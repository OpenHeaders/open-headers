/**
 * What the steps of each workflow's last run produced, held by run and
 * step (the workflow runs plan, The Run view). One hold serves the realm
 * that ran the steps and the page that keeps the run.
 *
 * A workflow's products are held until that workflow runs again. Across
 * workflows the held bodies are bounded: past the budget the oldest runs
 * give theirs up first, never the run that is holding.
 */

import type { StepProduct } from './run-events';

export interface RunProductHold {
  /** A run of this workflow begins — whatever its last run held is dropped. */
  open(workflowKey: string, runId: string): void;
  /** Hold one step's product. A run other than the workflow's open one holds nothing. */
  put(workflowKey: string, runId: string, stepId: string, product: StepProduct): void;
  get(runId: string, stepId: string): StepProduct | null;
  clear(): void;
}

interface HeldRun {
  runId: string;
  products: Map<string, StepProduct>;
  bodySize: number;
}

function bodySizeOf(product: StepProduct): number {
  if (product.kind === 'response') return product.snapshot.body.length;
  let size = (product.message?.body.length ?? 0) + (product.reply?.body.length ?? 0);
  for (const entry of product.window ?? []) size += entry.message.body.length;
  return size;
}

/** `bodyBudget` is in body characters, across every workflow held. */
export function createRunProductHold(bodyBudget: number): RunProductHold {
  // Insertion order is age: a workflow's entry is re-inserted when it runs again.
  const held = new Map<string, HeldRun>();
  return {
    open(workflowKey, runId) {
      held.delete(workflowKey);
      held.set(workflowKey, { runId, products: new Map(), bodySize: 0 });
    },
    put(workflowKey, runId, stepId, product) {
      const run = held.get(workflowKey);
      if (run === undefined || run.runId !== runId) return;
      run.products.set(stepId, product);
      run.bodySize += bodySizeOf(product);
      let total = 0;
      for (const each of held.values()) total += each.bodySize;
      for (const [oldestKey, oldest] of held) {
        if (total <= bodyBudget || oldest === run) break;
        held.delete(oldestKey);
        total -= oldest.bodySize;
      }
    },
    get(runId, stepId) {
      for (const run of held.values()) {
        if (run.runId === runId) return run.products.get(stepId) ?? null;
      }
      return null;
    },
    clear() {
      held.clear();
    },
  };
}
