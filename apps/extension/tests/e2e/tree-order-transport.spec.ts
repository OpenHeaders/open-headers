/**
 * Tree order in transport — the extension host end to end, on a
 * workspace seeded straight into `chrome.storage` the way an S8-era
 * build left it (a `{ folders, items }` tree-order record, examples
 * whose capture times run backwards) and relaunched so the service
 * worker boots from that state:
 *
 *   T1  the boot normalises the legacy record once: folders then
 *       leaves on screen, the record rewritten as one `children` list;
 *   T2  a request's response examples render in slot order, not by
 *       `capturedAt`;
 *   T3  one drag interleaves a request between the two folders;
 *   T4  the export stamps that interleave as `order:` on the
 *       collection;
 *   T5  importing it into a fresh workspace (new uids) reproduces the
 *       interleave — the deep copy remapped `order` onto the new
 *       segments and the emission planned it;
 *   T6  importing a reversed `order` OVER the existing collection
 *       reorders it; with "keep target order" the recipient's order
 *       stands;
 *   T7  a workspace duplicate carries the examples' slot order.
 *
 * Reads are DOM order (`data-item-id`) for the active workspace and the
 * persisted `oh.ws.<id>.*` slots / a workspace export for the others.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { SEED } from './fixtures/tree-order-ids';
import { TreeRows } from './pages/tree-rows';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SEED_SCRIPT = path.join(__dirname, 'fixtures/tree-order-seed.ts');

let profileDir: string;
let context: BrowserContext;
let page: Page;
let workbench: WorkbenchPage;
let rows: TreeRows;
let workspaceId: string;

const COL = `req-col-${SEED.collection}`;
const FA = `req-folder-${SEED.folderA}`;
const FB = `req-folder-${SEED.folderB}`;
const R1 = `request-${SEED.r1}`;
const R2 = `request-${SEED.r2}`;
const R3 = `request-${SEED.r3}`;
const CHILDREN = [FA, FB, R1, R2, R3];

interface ExportEnvelope {
  entities: {
    collections: Array<{ uid: string; name: string; order?: string[] }>;
    folders: Array<{ uid: string; name: string; order?: string[] }>;
  };
}

/** Run the tsx seed/parse helper (core schemas are TS source the Playwright loader cannot resolve). */
function helper(args: string[], input?: string, env: Record<string, string> = {}): string {
  const result = spawnSync('pnpm', ['--filter', '@openheaders/extension', 'exec', 'tsx', SEED_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    input,
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

/** The uid tail of a directory segment (`<slug>-<uid>`). */
const uidOf = (segment: string): string => segment.slice(-8);
/** The slug of a directory segment — what survives a new-uid import. */
const slugOf = (segment: string): string => segment.slice(0, -9);

async function launch(): Promise<void> {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;
  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);
  rows = new TreeRows(page);
}

async function storageGet<T>(key: string): Promise<T | undefined> {
  return page.evaluate(
    (k: string) => new Promise<T | undefined>((resolve) => chrome.storage.local.get(k, (items) => resolve(items[k]))),
    key,
  );
}

async function exportCollection(): Promise<{ yaml: string; envelope: ExportEnvelope }> {
  const res = await workbench.rpc<{ success: boolean; yaml?: string; error?: string }>('exportWorkspace', {
    scope: { kind: 'selection', selection: { collections: [SEED.collection] } },
  });
  expect(res.success, res.error).toBe(true);
  const yaml = res.yaml!;
  return { yaml, envelope: JSON.parse(helper(['parse'], yaml)) as ExportEnvelope };
}

async function exportWorkspaceOf(id: string): Promise<ExportEnvelope> {
  const res = await workbench.rpc<{ success: boolean; yaml?: string; error?: string }>('exportWorkspace', {
    workspaceId: id,
    scope: { kind: 'workspace' },
  });
  expect(res.success, res.error).toBe(true);
  return JSON.parse(helper(['parse'], res.yaml!)) as ExportEnvelope;
}

function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function importOverExisting(envelope: ExportEnvelope, yaml: string, keepTargetOrder: boolean): Promise<void> {
  const update = (uids: string[]) => Object.fromEntries(uids.map((uid) => [uid, 'update']));
  const res = await workbench.rpc<{ success: boolean; error?: string }>('importWorkspace', {
    incoming: envelope,
    strategies: {
      collections: update([SEED.collection]),
      folders: update([SEED.folderA, SEED.folderB]),
      requests: update([SEED.r1, SEED.r2, SEED.r3, SEED.inFolder]),
    },
    keepTargetCollectionOrder: keepTargetOrder,
    target: { mode: 'picked', workspaceId },
    sourceHash: sha256(yaml),
  });
  expect(res.success, res.error).toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(90_000);
  profileDir = await mkdtemp(path.join(tmpdir(), 'oh-tree-order-e2e-'));

  // Boot once to mint the default workspace and learn its id, seed the
  // S8-era slots straight into chrome.storage, then relaunch on the
  // same profile: the service worker rebuilds its oracle from those
  // projections and the hydration pass keys the seeded tree.
  await launch();
  const active = await workbench.rpc<{ workspace: { id: string } | null }>('getActiveWorkspace');
  expect(active.workspace).toBeTruthy();
  workspaceId = active.workspace!.id;
  // The registry persists asynchronously; closing before it lands would
  // let the relaunch mint a fresh default workspace under a new id.
  await expect
    .poll(
      async () => {
        const registry = await storageGet<Array<{ id: string }>>('oh.workspaces');
        return registry?.some((workspace) => workspace.id === workspaceId) ?? false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  const values = JSON.parse(helper(['seed', 'legacy'], undefined, { OH_E2E_WORKSPACE_ID: workspaceId })) as Record<
    string,
    unknown
  >;
  await page.evaluate(
    (items: Record<string, unknown>) => new Promise<void>((resolve) => chrome.storage.local.set(items, resolve)),
    values,
  );
  await context.close();

  await launch();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
  await rows.expandIfCollapsed(COL);
});

test.afterAll(async () => {
  await context?.close();
});

test('T1 — an S8-era record boots as folders then leaves and is rewritten as one children list', async () => {
  await expect.poll(() => rows.orderOf(CHILDREN)).toEqual([FA, FB, R1, R2, R3]);
  await expect
    .poll(async () => {
      const record = await storageGet<{ containers: Record<string, { children?: string[] }> }>(
        `oh.ws.${workspaceId}.treeOrder`,
      );
      return record?.containers[`request-collection:${SEED.collection}`]?.children ?? null;
    })
    .toEqual([SEED.folderA, SEED.folderB, SEED.r1, SEED.r2, SEED.r3]);
});

test('T2 — response examples render in slot order, not by capture time', async () => {
  await rows.expandIfCollapsed(R1);
  const examples = [SEED.e1, SEED.e2, SEED.e3].map((uid) => `resp-example-${uid}`);
  await expect.poll(() => rows.orderOf(examples)).toEqual(examples);
  await rows.row(R1).click();
});

test('T3 — a request dragged onto the upper band of the second folder lands between the folders', async () => {
  await rows.drag(rows.row(R1), rows.row(FB), 0.2);
  await rows.expectMovedToast(1);
  await expect.poll(() => rows.orderOf(CHILDREN)).toEqual([FA, R1, FB, R2, R3]);
});

test('T4 — the export stamps the interleave as order: on the collection', async () => {
  const { envelope } = await exportCollection();
  const collection = envelope.entities.collections.find((c) => c.uid === SEED.collection);
  expect(collection?.order?.map(uidOf)).toEqual([SEED.folderA, SEED.r1, SEED.folderB, SEED.r2, SEED.r3]);
  const folderA = envelope.entities.folders.find((f) => f.uid === SEED.folderA);
  expect(folderA?.order?.map(uidOf)).toEqual([SEED.inFolder]);
});

test('T5 — importing into a fresh workspace reproduces the interleave on the new uids', async () => {
  const { yaml, envelope } = await exportCollection();
  const res = await workbench.rpc<{ success: boolean; targetWorkspaceId?: string; error?: string }>('importWorkspace', {
    incoming: envelope,
    strategies: {},
    target: { mode: 'new', name: 'Imported Order' },
    sourceHash: sha256(yaml),
  });
  expect(res.success, res.error).toBe(true);
  const sourceOrder = envelope.entities.collections.find((c) => c.uid === SEED.collection)?.order ?? [];
  await expect
    .poll(async () => {
      const imported = await exportWorkspaceOf(res.targetWorkspaceId!);
      const mixed = imported.entities.collections.find((c) => c.name === 'Mixed');
      return mixed?.order?.map(slugOf) ?? null;
    })
    .toEqual(sourceOrder.map(slugOf));
});

test('T6 — a reversed order imported over the existing collection reorders it; keep-target-order does not', async () => {
  const { yaml, envelope } = await exportCollection();
  const collection = envelope.entities.collections.find((c) => c.uid === SEED.collection)!;
  const reversed: ExportEnvelope = {
    ...envelope,
    entities: {
      ...envelope.entities,
      collections: envelope.entities.collections.map((c) =>
        c.uid === SEED.collection ? { ...c, order: [...(c.order ?? [])].reverse() } : c,
      ),
    },
  };
  expect(collection.order).toHaveLength(5);

  await importOverExisting(reversed, yaml, false);
  await expect.poll(() => rows.orderOf(CHILDREN)).toEqual([R3, R2, FB, R1, FA]);

  await importOverExisting(envelope, yaml, true);
  await page.waitForTimeout(1000);
  expect(await rows.orderOf(CHILDREN)).toEqual([R3, R2, FB, R1, FA]);

  await importOverExisting(envelope, yaml, false);
  await expect.poll(() => rows.orderOf(CHILDREN)).toEqual([FA, R1, FB, R2, R3]);
});

test('T7 — a workspace duplicate carries the examples in slot order', async () => {
  const res = await workbench.rpc<{ success: boolean; workspace?: { id: string }; error?: string }>(
    'duplicateWorkspace',
    { id: workspaceId, name: 'Order Duplicate' },
  );
  expect(res.success, res.error).toBe(true);
  await expect
    .poll(async () => {
      const examples = await storageGet<Array<{ uid: string }>>(`oh.ws.${res.workspace!.id}.responseExamples`);
      return examples?.map((example) => example.uid) ?? null;
    })
    .toEqual([SEED.e1, SEED.e2, SEED.e3]);
  await expect
    .poll(async () => {
      const record = await storageGet<{ containers: Record<string, { children?: string[] }> }>(
        `oh.ws.${res.workspace!.id}.treeOrder`,
      );
      return record?.containers[`request-collection:${SEED.collection}`]?.children ?? null;
    })
    .toEqual([SEED.folderA, SEED.r1, SEED.folderB, SEED.r2, SEED.r3]);
});
