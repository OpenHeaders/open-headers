/**
 * Authoring a workflow's session steps on the desktop host — the two
 * device scenarios written through the REAL form from "New workflow",
 * saved, and run green in the workflow's view against the playground's device
 * scenario (a backend's HTTP api beside the aedes probe broker on TCP
 * 3131).
 *
 *   A1  A reboot commanded over HTTP, acknowledged over MQTT: a Listen, a
 *       Call that captures the command's id, an Expect whose match rows
 *       hold the answer to THIS run's command. The defaults carry the
 *       arming — the Expect is on the Listen above it and waits after
 *       the step before it.
 *   A2  A name published over MQTT, read back over HTTP: a Listen, a Send
 *       of a saved message, a Call with a success criterion and a poll.
 *
 * Each leg reads the saved workflow back over the bridge, so the form's
 * every field is pinned to what it wrote.
 *
 * Requires a build that opts in to authoring:
 * `OH_WORKFLOW_SESSION_AUTHORING=1 pnpm turbo build
 * --filter=@openheaders/desktop`; the playground boots as Playwright's
 * webServer. The run legs beside this spec are
 * `workflow-runs-desktop.spec.ts`.
 *
 * Seeding: the app boots once to mint its default workspace, quits, its
 * storage gains the collection and the requests the steps pick from
 * (`fixtures/workflow-runs-desktop-seed.ts`, under the extension
 * package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { type ElectronApplication, expect, type Locator, test } from '@playwright/test';
import { launchDesktopApp } from './fixtures/launch-app';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: fresh port off every prior suite (ledger through 22637).
const DAEMON_PORT = 22737;
// The playground webServer: the device api, and the probe broker's TCP listener.
const DEVICES_ORIGIN = 'http://127.0.0.1:3000';
const MQTT_PROBE_PORT = 3131;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

async function launchApp(): Promise<void> {
  electronApp = await launchDesktopApp(APP_ROOT, userData);
  workbench = await electronApp.firstWindow();
  await expect
    .poll(
      async () => {
        try {
          const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
          return typeof res.activeWorkspaceId === 'string';
        } catch {
          return false;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

// ── Workbench DOM helpers (the shared UI's selectors; visible-scoped —
//    background tabs stay mounted) ───────────────────────────────────

async function showWorkflowsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="workflows"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /WORKFLOWS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

/** The right side panel takes a third of the window: the form gets it back. */
async function closeNotifications(): Promise<void> {
  const tab = workbench.locator('[role="tab"][data-tool-window="notifications"]').first();
  if ((await tab.getAttribute('aria-selected')) === 'true') await tab.click();
}

/** A control's editable `<input>` from its test id — AntD stamps the attribute on the input or on a wrapper. */
function field(testId: string): Locator {
  return workbench.getByTestId(testId).filter({ visible: true }).locator('xpath=descendant-or-self::input').first();
}

function card(stepId: string): Locator {
  return workbench.locator(`[data-step-card="${stepId}"]`).filter({ visible: true });
}

/** A card's collapse section header — a button whose name starts with the section's label. */
function sectionHeader(stepCard: Locator, label: string): Locator {
  return stepCard.getByRole('button', { name: new RegExp(label) });
}

function openDropdown(): Locator {
  return workbench.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
}

/** Open an AntD Select and pick the option titled `label`. */
async function pickOption(select: Locator, label: string): Promise<void> {
  await select.click();
  await openDropdown().locator(`.ant-select-item-option[title="${label}"]`).click();
}

function select(testId: string): Locator {
  return workbench.getByTestId(testId).filter({ visible: true }).first();
}

/** The form's own address of a step's field: its id, or the request a call sends. */
function stepField(index: number, leaf: 'id' | 'requestUid'): Locator {
  return workbench.locator(`[data-field-path="steps.${index}.${leaf}"]`).filter({ visible: true });
}

async function nameStep(index: number, id: string): Promise<void> {
  await stepField(index, 'id').locator('input').fill(id);
  await expect(card(id)).toBeVisible();
}

async function addStep(): Promise<void> {
  await workbench
    .locator('button')
    .filter({ hasText: /^Step$/ })
    .filter({ visible: true })
    .first()
    .click();
}

