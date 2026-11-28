/**
 * Authoring a workflow's session steps in the extension — the reboot
 * scenario written through the REAL form in the workbench page from "New
 * workflow", saved, and run green in that page beside the session it
 * holds: real Chromium with the built extension, no daemon, the
 * playground's device scenario (a backend's HTTP api beside the aedes
 * probe broker on its `/net/mqtt` upgrade path).
 *
 *   A1  A reboot commanded over HTTP, acknowledged over MQTT: a Listen, a
 *       Call that captures the command's id, an Expect whose match rows
 *       hold the answer to THIS run's command. The defaults carry the
 *       arming — the Expect is on the Listen above it and waits after
 *       the step before it.
 *
 * The leg reads the saved workflow back from the service worker, so the
 * form's every field is pinned to what it wrote.
 *
 * Requires an extension `dist/chrome` build that opts in to authoring:
 * `OH_WORKFLOW_SESSION_AUTHORING=1 pnpm --filter @openheaders/extension
 * build:chrome`; the playground boots as Playwright's webServer. The run
 * legs beside this spec are `workflow-runs-extension.spec.ts`.
 *
 * Seeding: the extension boots once to mint its default workspace, its
 * `chrome.storage` gains the collection and the requests the steps pick
 * from (`fixtures/workflow-runs-extension-seed.ts`, under tsx) from a
 * workbench PAGE evaluate, and the browser relaunches on the same profile.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { launchExtensionContext } from './fixtures/launch-extension';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SEED_SCRIPT = path.join(__dirname, 'fixtures/workflow-runs-extension-seed.ts');
// The playground webServer: the device api, the probe broker's WebSocket
// path and its TCP listener.
const DEVICES_ORIGIN = 'http://127.0.0.1:3000';
const MQTT_WS_PROBE_URL = 'ws://127.0.0.1:3000/net/mqtt';
const MQTT_PROBE_PORT = 3131;

let profileDir: string;
let context: BrowserContext;
let page: Page;
let workbench: WorkbenchPage;

async function launch(): Promise<void> {
  context = await launchExtensionContext(profileDir, extensionPath);
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;
  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);
}

async function storageGet<T>(key: string): Promise<T | undefined> {
  return page.evaluate(
    (k: string) => new Promise<T | undefined>((resolve) => chrome.storage.local.get(k, (items) => resolve(items[k]))),
    key,
  );
}

// ── The form (the shared UI's selectors; visible-scoped — background
//    tabs stay mounted) ──────────────────────────────────────────────

/** A control's editable `<input>` from its test id — AntD stamps the attribute on the input or on a wrapper. */
function field(testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true }).locator('xpath=descendant-or-self::input').first();
}

function card(stepId: string): Locator {
  return page.locator(`[data-step-card="${stepId}"]`).filter({ visible: true });
}

function openDropdown(): Locator {
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
}

/** Open an AntD Select and pick the option titled `label`. */
async function pickOption(select: Locator, label: string): Promise<void> {
  await select.click();
  await openDropdown().locator(`.ant-select-item-option[title="${label}"]`).click();
}

function select(testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true }).first();
}

/** The form's own address of a step's field: its id, or the request a call sends. */
function stepField(index: number, leaf: 'id' | 'requestUid'): Locator {
  return page.locator(`[data-field-path="steps.${index}.${leaf}"]`).filter({ visible: true });
}

async function nameStep(index: number, id: string): Promise<void> {
  await stepField(index, 'id').locator('input').fill(id);
  await expect(card(id)).toBeVisible();
}

/** Add a step through the picker "+ Step" opens: a kind's row — a call, where none is named. */
async function addStep(kind: 'call' | 'listen' | 'send' | 'expect' = 'call'): Promise<void> {
  await page.getByTestId('wf-graph-add-step').filter({ visible: true }).first().click();
  await page.getByTestId(`wf-step-picker-kind-${kind}`).click();
}

