/**
 * Site navigation. Authored rather than imported: the order, wording and
 * grouping of the menu are design decisions, not content.
 *
 * NOTE ON BASE PATHS: Astro rewrites `<img src>` and bundled asset URLs for a
 * non-root `base` automatically, but it does NOT rewrite plain string
 * `href="/foo/"` attributes. On a GitHub Pages project site every such link
 * points above the deployed root and 404s. Build every internal URL with
 * `withBase()` (or the `*Href` helpers below) instead of writing a bare path.
 */
export interface NavLink {
  href: string;
  label: string;
}

/** Prefix an internal path with Astro's configured base. */
export function withBase(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

/** Navigation entries, in menu order. Paths are base-less; render through `withBase`. */
export const NAV_LINKS: NavLink[] = [
  { href: '/nosotros/', label: 'Nosotros' },
  { href: '/productos/', label: 'Productos' },
  { href: '/en-cafeteria/', label: 'En cafetería' },
  { href: '/galeria-de-fotos/', label: 'Galería de fotos' },
  { href: '/contacto/', label: 'Contacto' },
];

/** `NAV_LINKS` with the deployment base applied, ready to use in markup. */
export function navLinks(): NavLink[] {
  return NAV_LINKS.map((link) => ({ ...link, href: withBase(link.href) }));
}

/**
 * Display sections, in menu order.
 *
 * `slug` is the value stored in product frontmatter (`sections: ["cafeteria"]`)
 * and used as the map key for section views — it is a data identifier.
 * `href` is the public URL, which is a separate concern and does not have to
 * match the slug: the cafeteria section lives at `/en-cafeteria/`.
 *
 * These were once conflated, and the category route was built by interpolating
 * the slug into the URL, which emitted `/cafeteria/categoria/...` — pages
 * nothing linked to — while the nav's `/en-cafeteria/...` 404'd. Always build
 * URLs from `href`; `basePath()` below is the single place that does it.
 */
export type SectionSlug = 'productos' | 'cafeteria';

export interface Section {
  slug: SectionSlug;
  title: string;
  href: string;
  tagline: string;
  description: string;
}

export const SECTIONS: Section[] = [
  {
    slug: 'productos',
    title: 'Productos',
    href: '/productos/',
    tagline: 'Pastelería fina y chocolatería',
    description:
      'Tortas a pedido, tartas, pasteles y confites elaborados a mano en nuestro taller de San Joaquín.',
  },
  {
    slug: 'cafeteria',
    title: 'En cafetería',
    href: '/en-cafeteria/',
    tagline: 'Tienda y terraza',
    description:
      'Café de grano, pastelería por trozo y bebestibles para disfrutar en nuestra terraza o para llevar.',
  },
];

/**
 * The public path prefix for a section, e.g. `/en-cafeteria/`, with the
 * deployment base applied. For `getStaticPaths` params use `sectionSegment`.
 */
export function sectionHref(slug: SectionSlug): string {
  return withBase(sectionPath(slug));
}

/** The base-less section path, e.g. `/en-cafeteria/`. */
export function sectionPath(slug: SectionSlug): string {
  const section = SECTIONS.find((entry) => entry.slug === slug);
  if (!section) throw new Error(`Unknown section slug "${slug}"`);
  return section.href;
}

/**
 * The bare URL segment for a section, e.g. `en-cafeteria`. Astro prepends the
 * deployment base to `getStaticPaths` params itself, so they must not carry it.
 */
export function sectionSegment(slug: SectionSlug): string {
  return sectionPath(slug).replace(/^\/|\/$/g, '');
}

/**
 * Build a base-less child route under a section, e.g.
 * `/en-cafeteria/categoria/tartas/`.
 *
 * Use this for breadcrumb trails and `getStaticPaths` params, which are
 * base-less by contract. Use `sectionRoute` for values rendered straight into
 * markup.
 */
export function sectionPathRoute(slug: SectionSlug, ...segments: string[]): string {
  const root = sectionPath(slug).replace(/\/$/, '');
  const tail = segments.map((segment) => segment.replace(/^\/|\/$/g, '')).filter(Boolean);
  return tail.length ? `${root}/${tail.join('/')}/` : `${root}/`;
}

/** Build a child route under a section, e.g. `/en-cafeteria/categoria/tartas/`. */
export function sectionRoute(slug: SectionSlug, ...segments: string[]): string {
  return withBase(sectionPathRoute(slug, ...segments));
}

/** The product detail route for a product slug, e.g. `/producto/red-velvet/`. */
export function productHref(productId: string): string {
  return withBase(`/producto/${productId}/`);
}
