/**
 * General Utilities
 */

import type { V5 } from '@openheaders/core/types';

/**
 * Generate a fast hash for a V5 workbench array (FNV-1a 32-bit).
 * Used for change detection — not cryptographic.
 */
export function generateRulesHash(rules: V5.Rule[]): string {
  const str = JSON.stringify(rules.map((r) => ({ uid: r.uid, enabled: r.enabled, type: r.type })));
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Create a debounce function to avoid too many rapid updates
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function (this: unknown, ...args: Parameters<T>): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