/** Add a call on a saved request: found by a search of the picker, its row named by its path, taken by Enter. */
async function addStepOnRequest(search: string, path: string): Promise<void> {
  await page.getByTestId('wf-graph-add-step').filter({ visible: true }).first().click();
  await page.getByTestId('wf-step-picker-search').fill(search);
  await expect(page.locator(`.oh-wf-picker-row[title="${path}"]`)).toHaveAttribute('data-first', 'true');
  await page.keyboard.press('Enter');
}

/** Add a capture row to the open step, on its Data tab, and set it to read a JSON path. */
async function addJsonCapture(index: number, row: number, name: string, jsonPath: string): Promise<void> {
  await page.getByTestId('wf-step-tab-data').filter({ visible: true }).first().click();
  const captures = page.locator(`[data-field-path="steps.${index}.captures"]`).filter({ visible: true });
  await captures.locator('button').filter({ hasText: 'Add capture' }).click();
  const captureRow = page.getByTestId(`wf-step-${index}-capture-${row}`).filter({ visible: true });
  await field(`wf-step-${index}-capture-${row}-name`).fill(name);
  await pickOption(captureRow.locator('.ant-select'), 'JSON path');
  await captureRow.getByPlaceholder('$.access_token').fill(jsonPath);
}

/** Add a criterion row that holds a JSON path of the subject equal to a value. */
async function addEqualsRow(rowsTestId: string, row: number, jsonPath: string, value: string): Promise<void> {
  await page.getByTestId(`${rowsTestId}-add`).filter({ visible: true }).click();
  await pickOption(select(`${rowsTestId}-${row}-kind`), 'Equals');
  await page
    .getByTestId(`${rowsTestId}-${row}`)
    .filter({ visible: true })
    .getByPlaceholder('$.access_token')
    .fill(jsonPath);
  await field(`${rowsTestId}-${row}-value`).fill(value);
}

/** Commit the create gesture's primed breadcrumb rename: its input arrives focused, its text selected. */
async function newWorkflow(name: string): Promise<void> {
  await page.getByRole('button', { name: 'New workflow' }).filter({ visible: true }).first().click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const el = document.activeElement;
        return el instanceof HTMLInputElement ? el.value : '';
      }),
    )
    .toMatch(/^New Workflow/);
  await page.keyboard.insertText(name);
  await page.keyboard.press('Enter');
}

interface SavedWorkflow {
  name: string;
  refresh: { kind: string };
  published?: boolean;
  steps: Record<string, unknown>[];
}

async function savedWorkflow(name: string): Promise<SavedWorkflow | null> {
  const listed = await workbench.rpc<{ workflows: SavedWorkflow[] }>('listLiveWorkflows');
  return listed.workflows.find((workflow) => workflow.name === name) ?? null;
}

function runRow(stepId: string): Locator {
  return page.getByTestId(`wf-run-row-${stepId}`).filter({ visible: true }).first();
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(30_000);

test.beforeAll(async () => {
  test.setTimeout(90_000);
  profileDir = await mkdtemp(path.join(tmpdir(), 'oh-workflow-authoring-extension-e2e-'));

  // Boot once to mint the default workspace and learn its id.
  await launch();
  const active = await workbench.rpc<{ workspace: { id: string } | null }>('getActiveWorkspace');
  expect(active.workspace).toBeTruthy();
  const workspaceId = active.workspace!.id;
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

  const seeded = spawnSync('pnpm', ['--filter', '@openheaders/extension', 'exec', 'tsx', SEED_SCRIPT], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      OH_E2E_DEVICES_ORIGIN: DEVICES_ORIGIN,
      OH_E2E_MQTT_WS_URL: MQTT_WS_PROBE_URL,
      OH_E2E_MQTT_PROBE_PORT: String(MQTT_PROBE_PORT),
      OH_E2E_WORKSPACE_ID: workspaceId,
    },
    encoding: 'utf-8',
  });
  expect(seeded.status, seeded.stderr).toBe(0);
  await page.evaluate(
    (items: Record<string, unknown>) => new Promise<void>((resolve) => chrome.storage.local.set(items, resolve)),
    { ...(JSON.parse(seeded.stdout) as Record<string, unknown>), onboardingCompleted: true },
  );
  await context.close();

  // Relaunch on the seeded slots: the service worker rebuilds its stores from them.
  await launch();
  await workbench.showWorkflowsView();
  await workbench.collapseRightSidebar();
  await page.locator('[data-item-id="workflow-e2ewxwf1"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await context?.close();
});