/** Add a capture row to a step and set it to read a JSON path. */
async function addJsonCapture(index: number, row: number, name: string, jsonPath: string): Promise<void> {
  const captures = workbench.locator(`[data-field-path="steps.${index}.captures"]`).filter({ visible: true });
  await captures.locator('button').filter({ hasText: '+ Capture' }).click();
  const captureRow = workbench.getByTestId(`wf-step-${index}-capture-${row}`).filter({ visible: true });
  await field(`wf-step-${index}-capture-${row}-name`).fill(name);
  await pickOption(captureRow.locator('.ant-select'), 'JSON path');
  await captureRow.getByPlaceholder('$.access_token').fill(jsonPath);
}

/** Add a criterion row that holds a JSON path of the subject equal to a value. */
async function addEqualsRow(rowsTestId: string, row: number, jsonPath: string, value: string): Promise<void> {
  await workbench.getByTestId(`${rowsTestId}-add`).filter({ visible: true }).click();
  await pickOption(select(`${rowsTestId}-${row}-kind`), 'Equals');
  await workbench
    .getByTestId(`${rowsTestId}-${row}`)
    .filter({ visible: true })
    .getByPlaceholder('$.access_token')
    .fill(jsonPath);
  await field(`${rowsTestId}-${row}-value`).fill(value);
}

/** Commit the create gesture's primed breadcrumb rename: its input arrives focused, its text selected. */
async function newWorkflow(name: string): Promise<void> {
  await workbench.getByRole('button', { name: 'New workflow' }).filter({ visible: true }).first().click();
  await expect
    .poll(async () =>
      workbench.evaluate(() => {
        const el = document.activeElement;
        return el instanceof HTMLInputElement ? el.value : '';
      }),
    )
    .toMatch(/^New Workflow/);
  await workbench.keyboard.insertText(name);
  await workbench.keyboard.press('Enter');
}

/** Open a step in the view's panel by its node on the graph — re-centred first, so a node below the strip is in reach. */
async function openStep(stepId: string): Promise<void> {
  await workbench.getByTestId('wf-graph-fit').filter({ visible: true }).first().click();
  await workbench.getByTestId(`wf-graph-node-${stepId}`).filter({ visible: true }).first().click();
  await expect(card(stepId)).toBeVisible();
}

/** Close the open step: the panel shows the workflow. */
async function closeStep(): Promise<void> {
  await workbench.getByTestId('wf-panel-close').filter({ visible: true }).first().click();
}

/** The first step of a new workflow, made the Listen every later step is on. */
async function authorListen(): Promise<void> {
  await openStep('step1');
  const action = select('wf-step-0-action');
  await action.click();
  await expect(
    openDropdown().locator('.ant-select-item-option[title="Listen"]'),
    'this spec needs a build made with OH_WORKFLOW_SESSION_AUTHORING=1',
  ).toBeVisible();
  await openDropdown().locator('.ant-select-item-option[title="Listen"]').click();
  await nameStep(0, 'probe');
  await pickOption(select('wf-step-0-session-request'), 'Devices > MQTT Probe MQTT');
  await expect(workbench.getByTestId('wf-step-0-identity').filter({ visible: true })).toBeVisible();
}

async function save(): Promise<void> {
  await workbench
    .locator('button')
    .filter({ hasText: /^Save$/ })
    .filter({ visible: true })
    .first()
    .click();
}

interface SavedWorkflow {
  name: string;
  refresh: { kind: string };
  published?: boolean;
  steps: Record<string, unknown>[];
}

async function savedWorkflow(name: string): Promise<SavedWorkflow | null> {
  const snapshot = await invoke<{ entries: { workflow: SavedWorkflow }[] }>({
    type: 'oh.sync.snapshotLiveWorkflows',
    workspaceId,
  });
  return snapshot.entries.find((entry) => entry.workflow.name === name)?.workflow ?? null;
}

function runRow(stepId: string): Locator {
  return workbench.getByTestId(`wf-run-row-${stepId}`).filter({ visible: true }).first();
}

