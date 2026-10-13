#!/usr/bin/env node
/**
 * Emit redirect stubs for historical URLs.
 *
 * GitHub Pages serves static files only — it cannot issue a 301. The next best
 * thing is a small HTML page carrying `<meta http-equiv="refresh">` plus a
 * `rel="canonical"` pointing at the new location, which search engines follow
 * and browsers honour immediately.
 *
 * Run after `astro build`:
 *
 *   node scripts/emit-redirects.mjs
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const site = (process.env.SITE_URL ?? 'https://sweetcaroline.cl').replace(/\/$/, '');

/** Escape a string for safe interpolation into HTML text/attribute context. */
const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function stub(to) {
  const target = `${site}${to}`;
  const safe = escapeHtml(target);
  const safeTo = escapeHtml(to);
  return `<!doctype html>
<html lang="es-CL">
  <head>
    <meta charset="utf-8">
    <title>Redirigiendo… | Sweet Caroline</title>
    <link rel="canonical" href="${safe}">
    <meta name="robots" content="noindex, follow">
    <meta http-equiv="refresh" content="0; url=${safe}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <p>Esta página se trasladó. <a href="${safeTo}">Ir a la nueva dirección</a>.</p>
  </body>
</html>
`;
}

async function main() {
  const mapPath = path.join(ROOT, 'src/data/legacy-urls.json');
  const map = JSON.parse(await readFile(mapPath, 'utf8'));

  // A stub must never shadow a page the new site actually builds.
  const isBuilt = async (route) => {
    try {
      await access(path.join(DIST, route.replace(/^\//, ''), 'index.html'));
      return true;
    } catch {
      return false;
    }
  };

  let written = 0;
  let skipped = 0;
  let mirrors = 0;

  for (const [from, to] of Object.entries(map)) {
    if (from === to || from === '/') continue;

    const normalizedFrom = from.endsWith('/') ? from : `${from}/`;
    if (await isBuilt(normalizedFrom)) {
      skipped++;
      continue;
    }

    const dest = path.join(DIST, normalizedFrom.replace(/^\//, ''), 'index.html');
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, stub(to), 'utf8');
    written++;

    // Also emit a sibling `<route>.html`. Static hosts disagree about slash
    // handling: GitHub Pages resolves `/foo` to `/foo/index.html` with a 301,
    // while some others (including `astro preview`) simply 404. The mirror file
    // makes the legacy URL work on both, and is harmlessly shadowed by the
    // directory form wherever that redirect does happen.
    const mirror = path.join(DIST, `${normalizedFrom.replace(/\/$/, '')}.html`);
    await mkdir(path.dirname(mirror), { recursive: true });
    await writeFile(mirror, stub(to), 'utf8');
    mirrors++;
  }

  process.stdout.write(
    `[redirects] wrote ${written} stub(s) + ${mirrors} extensionless mirror(s), skipped ${skipped} already built\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[redirects] FAILED: ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
