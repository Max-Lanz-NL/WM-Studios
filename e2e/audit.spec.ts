import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3001";

test("old and malformed bags reconcile with stock and remain usable", async ({
  page,
  request,
}) => {
  const rows = await (
    await request.get("http://127.0.0.1:54329/rest/v1/catalog?select=body")
  ).json();
  const p = rows.find((r: any) => r.body.slug === "the-essential-tee").body;
  await page.addInitScript(
    ({ id, sku }) =>
      localStorage.setItem(
        "wm-bag",
        JSON.stringify([
          null,
          { productId: id, sku, quantity: 2 },
          { productId: id, sku, quantity: 20 },
          { productId: "missing", sku: "gone", quantity: 1 },
        ]),
      ),
    { id: p.id, sku: p.variants[0].sku },
  );
  await page.goto("/shop");
  await page.getByRole("button", { name: "Shopping bag", exact: true }).click();
  await expect(
    page.getByText(
      "Your bag was updated to match current availability. Please review the items and quantities.",
    ),
  ).toBeVisible();
  await expect(page.locator(".bag-line")).toHaveCount(1);
  await expect(page.locator(".quantity > span")).toHaveText("10");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Explore the collection ↗", exact: true }),
  ).toBeVisible();
});

test("menu to search moves keyboard focus into the new dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByLabel("Search by product name");
  await expect(search).toBeFocused();
  await search.fill("absent item");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No items found. Adjust your filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters ×" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unisex", exact: true }),
  ).toBeVisible();
});

test("a lost checkout response retries one order and recovers confirmation after reload", async ({
  page,
  request,
}) => {
  let firstKey = "",
    receipt: any;
  let attempts = 0;
  await page.route("**/api/store", async (route) => {
    const input = route.request().postDataJSON();
    if (input.action !== "checkout") return route.continue();
    attempts++;
    if (firstKey) expect(input.key).toBe(firstKey);
    else firstKey = input.key;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    receipt = await response.json();
    await route.abort("failed");
  });
  await page.goto("/products/the-essential-tee");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await page.getByRole("button", { name: "Continue to demo checkout" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Lost response demo");
  await page
    .getByLabel("Email", { exact: true })
    .fill("lost-response@example.invalid");
  await page.getByLabel("Street address").fill("Teststraat 1");
  await page.getByLabel("Postcode").fill("1000 AA");
  await page.getByLabel("City", { exact: true }).fill("Teststad");
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(
    page.getByText(/We could not confirm the connection/),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "lost-response@example.invalid",
  );
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect.poll(() => attempts).toBe(2);
  await expect(
    page.getByRole("button", { name: "Place demo order" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Thank you. Your demo order is confirmed.",
    }),
  ).toBeVisible();
  await expect(page.getByText(receipt.number, { exact: true })).toBeVisible();
  const recovered = await request.post("/api/store", {
    headers: { origin },
    data: { action: "checkout_status", key: firstKey },
  });
  expect((await recovered.json()).receipt).toEqual(receipt);
  await expect(page.locator(".bag-line")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue exploring", exact: true })
    .click();
  await page.getByRole("button", { name: "Shopping bag", exact: true }).click();
  await page
    .getByRole("button", { name: "View last demo confirmation ↗", exact: true })
    .click();
  await expect(page.getByText(receipt.number, { exact: true })).toBeVisible();
});

test("business and service content saves centrally and appears on customer pages", async ({
  page,
  request,
}) => {
  const rows = await (
    await request.get(
      "http://127.0.0.1:54329/rest/v1/content_settings?select=body",
    )
  ).json();
  const original = rows[0].body;
  await page.goto("/admin");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("e2e-owner@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-e2e-test-password-only");
  await page.getByRole("button", { name: "Open the studio" }).click();
  await page.getByRole("button", { name: "Releases", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Releases" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stock", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stock by variant" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Before real sales" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Website", exact: true }).click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Studio MW test fixture");
  await page
    .getByLabel("Customer service email", { exact: true })
    .fill("studio@example.invalid");
  await page
    .getByLabel("Delivery destinations, rates and times", { exact: true })
    .fill("Delivery fixture: test destinations only.");
  await page
    .getByLabel("Returns address, costs and procedure", { exact: true })
    .fill("Returns fixture: no real deliveries.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Homepage saved.", { exact: true }),
  ).toBeVisible();
  try {
    await page.screenshot({
      path: "test-results/service-editor.png",
      fullPage: true,
    });
    await page.goto("/info/contact");
    await expect(
      page.getByRole("link", { name: "studio@example.invalid ↗" }),
    ).toHaveAttribute("href", "mailto:studio@example.invalid");
    await expect(
      page.getByText("Studio MW test fixture", { exact: true }),
    ).toBeVisible();
    const olderClient = await page.request.post("/api/admin", {
      headers: { origin },
      data: {
        action: "home",
        content: { headline: original.headline, subtitle: original.subtitle },
      },
    });
    expect(olderClient.ok()).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("link", { name: "studio@example.invalid ↗" }),
    ).toBeVisible();
    await page.goto("/info/shipping");
    await expect(
      page.getByText("Delivery fixture: test destinations only.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/info/faq");
    await page.getByText("Can I place a real order?", { exact: true }).click();
    await expect(
      page.getByText(/Demo checkout takes no payment/),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/services-mobile.png",
      fullPage: true,
    });
  } finally {
    const restore = await page.request.post("/api/admin", {
      headers: { origin },
      data: {
        action: "home",
        content: { ...original, services: original.services || {} },
      },
    });
    expect(restore.ok()).toBe(true);
  }
});

test("every customer page has navigation and unknown pages offer a way back", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/shop",
    "/products/the-essential-tee",
    "/info/contact",
    "/info/shipping",
    "/info/faq",
    "/info/privacy",
    "/info/terms",
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/products/not-a-published-piece");
  await expect(
    page.getByRole("heading", { name: "Out of sight for a moment." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the collection ↗" }),
  ).toHaveAttribute("href", "/shop");
});

test("storage restrictions do not crash the bag", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "wm-bag" || key === "wm-wish")
        throw new DOMException("Storage disabled", "SecurityError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/products/the-essential-tee");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.locator(".bag-line")).toHaveCount(1);
  await expect(
    page.getByText(
      "Browser storage is unavailable. Your bag may not be saved when you leave this page.",
    ),
  ).toBeVisible();
});
