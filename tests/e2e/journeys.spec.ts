import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// This spec is an ES module, so `__dirname` does not exist; resolve the data
// directory from `import.meta.url` instead.
const INSTAGRAM_FEED = new URL('../../src/data/instagram.json', import.meta.url);

const MAIN_ROUTES = [
  { path: '/', heading: /instagram/i },
  { path: '/nosotros/', heading: /la pastelería/i },
  { path: '/contacto/', heading: /^contacto$/i },
];

/** Routes deleted with the catalog redesign; nothing may serve them. */
const RETIRED_ROUTES = ['/productos/', '/en-cafeteria/', '/galeria-de-fotos/'];

test.describe('critical journeys', () => {
  test('home page is the Instagram feed with a working profile link', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/sweet caroline en instagram/i);

    // The link to the profile is the one part of the feed that works without
    // Instagram's script.
    const profile = page.getByRole('link', { name: /ver el perfil en instagram/i }).first();
    await expect(profile).toHaveAttribute(
      'href',
      'https://www.instagram.com/sweetcarolinechile/',
    );
  });

  test('every post has an embed, and a link that works without Instagram', async ({ page }) => {
    const feed = JSON.parse(readFileSync(INSTAGRAM_FEED, 'utf8')) as {
      posts: string[];
      guestPosts: string[];
    };
    const expected = feed.posts.length + feed.guestPosts.length;

    // `embed.js` *replaces* each blockquote with a cross-origin iframe, so the
    // markup count is the pre-script state. Blocking Instagram exercises the
    // path a visitor with a blocker or a down service gets: one blockquote and
    // one working link per post.
    await page.route(/instagram\.com/, (route) => route.abort());
    await page.goto('/');

    await expect(page.locator('main blockquote.instagram-media')).toHaveCount(expected);

    const links = page.locator('main blockquote.instagram-media a[href*="instagram.com"]');
    await expect(links).toHaveCount(expected);
    const hrefs = await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('href') ?? ''),
    );
    expect(hrefs).toEqual([...feed.posts, ...feed.guestPosts]);
  });

  test('every post keeps a visible link once Instagram rewrites the embeds', async ({ page }) => {
    // `embed.js` deletes each blockquote it converts, and Instagram can answer
    // its embed endpoint with `x-frame-options: DENY`, leaving an empty 2px
    // frame. The per-post link lives outside the blockquote for exactly that
    // case: no post may become unreachable.
    const feed = JSON.parse(readFileSync(INSTAGRAM_FEED, 'utf8')) as {
      posts: string[];
      guestPosts: string[];
    };
    const expected = [...feed.posts, ...feed.guestPosts];

    await page.goto('/');
    // Allow the embed script to run and rewrite the list, or to fail trying.
    await page.waitForTimeout(3000);

    const visible = await page
      .locator('main a[href^="https://www.instagram.com/"]')
      .evaluateAll((anchors) =>
        anchors
          .filter((anchor) => (anchor as HTMLElement).offsetParent !== null)
          .map((anchor) => anchor.getAttribute('href') ?? ''),
      );

    for (const url of expected) {
      expect(visible, `${url} should stay reachable`).toContain(url);
    }
  });

  test('the embeds do not overflow the page when Instagram loads', async ({ page }) => {
    // Instagram styles its frame `position: absolute; width: 100%;`. Without a
    // positioned wrapper that 100% resolves against the viewport and the page
    // scrolls sideways on a phone.
    await page.goto('/', { waitUntil: 'networkidle' });

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(1);
  });

  test('labels a post published by another account', async ({ page }) => {
    // Instagram replaces the blockquote with an iframe, so keep the markup the
    // label sits next to by blocking the embed script.
    await page.route(/instagram\.com/, (route) => route.abort());
    await page.goto('/');

    // A guest post must be attributed, or the homepage implies it is ours.
    const feed = JSON.parse(
      readFileSync(INSTAGRAM_FEED, 'utf8'),
    ) as { guestPosts: string[] };
    for (const url of feed.guestPosts) {
      const account = /instagram\.com\/([A-Za-z0-9._]+)\/(?:p|reel)\//.exec(url)?.[1];
      expect(account, `${url} should name its account`).toBeTruthy();
      await expect(page.getByRole('link', { name: `@${account}` })).toBeVisible();
    }
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

  test('does not serve the retired sections', async ({ request }) => {
    for (const route of RETIRED_ROUTES) {
      const response = await request.get(route);
      expect(response.status(), `${route} should be gone`).toBe(404);
    }
  });

  test('a legacy stub declares its canonical target', async ({ request }) => {
    const response = await request.get('/nuestros-productos/productos/confites/macarons-de-chocolate/');
    expect(response.status()).toBe(200);

    const body = await response.text();
    // Retired product pages redirect to the homepage, which is where the
    // Instagram feed and the contact details live.
    const target = 'https://sweetcaroline.cl/';

    expect(body).toContain('http-equiv="refresh"');
    expect(body).toContain(`url=${target}`);
    expect(body).toContain(`rel="canonical" href="${target}"`);
    // Stubs must not compete with the real page in search results. While the
    // preview is unlisted the stub is blocked outright (`noindex, nofollow`);
    // an indexing-enabled build relaxes only the follow half.
    expect(body).toMatch(/<meta name="robots" content="noindex[^"]*">/);
  });

  test('the redirect target actually exists', async ({ request }) => {
    // The stub redirects to the absolute production URL, so a local preview
    // server must not follow it. Assert the redirect contract on the markup and
    // resolve the target separately instead.
    const stub = await request.get('/galeria/');
    expect(stub.status()).toBe(200);

    const body = await stub.text();
    expect(body).toContain('url=https://sweetcaroline.cl/');

    // The in-page link is base-aware, so it works where the meta refresh to the
    // absolute URL might not.
    const href = /<a href="([^"]+)">Ir a la nueva dirección/.exec(body)?.[1] ?? '';
    expect(href).toMatch(/^\/(sweetcaroline\/)?$/);

    // The target itself is a real page, not the 404 shell.
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<h1');
  });

  test('every published page carries a noindex directive', async ({ page, request }) => {
    // The preview is public but must stay unlisted. robots.txt is advisory, so
    // the per-page directive is the load-bearing one; assert it end-to-end.
    for (const route of MAIN_ROUTES.map((r) => r.path)) {
      await page.goto(route);
      const content = await page
        .locator('meta[name="robots"]')
        .getAttribute('content');
      expect(content, `${route} should be noindex`).toContain('noindex');
    }

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toMatch(/User-agent: \*\s*\nDisallow: \//);
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
    // Nosotros and Contacto; the logo is the link home.
    expect(hrefs.length).toBeGreaterThan(1);

    for (const href of hrefs) {
      const response = await page.request.get(href);
      expect(response.status(), `nav link ${href} should resolve`).toBe(200);

      const body = await response.text();
      // A styled page links its stylesheet; an unstyled 404 shell does not.
      expect(body, `nav link ${href} should be a real page`).toContain('<h1');
    }
  });

  test('the navigation offers only the two remaining sections', async ({ page, isMobile }) => {
    await page.goto('/');

    const name = isMobile ? /navegación principal móvil/i : /navegación principal$/i;
    if (isMobile) {
      await page.getByRole('button', { name: /menú/i }).click();
    }
    const nav = page.getByRole('navigation', { name });

    const labels = await nav.getByRole('link').allInnerTexts();
    expect(labels.map((label) => label.trim().toUpperCase())).toEqual(['NOSOTROS', 'CONTACTO']);
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
