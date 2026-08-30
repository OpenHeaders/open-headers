/**
 * Sidebar tree dnd e2e — the request tree's move gestures end to end,
 * on the one merged child order (the tree containment plan, slice 7b):
 * a leaf reorders among its siblings, a leaf drops into a folder, a
 * folder moves across collections, a collection reorders, a Cmd-click
 * multi-selection moves together in visible order, a folder created
 * from the container's `+` lands last, a request lands between two
 * folders and a folder between two requests, Alt+↑/↓ move across
 * kinds, Alt+← lands right after the folder left, a mixed folder +
 * request selection lands together and first, the order survives a
 * reload, and a collection delete follows the sets — a request dragged
 * out survives, one dragged in goes with it, nothing rehomes. Every
 * drop is one move on the parent's ordered set — the rows' document
 * order is what the assertions read (`data-item-id`); the toast
 * confirms the count.
 *
 * Drags are real pointer sequences: press on the source row, glide
 * onto the target row's band, release. The tests chain on one tree,
 * so the suite is serial — a failure stops it rather than reseeding a
 * fresh worker under the rest.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';
import { expectUniqueRows, installBroadcastLog } from './pages/duplicate-rows';
import { TreeRows } from './pages/tree-rows';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let page: Page;
let workbench: WorkbenchPage;
let rows: TreeRows;
const consoleLog: string[] = [];

const ids = { colA: '', colB: '', folder: '', second: '', r1: '', r2: '', r3: '', r4: '' };
const col = (uid: string): string => `req-col-${uid}`;
const folder = (uid: string): string => `req-folder-${uid}`;
const request = (uid: string): string => `request-${uid}`;
const requestRow = (uid: string): Locator => rows.row(request(uid));

/** Persist an HTTP request under a collection or a folder path via the real CRUD RPC; returns its uid. */
async function seedRequest(name: string, target: { collectionUid?: string; parentPath?: string }): Promise<string> {
  const res = await workbench.rpc<{ success: boolean; request?: { uid: string }; error?: string }>(
    'createLocalRequest',
    { name, ...target, seed: { method: 'GET', url: 'https://api.openheaders.io/v1', headers: [], params: [] } },
  );
  expect(res.success, res.error).toBe(true);
  return res.request!.uid;
}

/** The rows right under a container row, `count` of them. */
async function childrenOf(containerId: string, count: number): Promise<string[]> {
  const order = await rows.order();
  const at = order.indexOf(containerId);
  return order.slice(at + 1, at + 1 + count);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;
  page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleLog.push(`${msg.type()}: ${msg.text()}`);
  });
  workbench = await WorkbenchPage.open(page, extensionId);
  rows = new TreeRows(page);

  ids.colA = await workbench.seedRequestCollection('Alpha');
  ids.colB = await workbench.seedRequestCollection('Beta');
  const collections = await workbench.rpc<{ collections?: Array<{ uid: string; path: string }> }>(
    'getLocalRequestCollections',
  );
  const pathOf = (uid: string): string => collections.collections?.find((c) => c.uid === uid)?.path ?? '';
  const nested = await workbench.rpc<{ success: boolean; folder?: { uid: string; path: string } }>(
    'createLocalRequestFolder',
    { name: 'Nested', parentPath: pathOf(ids.colA) },
  );
  expect(nested.success).toBe(true);
  ids.folder = nested.folder!.uid;
  ids.r1 = await seedRequest('r1', { collectionUid: ids.colA });
  ids.r2 = await seedRequest('r2', { collectionUid: ids.colA });
  ids.r3 = await seedRequest('r3', { collectionUid: ids.colA });
  ids.r4 = await seedRequest('r4', { parentPath: nested.folder!.path });

  await workbench.reload();
  await installBroadcastLog(page);
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
  await rows.expandIfCollapsed(col(ids.colA));
  await rows.expandIfCollapsed(folder(ids.folder));
});

test.afterAll(async () => {
  await context?.close();
});

test('a leaf dropped on the lower band of a sibling lands after it', async () => {
  await rows.drag(requestRow(ids.r1), requestRow(ids.r3), 0.8);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([request(ids.r1), request(ids.r2), request(ids.r3)]))
    .toEqual([request(ids.r2), request(ids.r3), request(ids.r1)]);
});

test('a leaf dropped on a folder row lands inside it, first among its children', async () => {
  await rows.drag(requestRow(ids.r2), rows.row(folder(ids.folder)), 0.5);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect.poll(() => childrenOf(folder(ids.folder), 2)).toEqual([request(ids.r2), request(ids.r4)]);
});

