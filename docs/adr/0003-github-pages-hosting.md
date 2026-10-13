# ADR 0003 — Host on GitHub Pages, with redirect stubs for legacy URLs

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

`sweetcaroline.cl` already resolves to GitHub Pages (`server: GitHub.com`,
`last-modified: 2024-05-13`), serving a stale static mirror. The domain is
already pointed there and no DNS change is needed.

GitHub Pages serves static files only and cannot issue HTTP 301 redirects. The
WordPress site has 62 product permalinks at deeply nested paths such as
`/nuestros-productos/productos/confites/macarons-de-chocolate/`, plus
`/galeria/` and `/nuestros-productos/`.

## Decision

Deploy the built `dist/` to GitHub Pages via `withastro/action@v6` and
`actions/deploy-pages@v5`, with `public/CNAME` set to `sweetcaroline.cl`.

Preserve historical URLs by emitting a redirect stub at every legacy path:
a small HTML page carrying `<meta http-equiv="refresh">`, a `rel="canonical"`
pointing at the new URL, and `<meta name="robots" content="noindex, follow">`.

Each stub is written **twice** — as `<route>/index.html` and as
`<route>.html` — because static hosts disagree about trailing slashes. GitHub
Pages resolves `/foo` to `/foo/index.html` with a 301; some other servers simply
404. Each stub carries its own `noindex`, so the duplication has no SEO cost.

Redirect stubs are excluded from the sitemap, which would otherwise contradict
their `noindex` directive.

## Consequences

**Positive**

- No hosting cost, no server, no TLS to manage, no DNS change.
- Existing inbound links and search rankings survive the rebuild.
- Deploys are atomic and reversible: the previous artifact is one revert away.

**Negative**

- No server-side redirects, hence the meta-refresh approach. Meta refresh is
  slower than a 301 and is technically a soft signal, but it is the standard
  workaround and is honoured by browsers and crawlers.
- GitHub Pages has soft bandwidth limits and no custom headers. Acceptable for a
  site of this size; if traffic or header needs grow, moving to Cloudflare Pages
  is a build-target change, not a rewrite.
- **Open item:** the repository currently serving the apex domain has not been
  identified. Until it is (or a new one is created with the CNAME transferred),
  the POC should be deployed to a project page via `BASE_PATH` so production is
  never touched. Cutover is a deliberate, separate step.

## Alternatives considered

- **Cloudflare Pages / Netlify** — better build ergonomics and real redirect
  rules, but requires a DNS change and a new account for no functional gain.
- **A container on an existing host** — full control and a path to SSR, but
  brings a server, TLS and patching to a static brochure.
