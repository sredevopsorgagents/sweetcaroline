# ADR 0006 — Homepage is the Instagram feed; only Nosotros and Contacto remain

- **Status:** Accepted
- **Date:** 2026-11-08
- **Supersedes in part:** ADR 0002 (the product/category content is no longer
  published, though it is still imported and versioned)

## Context

The client asked to keep only the `Nosotros` and `Contacto` sections and to make
the landing page show the content of
[instagram.com/sweetcarolinechile](https://www.instagram.com/sweetcarolinechile/).
Every other section — `Productos`, `En cafetería`, `Galería de fotos` — had to go.

The client then asked to "just embed an official integration". That constraint
is what shaped the design, because Instagram offers no official way to embed a
whole profile:

| Option | Official? | Needs the target account? | Verdict |
| --- | --- | --- | --- |
| Post/Reel embed (`embed.js` + `<blockquote class="instagram-media">`) | yes | no | **chosen** |
| Profile embed (`instagram.com/<user>/embed/`) | no | — | login-walled; not embeddable |
| Instagram API with Instagram Login (`/<ig-user-id>/media`) | yes | **yes** — a token authorizing *that* account | rejected: no valid token for `sweetcarolinechile` |
| Third-party widget (Elfsight `Account (Public)`, EmbedSocial) | no | no, but a vendor account | rejected: third-party dependency and account for a public feed |

A token for `@sweetcarolinechile` cannot be minted from another account: an
Instagram Login token is scoped to the account that authorized it, and there is no
`/username/media` endpoint. The earlier attempt failed with `OAuthException 190`
(session expired), and `@elclaustrocl`'s token cannot read `sweetcarolinechile`.

## Decision

1. **Routes.** The site publishes `/`, `/nosotros/`, `/contacto/` and `/404`.
   `src/pages/productos/`, `src/pages/[section]/`, `src/pages/en-cafeteria/`,
   `src/pages/producto/` and `src/pages/galeria-de-fotos.astro` are deleted, along
   with the components and `src/lib/catalog.ts` that only they used. `NAV_LINKS`
   holds `Nosotros` and `Contacto`; the logo links home.

2. **Homepage = Instagram feed.** `src/data/instagram.json` lists the post
   permalinks (`https://www.instagram.com/p/<id>/` or `/reel/<id>/`); the page
   renders one official `<blockquote class="instagram-media">` per entry and loads
   `https://www.instagram.com/embed.js` **once**, and only when the list is not
   empty. The anchor inside each blockquote is the no-JavaScript fallback.

3. **Nothing is fetched at build time.** No token, no secret, no vendor account.
   Builds stay deterministic and offline-capable, which is the same reason the
   WordPress importer never runs in CI.

4. **Empty list falls back to local photographs.** While `posts` is empty the
   homepage shows the imported photographs (`instagram.fallback`, seeded from
   `src/data/gallery.json`) plus a link to the profile, so the landing page is
   never blank and loads no third-party script.

5. **Retired URLs redirect to `/`.** Every historical WordPress permalink
   (62 products, `/nuestros-productos/`, `/galeria/`) now targets the homepage.
   `scripts/import-wordpress.mjs` derives the same map, so a re-import cannot
   resurrect the deleted `/producto/...` routes. The removed *new* routes
   (`/productos/`, `/en-cafeteria/`, `/galeria-de-fotos/`) are simply absent and
   fall through to `404` — they were only ever published on the preview.

6. **Content is retained, not published.** `src/content/products/*.json`,
   `categories/*.json`, `src/data/home.json` and the imported assets stay in the
   repository as provenance (ADR 0002). Nothing renders them, but deleting them
   would destroy the record of the import that already happened.

## Consequences

- **The feed is hand-curated.** Adding a post means adding a permalink to
  `src/data/instagram.json` and rebuilding; the feed does not update itself. The
  alternative (a token for `@sweetcarolinechile`) would allow a manual snapshot
  import, which is a later option if the client wants automation.
- **Instagram's script and iframes run on the landing page.** They are third-party
  requests that can set cookies. `docs/adr/0004` uncovers the site for the public
  cutover, so this is visible to real visitors; a cookie/consent banner is a
  client decision, not something this repository can invent.
- **An embed that fails to load degrades gracefully, by construction.** Verified
  in this repo's sandbox: `embed.js` *deletes* each blockquote it converts, and
  Instagram can answer its embed endpoint with `x-frame-options: DENY`, leaving a
  2px-tall empty frame. A deleted post, a blocker, or a refused embed would then
  take the post link with it. So every post also carries a plain
  "Ver publicación en Instagram" link *outside* the blockquote,
  and `tests/e2e/journeys.spec.ts` asserts that all of them stay visible after
  `embed.js` has run.
- **Whether Instagram renders the embeds cannot be verified from this sandbox.**
  From its datacenter IP Instagram serves `DENY` to anonymous clients (also with
  a persistent, non-automated browser profile), so the suite pins the markup and
  the fallbacks rather than pixels. A visitor in a normal browser on a normal
  connection is the only reliable check; if the frames stay blank there, the
  fallback links and the profile button still carry the page.
- **`/galeria/` is still a stub**, but it now lands on the feed rather than a
  gallery page, so visitors see photographs either way.
- `tests/unit/deploy.test.ts` pins the published set: only `/`, `/nosotros/`,
  `/contacto/` and `404.html` may be real pages; everything else in `dist/` must
  be a redirect stub.
