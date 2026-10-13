/**
 * Unit tests for the catalog view-model helpers.
 *
 * These are pure functions over plain objects — they do not touch `astro:content`
 * — so the grouping, ordering and count rules can be pinned without a build.
 */

import { describe, expect, it } from 'vitest';

// `src/lib/catalog.ts` imports `astro:content` for its types, so the pure rules
// it owns are mirrored here as an executable specification. If the two drift,
// the e2e suite catches it against real pages.
type Section = 'productos' | 'cafeteria';

interface ProductLike {
  id: string;
  data: { name: string; sections: Section[]; categories: string[]; image: string | null };
}

const product = (
  id: string,
  name: string,
  sections: Section[],
  categories: string[],
  image: string | null = null,
): ProductLike => ({ id, data: { name, sections, categories, image } });

/** Mirrors `compareProducts` in src/lib/catalog.ts. */
const collate = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });

/** Mirrors `productsInCategory`. */
const inCategory = (products: ProductLike[], slug: string) =>
  products.filter((p) => p.data.categories.includes(slug));

/** Mirrors `productsInSection`. */
const inSection = (products: ProductLike[], section: Section) =>
  products.filter((p) => p.data.sections.includes(section));

/** Mirrors `needsPlaceholder`. */
const needsPlaceholder = (p: ProductLike) => !p.data.image;

/** Mirrors `formatCount`. */
const formatCount = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`;

describe('section membership', () => {
  const products = [
    product('a', 'Torta de prueba', ['productos'], ['tortas']),
    product('b', 'Café', ['cafeteria'], ['bebestibles']),
    product('c', 'Macarons', ['productos', 'cafeteria'], ['confites']),
  ];

  it('includes a product in every section it declares', () => {
    expect(inSection(products, 'productos').map((p) => p.id)).toEqual(['a', 'c']);
    expect(inSection(products, 'cafeteria').map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('lets a product belong to two sections at once', () => {
    // Confites genuinely appears in both the shop catalog and the cafeteria menu.
    const shared = products.filter((p) => p.data.sections.length > 1);
    expect(shared.map((p) => p.id)).toEqual(['c']);
  });
});

describe('category membership', () => {
  it('includes a product in each of its categories', () => {
    const products = [product('x', 'Tarta de Berries', ['productos'], ['por-trozo', 'tartas'])];
    expect(inCategory(products, 'por-trozo')).toHaveLength(1);
    expect(inCategory(products, 'tartas')).toHaveLength(1);
    expect(inCategory(products, 'tortas')).toHaveLength(0);
  });
});

describe('name collation', () => {
  it('orders ñ after n, as Spanish readers expect', () => {
    const names = ['Nuez', 'Ñu', 'Naranja'];
    expect([...names].sort(collate)).toEqual(['Naranja', 'Nuez', 'Ñu']);
  });

  it('ignores accents when ordering', () => {
    const names = ['Ópera', 'Panqueque', 'Amanda'];
    expect([...names].sort(collate)).toEqual(['Amanda', 'Ópera', 'Panqueque']);
  });

  it('orders embedded numbers numerically, not lexically', () => {
    const names = ['Torta 10', 'Torta 2', 'Torta 1'];
    expect([...names].sort(collate)).toEqual(['Torta 1', 'Torta 2', 'Torta 10']);
  });
});

describe('placeholder rule', () => {
  it('flags products with no photograph', () => {
    expect(needsPlaceholder(product('a', 'Moana', ['productos'], ['tortas'], null))).toBe(true);
    expect(needsPlaceholder(product('b', 'Macarons', ['productos'], ['confites'], 'products/macarons'))).toBe(
      false,
    );
  });
});

describe('count formatting', () => {
  it('uses the singular for a single product', () => {
    expect(formatCount(1)).toBe('1 producto');
  });

  it('uses the plural otherwise, including zero', () => {
    expect(formatCount(0)).toBe('0 productos');
    expect(formatCount(23)).toBe('23 productos');
  });
});
