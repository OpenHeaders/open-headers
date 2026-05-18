import type { AnnotatedHeader } from '../../../data/header-attribution';
import type { HeaderRowMeta } from '../../../data/header-filter';

// Headers commonly carried on every fetch — folded by the hide-noise toggle.
const NOISE_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'connection',
  'upgrade-insecure-requests',
]);
const NOISE_PREFIXES = ['sec-fetch-', 'sec-ch-ua'];

export function isNoiseHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (NOISE_HEADERS.has(lower)) return true;
  return NOISE_PREFIXES.some((p) => lower.startsWith(p));
}

export function originOf(attribution: AnnotatedHeader['attribution']): HeaderRowMeta['origin'] {
  if (attribution.kind === 'server') return 'server';
  if (attribution.kind === 'system') return 'system';
  return 'rule';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function humanSec(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}