test('a folder dropped on another collection moves there with its subtree', async () => {
  await rows.drag(rows.row(folder(ids.folder)), rows.row(col(ids.colB)), 0.5);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await rows.expandIfCollapsed(col(ids.colB));
  await rows.expandIfCollapsed(folder(ids.folder));
  await expect.poll(() => childrenOf(col(ids.colB), 3)).toEqual([folder(ids.folder), request(ids.r2), request(ids.r4)]);
});

test('a collection dropped on the upper band of another reorders the roots', async () => {
  await rows.drag(rows.row(col(ids.colB)), rows.row(col(ids.colA)), 0.2);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect.poll(() => rows.orderOf([col(ids.colA), col(ids.colB)])).toEqual([col(ids.colB), col(ids.colA)]);
});

test('a dragged member of the multi-selection takes the selection along, in visible order', async () => {
  // Alpha reads r3, r1 top to bottom; the selection lands in that order.
  await requestRow(ids.r3).click();
  await requestRow(ids.r1).click({ modifiers: ['Meta'] });
  await requestRow(ids.r3).click({ modifiers: ['Meta'] });
  await rows.drag(requestRow(ids.r3), rows.row(folder(ids.folder)), 0.5);
  await rows.expectMovedToast(2);
  await page.waitForTimeout(1500);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => childrenOf(folder(ids.folder), 4))
    .toEqual([request(ids.r3), request(ids.r1), request(ids.r2), request(ids.r4)]);
});

test('a folder created from the container + lands last', async () => {
  await rows.addFolder(col(ids.colB));
  const folders = await workbench.rpc<{ folders?: Array<{ uid: string; name: string }> }>('getLocalRequestFolders');
  ids.second = folders.folders?.find((f) => f.name === 'New Folder')?.uid ?? '';
  expect(ids.second).not.toBe('');
  // The new folder opens its overview; the tree stays where it was.
  await rows.expandIfCollapsed(col(ids.colB));
  await rows.expandIfCollapsed(folder(ids.folder));
  await expect
    .poll(() => rows.orderOf([folder(ids.folder), folder(ids.second), request(ids.r4)]))
    .toEqual([folder(ids.folder), request(ids.r4), folder(ids.second)]);
});

test('a request dropped on the upper band of a folder lands between the two folders', async () => {
  await rows.drag(requestRow(ids.r2), rows.row(folder(ids.second)), 0.2);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([folder(ids.folder), request(ids.r2), folder(ids.second), request(ids.r4)]))
    .toEqual([folder(ids.folder), request(ids.r4), request(ids.r2), folder(ids.second)]);
});

test('a folder dropped between two requests sits between them', async () => {
  // r4 out of Nested, after r2: Beta reads Nested, r2, r4, New Folder.
  await rows.drag(requestRow(ids.r4), requestRow(ids.r2), 0.8);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([folder(ids.folder), request(ids.r2), request(ids.r4), folder(ids.second)]))
    .toEqual([folder(ids.folder), request(ids.r2), request(ids.r4), folder(ids.second)]);
  // Nested onto the lower band of r2: it ends between r2 and r4.
  await rows.drag(rows.row(folder(ids.folder)), requestRow(ids.r2), 0.8);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([request(ids.r2), folder(ids.folder), request(ids.r4), folder(ids.second)]))
    .toEqual([request(ids.r2), folder(ids.folder), request(ids.r4), folder(ids.second)]);
});

test('Alt+Up and Alt+Down move a request across a folder', async () => {
  await rows.keyboardMove(request(ids.r4), 'ArrowUp');
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([request(ids.r2), request(ids.r4), folder(ids.folder), folder(ids.second)]))
    .toEqual([request(ids.r2), request(ids.r4), folder(ids.folder), folder(ids.second)]);
  await rows.keyboardMove(request(ids.r2), 'ArrowDown');
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([request(ids.r2), request(ids.r4), folder(ids.folder), folder(ids.second)]))
    .toEqual([request(ids.r4), request(ids.r2), folder(ids.folder), folder(ids.second)]);
});

test('Alt+Left moves a request out of its folder to sit right after it', async () => {
  await rows.expandIfCollapsed(folder(ids.folder));
  await rows.keyboardMove(request(ids.r1), 'ArrowLeft');
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await expect
    .poll(() => rows.orderOf([folder(ids.folder), request(ids.r3), request(ids.r1), folder(ids.second)]))
    .toEqual([folder(ids.folder), request(ids.r3), request(ids.r1), folder(ids.second)]);
  // r1 sits at Beta's level, not inside Nested.
  const folders = await workbench.rpc<{ folders?: Array<{ uid: string; path: string }> }>('getLocalRequestFolders');
  const requests = await workbench.rpc<{ requests?: Array<{ uid: string; path: string }> }>('getLocalRequests');
  const nestedPath = folders.folders?.find((f) => f.uid === ids.folder)?.path ?? '';
  const r1Path = requests.requests?.find((r) => r.uid === ids.r1)?.path ?? '';
  expect(r1Path.startsWith(`${nestedPath}/`)).toBe(false);
});

