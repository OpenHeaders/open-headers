/**
 * Pure fingerprint of a Live Workflow's EXECUTABLE definition.
 *
 * A workflow's cached token is a function of three recipe inputs: the
 * request each step embeds (`requestExecutableFingerprint`), the
 * variables that request resolves (`workflowVariableFingerprint`), and
 * the workflow definition itself — which steps run, in what order,
 * under what gates, capturing what. This collector covers the third:
 * editing a step's extractor, re-pointing a step at a different
 * request, or adding / removing / reordering steps all change the
 * produced value, so a definition change must invalidate the cache the
 * same way a material request edit does.
 */

import { canonicalJson } from '../sync/store/canonical';
import type { LiveWorkflow } from '../types/live';

/**
 * Stable fingerprint of a workflow's EXECUTABLE definition — every
 * field that influences the value its steps extract. Two workflows
 * with the same fingerprint produce the same captures from the same
 * upstream; a fingerprint change means the cached value was minted by
 * a recipe that no longer exists ("definitional staleness").
 *
 * Included per step (in declared order — array position is the
 * ready-set tiebreak when `priorityFrom` is absent):
 *   - `id`          — referenced by `{{step.<id>.<capture>}}` and by
 *                     gate / priority refs; renaming it reshapes
 *                     resolution.
 *   - `requestUid`  — which request the step invokes.
 *   - `captures`    — each capture's `name` + `extractor` config; the
 *                     extractor is the extraction recipe.
 *   - `dependsOn`   — execution-DAG edges. Sorted: the edge SET is
 *                     semantic, declared order within it is not.
 *   - `runIf`       — conditional gate predicate.
 *   - `priorityFrom`— ready-set ordering tiebreak.
 * Plus `parallelExecution` — switches the runner topology.
 *
 * Excluded as non-executable: `schemaVersion` / `uid` / `path` /
 * `name` / `description` (cosmetic + identity), `enabled` /
 * `published` (scheduling axes — gate WHETHER it runs, not what it
 * produces), `refresh` (cadence — gates WHEN it runs), and per-step
 * `uid` / `description` + per-capture `uid` / `description`. Editing
 * any of those must NOT trigger a refresh.
 *
 * Keyed through `canonicalJson` so structurally-equal workflows
 * serialize byte-identically regardless of object key order.
 */
export function workflowDefinitionFingerprint(workflow: LiveWorkflow): string {
  return canonicalJson({
    parallelExecution: workflow.parallelExecution ?? null,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      requestUid: step.requestUid,
      captures: step.captures.map((capture) => ({
        name: capture.name,
        extractor: capture.extractor,
      })),
      dependsOn: step.dependsOn ? [...step.dependsOn].sort() : null,
      runIf: step.runIf ?? null,
      priorityFrom: step.priorityFrom ?? null,
    })),
  });
}