test('A1 — a reboot commanded over HTTP and acknowledged over MQTT is authored through the form and runs green in the page', async () => {
  await newWorkflow('Authored reboot');

  // A new workflow opens on its graph and its own panel: the first step's node opens its card.
  await page.getByTestId('wf-graph-node-step1').filter({ visible: true }).first().click();
  const action = select('wf-step-0-action');
  await action.click();
  await expect(
    openDropdown().locator('.ant-select-item-option[title="Listen"]'),
    'this spec needs a build made with OH_WORKFLOW_SESSION_AUTHORING=1',
  ).toBeVisible();
  await openDropdown().locator('.ant-select-item-option[title="Listen"]').click();
  await nameStep(0, 'probe');
  await pickOption(select('wf-step-0-session-request'), 'Devices > MQTT Probe MQTT');
  await expect(page.getByTestId('wf-step-0-identity').filter({ visible: true })).toBeVisible();

  // A request taken in the picker is a call on it, named after it.
  await addStepOnRequest('reboot', 'Devices > POST Reboot dev-1');
  await expect(card('reboot-dev-1')).toBeVisible();
  await expect(stepField(1, 'requestUid').locator('.ant-select')).toContainText('Reboot dev-1');
  await nameStep(1, 'reboot');
  await addJsonCapture(1, 0, 'commandId', '$.commandId');

  // The picker's Wait carries the arming: on the Listen above, after the step before.
  await addStep('expect');
  await expect(select('wf-step-2-action')).toContainText('Wait');
  await nameStep(2, 'status');
  await expect(select('wf-step-2-on')).toContainText('probe');
  await expect(select('wf-step-2-after')).toContainText('reboot');
  await field('wf-step-2-address').fill('devices/dev-1/status');
  await addEqualsRow('wf-step-2-match', 0, '$.state', 'rebooting');
  await addEqualsRow('wf-step-2-match', 1, '$.commandId', '{{step.reboot.commandId}}');
  await addJsonCapture(2, 0, 'state', '$.state');

  // A workflow that holds a session gives a verdict, refreshed by hand: its own panel says so.
  await page.getByTestId('wf-panel-close').filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-form-session-verdict').filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first().click();

  await expect
    .poll(() => savedWorkflow('Authored reboot'))
    .toMatchObject({
      refresh: { kind: 'manual' },
      published: true,
      steps: [
        { id: 'probe', action: 'listen', sessionRequestUid: 'e2ewxmq1', timeoutMs: 10_000, captures: [] },
        {
          id: 'reboot',
          requestUid: 'e2ewxreb',
          captures: [{ name: 'commandId', extractor: { kind: 'json-path', path: '$.commandId' } }],
        },
        {
          id: 'status',
          action: 'expect',
          on: 'probe',
          after: 'reboot',
          address: 'devices/dev-1/status',
          match: [
            { kind: 'equals', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
            {
              kind: 'equals',
              extractor: { kind: 'json-path', path: '$.commandId' },
              value: '{{step.reboot.commandId}}',
            },
          ],
          timeoutMs: 10_000,
          captures: [{ name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
        },
      ],
    });

  // The saved workflow's tab is open, its panel saying no run was seen yet: the header's Run.
  await page.getByTestId('wf-run-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await page.getByTestId('wf-run').filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-view').filter({ visible: true }).first()).toHaveAttribute(
    'data-run-verdict',
    'passed',
    { timeout: 10_000 },
  );
  await expect(runRow('probe')).toContainText('Ready in');
  await expect(runRow('reboot')).toContainText('202');
  await expect(runRow('status')).toContainText('Matched after');
});
