/**
 * Pure formatters for cookie display. No React, no DOM — easy to test.
 */

import { getRelativeTimeFormat } from '@openheaders/i18n';

const NARROW_ALWAYS: Intl.RelativeTimeFormatOptions = { style: 'narrow', numeric: 'always' };

// 'Session' stays literal — it round-trips with the edit form's session
// label and the "{session}" merge hole in the cookies catalog.
export function formatRelativeExpiry(
  expirationDateSec: number | undefined,
  isSession: boolean | undefined,
  now: number,
  locale: string,
): string {
  if (isSession || expirationDateSec == null) return 'Session';
  const format = getRelativeTimeFormat(locale, NARROW_ALWAYS);
  const deltaMs = expirationDateSec * 1000 - now;
  const sec = Math.round(Math.abs(deltaMs) / 1000);
  const sign = deltaMs < 0 ? -1 : 1;
  if (sec < 60) return format.format(sign * sec, 'second');
  if (sec < 3600) return format.format(sign * Math.round(sec / 60), 'minute');
  if (sec < 86400) return format.format(sign * Math.round(sec / 3600), 'hour');
  if (sec < 86400 * 30) return format.format(sign * Math.round(sec / 86400), 'day');
  if (sec < 86400 * 365) return format.format(sign * Math.round(sec / (86400 * 30)), 'month');
  return format.format(sign * Math.round(sec / (86400 * 365)), 'year');
}

export function formatAbsoluteExpiry(expirationDateSec: number | undefined, isSession: boolean | undefined): string {
  if (isSession || expirationDateSec == null) return 'Session';
  try {
    return new Date(expirationDateSec * 1000)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d+Z$/, ' UTC');
  } catch {
    return '—';
  }
}

export function urlDecodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
