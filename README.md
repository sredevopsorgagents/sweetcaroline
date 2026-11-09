# Sweet Caroline — PoC sitio web

Sitio web de **Sweet Caroline**, pastelería fina y chocolatería en San Joaquín,
Santiago, Chile. Reemplaza el sitio WordPress/WPBakery anterior por un sitio estático,
rápido y accesible.

- **Producción:** https://www.sweetcaroline.cl (sitio oficial, fuera del alcance de este repo)
- **Origen del contenido:** el WordPress configurado en `WORDPRESS_BASE_URL`
  (`https://old.sweetcaroline.cl`) — se lee una sola vez, nunca en build
- **Éste sitio:** https://sredevopsorgagents.github.io/sweetcaroline/ (GitHub Pages)

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

- Node.js **≥ 22.12** (el `engines` de Astro 7; también es el piso de
  `--env-file-if-exists`)
- npm

## Empezar

```bash
npm install
npm run dev          # http://localhost:4321
```

## Variables de entorno

Nada se configura en runtime: todo se resuelve en build o al importar contenido.
`astro.config.mjs` lee `SITE_URL` y `BASE_PATH`; `src/lib/indexing.ts` lee
`ALLOW_INDEXING`; el importador lee `WORDPRESS_BASE_URL`.

| Variable | Para qué | Por defecto | Requerida por |
| --- | --- | --- | --- |
| `WORDPRESS_BASE_URL` | Origen de la API REST de WordPress que siembra `src/content/**` | **ninguno** | `content:import`, `content:check` |
| `SITE_URL` | URL pública de este build; de su path se deriva `base` | `https://sweetcaroline.cl` | `build`, `redirects` |
| `BASE_PATH` | Escape hatch que anula el `base` derivado | path de `SITE_URL` | — (normalmente sin usar) |
| `ALLOW_INDEXING` | `1` publica sitemap y `index, follow` | sin definir = bloqueado | `build` |

Copia el archivo de ejemplo (`.env` está en `.gitignore`):

```bash
cp .env.example .env
```

Las variables del shell **tienen prioridad** sobre `.env`, así que un caso puntual
se resuelve en línea:

```bash
WORDPRESS_BASE_URL=https://otro-origen.test npm run content:check
```

**`WORDPRESS_BASE_URL` no tiene valor por defecto, a propósito.** Un import sin
configurar falla con un mensaje que dice qué hacer, antes de tocar la red, en vez
de leer producción en silencio:

