/**
 * The values a secret manager has handed this worker — the set the
 * capture planes scrub by (the Secret Providers plan's P2d). Every
 * value the browser host ever holds passes through the loopback
 * broker (a send's registry build, the page realms' session resolves,
 * the rule compile's scope all ask it), so the broker notes each
 * answer here and nothing else needs to register. Add-only for the
 * worker's lifetime: a rotated value stays scrubbed because a row that
 * carried it may still be in the store. Nothing here persists, and
 * nothing here resolves — this is a set of strings, keyed by nothing.
 */

import type { SecretResolution } from '@openheaders/core/secret-providers';

const values = new Set<string>();

/** Note a broker answer's values — the ones that resolved, non-empty. */
export function noteSecretResolutions(results: ReadonlyMap<string, SecretResolution>): void {
  for (const result of results.values()) {
    if (result.ok && result.value !== '') values.add(result.value);
  }
}

/** The values to scrub — empty until a manager has answered. */
export function knownSecretValues(): ReadonlySet<string> {
  return values;
}

export function __resetSecretValueRegistryForTests(): void {
  values.clear();
}
