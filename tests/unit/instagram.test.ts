/**
 * Instagram feed configuration.
 *
 * Instagram has no official full-profile embed: the homepage embeds individual
 * posts with the official `embed.js`, driven entirely by `src/data/instagram.json`.
 * A malformed permalink does not fail loudly in the browser — Instagram's script
 * simply leaves an empty blockquote — so the shape is asserted here, where the
 * fix is obvious.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS = path.join(ROOT, 'src/assets');
const site = JSON.parse(readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const instagram = JSON.parse(
  readFileSync(path.join(ROOT, 'src/data/instagram.json'), 'utf8'),
) as {
  profile: string;
  fallback: { key: string; alt: string }[];
  posts: string[];
  guestPosts: string[];
};

// Mirrors INSTAGRAM_POST_PATTERN in src/data/instagram.ts: `/p/` or `/reel/`,
// optionally prefixed with the publishing account.
const postPattern =
  /^https:\/\/www\.instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel)\/[A-Za-z0-9_-]+\/?$/;

/** Mirrors postAccount(): the prefixed form names its account explicitly. */
const postAccount = (url: string) =>
  /^https:\/\/www\.instagram\.com\/([A-Za-z0-9._]+)\/(?:p|reel)\//.exec(url)?.[1] ??
  instagram.profile;

const assetExists = (key: string) =>
  ['webp', 'avif', 'png', 'jpg', 'jpeg', 'svg'].some((ext) =>
    existsSync(path.join(ASSETS, `${key}.${ext}`)),
  );

const allPosts = [...instagram.posts, ...instagram.guestPosts];

describe('instagram feed', () => {
  it('points at the same profile the rest of the site links to', () => {
    // site.json drives the header, footer, contact page and JSON-LD `sameAs`;
    // a divergent handle here would show one feed and link to another.
    expect(site.instagram).toBe(`https://www.instagram.com/${instagram.profile}/`);
  });

  it('lists only individual post or Reel permalinks', () => {
    const bad = allPosts.filter((url) => !postPattern.test(url));
    expect(bad).toEqual([]);
  });

  it('never lists the same post twice', () => {
    expect(new Set(allPosts).size).toBe(allPosts.length);
  });

  it('features our own posts, and only our own posts, in `posts`', () => {
    // A post by another account belongs in `guestPosts`, which the page labels
    // with that account, so the homepage never implies it is ours.
    const foreign = instagram.posts.filter((url) => postAccount(url) !== instagram.profile);
    expect(foreign).toEqual([]);
  });

  it('names the publishing account on every guest post', () => {
    const unlabelled = instagram.guestPosts.filter((url) => postAccount(url) === instagram.profile);
    expect(unlabelled).toEqual([]);
  });

  it('stays within the number of embeds the grid is designed for', () => {
    // One `<blockquote>` per post; beyond a dozen the page is slower than it is
    // useful, and each embed is a third-party iframe.
    expect(allPosts.length).toBeLessThanOrEqual(12);
  });

  it('falls back to photographs that exist on disk', () => {
    expect(instagram.fallback.length).toBeGreaterThan(0);
    const missing = instagram.fallback.filter((photo) => !assetExists(photo.key));
    expect(missing.map((photo) => photo.key)).toEqual([]);
  });

  it('gives every fallback photograph a non-empty alt', () => {
    expect(instagram.fallback.filter((photo) => !photo.alt.trim())).toEqual([]);
  });
});