```
[import] WORDPRESS_BASE_URL is not set. Copy .env.example to .env, or pass --wp-base <origin>.
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

Los dos comandos de contenido cargan `.env` automáticamente
(`node --env-file-if-exists=.env`), así que no hay que exportar nada a mano.

## Contenido

El contenido se importa una sola vez desde la API REST de WordPress y se
versiona en el repositorio. **El importador no se ejecuta nunca en CI**: necesita
red y haría los builds no deterministas. Por lo mismo `WORDPRESS_BASE_URL` no es
un secreto de CI — no hay ningún job que lo use.

```
npm run content:import                 # importación completa (baja imágenes)
npm run content:import -- --no-images  # sólo datos, sin descargar imágenes
npm run content:check                  # verifica sin escribir
```

El origen se resuelve en este orden: `--wp-base` → `WORDPRESS_BASE_URL` → error.
`--wp-base` gana sobre `.env`, para apuntar a un clon o a un dump local sin editar
el archivo:

```bash
npm run content:check -- --wp-base http://localhost:8080
```

Escribe:

```
src/content/products/*.json    62 productos (procedencia, no publicado)
src/content/categories/*.json  8 categorías de vitrina (procedencia)
src/content/pages/*.md         nosotros, en-cafeteria
src/data/site.json             contacto, horarios, dirección
src/data/home.json             hero y destacados (procedencia, sin uso)
src/data/gallery.json          galería
src/data/instagram.json        feed de la portada: posts + fallback local
src/data/legacy-urls.json      URLs antiguas -> portada
src/assets/**                  imágenes normalizadas a WebP
content-report.md              informe para el cliente
```

Reglas del importador:

1. **Nunca reescribe textos.** Sólo normaliza HTML, entidades y espacios.
2. Las imágenes se descargan desde el `source_url` que informa la API, nunca
   desde una ruta adivinada (el directorio de uploads es inconsistente).
3. Los errores de tipeo, las descripciones faltantes y las fotos faltantes se
   reportan en `content-report.md`; no se corrigen solos.

El campo `sourceUrl` de cada producto es **provenance**: registra de dónde salió
ese contenido en la importación que ya ocurrió. No es configuración y no cambia al
mover `WORDPRESS_BASE_URL`.

Después de importar, revisar `content-report.md` y correr `npm test` — los tests
de integridad de contenido fallan si una categoría no resuelve, si un producto
queda fuera de toda sección o si una imagen referenciada no existe.

## Arquitectura

```
src/
  content.config.ts     esquemas Zod de las colecciones
  content/              contenido importado
  data/                 navegación, sitio, galería, Instagram, URLs antiguas
  lib/                  images.ts, seo.ts, site.ts, indexing.ts
  layouts/BaseLayout    head, SEO, JSON-LD, header, footer
  components/           UI reutilizable
  pages/                rutas
  styles/global.css     tokens de marca
scripts/
  import-wordpress.mjs  importador (manual, con red)
  wp-base.mjs           resolución de WORDPRESS_BASE_URL
  emit-redirects.mjs    stubs de URLs históricas
  generate-brand-assets.mjs
tests/unit/             Vitest — catálogo, contenido, deploy, wp-base
tests/e2e/              Playwright + axe
docs/adr/               decisiones y su justificación
```

Un solo artefacto desplegable (`dist/`). Sin servidor, sin base de datos, sin
configuración en runtime. Ver `docs/adr/` para las decisiones y su justificación,
y [`AGENTS.md`](AGENTS.md) para la guía operativa del repositorio.

### Rutas

| Ruta | Página |
| --- | --- |
| `/` | Portada: feed de Instagram |
| `/nosotros/` | Quiénes somos, misión, visión |
| `/contacto/` | Contacto, horarios, mapa |
| `/404` | No encontrado |

Las secciones `Productos`, `En cafetería` y `Galería de fotos` fueron retiradas
(ver ADR 0006). Sus datos siguen versionados en `src/content/**` como procedencia
del import, pero ninguna ruta los publica, y sus rutas ya no existen.

Las URLs históricas de WordPress (`/nuestros-productos/...`, `/galeria/`) siguen
resolviendo mediante stubs con `meta refresh` + `canonical`; ahora todas apuntan a
la portada.

### Portada: feed de Instagram

Instagram **no tiene embed oficial de perfil completo**: sólo permite incrustar
publicaciones individuales. Por eso la portada es una lista curada de permalinks
que se renderizan con el script oficial `instagram.com/embed.js`:

1. Abre la publicación en instagram.com y copia su permalink
   (`https://www.instagram.com/p/<id>/` o `/reel/<id>/`).
2. Agrégalo a `posts` en `src/data/instagram.json`, de la más nueva a la más
   antigua (entre 6 y 12 entradas).
3. `npm run build`. El feed no se actualiza solo: cada publicación nueva es un
   commit.

No hay token ni secreto: nada se descarga en build. Mientras `posts` esté vacío
—el estado inicial— la portada muestra las fotografías ya importadas
(`fallback` en el mismo archivo) y un botón al perfil, así que no queda en blanco
ni carga scripts de terceros. Un permalink mal escrito **rompe el build** con un
mensaje que lo nombra.

El embed agrega contenido e `iframe`s de Instagram (cookies de terceros) a la
portada. Cada publicación conserva además un link propio ("Ver publicación en
Instagram") **fuera** del bloque que Instagram reescribe, porque `embed.js`
borra el bloquequote al convertirlo y puede dejar un `iframe` vacío si Instagram
responde `x-frame-options: DENY`. Así ninguna publicación queda inalcanzable con
JavaScript bloqueado, con un bloqueador de anuncios o si Instagram rechaza el
embed. Los tests e2e verifican ese respaldo.

> No fue posible verificar visualmente el render real de los embeds desde este
> entorno: Instagram responde `DENY` a clientes anónimos que salen de una IP de
> datacenter. Los tests verifican el marcado y los respaldos, no los píxeles.
> Conviene abrir la portada publicada una vez desde un navegador normal.

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

El sitio apunta a **WCAG 2.2 AA** y se verifica con axe-core en las tres rutas
publicadas, en escritorio y móvil, en cada corrida de tests.

## Despliegue

- `main` → build → GitHub Pages (`.github/workflows/deploy.yml`)
- Pull requests → type check, build, tests de unidad, e2e + accesibilidad
  (`.github/workflows/ci.yml`)

El orden importa: en CI el **build va antes de los tests de unidad**, porque
`tests/unit/deploy.test.ts` verifica el `dist/` construido.

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
correcto (`https://sweetcaroline.cl`, `base: '/'`).

`tests/unit/deploy.test.ts` verifica el `dist/` construido: que ningún enlace o
asset interno escape del `base`, que todos resuelvan a un archivo existente, que
`robots.txt` apunte al sitemap del host correcto y que las únicas páginas reales
sean `/`, `/nosotros/`, `/contacto/` y `404.html` —todo lo demás bajo `dist/` debe
ser un stub de redirección.

### Indexación

El sitio **no debe ser indexado**: es un POC público en revisión, y público no es
lo mismo que encontrable. El bloqueo es el valor por defecto y cubre varias vías,
porque ninguna sola alcanza:

| Vía | Mecanismo |
| --- | --- |
| `robots.txt` | `Disallow: /` para `*` y para los crawlers de IA/archivado nombrados |
| Cada página | `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">` |
| Cada página | El mismo valor como `<meta http-equiv="X-Robots-Tag">` (GitHub Pages no permite cabeceras reales) |
| Sitemap | No se emite: un sitemap es una invitación a crawlear |
| Stubs de redirección | `noindex, nofollow` en lugar de `noindex, follow` |

`robots.txt` es sólo una sugerencia y algunos robots lo ignoran; por eso la
directiva por página es la que sostiene la política. Ver `src/lib/indexing.ts`.

Para indexar un build (por ejemplo en el cutover al dominio raíz):

```bash
ALLOW_INDEXING=1 npm run build
```

Eso restaura `index, follow`, el sitemap y la línea `Sitemap:` en `robots.txt`.
`tests/unit/deploy.test.ts` y la suite e2e verifican ambas ramas.

## Limitaciones conocidas

- El contenido es sólo lectura para el cliente: editarlo requiere un commit.
  Ver ADR 0002 para el plan de un CMS basado en Git.
- El feed de la portada es manual: no se agrega o actualiza solo. Automatizarlo
  requeriría un token de la propia cuenta `@sweetcarolinechile`; ver ADR 0006.
- 23 de 62 productos no tienen fotografía en WordPress. Listados en
  `content-report.md` (ya no se publican: ver ADR 0006).
- 2 productos no tienen descripción en el origen.
- `public/CNAME` no se publica, porque una página de proyecto no debe declarar un
  dominio que no sirve. Debe **restaurarse antes del cutover** al dominio raíz,
  junto con `ALLOW_INDEXING=1`; ver ADR 0003.
- El repositorio que sirve `sweetcaroline.cl` (un export estático de WordPress de
  2024) aún no está identificado. Hasta resolverlo, producción no se toca.
