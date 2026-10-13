import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// `SITE_URL` / `BASE_PATH` let one config serve both the project-page preview
// (https://<owner>.github.io/sweetcaroline-poc) and the apex domain
// (https://sweetcaroline.cl) without touching source.
const site = process.env.SITE_URL ?? 'https://sweetcaroline.cl';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Inline small stylesheets rather than emitting a render-blocking request.
    inlineStylesheets: 'auto',
  },
  image: {
    // sharp is a direct dependency; make the service explicit.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  integrations: [
    sitemap({
      // The legacy redirect stubs written by scripts/emit-redirects.mjs carry
      // `noindex, follow`; listing them would contradict that.
      filter: (page) => !page.includes('/nuestros-productos/') && !page.endsWith('/galeria/'),
    }),
  ],
  // Poppins is the existing brand typeface (the WordPress theme loads it from
  // Google Fonts at runtime). Astro downloads and self-hosts it at build time,
  // which removes a render-blocking third-party request and keeps visitor data
  // away from Google.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Poppins',
      cssVariable: '--font-poppins',
      weights: [400, 600, 700, 800],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