/** The saved workflow's tab is open, its panel saying no run was seen yet: press the header's Refresh. */
async function runOpenWorkflow(): Promise<void> {
  await workbench.getByTestId('wf-run-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await workbench
    .getByRole('button', { name: /Refresh$/ })
    .filter({ visible: true })
    .first()
    .click();
  await expect(workbench.getByTestId('wf-view').filter({ visible: true }).first()).toHaveAttribute(
    'data-run-verdict',
    'passed',
    { timeout: 10_000 },
  );
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(30_000);

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-workflow-authoring-desktop-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );

  // Phase 1: boot once to mint the default workspace and learn its id.
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(res.activeWorkspaceId).toBeTruthy();
  workspaceId = res.activeWorkspaceId as string;
  await electronApp.close();

  const seeded = spawnSync(
    'pnpm',
    [
      '--filter',
      '@openheaders/extension',
      'exec',
      'tsx',
      path.join(__dirname, 'fixtures/workflow-runs-desktop-seed.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_DEVICES_ORIGIN: DEVICES_ORIGIN,
        OH_E2E_MQTT_PROBE_PORT: String(MQTT_PROBE_PORT),
        OH_E2E_WORKSPACE_ID: workspaceId,
      },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded requests and open the workflows view.
  await launchApp();
  await closeNotifications();
  await showWorkflowsView();
  await workbench.locator('[data-item-id="workflow-e2ewrwf1"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

test('A1 — a reboot commanded over HTTP and acknowledged over MQTT is authored through the form and runs green', async () => {
  await newWorkflow('Authored reboot');
  await authorListen();

  await addStep();
  await nameStep(1, 'reboot');
  await pickOption(stepField(1, 'requestUid').locator('.ant-select'), 'Devices > POST Reboot dev-1');
  await addJsonCapture(1, 0, 'commandId', '$.commandId');

  // The defaults carry the arming: on the Listen above, after the step before.
  await addStep();
  await pickOption(select('wf-step-2-action'), 'Expect');
  await nameStep(2, 'status');
  await expect(select('wf-step-2-on')).toContainText('probe');
  await expect(select('wf-step-2-after')).toContainText('reboot');
  await field('wf-step-2-address').fill('devices/dev-1/status');
  await addEqualsRow('wf-step-2-match', 0, '$.state', 'rebooting');
  await addEqualsRow('wf-step-2-match', 1, '$.commandId', '{{step.reboot.commandId}}');
  await addJsonCapture(2, 0, 'state', '$.state');

  // A workflow that holds a session gives a verdict, refreshed by hand: its own panel says so.
  await closeStep();
  await expect(workbench.getByTestId('wf-form-session-verdict').filter({ visible: true })).toBeVisible();
  await save();

  await expect
    .poll(() => savedWorkflow('Authored reboot'))
    .toMatchObject({
      refresh: { kind: 'manual' },
      published: true,
      steps: [
        { id: 'probe', action: 'listen', sessionRequestUid: 'e2ewrmq1', timeoutMs: 10_000, captures: [] },
        {
          id: 'reboot',
          requestUid: 'e2ewrreb',
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

  await runOpenWorkflow();
  await expect(runRow('probe')).toContainText('Ready in');
  await expect(runRow('reboot')).toContainText('202');
  await expect(runRow('status')).toContainText('Matched after');
});

test('A2 — a name published over MQTT and read back over HTTP is authored through the form and runs green', async () => {
  await newWorkflow('Authored rename');
  await authorListen();

  await addStep();
  await pickOption(select('wf-step-1-action'), 'Send');
  await nameStep(1, 'rename');
  await expect(select('wf-step-1-on')).toContainText('probe');
  await select('wf-step-1-message').click();
  await openDropdown().locator('.ant-select-item-option').filter({ hasText: 'Set name' }).click();
  await addJsonCapture(1, 0, 'name', '$.name');

  await addStep();
  await nameStep(2, 'device');
  await pickOption(stepField(2, 'requestUid').locator('.ant-select'), 'Devices > GET Get dev-1');
  await sectionHeader(card('device'), 'Success criteria').click();
  await addEqualsRow('wf-step-2-criterion', 0, '$.name', '{{step.rename.name}}');
  await sectionHeader(card('device'), 'Poll').click();
  await field('wf-step-2-poll-attempts').fill('10');
  await field('wf-step-2-poll-delay').fill('200');

  await save();

  await expect
    .poll(() => savedWorkflow('Authored rename'))
    .toMatchObject({
      refresh: { kind: 'manual' },
      published: true,
      steps: [
        { id: 'probe', action: 'listen', sessionRequestUid: 'e2ewrmq1' },
        {
          id: 'rename',
          action: 'send',
          on: 'probe',
          messageUid: 'e2ewrmsg',
          captures: [{ name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
        },
        {
          id: 'device',
          requestUid: 'e2ewrget',
          successCriteria: [
            { kind: 'equals', extractor: { kind: 'json-path', path: '$.name' }, value: '{{step.rename.name}}' },
          ],
          poll: { maxAttempts: 10, delayMs: 200 },
        },
      ],
    });

  await runOpenWorkflow();
  await expect(runRow('rename')).toContainText('Acknowledged in');
  await expect(runRow('device')).toContainText(/Passed on attempt \d+ of 10/);
});
