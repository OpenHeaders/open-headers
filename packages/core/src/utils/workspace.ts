/**
 * Workspace naming utilities — shared between desktop and extension.
 *
 * Folder names use the `<slug>-<uid>` convention. The uid is the stable
 * identity (embedded in the YAML of the item it names); the slug is a
 * rename-safe human hint. See the v5 foundation plan (Phase 0 #1, #2, #14).
 */

const UID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const UID_LENGTH = 8;
const UID_REGEX = /-([a-z0-9]{8})$/;
const SLUG_MAX_LENGTH = 40;

/** Generate an 8-char lowercase-alphanumeric uid (36^8 ≈ 2.8 trillion). */
export function generateUid(): string {
  let uid = '';
  for (let i = 0; i < UID_LENGTH; i++) {
    uid += UID_CHARS[Math.floor(Math.random() * UID_CHARS.length)];
  }
  return uid;
}

/**
 * Slugify a display name for folder use.
 *
 * Contract:
 *   - Lowercases (after Unicode normalization + diacritic stripping)
 *   - Replaces any run of non-[a-z0-9] with a single hyphen
 *   - Trims leading/trailing hyphens
 *   - Truncates to {@link SLUG_MAX_LENGTH} chars (after hyphen-trim)
 *
 * Empty input (or input that fully strips) returns `''` — callers should
 * fall back to the uid in that case (see {@link toFolderName}).
 */
export function slugify(name: string): string {
  const normalized = name.normalize('NFKD').replace(/\p{M}+/gu, '');
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.length > SLUG_MAX_LENGTH ? slug.slice(0, SLUG_MAX_LENGTH).replace(/-$/, '') : slug;
}

/**
 * Build a folder name from a display name + uid.
 *   e.g. "Login" + "x7k2abcd" → "login-x7k2abcd"
 * Empty slug → just the uid.
 */
export function toFolderName(name: string, uid: string): string {
  const slug = slugify(name);
  return slug ? `${slug}-${uid}` : uid;
}

/**
 * Extract the uid suffix from a folder name.
 * Matches only 8-char lowercase-alphanumeric suffixes preceded by `-`.
 * Returns the input unchanged if no uid suffix is detected — callers
 * can rely on the uid being present when the folder was written by us.
 */
export function extractUid(folderName: string): string {
  const match = folderName.match(UID_REGEX);
  return match ? match[1] : folderName;
}
