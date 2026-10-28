import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { createChunks } from "@supabase/ssr";
const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const freshClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const origin = "http://127.0.0.1:3002";
const run = randomUUID();
const productIds: string[] = [];
const userIds: string[] = [];
const pool = new Pool({
  connectionString: process.env.WM_TEST_DATABASE_URL,
  max: 3,
});
function product(status = "published", releaseAt: string | null = null) {
  return {
    name: "Local acceptance " + randomUUID().slice(0, 8),
    slug: "local-" + randomUUID(),
    brand: "WM STUDIO",
    category: "T-shirts",
    gender: "Unisex",
    description: "Lokale Supabase-acceptatietest",
    price: 6500,
    status,
    releaseAt,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
    variants: [
      { size: "M", color: "Black", sku: "LOCAL-" + randomUUID(), stock: 3 },
    ],
  };
}
async function login(page: Page, person: "MAX" | "WILLEMIJN" = "MAX") {
  await page.goto("/admin");
  await page
    .getByLabel("E-mailadres", { exact: true })
    .fill(process.env[`LOCAL_${person}_EMAIL`]!);
  await page
    .getByLabel("Wachtwoord", { exact: true })
    .fill(process.env[`LOCAL_${person}_PASSWORD`]!);
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(
    page.getByRole("heading", { name: "A new day in the studio." }),
  ).toBeVisible();
}
async function ownerClient() {
  const c = freshClient();
  const { error } = await c.auth.signInWithPassword({
    email: process.env.LOCAL_MAX_EMAIL!,
    password: process.env.LOCAL_MAX_PASSWORD!,
  });
  expect(error).toBeNull();
  return c;
}
async function createProduct(
  c: Awaited<ReturnType<typeof ownerClient>>,
  input = product(),
) {
  const id = randomUUID();
  const { error } = await c.rpc("save_product", {
    payload: input,
    target_id: id,
    expected_version: null,
  });
  expect(error).toBeNull();
  productIds.push(id);
  return { ...input, id };
}
test.afterAll(async () => {
  for (const id of productIds)
    await service.from("products").update({ status: "archived" }).eq("id", id);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await pool.end();
});
test("echte persoonlijke logins, veilige cookies en uitloggen", async ({
  page,
  browser,
}) => {
  await login(page);
  const first = (await page.context().cookies()).filter((c) =>
    c.name.includes("auth-token"),
  );
  expect(first.length).toBeGreaterThan(0);
  expect(first.every((c) => c.httpOnly && c.sameSite === "Lax")).toBe(true);
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await login(other, "WILLEMIJN");
    const second = (await context.cookies()).filter((c) =>
      c.name.includes("auth-token"),
    );
    expect(second[0].value !== first[0].value).toBe(true);
    await page.getByRole("button", { name: "Uitloggen" }).click();
    await expect(
      page.getByRole("button", { name: "Open the studio" }),
    ).toBeVisible();
    await other.reload();
    await expect(
      other.getByRole("heading", { name: "A new day in the studio." }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
test("echte Data API dwingt RLS en rollen af ondanks vervalste gebruikersmetadata", async () => {
  const email = `outsider-${run}@wm-studio.test`,
    password = randomBytes(24).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "owner" },
  });
  expect(error).toBeNull();
  userIds.push(data.user!.id);
  const outsider = freshClient();
  expect(
    (await outsider.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  const orders = await outsider.from("order_overview").select("body");
  expect(orders.error).toBeNull();
  expect(orders.data).toEqual([]);
  expect(
    (
      await outsider.rpc("save_product", {
        payload: product(),
        target_id: randomUUID(),
        expected_version: null,
      })
    ).error?.message,
  ).toContain("FORBIDDEN");
  await service
    .from("staff_members")
    .insert({ user_id: data.user!.id, role: "designer", active: true });
  const p = await createProduct(outsider);
  expect(p.id).toBeTruthy();
  expect(
    (
      await outsider
        .from("staff_members")
        .update({ role: "owner" })
        .eq("user_id", data.user!.id)
    ).error,
  ).not.toBeNull();
  await service
    .from("staff_members")
    .update({ active: false })
    .eq("user_id", data.user!.id);
  expect(
    (
      await outsider.rpc("save_product", {
        payload: product(),
        target_id: randomUUID(),
        expected_version: null,
      })
    ).error?.message,
  ).toContain("FORBIDDEN");
});
test("echte Auth ververst een sessie en weigert een ingetrokken refresh-token", async () => {
  const c = await ownerClient();
  const before = (await c.auth.getSession()).data.session!;
  const refreshed = await c.auth.refreshSession();
  expect(refreshed.error).toBeNull();
  expect(refreshed.data.session?.refresh_token !== before.refresh_token).toBe(
    true,
  );
  const refreshToken = refreshed.data.session!.refresh_token;
  await c.auth.signOut({ scope: "local" });
  expect(
    (await freshClient().auth.refreshSession({ refresh_token: refreshToken }))
      .error,
  ).not.toBeNull();
});
test("SSR vernieuwt een verouderde sessiecookie via echte Auth", async ({
  page,
}) => {
  await login(page);
  const read = async () => {
    const chunks = (await page.context().cookies())
      .filter((c) => c.name.includes("auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));
    const raw = chunks.map((c) => c.value).join("");
    expect(raw.startsWith("base64-")).toBe(true);
    return {
      name: chunks[0].name.replace(/\.\d+$/, ""),
      session: JSON.parse(
        Buffer.from(raw.slice(7), "base64url").toString("utf8"),
      ),
    };
  };
  const before = await read();
  before.session.expires_at = Math.floor(Date.now() / 1000) - 30;
  const encoded =
    "base64-" +
    Buffer.from(JSON.stringify(before.session)).toString("base64url");
  await page.context().clearCookies();
  await page.context().addCookies(
    createChunks(before.name, encoded).map((c) => ({
      ...c,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
  const response = await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "A new day in the studio." }),
  ).toBeVisible();
  const after = await read();
  expect(after.session.refresh_token !== before.session.refresh_token).toBe(
    true,
  );
  expect(response?.headers()["cache-control"]).toContain("no-store");
});
test("webshop, echte checkout en orderverwerking op centrale PostgreSQL", async ({
  page,
}) => {
  const c = await ownerClient();
  const p = await createProduct(c);
  await page.goto("/products/" + p.slug);
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.getByRole("button", { name: "Naar demo-checkout" }).click();
  await page.getByLabel("Naam", { exact: true }).fill("Lokale Acceptatie");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("acceptance@wm-studio.test");
  await page.getByLabel("Straat en huisnummer").fill("Teststraat 1");
  await page.getByLabel("Postcode").fill("1000 AA");
  await page.getByLabel("Plaats", { exact: true }).fill("Teststad");
  await page.getByRole("button", { name: "Demo-order plaatsen" }).click();
  await expect(
    page.getByRole("heading", { name: "Bedankt. Je demo-order staat klaar." }),
  ).toBeVisible();
  await login(page);
  await page
    .getByRole("button", { name: "Bestellingen", exact: false })
    .first()
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Lokale Acceptatie" })
    .first();
  await row.getByRole("button", { name: "Open" }).click();
  await page.getByRole("button", { name: "Markeer als ingepakt" }).click();
  await expect(
    page.getByRole("button", { name: "Markeer als verzonden (demo)" }),
  ).toBeVisible();
  const stock = await service
    .from("catalog")
    .select("body")
    .eq("id", p.id)
    .single();
  expect(stock.data?.body.variants[0].stock).toBe(2);
});
test("database-Cron publiceert zonder browser en geeft verlopen reserveringen vrij", async () => {
  const c = await ownerClient();
  const p = await createProduct(
    c,
    product("scheduled", new Date(Date.now() + 3000).toISOString()),
  );
  const live = await createProduct(c);
  const payload = {
    key: randomUUID(),
    email: "reserved@wm-studio.test",
    name: "Reserved Test",
    address: "Teststraat 1, Teststad",
    items: [{ productId: live.id, sku: live.variants[0].sku, quantity: 1 }],
  };
  const { data, error } = await service.rpc("checkout_staging", {
    payload,
    reserve_only: true,
  });
  expect(error).toBeNull();
  await pool.query(
    "update orders set expires_at=now()-interval '1 minute' where id=$1",
    [data.id],
  );
  await expect
    .poll(
      async () => {
        const r = await service
          .from("products")
          .select("status")
          .eq("id", p.id)
          .single();
        return r.data?.status;
      },
      { timeout: 95000, intervals: [2000, 5000] },
    )
    .toBe("published");
  await expect
    .poll(
      async () => {
        const r = await service
          .from("orders")
          .select("payment_status")
          .eq("id", data.id)
          .single();
        return r.data?.payment_status;
      },
      { timeout: 20000, intervals: [1000] },
    )
    .toBe("expired");
  const jobs = await pool.query(
    "select d.status from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='wm-commerce-maintenance' order by d.start_time desc limit 1",
  );
  expect(jobs.rows[0]?.status).toBe("succeeded");
});
