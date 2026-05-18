/**
 * Pure formatters for cookie display. No React, no DOM — easy to test.
 */

export function formatRelativeExpiry(expirationDateSec: number | undefined, isSession: boolean | undefined, now: number = Date.now()): string {
  if (isSession || expirationDateSec == null) return 'Session';
  const deltaMs = expirationDateSec * 1000 - now;
  const absMs = Math.abs(deltaMs);
  const sec = Math.round(absMs / 1000);
  const past = deltaMs < 0;
  let s: string;
  if (sec < 60) s = `${sec}s`;
  else if (sec < 3600) s = `${Math.round(sec / 60)}m`;
  else if (sec < 86400) s = `${Math.round(sec / 3600)}h`;
  else if (sec < 86400 * 30) s = `${Math.round(sec / 86400)}d`;
  else if (sec < 86400 * 365) s = `${Math.round(sec / (86400 * 30))}mo`;
  else s = `${Math.round(sec / (86400 * 365))}y`;
  return past ? `${s} ago` : `in ${s}`;
}

export function formatAbsoluteExpiry(expirationDateSec: number | undefined, isSession: boolean | undefined): string {
  if (isSession || expirationDateSec == null) return 'Session';
  try {
    return new Date(expirationDateSec * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
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