test('a mixed folder + request selection dropped on a collection lands together, first', async () => {
  await rows.drag(requestRow(ids.r2), rows.row(col(ids.colA)), 0.5);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await rows.expandIfCollapsed(col(ids.colA));
  await expect.poll(() => childrenOf(col(ids.colA), 1)).toEqual([request(ids.r2)]);

  await rows.row(folder(ids.folder)).click();
  await requestRow(ids.r1).click({ modifiers: ['Meta'] });
  await rows.row(folder(ids.folder)).click({ modifiers: ['Meta'] });
  await rows.drag(requestRow(ids.r1), rows.row(col(ids.colA)), 0.5);
  await rows.expectMovedToast(2);
  await page.waitForTimeout(1500);
  await expectUniqueRows(page, workbench, consoleLog);
  await rows.expandIfCollapsed(col(ids.colA));
  await expect
    .poll(() => rows.orderOf([folder(ids.folder), request(ids.r1), request(ids.r2)]))
    .toEqual([folder(ids.folder), request(ids.r1), request(ids.r2)]);
});

test('the order survives a reload', async () => {
  for (const id of [col(ids.colB), col(ids.colA), folder(ids.folder), folder(ids.second)]) {
    await rows.expandIfCollapsed(id);
  }
  const before = await rows.order();
  await workbench.reload();
  await workbench.showRequestsView();
  for (const id of [col(ids.colB), col(ids.colA), folder(ids.folder), folder(ids.second)]) {
    await rows.expandIfCollapsed(id);
  }
  await expect.poll(() => rows.order()).toEqual(before);
});

test('a collection delete follows the sets: a request dragged out survives, one dragged in goes, nothing rehomes', async () => {
  // Gamma holds g1, g2; Delta holds d1. g1 goes to Delta, d1 comes to
  // Gamma, then Gamma is deleted from its row's ⋯ menu.
  const gamma = await workbench.seedRequestCollection('Gamma');
  const delta = await workbench.seedRequestCollection('Delta');
  const g1 = await seedRequest('g1', { collectionUid: gamma });
  const g2 = await seedRequest('g2', { collectionUid: gamma });
  const d1 = await seedRequest('d1', { collectionUid: delta });
  await rows.expandIfCollapsed(col(gamma));
  await rows.expandIfCollapsed(col(delta));
  await expect.poll(() => rows.orderOf([request(g1), request(g2), request(d1)])).toHaveLength(3);

  await rows.drag(requestRow(g1), rows.row(col(delta)), 0.5);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await rows.expandIfCollapsed(col(delta));
  await expect.poll(() => childrenOf(col(delta), 2)).toEqual([request(g1), request(d1)]);
  await rows.drag(requestRow(d1), rows.row(col(gamma)), 0.5);
  await rows.expectMovedToast(1);
  await page.waitForTimeout(800);
  await expectUniqueRows(page, workbench, consoleLog);
  await rows.expandIfCollapsed(col(gamma));
  await expect.poll(() => childrenOf(col(gamma), 2)).toEqual([request(d1), request(g2)]);

  await rows.deleteContainer(col(gamma));
  await expect.poll(() => rows.row(col(gamma)).count()).toBe(0);
  await expect
    .poll(() => rows.orderOf([col(delta), request(g1), request(g2), request(d1)]))
    .toEqual([col(delta), request(g1)]);
  // Past the reconciler's rehome grace nothing comes back under Delta.
  await page.waitForTimeout(3000);
  expect(await rows.orderOf([col(delta), request(g1), request(g2), request(d1)])).toEqual([col(delta), request(g1)]);
  const requests = await workbench.rpc<{ requests?: Array<{ uid: string; path: string }> }>('getLocalRequests');
  const collections = await workbench.rpc<{ collections?: Array<{ uid: string; path: string }> }>(
    'getLocalRequestCollections',
  );
  const deltaPath = collections.collections?.find((c) => c.uid === delta)?.path ?? '';
  expect(collections.collections?.some((c) => c.uid === gamma)).toBe(false);
  expect(requests.requests?.map((r) => r.uid)).not.toContain(g2);
  expect(requests.requests?.map((r) => r.uid)).not.toContain(d1);
  expect(requests.requests?.find((r) => r.uid === g1)?.path.startsWith(`${deltaPath}/`)).toBe(true);
});
