/**
 * Phase 10 stale-draft e2e — verifies the full contract end-to-end
 * against a real Chromium + real `navigator.locks`:
 *
 *   1. Creating a rule stamps `version: 1`.
 *   2. Saving with a matching `expectedVersion` increments it.
 *   3. Saving with a stale `expectedVersion` is rejected with
 *      `{ ok: false, reason: 'stale-draft', serverVersion, serverRule }`.
 *   4. Two concurrent saves with the same `expectedVersion` produce
 *      exactly one winner — the other sees `stale-draft`. Web Locks
 *      serialize the read-modify-write at the SW's storage boundary.
 *
 * We drive the RPC directly from page contexts rather than the rule
 * editor UI because Phase 10's invariants are a contract between the
 * SW and the renderer, not a UI affordance — exercising the RPC
 * round-trip keeps the test narrow and deterministic.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2];
});

test.afterAll(async () => {
  await context.close();
});

async function newRpcPage(): Promise<Page> {
  // Popup is the simplest extension-origin page — gives us `chrome.*`
  // access + a working runtime.sendMessage channel to the SW.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  return page;
}

/** Send a typed RPC from a page and return its response. */
async function rpc(page: Page, type: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  return page.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  );
}

interface UpdateSuccess {
  ok: true;
  version: number;
  rule: { uid: string; name: string; version: number };
}

interface UpdateStaleDraft {
  ok: false;
  reason: 'stale-draft';
  serverVersion: number;
  serverRule: { uid: string; name: string; version: number };
}

interface UpdateOtherFailure {
  ok: false;
  reason: 'not-found' | 'other';
  message?: string;
}

type UpdateResult = UpdateSuccess | UpdateStaleDraft | UpdateOtherFailure;

test.describe('Phase 10 — rule version counter', () => {
  test('createLocalRule stamps version: 1', async () => {
    const caller = await newRpcPage();
    try {
      const created = (await rpc(caller, 'createLocalRule', {
        rule: {
          name: 'Phase10 ver1',
          type: 'header',
          enabled: true,
          conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X-Auth', value: 'v1' }],
            responseHeaders: [],
          },
        },
      })) as { success: true; rule: { uid: string; version: number } };
      expect(created.success).toBe(true);
      expect(created.rule.version).toBe(1);

      // Tidy up — delete so we don't pollute state for concurrent
      // tests sharing the same persistent context.
      await rpc(caller, 'deleteRule', { ruleId: created.rule.uid });
    } finally {
      await caller.close();
    }
  });

  test('updateLocalRule with matching expectedVersion advances to version: 2', async () => {
    const caller = await newRpcPage();
    try {
      const created = (await rpc(caller, 'createLocalRule', {
        rule: {
          name: 'Phase10 advance',
          type: 'header',
          enabled: true,
          conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X', value: 'a' }],
            responseHeaders: [],
          },
        },
      })) as { success: true; rule: { uid: string; version: number } };

      const result = (await rpc(caller, 'updateLocalRule', {
        ruleId: created.rule.uid,
        updates: { name: 'Phase10 advance v2' },
        expectedVersion: 1,
      })) as UpdateResult;

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.version).toBe(2);

      await rpc(caller, 'deleteRule', { ruleId: created.rule.uid });
    } finally {
      await caller.close();
    }
  });
});

