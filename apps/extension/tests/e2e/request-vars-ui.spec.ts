/**
 * Request-editor variable-resolution UI e2e — the DOM counterpart to
 * `request-vars.spec.ts`.
 *
 * Proves the editor's reactive unresolved-flagging loop: typing a
 * `{{ref}}` that resolves nowhere flags the owning section (a red tab
 * dot) and disables Send (the wire-facing gate, equivalent to the DNR
 * compile gate for rules); switching the reference to a DEFINED variable
 * clears the flag, re-enables Send, and the value rides the actual wire
 * (read back from the `/api/echo` reflection in the response panel).
 *
 * The resolver + the `hasUnresolvedRefs` aggregate are unit-covered;
 * this asserts the renderer wires them to the Send button + tab badge and
 * that the renderer's resolver sees the seeded workspace variable.
 *
 * The defined variable (`wsOnly`) is seeded via the real workspace-import
 * pipeline — workspace variables have no write RPC, and the import
 * re-hydrates the stores the renderer's resolver reads after a reload.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Matches the Headers bulk-edit textarea placeholder. */
const HEADERS_BULK = /Content-Type: application/;

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let probeUid: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  // Seed one workspace variable through the real import pipeline (no
  // write RPC exists for workspace vars). The reload below re-hydrates
  // the renderer's resolver context with it.
  const imported = await workbench.rpc<{ success: boolean; error?: string }>('importWorkspace', {
    incoming: buildWorkspaceVarEnvelope(),
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:request-vars-ui-seed',
  });
  expect(imported.success, imported.error).toBe(true);

  probeUid = await workbench.seedRequest({
    name: 'ui-var-probe',
    method: 'GET',
    url: API_ECHO_URL,
    auth: { type: 'none' },
    body: { type: 'none' },
  });
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
});

test.afterAll(async () => {
  await context.close();
});

/** 8-char `[a-z0-9]` uid matching `UidSchema`. */
function mkUid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Minimal `WorkspaceExport` envelope carrying one workspace variable. */
function buildWorkspaceVarEnvelope(): Record<string, unknown> {
  return {
    kind: 'workspace-export',
    schemaVersion: 5,
    exportFormatVersion: 1,
    exportId: mkUid(),
    exportedAt: '2026-01-01T00:00:00.000Z',
    source: { app: 'extension', appVersion: '2026.1.0', platform: 'chrome' },
    scope: 'workspace',
    workspace: { uid: mkUid(), name: 'UI Var Seed' },
    entities: {
      collections: [],
      folders: [],
      rules: [],
      requests: [],
      templates: [],
      environments: [],
      workspaceVars: {
        schemaVersion: 5,
        variables: [{ uid: mkUid(), name: 'wsOnly', value: 'ws-value', type: 'default' }],
      },
      liveWorkflows: [],
      liveVariables: [],
    },
    meta: {
      redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
      counts: { rules: 0, requests: 0, environments: 0, liveWorkflows: 0, liveVariables: 0, templates: 0, secrets: 0 },
    },
  };
}

interface Echo {
  headers: Record<string, string | string[] | undefined>;
}

test.describe('Request editor — unresolved flagging gates Send', () => {
  test('unresolved {{ref}} flags the section + disables Send; defining it clears both and rides the wire', async () => {
    const sendButton = page.getByRole('button', { name: 'Send' }).filter({ visible: true }).first();
    const unresolvedDot = page.getByTestId('oh-section-unresolved').filter({ visible: true });

    await workbench.openRequest(probeUid);
    await workbench.openEditorTab(/Headers/);

    // ── Unresolved: a ref that resolves nowhere ──────────────────
    await workbench.fillBulkEdit(HEADERS_BULK, 'X-Probe: {{wsMissingVar}}');
    await expect(sendButton).toBeDisabled();
    await expect(unresolvedDot).toBeVisible();

    // ── Defined: switch to the seeded workspace variable ─────────
    await workbench.fillBulkEdit(HEADERS_BULK, 'X-Probe: {{wsOnly}}');
    await expect(sendButton).toBeEnabled();
    await expect(unresolvedDot).toHaveCount(0);

    // ── Resolves on the wire ─────────────────────────────────────
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-probe']).toBe('ws-value');
  });
});
