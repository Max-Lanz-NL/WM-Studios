import { test, expect } from "@playwright/test";

test("mobiele shop biedt zoeken, favorieten en kledinglijnen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { level: 1, name: "The collection" }),
  ).toBeVisible();
  await expect(page.getByLabel("Filter clothing line")).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Search by product name").fill("Essential");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Save The Essential Tee", exact: true })
    .click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your favourites" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("productlinks zijn deelbaar en shopverwijzingen bereiken de homepage", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("link", { name: "Our story", exact: true }).first(),
  ).toHaveAttribute("href", "/#story");
  await expect(
    page.getByRole("link", { name: "The collective", exact: true }).first(),
  ).toHaveAttribute("href", "/#brands");
  await page
    .getByRole("link", { name: "The Essential Tee", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/products\/the-essential-tee$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Essential Tee" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "The Essential Tee" }),
  ).toBeVisible();
});

test("kleurkeuze en voorraad begrenzen de winkelmand voor checkout", async ({
  page,
  request,
}) => {
  const origin = "http://127.0.0.1:3001";
  const login = await request.post("/api/admin", {
    headers: { origin },
    data: {
      action: "login",
      email: "e2e-owner@example.invalid",
      password: "local-e2e-test-password-only",
    },
  });
  expect(login.ok()).toBe(true);
  const token = Date.now();
  const created = await request.post("/api/admin", {
    headers: { origin },
    data: {
      action: "product",
      product: {
        name: "Colour stock check",
        slug: `colour-stock-${token}`,
        brand: "FORM",
        category: "T-shirts",
        gender: "Unisex",
        description: "Fixture",
        price: 4500,
        status: "published",
        releaseAt: null,
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
        variants: [
          { size: "M", color: "Black", sku: `BLACK-${token}`, stock: 2 },
          { size: "M", color: "White", sku: `WHITE-${token}`, stock: 1 },
        ],
      },
    },
  });
  expect(created.ok()).toBe(true);
  const product = await created.json();
  await page.goto(`/products/${product.slug}`);
  await page.getByLabel("Colour", { exact: true }).selectOption("White");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByText("White / M", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Increase quantity", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Shopping bag", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Increase quantity", exact: true }),
  ).toBeDisabled();
});

test("Studio MW branding is consistent across store and admin", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText("WM Studio Collective");
  await page.goto("/shop");
  await expect(page).toHaveTitle("The collection | Studio MW");
  await expect(
    page.getByRole("link", { name: "Studio MW home", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".store-header .brand-mark")).toBeVisible();
  await expect(page.getByText("WM STUDIO", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filter clothing line")).toContainText(
    "STUDIO MW",
  );
  await page.goto("/info/contact");
  await expect(page.locator("main")).toContainText(
    "Studio MW is being founded",
  );
  await expect(page.locator(".brand-mark")).toBeVisible();
  await page.goto("/admin");
  await expect(page.locator(".brand-mark")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("WM STUDIO COLLECTIVE");
});

test("store forms, information pages and login errors use English", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByText("Free shipping from €150", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Shopping bag", exact: true }).click();
  await expect(
    page.getByText("Your bag is waiting for something special."),
  ).toBeVisible();
  await page.goto("/info/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy & cookies — draft" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "Test orders and waitlist entries are stored centrally",
  );
  await page.goto("/admin");
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  const denied = await request.post("/api/admin", {
    headers: { origin: "http://127.0.0.1:3001" },
    data: {
      action: "login",
      email: "nobody@example.invalid",
      password: "not-a-valid-password",
    },
  });
  expect(denied.status()).toBe(401);
  expect((await denied.json()).error).toBe(
    "Sign-in failed. Check your details.",
  );
});

test("size feedback clears after success and bag controls are easy to tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/the-essential-tee");
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(
    page.getByText("Please select your size first.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(
    page.getByRole("dialog", { name: "Shopping bag" }),
  ).toBeVisible();
  await expect(
    page.getByText("Please select your size first.", { exact: true }),
  ).toHaveCount(0);
  for (const name of ["Decrease quantity", "Increase quantity"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("products come before the brand story and empty upcoming releases disappear", async ({
  page,
  request,
}) => {
  await page.goto("/");
  expect(
    await page
      .locator("#collection")
      .evaluate(
        (el) =>
          !!(
            el.compareDocumentPosition(document.querySelector(".manifesto")!) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
  ).toBe(true);
  await expect(page.locator(".drop-section")).toBeVisible();
  const catalog = await request.get(
    "http://127.0.0.1:54329/rest/v1/catalog?select=body",
  );
  const rows = await catalog.json();
  const original = rows.find(
    (r: { body: { slug: string } }) => r.body.slug === "off-duty-hoodie",
  ).body;
  const origin = "http://127.0.0.1:3001";
  const login = await request.post("/api/admin", {
    headers: { origin },
    data: {
      action: "login",
      email: "e2e-owner@example.invalid",
      password: "local-e2e-test-password-only",
    },
  });
  expect(login.ok()).toBe(true);
  const publish = await request.post("/api/admin", {
    headers: { origin },
    data: {
      action: "product",
      id: original.id,
      product: { ...original, status: "published", releaseAt: null },
    },
  });
  expect(publish.ok()).toBe(true);
  const published = await publish.json();
  try {
    await page.reload();
    await expect(page.locator(".drop-section")).toHaveCount(0);
    await expect(page.locator(".product-grid")).not.toContainText("colour(s)");
  } finally {
    const restore = await request.post("/api/admin", {
      headers: { origin },
      data: {
        action: "product",
        id: original.id,
        product: {
          ...original,
          releaseAt: new Date(original.releaseAt).toISOString(),
          version: published.version,
        },
      },
    });
    expect(restore.ok()).toBe(true);
  }
});

test("product page has usable photographs, sizing and stable bag navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/the-essential-tee");
  await expect(page).toHaveTitle("The Essential Tee | Studio MW");
  await expect(
    page.getByRole("heading", { level: 1, name: "The Essential Tee" }),
  ).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "View photograph 2: Test fixture reverse view",
    })
    .click();
  await expect(page.locator(".active-product-photo")).toHaveAttribute(
    "alt",
    "Test fixture reverse view",
  );
  await page.getByText("Size guide", { exact: true }).click();
  await expect(
    page.getByText("Test fixture measurements: M — chest 104 cm"),
  ).toBeVisible();
  await page.getByText("Details & care", { exact: true }).click();
  await expect(page.getByText("Test fixture cotton composition")).toBeVisible();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Shopping bag" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { level: 1, name: "The Essential Tee" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/product-page-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Off Duty Hoodie", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Off Duty Hoodie" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "The Essential Tee" }),
  ).toHaveCount(0);
});

test("collection sorting keeps prices in order and favourites expose selection", async ({
  page,
}) => {
  await page.goto("/shop");
  await page.getByLabel("Sort products").selectOption("price-high");
  const prices = await page.locator(".product-meta > b").allTextContents();
  const numeric = prices.map((p) => Number(p.replace(/[^0-9.]/g, "")));
  expect(numeric).toEqual([...numeric].sort((a, b) => b - a));
  const save = page.getByRole("button", {
    name: "Save The Essential Tee",
    exact: true,
  });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
});
