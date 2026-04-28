/**
 * Apply a scenario in a given order against a fresh in-memory store
 * and return the canonical snapshot. The invariant: for any complete
 * observation set, the canonical snapshot is the same regardless of
 * apply order (§22.1).
 */

import type { MutationEnvelope } from '../../../src/sync';
import { InMemoryDocumentStore } from '../../../src/sync';
import type { Rng } from './random';

export interface Scenario {
  name: string;
  envelopes: MutationEnvelope[];
}

export function applyOrder(envelopes: readonly MutationEnvelope[]): string {
  const store = new InMemoryDocumentStore();
  for (const env of envelopes) store.apply(env);
  return store.canonicalSnapshot();
}

/**
 * Apply the scenario under K distinct random permutations and assert
 * all canonical snapshots are byte-identical. Returns the snapshot
 * (so callers can additionally assert structural properties).
 */
export function assertConvergent(scenario: Scenario, rng: Rng, permutationsPerScenario: number): string {
  const baseline = applyOrder(scenario.envelopes);
  for (let i = 0; i < permutationsPerScenario - 1; i += 1) {
    const permuted = rng.shuffle(scenario.envelopes.slice());
    const snapshot = applyOrder(permuted);
    if (snapshot !== baseline) {
      throw new Error(
        `convergence violation in scenario ${scenario.name}\n` +
          `permutation ${i + 1}\n` +
          `baseline: ${baseline}\n` +
          `permuted: ${snapshot}`,
      );
    }
  }
  return baseline;
}
