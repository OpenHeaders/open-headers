/**
 * The secret scrub — a secret manager's value never reaches a captured
 * row. A value a manager handed out for a send or a rule compile is
 * live on the wire (a header, a query field, a body, a frame) and the
 * capture planes record the wire faithfully; the scrub replaces every
 * occurrence of such a value in a capture, keyed by the VALUE itself,
 * before the capture is stored or shipped (the Secret Providers plan's
 * P2d). Value-keyed, not field-keyed: a header's value may carry the
 * secret inside a scheme (`Bearer …`), a body may echo it, a redirect
 * may move it into a query — the only honest rule is "wherever these
 * bytes appear". The host feeds the set from the one place every
 * value passes through; nothing here knows where that is.
 *
 * Identity-preserving: an update that carries none of the values comes
 * back as the same object, so the common case allocates nothing.
 */

import type { RuleSnapshot } from '../types/telemetry';
import type { RequestLifecycleUpdate } from './types';

/** What a scrubbed value reads as — one language-free marker the surfaces recognise. */
export const SECRET_VALUE_PLACEHOLDER = '<hidden: a secret manager value>';

/** Replace every occurrence of every value in `text`; the same string when none occurs. */
export function scrubSecretText(text: string, values: ReadonlySet<string>): string {
  let out = text;
  for (const value of values) {
    if (value !== '' && out.includes(value)) out = out.split(value).join(SECRET_VALUE_PLACEHOLDER);
  }
  return out;
}

/**
 * Walk a JSON-safe tree and scrub every string leaf. The capture
 * contracts are structurally JSON-safe by law (the lifecycle's own
 * compile-time proof), so plain objects, arrays and primitives are the
 * whole vocabulary; a subtree with nothing to scrub comes back as
 * itself.
 */
function scrubTree(node: unknown, values: ReadonlySet<string>): unknown {
  if (typeof node === 'string') return scrubSecretText(node, values);
  if (Array.isArray(node)) {
    let copy: unknown[] | null = null;
    for (let i = 0; i < node.length; i++) {
      const next = scrubTree(node[i], values);
      if (next !== node[i]) {
        copy ??= [...node];
        copy[i] = next;
      }
    }
    return copy ?? node;
  }
  if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    let copy: Record<string, unknown> | null = null;
    for (const key of Object.keys(record)) {
      const next = scrubTree(record[key], values);
      if (next !== record[key]) {
        copy ??= { ...record };
        copy[key] = next;
      }
    }
    return copy ?? node;
  }
  return node;
}

/** Scrub one lifecycle update — the store's intake transform. */
export function scrubLifecycleUpdate(
  update: RequestLifecycleUpdate,
  values: ReadonlySet<string>,
): RequestLifecycleUpdate {
  if (values.size === 0) return update;
  return scrubTree(update, values) as RequestLifecycleUpdate;
}

/** Scrub a fire's rule snapshot — the resolved header values a compile baked in. */
export function scrubRuleSnapshot(snapshot: RuleSnapshot, values: ReadonlySet<string>): RuleSnapshot {
  if (values.size === 0) return snapshot;
  return scrubTree(snapshot, values) as RuleSnapshot;
}
