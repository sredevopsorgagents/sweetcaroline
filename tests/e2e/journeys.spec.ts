import { expect, test } from '@playwright/test';

const MAIN_ROUTES = [
  { path: '/', heading: /pastelería para deleitarte/i },
  { path: '/nosotros/', heading: /la pastelería/i },
  { path: '/productos/', heading: /^productos$/i },
  { path: '/en-cafeteria/', heading: /en cafetería/i },
  { path: '/galeria-de-fotos/', heading: /galería de fotos/i },
  { path: '/contacto/', heading: /^contacto$/i },
];

test.describe('critical journeys', () => {
  test('home page loads with the hero and a working WhatsApp CTA', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/pastelería para deleitarte/i);

    const whatsapp = page.getByRole('link', { name: /pedir por whatsapp/i }).first();
    await expect(whatsapp).toHaveAttribute('href', 'https://wa.me/56996906461?text=Hola%2C%20quisiera%20hacer%20un%20pedido.');
  });

  test('browses from the products index into a category and a product detail', async ({ page }) => {
    await page.goto('/productos/');

    await page.getByRole('link', { name: /tortas/i }).first().click();
    await expect(page).toHaveURL(/\/productos\/categoria\/tortas\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/tortas/i);

    // 23 tortas in the imported catalog.
    await expect(page.locator('main ul li a[href^="/producto/"]')).toHaveCount(23);

    await page.locator('main ul li a[href^="/producto/"]').first().click();
    await expect(page).toHaveURL(/\/producto\/[\w-]+\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /consultar por whatsapp/i })).toBeVisible();
  });

  test('shows both published opening-hours ranges on the contact page', async ({ page }) => {
    await page.goto('/contacto/');

    await expect(page.getByText(/viernes a domingo, 16\.30 a 21\.30/i).first()).toBeVisible();
    await expect(page.getByText(/lunes a domingo, 10\.00 a 20\.00/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /ver en google maps/i }).first()).toHaveAttribute(
      'href',
      'https://maps.sweetcaroline.cl',
    );
  });

  test('keeps the legacy gallery URL working', async ({ page }) => {
    await page.goto('/galeria-de-fotos/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/galería de fotos/i);
    await expect(page.locator('main img').first()).toBeVisible();
  });

  test('a legacy stub declares its canonical target', async ({ request }) => {
    const response = await request.get('/nuestros-productos/productos/confites/macarons-de-chocolate/');
    expect(response.status()).toBe(200);

    const body = await response.text();
    const target = 'https://sweetcaroline.cl/producto/macarons-de-chocolate/';

    expect(body).toContain('http-equiv="refresh"');
    expect(body).toContain(`url=${target}`);
    expect(body).toContain(`rel="canonical" href="${target}"`);
    // Stubs must not compete with the real page in search results.
    expect(body).toContain('noindex, follow');
  });

  test('the redirect target actually exists', async ({ request }) => {
    const response = await request.get('/producto/macarons-de-chocolate/');
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/Macarons/i);
  });

  test('renders a 404 page for an unknown path', async ({ page }) => {
    const response = await page.goto('/esta-pagina-no-existe/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/no encontrada/i);
  });
});

test.describe('navigation', () => {
  for (const route of MAIN_ROUTES) {
    test(`${route.path} renders its heading`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(route.heading);
    });
  }

  test('mobile menu opens, closes on Escape and returns focus', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only behaviour');

    await page.goto('/');
    const toggle = page.getByRole('button', { name: /menú/i });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: /móvil/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  /**
   * Regression guard for the first GitHub Pages deploy, which shipped every
   * asset and internal link as a root-absolute path while the site was served
   * from `/sweetcaroline/`, so all of them 404'd. This follows the links a
   * visitor actually clicks and asserts they land on real pages.
   */
  test('every header nav link resolves to a real page', async ({ page, isMobile }) => {
    await page.goto('/');

    // The header renders two navs and hides one per breakpoint; open the mobile
    // menu so its links are reachable on a phone viewport.
    const name = isMobile ? /navegación principal móvil/i : /navegación principal$/i;
    if (isMobile) {
      await page.getByRole('button', { name: /menú/i }).click();
    }
    const nav = page.getByRole('navigation', { name });

    const hrefs = await nav.getByRole('link').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThan(3);

    for (const href of hrefs) {
      const response = await page.request.get(href);
      expect(response.status(), `nav link ${href} should resolve`).toBe(200);

      const body = await response.text();
      // A styled page links its stylesheet; an unstyled 404 shell does not.
      expect(body, `nav link ${href} should be a real page`).toContain('<h1');
    }
  });

  test('the cafeteria section links to the URL it is published at', async ({ page }) => {
    // The section is published at `/en-cafeteria/`; a link to a slug-derived
    // `/cafeteria/` would be a dead end.
    await page.goto('/productos/categoria/tortas/');

    const response = await page.request.get('/en-cafeteria/categoria/tartas/');
    expect(response.status()).toBe(200);
    await expect(page.locator('a[href$="/cafeteria/"]')).toHaveCount(0);
  });
});

test.describe('layout integrity', () => {
  for (const route of MAIN_ROUTES) {
    test(`${route.path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(route.path);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });
      // Allow a single pixel for sub-pixel rounding.
      expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(1);
    });
  }
});
