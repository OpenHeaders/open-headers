/**
 * How long a toast stays — by how much there is to read. A success is a
 * glance; an error carrying a vendor's detail and a guidance line is a
 * paragraph, and a paragraph that vanishes at the library default of
 * three seconds was never read. Reading runs at roughly three words a
 * second, so the error's stay scales with its words between a floor
 * every error gets and a ceiling past which it should be a dismissible
 * notification instead. A click dismisses it early either way.
 */

const WORDS_PER_SECOND = 3;
const ERROR_FLOOR_SECONDS = 6;
const ERROR_CEILING_SECONDS = 10;

/** Seconds an error toast carrying `text` stays on screen. */
export function errorToastDuration(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '').length;
  return Math.min(ERROR_CEILING_SECONDS, Math.max(ERROR_FLOOR_SECONDS, Math.ceil(words / WORDS_PER_SECOND)));
}
