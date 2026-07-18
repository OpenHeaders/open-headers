/**
 * Render a millisecond duration as a compact "Xs / Xm / Xh ago" string
 * via `Intl.RelativeTimeFormat` in the given locale.
 *
 * Tuned for awareness chip subtitles where space is tight. Negatives
 * clamp to "now" — a peer's HLC briefly running ahead of local is
 * normal under skew and shouldn't surface as nonsense like "-3s ago".
 */

import { getRelativeTimeFormat } from '@openheaders/i18n';

const NARROW_ALWAYS: Intl.RelativeTimeFormatOptions = { style: 'narrow', numeric: 'always' };
const NARROW_AUTO: Intl.RelativeTimeFormatOptions = { style: 'narrow', numeric: 'auto' };

export function formatAgo(ms: number, locale: string): string {
  if (!Number.isFinite(ms) || ms < 1500) return getRelativeTimeFormat(locale, NARROW_AUTO).format(0, 'second');
  const format = getRelativeTimeFormat(locale, NARROW_ALWAYS);
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return format.format(-seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return format.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, 'hour');
  return format.format(-Math.round(hours / 24), 'day');
}
