/**
 * Duplicate-row evidence for the sidebar tree specs.
 *
 * A row id should never repeat — the tree renders each entity once.
 * Intermittently, right after a move's drop, the sidebar keeps a second
 * DOM row for the moved entity: the SW's tree and the post-states the
 * page received are correct, the two DOM rows sit under one DOM parent
 * but belong to two distinct, non-alternate fibers, and the current
 * sibling chain holds the key once (tree containment S12, open
 * finding). `expectUniqueRows` fails with everything the fix session
 * needs; `installBroadcastLog` records the container post-states as the
 * page receives them so the data side is on the record too.
 */

import { expect, type Page } from '@playwright/test';
import type { WorkbenchPage } from './workbench-page';

interface BroadcastLogWindow {
  __ohLog?: unknown[];
}

/** Record every request-collection / request-folder broadcast the page receives (kind, target, item, `items` slots). */
export async function installBroadcastLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log: unknown[] = [];
    (window as unknown as { __ohLog: unknown[] }).__ohLog = log;
    chrome.runtime.onMessage.addListener((message: Record<string, unknown>) => {
      if (message.type !== 'syncBroadcast') return;
      const envelope = message.envelope as { body: { kind: string; type: string; id: string; itemId?: string } };
      if (envelope.body.type !== 'request-folder' && envelope.body.type !== 'request-collection') return;
      const post = (message.requestFolderPostState ?? message.requestCollectionPostState) as
        | { setOrderKeys: Record<string, Array<{ itemId: string }>> }
        | undefined;
      log.push([
        Date.now() % 100000,
        envelope.body.kind,
        envelope.body.type.slice(8),
        envelope.body.id,
        envelope.body.itemId,
        post?.setOrderKeys.items?.map((s) => s.itemId),
      ]);
    });
  });
}

/** Document order of the tree rows, as `data-item-id`s. */
async function rowOrder(page: Page): Promise<string[]> {
  return page.locator('[data-item-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id') ?? ''));
}

/** The React fibers behind each DOM row of `dup`: the host `.tree-dnd-row` fiber identity, its parent and DOM position. */
async function hostFiberFacts(page: Page, dup: string[]): Promise<unknown[]> {
  return page.evaluate(
    (ids: string[]) =>
      ids.map((id) => {
        type Fiber = { alternate: Fiber | null; stateNode: unknown; index: number; return: Fiber | null };
        const wrappers = Array.from(document.querySelectorAll(`[data-item-id="${id}"]`)).map(
          (el) => el.parentElement?.parentElement as HTMLElement,
        );
        const fiberOf = (el: HTMLElement): Fiber | null => {
          const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
          return key ? (el as unknown as Record<string, Fiber>)[key] : null;
        };
        const fibers = wrappers.map(fiberOf);
        const [a, b] = fibers;
        return {
          wrapperClasses: wrappers.map((w) => w?.className),
          sameFiber: a !== null && a === b,
          alternates: a !== null && b !== null && (a.alternate === b || b.alternate === a),
          stateNodeMatches: fibers.map((f, i) => f?.stateNode === wrappers[i]),
          indexes: fibers.map((f) => f?.index),
          sameParentFiber: a !== null && b !== null && a.return === b.return,
          domParentsSame: wrappers[0]?.parentElement === wrappers[1]?.parentElement,
          domIndexes: wrappers.map((w) => (w?.parentElement ? Array.from(w.parentElement.children).indexOf(w) : -1)),
        };
      }),
    dup,
  );
}

export async function expectUniqueRows(
  page: Page,
  workbench: WorkbenchPage,
  consoleLog: readonly string[],
): Promise<void> {
  const order = await rowOrder(page);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const id of order) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  if (duplicates.length === 0) return;
  const evidence = {
    duplicates,
    rows: order,
    hosts: await hostFiberFacts(page, duplicates),
    broadcasts: (await page.evaluate(() => (window as unknown as BroadcastLogWindow).__ohLog ?? [])).slice(-8),
    console: consoleLog.slice(-12),
    swRequests: (
      await workbench.rpc<{ requests?: Array<{ uid: string; path: string }> }>('getLocalRequests')
    ).requests?.map((r) => [r.uid, r.path]),
    swTrees: await workbench.rpc('getLocalRequestCollectionTrees'),
  };
  expect(duplicates, `duplicate rows ${JSON.stringify(evidence)}`).toEqual([]);
}
