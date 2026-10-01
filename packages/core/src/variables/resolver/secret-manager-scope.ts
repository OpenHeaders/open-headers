/**
 * The secret-manager scope a SESSION retains — the per-session
 * counterpart of the per-send registry build (the Secret Providers
 * plan, P2b). A session resolves templates at Connect and again per
 * rider typed after the socket opens, through one retained resolver;
 * every pass first ASKS for the secret-manager entries it is about to
 * reference that the session has not resolved yet, then installs the
 * merged registry on the resolver and resolves synchronously as before.
 *
 * A resolved value stays for the session's life (one prompt per entry
 * per session — the retained-resolver discipline, inside L1: the value
 * lives only in this scope's memory and dies with the session). A
 * FAILED entry is asked again on its next reference — a send is a new
 * attempt (the registry never probes; the provider's resolve is the
 * authority, and a denied prompt re-prompts). An entry the vault holds
 * under another kind, or a name the vault lacks, is never asked.
 *
 * Host-neutral: the host hands in the resolve seam — a node host's
 * local broker, the browser page realm's bridge call toward its
 * service worker, a test's fake — so the three session executors, the
 * page-realm factories and the browser's rule compile share this one
 * law. The installer is whatever reads the merged registry: a
 * resolver, or a holder the compile path's resolver is synced from.
 */

import type { SecretBrokerEntry, SecretResolution, SecretResolveFailureReason } from '../../secret-providers/types';
import type { Vault, VaultSecretManager } from '../../types';
import type { VariableResolver } from './variable-resolver';

/** One batch of referenced entries in, each one's typed result out by name. */
export type SecretManagerResolveBatch = (
  entries: readonly SecretBrokerEntry[],
) => Promise<ReadonlyMap<string, SecretResolution>>;

export interface SecretManagerScope {
  /**
   * Resolve the secret-manager entries among `names` the scope has no
   * value for yet (never resolved, or failed last time), then install
   * the merged registry and failures on the resolver. `null` when
   * nothing needs asking — the caller then resolves synchronously, as
   * a pass naming no such entry always did; only a real ask (a
   * provider may prompt) makes it wait. Asks run one after another, so
   * two riders naming the same unresolved entry at once ask for it
   * once. `retryFailed: false` leaves a failed entry as it stands — a
   * pass nobody asked for (a timer's rebuild) never re-prompts for a
   * denial; the next pass a person caused does.
   */
  ensure(names: ReadonlySet<string>, retryFailed?: boolean): Promise<void> | null;
}

/** What reads the merged registry — a resolver, or the compile path's holder. */
export type SecretManagerScopeInstaller = Pick<VariableResolver, 'setSecretManagerRegistry'>;

export function createSecretManagerScope(
  resolver: SecretManagerScopeInstaller,
  vault: Vault,
  resolveBatch: SecretManagerResolveBatch,
): SecretManagerScope {
  const entries = new Map<string, VaultSecretManager>();
  for (const secret of vault.secrets) {
    if (secret.kind === 'secret-manager') entries.set(secret.name, secret);
  }
  const registry = new Map<string, string>();
  const failures = new Map<string, SecretResolveFailureReason>();
  let tail: Promise<void> = Promise.resolve();

  const missing = (names: ReadonlySet<string>, retryFailed: boolean): SecretBrokerEntry[] => {
    const pending: SecretBrokerEntry[] = [];
    for (const name of names) {
      const entry = entries.get(name);
      if (entry === undefined || registry.has(name)) continue;
      if (!retryFailed && failures.has(name)) continue;
      pending.push({ name, locator: entry.locator });
    }
    return pending;
  };

  const resolveMissing = async (names: ReadonlySet<string>, retryFailed: boolean): Promise<void> => {
    // Recomputed behind the chain — an earlier ask may have answered.
    const pending = missing(names, retryFailed);
    if (pending.length === 0) return;
    const results = await resolveBatch(pending);
    for (const { name } of pending) {
      const result = results.get(name);
      if (result?.ok === true) {
        registry.set(name, result.value);
        failures.delete(name);
      } else {
        failures.set(name, result === undefined ? 'unavailable' : result.reason);
      }
    }
    resolver.setSecretManagerRegistry(registry, failures);
  };

  return {
    ensure(names, retryFailed = true) {
      if (missing(names, retryFailed).length === 0) return null;
      const run = tail.then(() => resolveMissing(names, retryFailed));
      tail = run.catch(() => undefined);
      return run;
    },
  };
}
