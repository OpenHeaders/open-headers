/**
 * Which templates carry a secret manager's value once resolved — the
 * names side of the Secret Providers plan's redaction law (L3): a
 * surface that shows what left the wire masks a header, a metadata
 * pair or an outbound message whose template named a vault row of
 * kind Secret Manager, and it learns that from the NAMES the template
 * referenced, never by searching captured text for a value. The
 * executors stamp these facts beside what they recorded; the
 * timelines and exports read the stamps.
 */

import type { Vault } from '../types';
import { collectTemplateVariableNames } from './referenced-names';

/** The vault's secret-manager row names — the set a template is checked against. */
export function secretManagerNamesOf(vault: Vault): ReadonlySet<string> {
  const names = new Set<string>();
  for (const secret of vault.secrets) {
    if (secret.kind === 'secret-manager') names.add(secret.name);
  }
  return names;
}

const NONE: ReadonlySet<string> = new Set();

/** The secret-manager rows the templates reference, by name — explicit
 *  `{{vault.X}}` or the flat `{{X}}` the vault answers first. An empty
 *  set answers empty without reading the templates. */
export function secretManagerReferences(
  templates: Iterable<string>,
  secretNames: ReadonlySet<string>,
): ReadonlySet<string> {
  if (secretNames.size === 0) return NONE;
  const out = new Set<string>();
  for (const name of collectTemplateVariableNames(templates)) {
    if (secretNames.has(name)) out.add(name);
  }
  return out;
}

/** Whether any of the templates references one of the secret-manager rows. */
export function referencesSecretManager(templates: Iterable<string>, secretNames: ReadonlySet<string>): boolean {
  return secretManagerReferences(templates, secretNames).size > 0;
}

/**
 * Every template string reachable in a draft that a send would fill —
 * the deep walk, minus any row switched off (`enabled: false`, the
 * key-value rows' shared convention): a disabled header's reference
 * is never sent, so a count of what leaves must not include it.
 */
export function collectSentTemplateStrings(value: unknown): string[] {
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
      const record = node as Record<string, unknown>;
      if (record.enabled === false) return;
      for (const item of Object.values(record)) walk(item);
    }
  };
  walk(value);
  return out;
}