test.describe('Phase 10 — stale-draft rejection', () => {
  test('second save with the original expectedVersion sees stale-draft', async () => {
    const tabA = await newRpcPage();
    const tabB = await newRpcPage();
    try {
      const created = (await rpc(tabA, 'createLocalRule', {
        rule: {
          name: 'Phase10 race',
          type: 'header',
          enabled: true,
          conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X', value: 'seed' }],
            responseHeaders: [],
          },
        },
      })) as { success: true; rule: { uid: string; version: number } };
      const ruleId = created.rule.uid;
      expect(created.rule.version).toBe(1);

      // Tab A saves first. Version advances to 2.
      const firstSave = (await rpc(tabA, 'updateLocalRule', {
        ruleId,
        updates: { name: 'Phase10 race — A wins' },
        expectedVersion: 1,
      })) as UpdateResult;
      expect(firstSave.ok).toBe(true);
      if (firstSave.ok) expect(firstSave.version).toBe(2);

      // Tab B, unaware, saves with stale expectedVersion=1.
      const secondSave = (await rpc(tabB, 'updateLocalRule', {
        ruleId,
        updates: { name: 'Phase10 race — B loses' },
        expectedVersion: 1,
      })) as UpdateResult;
      expect(secondSave.ok).toBe(false);
      if (!secondSave.ok && secondSave.reason === 'stale-draft') {
        expect(secondSave.serverVersion).toBe(2);
        expect(secondSave.serverRule.name).toBe('Phase10 race — A wins');
      } else {
        throw new Error(`expected stale-draft; got ${JSON.stringify(secondSave)}`);
      }

      await rpc(tabA, 'deleteRule', { ruleId });
    } finally {
      await tabA.close();
      await tabB.close();
    }
  });

  test('concurrent saves — exactly one winner, one stale-draft (Web Locks serialize)', async () => {
    const tabA = await newRpcPage();
    const tabB = await newRpcPage();
    try {
      const created = (await rpc(tabA, 'createLocalRule', {
        rule: {
          name: 'Phase10 concurrent',
          type: 'header',
          enabled: true,
          conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X', value: 'seed' }],
            responseHeaders: [],
          },
        },
      })) as { success: true; rule: { uid: string; version: number } };
      const ruleId = created.rule.uid;

      // Both tabs call updateLocalRule at once with expectedVersion=1.
      // Web Locks in the SW must serialize — one acquires first, bumps
      // version to 2; the other observes 2 and stale-drafts.
      const [resA, resB] = await Promise.all([
        rpc(tabA, 'updateLocalRule', {
          ruleId,
          updates: { name: 'A' },
          expectedVersion: 1,
        }) as Promise<UpdateResult>,
        rpc(tabB, 'updateLocalRule', {
          ruleId,
          updates: { name: 'B' },
          expectedVersion: 1,
        }) as Promise<UpdateResult>,
      ]);

      const winners = [resA, resB].filter((r) => r.ok);
      const losers = [resA, resB].filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      const loser = losers[0];
      if (!loser.ok) expect(loser.reason).toBe('stale-draft');

      await rpc(tabA, 'deleteRule', { ruleId });
    } finally {
      await tabA.close();
      await tabB.close();
    }
  });

  test('three tabs save the same rule concurrently — 1 winner, 2 stale-draft; final state converges', async () => {
    // Plan §Phase 10 verification — scale the 2-context fuzz to 3
    // contexts. Web Locks serialize every read-modify-write; exactly
    // one save lands on disk and the other two surface stale-draft
    // with the WINNER's copy as the server state (proves no partial
    // merge, no lost writes, no duplicated entity).
    const tabA = await newRpcPage();
    const tabB = await newRpcPage();
    const tabC = await newRpcPage();
    try {
      const created = (await rpc(tabA, 'createLocalRule', {
        rule: {
          name: 'Phase10 three-ctx',
          type: 'header',
          enabled: true,
          conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X', value: 'seed' }],
            responseHeaders: [],
          },
        },
      })) as { success: true; rule: { uid: string; version: number } };
      const ruleId = created.rule.uid;

      const [resA, resB, resC] = await Promise.all([
        rpc(tabA, 'updateLocalRule', {
          ruleId,
          updates: { name: 'tab-A' },
          expectedVersion: 1,
        }) as Promise<UpdateResult>,
        rpc(tabB, 'updateLocalRule', {
          ruleId,
          updates: { name: 'tab-B' },
          expectedVersion: 1,
        }) as Promise<UpdateResult>,
        rpc(tabC, 'updateLocalRule', {
          ruleId,
          updates: { name: 'tab-C' },
          expectedVersion: 1,
        }) as Promise<UpdateResult>,
      ]);

      const winners = [resA, resB, resC].filter((r) => r.ok);
      const losers = [resA, resB, resC].filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(2);

      // Every loser sees `stale-draft` with serverVersion=2 and the
      // winner's name — no merge mayhem, deterministic view.
      const winner = winners[0];
      if (!winner.ok) throw new Error('invariant: winner must be ok');
      expect(winner.version).toBe(2);
      const winnerName = winner.rule.name;

      for (const loser of losers) {
        expect(loser.ok).toBe(false);
        if (!loser.ok && loser.reason === 'stale-draft') {
          expect(loser.serverVersion).toBe(2);
          expect(loser.serverRule.name).toBe(winnerName);
        } else {
          throw new Error(`expected stale-draft; got ${JSON.stringify(loser)}`);
        }
      }

      // Final storage state matches the winner — read from a fresh
      // tab to confirm the SW's storage write survived the race.
      const readBack = (await rpc(tabA, 'getLocalRules', {})) as {
        rules: Array<{ uid: string; name: string; version: number }>;
      };
      const finalRule = readBack.rules.find((r) => r.uid === ruleId);
      expect(finalRule).toBeDefined();
      expect(finalRule?.version).toBe(2);
      expect(finalRule?.name).toBe(winnerName);

      await rpc(tabA, 'deleteRule', { ruleId });
    } finally {
      await tabA.close();
      await tabB.close();
      await tabC.close();
    }
  });
});
