import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:3001";
test("gelijktijdige kopers kunnen het laatste artikel niet dubbel kopen", async ({
  request,
}) => {
  const headers = { origin };
  const login = await request.post("/api/admin", {
    headers,
    data: { action: "login", password: "local-e2e-test-password-only" },
  });
  expect(login.ok()).toBe(true);
  const token = Date.now();
  const created = await request.post("/api/admin", {
    headers,
    data: {
      action: "product",
      product: {
        name: "Concurrent test",
        slug: `concurrent-${token}`,
        brand: "WM STUDIO",
        category: "T-shirts",
        gender: "Unisex",
        description: "Demo",
        price: 6500,
        status: "published",
        releaseAt: null,
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
        variants: [
          { size: "M", color: "Black", sku: `CONCURRENT-${token}`, stock: 1 },
        ],
      },
    },
  });
  expect(created.ok()).toBe(true);
  const p = await created.json();
  const body = {
    action: "checkout",
    email: "concurrent@example.invalid",
    name: "Demo Buyer",
    address: "Teststraat 1, Teststad",
    price: 1,
    items: [{ productId: p.id, sku: p.variants[0].sku, quantity: 1, price: 1 }],
  };
  const results = await Promise.all([
    request.post("/api/store", {
      headers,
      data: { ...body, key: randomUUID() },
    }),
    request.post("/api/store", {
      headers,
      data: { ...body, key: randomUUID() },
    }),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([200, 400]);
  const successful = results.find((r) => r.ok())!;
  expect((await successful.json()).total).toBe(6995);
  const archived = await request.post("/api/admin", {
    headers,
    data: {
      action: "product",
      id: p.id,
      product: {
        ...p,
        status: "archived",
        variants: p.variants.map((v: { stock: number }) => ({
          ...v,
          stock: 0,
        })),
      },
    },
  });
  expect(archived.ok()).toBe(true);
});
test("beveiliging: beheer geweigerd zonder sessie en vreemde herkomst geblokkeerd", async ({
  request,
}) => {
  const denied = await request.post("/api/admin", {
    headers: { origin },
    data: { action: "home", content: { headline: "Hacked", subtitle: "" } },
  });
  expect(denied.status()).toBe(401);
  const csrf = await request.post("/api/store", {
    headers: { origin: "https://evil.invalid" },
    data: { action: "checkout" },
  });
  expect(csrf.status()).toBe(400);
  const invalid = await request.post("/api/store", {
    headers: { origin },
    data: { action: "checkout", items: [] },
  });
  expect(invalid.status()).toBe(400);
});
test("klant plaatst demo-order en beheerder verwerkt deze", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Made for your everyday extraordinary.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "The Essential Tee", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("heading", { name: "Your bag" })).toBeVisible();
  await page.getByRole("button", { name: "Naar demo-checkout" }).click();
  await page.getByLabel("Naam", { exact: true }).fill("Demo Klant");
  await page.getByLabel("E-mail", { exact: true }).fill("demo@example.invalid");
  await page.getByLabel("Straat en huisnummer").fill("Teststraat 1");
  await page.getByLabel("Postcode").fill("1000 AA");
  await page.getByLabel("Plaats", { exact: true }).fill("Teststad");
  await page.getByRole("button", { name: "Demo-order plaatsen" }).click();
  await expect(
    page.getByRole("heading", { name: "Bedankt. Je demo-order staat klaar." }),
  ).toBeVisible();
  await page.goto("/admin");
  await page
    .getByLabel("Beheerwachtwoord")
    .fill("local-e2e-test-password-only");
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(
    page.getByRole("heading", { name: "A new day in the studio." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bestellingen", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Open ↗" }).first().click();
  await page.getByRole("button", { name: "Markeer als ingepakt" }).click();
  await expect(
    page.getByRole("button", { name: "Markeer als verzonden (demo)" }),
  ).toBeVisible();
});
test("producteditor slaat een nieuw concept op", async ({ page }) => {
  await page.goto("/admin");
  await page
    .getByLabel("Beheerwachtwoord")
    .fill("local-e2e-test-password-only");
  await page.getByRole("button", { name: "Open the studio" }).click();
  await page.getByRole("button", { name: "Nieuw product" }).click();
  await page
    .getByLabel("Productnaam", { exact: true })
    .fill("Test Studio " + Date.now());
  for (let i = 1; i <= 3; i++)
    await page
      .getByLabel(`sku variant ${i}`, { exact: true })
      .fill(`TEST-${Date.now()}-${i}`);
  await page.getByRole("button", { name: "Product opslaan" }).click();
  await expect(
    page.getByText("Product opgeslagen.", { exact: true }),
  ).toBeVisible();
});
test("mobiele webshop blijft binnen het scherm", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("desktop preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".store-header")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .locator('img[loading="lazy"]')
    .evaluateAll((images) =>
      images.forEach((img) => img.setAttribute("loading", "eager")),
    );
  await page.waitForFunction(() =>
    Array.from(document.images).every((img) => img.complete),
  );
  await page.screenshot({
    path: "test-results/storefront.png",
    fullPage: true,
  });
  await page.goto("/admin");
  await page
    .getByLabel("Beheerwachtwoord")
    .fill("local-e2e-test-password-only");
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(
    page.getByRole("heading", { name: "A new day in the studio." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
});
