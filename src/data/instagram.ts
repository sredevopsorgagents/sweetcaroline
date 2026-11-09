/**
 * Instagram feed configuration.
 *
 * The homepage shows `@sweetcarolinechile` through Instagram's *official* embed
 * script, which embeds one post or Reel at a time — there is no official
 * full-profile embed. So the feed is an authored list of post permalinks, and
 * this file is the single place to edit it:
 *
 *   1. Open the post on instagram.com in a browser.
 *   2. Copy its permalink. Both forms Instagram hands out are accepted:
 *        https://www.instagram.com/p/ABC123defGH/
 *        https://www.instagram.com/sweetcarolinechile/p/ABC123defGH/
 *      (`reel` instead of `p` for a Reel.)
 *   3. Add it to `posts` below, newest first. 6–12 entries fill the grid.
 *
 * `posts` holds only our own account; someone else's post (a collaboration, a
 * customer tagging the shop) goes in `guestPosts` and is labelled with its
 * account, so the landing page never implies another business is Sweet
 * Caroline.
 *
 * Nothing is fetched at build time, so builds stay deterministic and offline.
 * When `posts` is empty the homepage falls back to `fallback` (already-imported
 * local photographs) plus a link to the profile, which keeps the page useful
 * without loading a third-party script.
 */
import rawInstagram from './instagram.json';

export interface InstagramFallbackPhoto {
  /** Image key resolved by `src/lib/images.ts`, e.g. "gallery/foto-01". */
  key: string;
  alt: string;
}

export interface InstagramPost {
  /** The permalink, exactly as pasted. */
  url: string;
  /** Account that published it. */
  account: string;
}

export interface InstagramConfig {
  /** Our handle, without the `@`. */
  profile: string;
  /** Local photographs shown while `posts` is empty. */
  fallback: InstagramFallbackPhoto[];
  /** Permalinks of our own posts and Reels. */
  posts: string[];
  /** Permalinks of posts by other accounts, featured on the homepage. */
  guestPosts: string[];
}

export const INSTAGRAM: InstagramConfig = rawInstagram as InstagramConfig;

/**
 * A permalink in the forms Instagram publishes: `/p/<shortcode>/` for a feed
 * post, `/reel/<shortcode>/` for a Reel, optionally prefixed with the account
 * that published it (`/<account>/p/<shortcode>/`).
 */
export const INSTAGRAM_POST_PATTERN =
  /^https:\/\/www\.instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel)\/[A-Za-z0-9_-]+\/?$/;

/**
 * The account a permalink belongs to. The profile-prefixed form names it
 * explicitly; the short `instagram.com/p/<id>/` form is resolved to ours, which
 * is how Instagram generates links for the account that owns the post.
 */
export function postAccount(url: string, ownProfile = INSTAGRAM.profile): string {
  const prefixed = /^https:\/\/www\.instagram\.com\/([A-Za-z0-9._]+)\/(?:p|reel)\//.exec(url);
  return prefixed ? prefixed[1] : ownProfile;
}

/** The feed, own posts first, each tagged with the account that published it. */
export function feedPosts(): InstagramPost[] {
  return [...INSTAGRAM.posts, ...INSTAGRAM.guestPosts].map((url) => ({
    url,
    account: postAccount(url),
  }));
}

/** The public profile URL the feed links to. */
export const INSTAGRAM_PROFILE_URL = `https://www.instagram.com/${INSTAGRAM.profile}/`;
