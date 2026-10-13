import { getCollection, type CollectionEntry } from 'astro:content';

export type Product = CollectionEntry<'products'>;
export type Category = CollectionEntry<'categories'>;
export type SectionSlug = 'productos' | 'cafeteria';

export interface CategoryWithProducts {
  category: Category;
  slug: string;
  name: string;
  products: Product[];
}

export interface SectionView {
  slug: SectionSlug;
  categories: CategoryWithProducts[];
  totalProducts: number;
}

const SECTION_SLUGS: SectionSlug[] = ['productos', 'cafeteria'];

/** Alias kept so the ordering rule lives in one place for tests and pages. */
export function compareProducts(a: Product, b: Product): number {
  return collate(a.data.name, b.data.name);
}

/**
 * Spanish-aware, accent-insensitive name collation. `localeCompare` with the
 * `es` locale orders ñ after n and ignores accents, which is what a Chilean
 * reader expects; a plain ASCII sort does not.
 */
function collate(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
}

export async function getProducts(): Promise<Product[]> {
  const products = await getCollection('products');
  return products.sort(compareProducts);
}

export async function getCategories(): Promise<Category[]> {
  const categories = await getCollection('categories');
  return categories.sort((a, b) => a.data.order - b.data.order);
}

/** Categories shown as tiles, i.e. visible and holding at least one product. */
export async function getVisibleCategories(): Promise<Category[]> {
  const categories = await getCategories();
  return categories.filter((c) => !c.data.hidden && !c.data.empty);
}

export function productsInCategory(products: Product[], categorySlug: string): Product[] {
  return products.filter((p) => p.data.categories.includes(categorySlug));
}

export function productsInSection(products: Product[], section: SectionSlug): Product[] {
  return products.filter((p) => p.data.sections.includes(section));
}

/**
 * Build the full view model for a section: its visible categories in their
 * configured order, each with its products already sorted.
 *
 * A category appears in more than one section on purpose — `confites` and
 * `postres` belong to both the shop catalog and the cafeteria menu.
 */
export async function getSectionView(section: SectionSlug): Promise<SectionView> {
  const [products, categories] = await Promise.all([getProducts(), getVisibleCategories()]);

  const inSection = productsInSection(products, section);
  const views = categories
    .filter((category) => inSection.some((p) => p.data.categories.includes(category.id)))
    .map((category) => ({
      category,
      slug: category.id,
      name: category.data.name,
      products: productsInCategory(inSection, category.id),
    }));

  return {
    slug: section,
    categories: views,
    totalProducts: inSection.length,
  };
}

/** Every (section, category) pair that has a page, for `getStaticPaths`. */
export async function getCategoryRoutes(): Promise<
  { section: SectionSlug; category: string; view: CategoryWithProducts }[]
> {
  const routes: { section: SectionSlug; category: string; view: CategoryWithProducts }[] = [];
  for (const section of SECTION_SLUGS) {
    const view = await getSectionView(section);
    for (const entry of view.categories) {
      routes.push({ section, category: entry.slug, view: entry });
    }
  }
  return routes;
}

export function isSectionSlug(value: string): value is SectionSlug {
  return (SECTION_SLUGS as string[]).includes(value);
}

export function findProduct(products: Product[], slug: string): Product | undefined {
  return products.find((p) => p.id === slug);
}

/**
 * True when a product carries no photograph. Roughly a third of the catalog
 * has no image in WordPress; these render a branded placeholder instead.
 */
export function needsPlaceholder(product: Product): boolean {
  return !product.data.image;
}

/** Human-readable product count, e.g. "23 productos" / "1 producto". */
export function formatCount(count: number): string {
  return `${count} ${count === 1 ? 'producto' : 'productos'}`;
}
