/**
 * Referenced-name collection — which variable NAMES an operation's
 * templates can reach through the vault. The per-execution secret-
 * manager registry resolves only these (the Secret Providers plan's
 * binding rule: a vault row the operation never references must never
 * trigger the provider's prompt), so every consume seam computes the
 * set before it builds its resolver.
 *
 * A vault entry is reachable by its explicit `{{vault.X}}` form and by
 * the flat `{{X}}` walk (vault is the first scope the walk consults);
 * every other namespace names a different scope and never reaches the
 * vault.
 */

import { parseReference } from './namespaces';
import { TEMPLATE_REGEX } from './resolver/template';

/** Names the given template strings reference through the vault. */
export function collectTemplateVariableNames(strings: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const text of strings) {
    for (const match of text.matchAll(TEMPLATE_REGEX)) {
      const parsed = parseReference(match[1] ?? '');
      if (!parsed.ok) continue;
      if (parsed.ref.namespace === null || parsed.ref.namespace === 'vault') out.add(parsed.ref.name);
    }
  }
  return out;
}

/**
 * Every string value reachable in an entity, depth first — the
 * kind-agnostic walk for the session request shapes (WebSocket, gRPC,
 * MQTT), whose templated fields have no dedicated collector and whose
 * message riders are typed after the socket opens. Over-inclusive by
 * design (a disabled row's template counts) and never under-inclusive
 * for what the entity holds.
 */
export function collectTemplateStringsDeep(value: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.includes('{{')) out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const item of Object.values(node)) walk(item);
    }
  };
  walk(value);
  return out;
}
