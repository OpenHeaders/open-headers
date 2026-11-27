/**
 * What the steps of a workflow's runs produced, held by run and step
 * (the workflow runs plan, The Run view). One hold serves the realm that
 * ran the steps and the page that keeps the runs.
 *
 * A hold keeps a count of runs a workflow: one in the realm that ran
 * them, where a workflow's products are held until it runs again; as
 * many as the page lists. Across workflows the held bodies are bounded:
 * past the budget the oldest runs give theirs up first, never the run
 * that is holding.
 */

import type { StepProduct } from './run-events';

export interface RunProductHold {
  /** A run of this workflow begins — past the count kept a workflow, its oldest run is dropped. */
  open(workflowKey: string, runId: string): void;
  /** Hold one step's product. A run this hold no longer keeps holds nothing. */
  put(workflowKey: string, runId: string, stepId: string, product: StepProduct): void;
  get(runId: string, stepId: string): StepProduct | null;
  clear(): void;
}

interface HeldRun {
  workflowKey: string;
  products: Map<string, StepProduct>;
  bodySize: number;
}

function bodySizeOf(product: StepProduct): number {
  if (product.kind === 'response') return product.snapshot.body.length;
  let size = (product.message?.body.length ?? 0) + (product.reply?.body.length ?? 0);
  for (const entry of product.window ?? []) size += entry.message.body.length;
  return size;
}

/** `bodyBudget` is in body characters, across every run held. */
export function createRunProductHold(bodyBudget: number, runsPerWorkflow = 1): RunProductHold {
  // By run id. Insertion order is age.
  const held = new Map<string, HeldRun>();
  return {
    open(workflowKey, runId) {
      held.delete(runId);
      held.set(runId, { workflowKey, products: new Map(), bodySize: 0 });
      let count = 0;
      for (const each of held.values()) if (each.workflowKey === workflowKey) count += 1;
      for (const [oldestId, oldest] of held) {
        if (count <= runsPerWorkflow) break;
        if (oldest.workflowKey !== workflowKey) continue;
        held.delete(oldestId);
        count -= 1;
      }
    },
    put(workflowKey, runId, stepId, product) {
      const run = held.get(runId);
      if (run === undefined || run.workflowKey !== workflowKey) return;
      run.products.set(stepId, product);
      run.bodySize += bodySizeOf(product);
      let total = 0;
      for (const each of held.values()) total += each.bodySize;
      for (const [oldestId, oldest] of held) {
        if (total <= bodyBudget || oldest === run) break;
        held.delete(oldestId);
        total -= oldest.bodySize;
      }
    },
    get(runId, stepId) {
      return held.get(runId)?.products.get(stepId) ?? null;
    },
    clear() {
      held.clear();
    },
  };
}
