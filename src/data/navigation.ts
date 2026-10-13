/**
 * Site navigation. Authored rather than imported: the order, wording and
 * grouping of the menu are design decisions, not content.
 */
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/nosotros/', label: 'Nosotros' },
  { href: '/productos/', label: 'Productos' },
  { href: '/en-cafeteria/', label: 'En cafetería' },
  { href: '/galeria-de-fotos/', label: 'Galería de fotos' },
  { href: '/contacto/', label: 'Contacto' },
];

/** Display sections, in menu order. */
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
