# Sweet Caroline — sitio web

Sitio web de **Sweet Caroline**, pastelería fina y chocolatería en San Joaquín,
Santiago. Reemplaza el sitio WordPress/WPBakery anterior por un sitio estático,
rápido y accesible.

- **Producción:** https://sweetcaroline.cl
- **Fuente de contenido histórica:** https://old.sweetcaroline.cl (WordPress)

## Stack

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Framework | [Astro 7](https://astro.build/) (salida estática) | HTML pre-renderizado, casi sin JavaScript |
| Estilos | [Tailwind CSS 4](https://tailwindcss.com/) vía `@tailwindcss/vite` | Tokens de marca en CSS, sin archivo de configuración |
| Lenguaje | TypeScript | Tipos estrictos en contenido y utilidades |
| Contenido | JSON + Markdown versionados, validados con Zod | Builds deterministas, diffs revisables |
| Imágenes | `astro:assets` + `sharp` | AVIF/WebP responsivos en build |
| Tipografía | Astro Fonts API (Poppins) | Auto-alojada, sin request a Google |
| Tests | Vitest + Playwright + axe-core | Unidad, e2e y accesibilidad |
| Hosting | GitHub Pages | Donde ya apunta el dominio, sin costo |

## Requisitos

- Node.js **≥ 22.12** (el `engines` de Astro 7)
- npm

## Empezar

```bash
npm install
npm run dev          # http://localhost:4321
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build estático a `dist/` + stubs de redirección |
| `npm run preview` | Sirve `dist/` localmente |
| `npm run check` | `astro sync` + `tsc --noEmit` |
| `npm test` | Tests de unidad (Vitest) |
| `npm run test:e2e` | Tests e2e y de accesibilidad (Playwright + axe) |
| `npm run content:import` | Re-importa el contenido desde WordPress |
| `npm run content:check` | Verifica el contenido sin escribir |
| `npm run redirects` | Regenera los stubs de URLs antiguas |

## Contenido

El contenido se importa una sola vez desde la API REST de WordPress y se
versiona en el repositorio. **El importador no se ejecuta nunca en CI**: necesita
red y haría los builds no deterministas.

```
npm run content:import                 # importación completa (baja imágenes)
npm run content:import -- --no-images  # sólo datos, sin descargar imágenes
npm run content:check                  # verifica sin escribir
```

Escribe:

```
src/content/products/*.json    62 productos
src/content/categories/*.json  8 categorías de vitrina
src/content/pages/*.md         nosotros, en-cafeteria
src/data/site.json             contacto, horarios, dirección
src/data/home.json             hero y destacados
src/data/gallery.json          galería
src/data/legacy-urls.json      URLs antiguas -> nuevas
src/assets/**                  imágenes normalizadas a WebP
content-report.md              informe para el cliente
```

Reglas del importador:

1. **Nunca reescribe textos.** Sólo normaliza HTML, entidades y espacios.
2. Las imágenes se descargan desde el `source_url` que informa la API, nunca
   desde una ruta adivinada (el directorio de uploads es inconsistente).
3. Los errores de tipeo, las descripciones faltantes y las fotos faltantes se
   reportan en `content-report.md`; no se corrigen solos.

Después de importar, revisar `content-report.md` y correr `npm test` — los tests
de integridad de contenido fallan si una categoría no resuelve, si un producto
queda fuera de toda sección o si una imagen referenciada no existe.

## Arquitectura

```
src/
  content.config.ts     esquemas Zod de las colecciones
  content/              contenido importado
  data/                 navegación, sitio, galería, URLs antiguas
  lib/                  catalog.ts (agrupación), images.ts, seo.ts, site.ts
  layouts/BaseLayout    head, SEO, JSON-LD, header, footer
  components/           UI reutilizable
  pages/                rutas
  styles/global.css     tokens de marca
```

Un solo artefacto desplegable (`dist/`). Sin servidor, sin base de datos, sin
configuración en runtime. Ver `docs/adr/` para las decisiones y su justificación.

### Rutas

| Ruta | Página |
| --- | --- |
| `/` | Portada |
| `/nosotros/` | Quiénes somos, misión, visión |
| `/productos/` | Índice de categorías |
| `/productos/categoria/[categoria]/` | Productos de una categoría |
| `/en-cafeteria/` | Índice de cafetería |
| `/en-cafeteria/categoria/[categoria]/` | Productos de cafetería |
| `/producto/[slug]/` | Detalle de producto |
| `/galeria-de-fotos/` | Galería con lightbox |
| `/contacto/` | Contacto, horarios, mapa |
| `/404` | No encontrado |

Las URLs históricas de WordPress (`/nuestros-productos/...`, `/galeria/`) siguen
resolviendo mediante stubs con `meta refresh` + `canonical`.

## Marca y accesibilidad

Los tokens salen del CSS compilado del sitio original:

| Token | Valor | Uso |
| --- | --- | --- |
| `brand-500` | `#e6007e` | Color primario: header, footer, botones |
| `brand-700` | `#b20065` | Barra superior, hover, focos |
| `brand-900` | `#7a0043` | Titulares sobre fondo claro |
| `accent-500` | `#1f7691` | Antetítulos |
| `brand-line-soft` / `brand-line-strong` | `#f2b8ca` / `#f195b2` | **Sólo bordes** |

`brand-line-soft` sobre `brand-500` mide **2.68:1** y `brand-line-strong` sobre
blanco **2.17:1**: ambos reprueban WCAG AA como color de texto. Por eso están
nombrados `-line-` en lugar de `-100`/`-300`. Para texto usar `brand-500`
(4.50:1), `brand-700` (6.82:1) o `brand-900` (11.00:1).

El sitio apunta a **WCAG 2.2 AA** y se verifica con axe-core en 10 rutas, en
escritorio y móvil, en cada corrida de tests.

## Despliegue

- `main` → build → GitHub Pages (`.github/workflows/deploy.yml`)
- Pull requests → type check, tests de unidad, build, e2e + accesibilidad
  (`.github/workflows/ci.yml`)

El sitio se publica hoy en la **página de proyecto** del repositorio:
`https://sredevopsorgagents.github.io/sweetcaroline/`. `deploy.yml` inyecta
`SITE_URL` con esa URL, y `astro.config.mjs` **deriva `base` de su path**
(`/sweetcaroline`) en lugar de fijarlo a mano.

Esa derivación es deliberada: GitHub Pages sirve una página de proyecto bajo
`/<repo>/`, y un build con `base: '/'` emite `/_astro/...` y enlaces como
`/productos/` que apuntan por encima de la raíz publicada y devuelven 404 —es
decir, el sitio se ve sin estilos, sin imágenes y con la navegación muerta. Al
derivar `base` de `SITE_URL` los dos valores no pueden separarse.

Para previsualizar localmente con la forma de una página de proyecto:

```bash
SITE_URL=https://sredevopsorgagents.github.io/sweetcaroline npm run build
```

Para el dominio raíz, sin variables de entorno, el build por defecto ya es el
correcto (`https://sweetcaroline.cl`, `base: '/'`). `BASE_PATH` existe sólo como
escape hatch y tiene prioridad sobre la derivación.

`tests/unit/deploy.test.ts` verifica el `dist/` construido: que ningún enlace o
asset interno escape del `base`, que todos resuelvan a un archivo existente, que
`robots.txt` apunte al sitemap del host correcto y que la sección de cafetería se
publique en la URL que enlaza el menú.

## Limitaciones conocidas

- El contenido es sólo lectura para el cliente: editarlo requiere un commit.
  Ver ADR 0002 para el plan de un CMS basado en Git.
- 23 de 62 productos no tienen fotografía en WordPress y muestran una tarjeta de
  marca. Listados en `content-report.md`.
- 2 productos no tienen descripción en el origen.
- `public/CNAME` no se publica, porque una página de proyecto no debe declarar un
  dominio que no sirve. Debe **restaurarse antes del cutover** al dominio raíz;
  ver ADR 0003.
- El repositorio que sirve `sweetcaroline.cl` (un export estático de WordPress de
  2024) aún no está identificado. Hasta resolverlo, producción no se toca.
