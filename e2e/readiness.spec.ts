import { test, expect } from "@playwright/test";

test("mobiele shop biedt zoeken, favorieten en kledinglijnen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { level: 1, name: "The collection" }),
  ).toBeVisible();
  await expect(page.getByLabel("Filter kledinglijn")).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Zoeken", exact: true }).click();
  await page.getByLabel("Zoek op productnaam").fill("Essential");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Bewaar The Essential Tee", exact: true })
    .click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Favorieten", exact: true }).click();
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
    page.getByRole("dialog", { name: "The Essential Tee" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "The Essential Tee" }),
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
  await page.getByLabel("Kleur", { exact: true }).selectOption("White");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByText("White / M", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Meer", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await page.getByRole("button", { name: "Winkelmand", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Meer", exact: true }),
  ).toBeDisabled();
});

test("Studio MW branding is consistent across store and admin", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText("WM Studio Collective");
  await page.goto("/shop");
  await expect(page).toHaveTitle("De collectie | Studio MW");
  await expect(
    page.getByRole("link", { name: "Studio MW home", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".store-header .brand-mark")).toBeVisible();
  await expect(page.getByText("WM STUDIO", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filter kledinglijn")).toContainText(
    "STUDIO MW",
  );
  await page.goto("/info/contact");
  await expect(page.locator("main")).toContainText("Studio MW wordt opgericht");
  await expect(page.locator(".brand-mark")).toBeVisible();
  await page.goto("/admin");
  await expect(page.locator(".brand-mark")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("WM STUDIO COLLECTIVE");
});
