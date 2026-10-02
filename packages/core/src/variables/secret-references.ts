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

/** Whether any of the templates references one of the secret-manager
 *  rows — explicit `{{vault.X}}` or the flat `{{X}}` the vault answers
 *  first. An empty set answers `false` without reading the templates. */
export function referencesSecretManager(templates: Iterable<string>, secretNames: ReadonlySet<string>): boolean {
  if (secretNames.size === 0) return false;
  for (const name of collectTemplateVariableNames(templates)) {
    if (secretNames.has(name)) return true;
  }
  return false;
}
