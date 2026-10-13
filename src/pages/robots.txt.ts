/**
 * robots.txt as an endpoint rather than a static file.
 *
 * The sitemap URL has to track the deployed location: a static file cannot know
 * whether this build is the apex site or a project-page preview, and pointing
 * crawlers at the wrong URL is worse than saying nothing. Deriving it from
 * `Astro.site` + the configured base keeps it correct on both without
 * branching.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  // `new URL('sitemap-index.xml', site)` would resolve against the host root
  // and drop the base, so a project-page deploy would advertise the wrong
  // sitemap. Join the base path explicitly instead.
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const origin = site ?? new URL('https://sweetcaroline.cl/');
  const sitemap = new URL(`${base}/sitemap-index.xml`, origin.origin);

  const body = `User-agent: *
Allow: /

# El sitio no tiene rutas privadas ni de administración.
Sitemap: ${sitemap.href}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
