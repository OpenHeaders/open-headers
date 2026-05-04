/**
 * Convergence invariant — Phase A P0 (§22.1).
 *
 * For every generated scenario, applying the mutation set in any total
 * order against a lock-protected in-memory store must produce a
 * byte-identical materialized snapshot. We sample multiple random
 * permutations per scenario; ≥10 000 scenarios across all generators.
 *
 * The harness is deterministic: failures reproduce from the printed
 * seed.
 */

import { describe, expect, it } from 'vitest';
import { makeRng } from '../harness/random';
import { assertConvergent, type Scenario } from '../harness/run';
import {
  genAddRemoveAdd,
  genCollectionRename,
  genConcurrentRenames,
  genCreateDeleteHlcOrder,
  genCrossEntityRequestFolder,
  genCrossEntityRuleEnv,
  genCrossEntityRuleVault,
  genCrossEntityRuleWorkspaceVars,
  genCrossEntityWorkspaceMeta,
  genEnvRename,
  genFolderMove,
  genRequestEdit,
  genRequestFolderMove,
  genRuleReorder,
  genSameFieldSameHlc,
  genSetDeleteRace,
  genTemplateFolderMove,
  genUniformRandom,
  genVariableRenameSameUid,
  genVaultRename,
  genWorkspaceVarsRename,
} from '../harness/scenarios';

const PERMUTATIONS_PER_SCENARIO = 4;

interface Bucket {
  name: string;
  generate: (rng: ReturnType<typeof makeRng>) => Scenario;
  count: number;
}

const BUCKETS: Bucket[] = [
  { name: 'same-field-same-hlc', generate: genSameFieldSameHlc, count: 1500 },
  { name: 'add-remove-add', generate: genAddRemoveAdd, count: 1500 },
  { name: 'set-delete-race', generate: genSetDeleteRace, count: 1500 },
  { name: 'create-delete-hlc-order', generate: genCreateDeleteHlcOrder, count: 1500 },
  { name: 'concurrent-renames', generate: genConcurrentRenames, count: 1500 },
  { name: 'env-rename', generate: genEnvRename, count: 1500 },
  { name: 'collection-rename', generate: genCollectionRename, count: 1500 },
  { name: 'workspace-vars-rename', generate: genWorkspaceVarsRename, count: 1500 },
  { name: 'vault-rename', generate: genVaultRename, count: 1500 },
  { name: 'variable-rename-same-uid', generate: genVariableRenameSameUid, count: 1500 },
  { name: 'rule-reorder', generate: genRuleReorder, count: 1500 },
  { name: 'folder-move', generate: genFolderMove, count: 1500 },
  { name: 'request-edit', generate: genRequestEdit, count: 1500 },
  { name: 'request-folder-move', generate: genRequestFolderMove, count: 1500 },
  { name: 'template-folder-move', generate: genTemplateFolderMove, count: 1500 },
  { name: 'cross-entity-rule-env', generate: genCrossEntityRuleEnv, count: 1500 },
  { name: 'cross-entity-rule-vault', generate: genCrossEntityRuleVault, count: 1500 },
  { name: 'cross-entity-rule-workspace-vars', generate: genCrossEntityRuleWorkspaceVars, count: 1500 },
  { name: 'cross-entity-request-folder', generate: genCrossEntityRequestFolder, count: 1500 },
  { name: 'cross-entity-workspace-meta', generate: genCrossEntityWorkspaceMeta, count: 1500 },
  { name: 'uniform-random', generate: genUniformRandom, count: 2500 },
];

const SEED_BASE = 0x3f3f_5a7c;

describe('convergence under any total order', () => {
  for (const bucket of BUCKETS) {
    it(`${bucket.name} (×${bucket.count})`, () => {
      const rng = makeRng(SEED_BASE ^ hashName(bucket.name));
      for (let i = 0; i < bucket.count; i += 1) {
        const scenario = bucket.generate(rng);
        try {
          assertConvergent(scenario, rng, PERMUTATIONS_PER_SCENARIO);
        } catch (err) {
          throw new Error(
            `bucket=${bucket.name} iteration=${i} seed=${SEED_BASE ^ hashName(bucket.name)}\n` +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      }
    });
  }

  it('total scenario count meets the 10 000 floor', () => {
    const total = BUCKETS.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBeGreaterThanOrEqual(10_000);
  });
});

function hashName(s: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}
