/**
 * gRPC desktop in-process legs — the combined live-pass D-legs (D1–D8)
 * plus the status-popover spot-checks as a permanent gate, on the REAL
 * stack: the built desktop app (isolated userData, off-default daemon
 * port), the shared workbench UI driving in-process invokes through
 * the node transport, against the playground's h2c gRPC probe (the
 * Playwright webServer boots the playground; the probe rides it).
 *
 *   D1  unary OK: GetBook → `0 OK · ms` strip, schema-decoded Book,
 *       probe metadata + trailers populated; the pill popover carries
 *       the canonical 0 OK description.
 *   D2  trailers-only: `books/missing` → 5 NOT_FOUND with the
 *       trailers-only notice; canonical popover text.
 *   D3  invalid argument: empty name → 3 INVALID_ARGUMENT.
 *   D4  deadline: DelayedBook with `timeoutMs` below the probe delay →
 *       4 DEADLINE_EXCEEDED.
 *   D5  server stream: live ↓ rows PLUS the ↑ composed request row
 *       (both-directions capture), session timestamps, settle 0 OK,
 *       newest-first with the head row at the recorded position.
 *   D6  client stream: the timeline mounts INSTANTLY on invoke, the
 *       corner Send ×2 + End settle the summary; a strict-encode
 *       mismatch toasts the rider's EXACT error and leaves the stream
 *       open.
 *   D7  bidi: a sent message echoes back; Stop mid-stream → Stopped
 *       badge + 1 CANCELLED pill (display-side law), frames kept;
 *       canonical CANCELLED popover text.
 *   D8  compose aids: a vanished method renders the unresolved group
 *       with Invoke gated behind the honest tooltip; picking a real
 *       method enables "Use example message" pre-fill.
 *
 * Deliberately NOT here (covered elsewhere): the forwarded posture
 * (extension `grpc-forwarded.spec.ts`), generation + Save Response
 * (extension `grpc-workbench.spec.ts`), and the ⌘⇧↵/⌘⇧E chords
 * (jsdom editor matrix — platform-modifier dispatch is not portable
 * under Playwright; they stay a manual D6 spot-check).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage.json gains the BookService spec + collection + eight
 * D-leg requests (built and schema-validated by
 * `fixtures/grpc-desktop-seed.ts` under the extension package's tsx),
 * and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137,
// 19237, 19337).
const DAEMON_PORT = 19437;
// The playground webServer's h2c gRPC probe.
const GRPC_PORT = 3130;

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
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: {
      ...process.env,
      OPENHEADERS_USER_DATA_DIR: userData,
      OH_DISABLE_UPDATE_CHECKS: '1',
    },
  });
  workbench = await electronApp.firstWindow();
  // Engine-ready gate: the pre-engine rpc queue answers once the spine
  // is up, so one bridge round-trip is the readiness probe.
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

async function showRequestsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

async function collapseDocsPanel(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected')) === 'true') {
    await docsTab.click();
  }
}

function invokeButton(): Locator {
  return workbench.getByTestId('grpc-invoke-button').filter({ visible: true }).first();
}

function statusTag(): Locator {
  return workbench.getByTestId('grpc-status-tag').filter({ visible: true }).first();
}

function responsePane(): Locator {
  return workbench.getByTestId('grpc-response-pane').filter({ visible: true }).first();
}

function streamPane(): Locator {
  return workbench.getByTestId('grpc-stream-pane').filter({ visible: true }).first();
}

function timelineMessageRows(): Locator {
  return workbench.getByTestId('grpc-timeline-message-row').filter({ visible: true });
}

function responseRegion(): Locator {
  return workbench.locator('.rules-response-tabs').filter({ visible: true });
}

async function openResponseTab(name: RegExp): Promise<void> {
  await responseRegion().getByRole('tab', { name }).first().click();
}

async function openGrpcRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="grpc-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = workbench.locator('[data-item-id="req-col-e2ecol01"]');
    await collection.waitFor({ state: 'visible', timeout: 10_000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await invokeButton().waitFor({ state: 'visible', timeout: 10_000 });
}

async function invokeAndAwaitTag(text: string): Promise<void> {
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await statusTag().filter({ hasText: text }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** Hover the status pill and assert the canonical popover sentence.
 *  The pointer parks away first so the hover always lands as a fresh
 *  `mouseenter` (a no-move hover never re-fires the trigger), and the
 *  whole gesture retries — a re-render mid-hover can swallow one. */
async function expectStatusPopover(text: RegExp): Promise<void> {
  const popoverText = workbench.locator('.ant-popover').filter({ visible: true }).getByText(text).first();
  await expect
    .poll(
      async () => {
        await workbench.mouse.move(0, 0);
        await statusTag()
          .hover()
          .catch(() => {});
        await workbench.waitForTimeout(400);
        return popoverText.isVisible().catch(() => false);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  // Park the pointer so the popover can't shadow the next leg's clicks.
  await workbench.mouse.move(0, 0);
}

/** Replace the visible message editor's buffer — single bulk insert so
 *  Monaco's auto-closing brackets can't mangle the JSON; Esc dismisses
 *  the suggest widget. */
async function fillMessageEditor(text: string): Promise<void> {
  const editor = workbench.locator('.monaco-editor').filter({ visible: true }).first();
  await editor.click();
  await workbench.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await workbench.keyboard.press('Backspace');
  await workbench.keyboard.insertText(text);
  await workbench.keyboard.press('Escape');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-grpc-desktop-e2e-'));
  await writeFile(
    path.join(userData, 'storage.json'),
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

  // Seed the workspace slots with schema-validated entities (tsx via
  // the extension package — the one that carries the tsx devDep).
  const seeded = spawnSync(
    'pnpm',
    ['--filter', '@openheaders/extension', 'exec', 'tsx', path.join(__dirname, 'fixtures/grpc-desktop-seed.ts')],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_GRPC_PORT: String(GRPC_PORT),
        OH_E2E_WORKSPACE_ID: workspaceId,
      },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'storage.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots and open the requests view.
  await launchApp();
  await showRequestsView();
  await collapseDocsPanel();
  await workbench.locator('[data-item-id="req-col-e2ecol01"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── D1: unary OK ────────────────────────────────────────────────────

test('D1 — unary OK: decoded Book, probe metadata + trailers, canonical 0 OK popover', async () => {
  await openGrpcRequest('e2egrpd1');
  await invokeAndAwaitTag('0 OK');
  await expect(responsePane()).toContainText('The Open Headers Field Guide');
  await openResponseTab(/Metadata/);
  await expect(responsePane()).toContainText('x-probe');
  await openResponseTab(/Trailers/);
  await expect(responsePane()).toContainText('x-probe-region');
  await expectStatusPopover(/Status code 0 OK is a standard response/);
});

// ── D2: trailers-only NOT_FOUND ─────────────────────────────────────

test('D2 — trailers-only reply: 5 NOT_FOUND with the notice and canonical popover', async () => {
  await openGrpcRequest('e2egrpd2');
  await invokeAndAwaitTag('5 NOT_FOUND');
  // The notice renders in the Trailers tab — the status arrived with
  // the initial metadata (`grpcStatusSource === 'headers'`).
  await openResponseTab(/Trailers/);
  await expect(responsePane()).toContainText(/Trailers-only reply/);
  await expectStatusPopover(/Status code 5 NOT_FOUND is returned if a requested entity/);
});

// ── D3: invalid argument ────────────────────────────────────────────

test('D3 — empty name answers 3 INVALID_ARGUMENT', async () => {
  await openGrpcRequest('e2egrpd3');
  await invokeAndAwaitTag('3 INVALID_ARGUMENT');
});

// ── D4: deadline ────────────────────────────────────────────────────

test('D4 — timeoutMs below the probe delay aborts with the classified deadline error', async () => {
  await openGrpcRequest('e2egrpd4');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  // The probe sleeps past the deadline without honoring `grpc-timeout`
  // server-side, so the LOCAL abort wins pre-head — a classified error
  // snapshot, never a synthetic status (missing status stays null by
  // the S4 capture law; a 4 DEADLINE_EXCEEDED pill would only render
  // if the server itself sent one).
  const errorState = workbench.getByTestId('grpc-response-error').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(errorState).toContainText('Call deadline of 1000 ms elapsed before a response arrived.');
});

// ── D5: server stream ───────────────────────────────────────────────

test('D5 — server stream: both directions, session timestamps, recorded head position', async () => {
  await openGrpcRequest('e2egrpd5');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await streamPane().waitFor({ state: 'visible', timeout: 15_000 });
  // The ↑ composed request frame plus three ↓ books.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20_000 }).toBe(4);
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15_000 });
  // Live-session frames carry timestamps (the session-only law).
  expect(await workbench.getByTestId('grpc-timeline-message-time').filter({ visible: true }).count()).toBeGreaterThan(
    0,
  );
  // Newest-first default with the head row at the recorded position
  // (`headAtMessage` = 1 — after the composed ↑ request in call order).
  const rows = streamPane().locator(
    '[data-testid="grpc-timeline-sent-row"], [data-testid="grpc-timeline-connected-row"], ' +
      '[data-testid="grpc-timeline-ended-row"], [data-testid="grpc-timeline-message-row"]',
  );
  const sequence = await rows.evaluateAll((els) =>
    els.map((el) => {
      const id = el.getAttribute('data-testid') ?? '';
      if (id !== 'grpc-timeline-message-row') return id.replace('grpc-timeline-', '').replace('-row', '');
      return el.querySelector('.anticon-arrow-up') !== null ? 'up' : 'down';
    }),
  );
  expect(sequence).toEqual(['ended', 'down', 'down', 'down', 'connected', 'up', 'sent']);
});

// ── D6: client stream + riders ──────────────────────────────────────

test('D6 — client stream: instant mount, corner sends, exact-error toast, summary settle', async () => {
  await openGrpcRequest('e2egrpd6');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();

  // S12 law: the seeded live state mounts the timeline immediately —
  // no wire event has arrived yet on a client stream.
  await workbench
    .getByTestId('grpc-timeline-sent-row')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
  await workbench.getByTestId('grpc-streaming-badge').filter({ visible: true }).first().waitFor({ state: 'visible' });

  const sendButton = workbench.getByTestId('grpc-stream-send').filter({ visible: true }).first();
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(1);
  await sendButton.click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(2);

  // Strict encode: a buffer that doesn't match the input type fails
  // the RIDER alone — the toast carries the EXACT error, stream open.
  await fillMessageEditor('{"nope":1}');
  await sendButton.click();
  await workbench
    .locator('.ant-message')
    .getByText(/Unknown field `nope`/)
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await workbench.getByTestId('grpc-streaming-badge').filter({ visible: true }).first().waitFor({ state: 'visible' });

  // Restore a valid buffer, send, half-close → summary ↓ + 0 OK.
  await fillMessageEditor('{"book":{"name":"books/e2e-3"}}');
  await sendButton.click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(3);
  await workbench.getByTestId('grpc-stream-end').filter({ visible: true }).first().click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(4);
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15_000 });
  await expect(streamPane()).toContainText('bookCount');
});

// ── D7: bidi + Stop mid-stream ──────────────────────────────────────

test('D7 — bidi echo; Stop mid-stream keeps frames and reads 1 CANCELLED', async () => {
  await openGrpcRequest('e2egrpd7');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await workbench
    .getByTestId('grpc-timeline-sent-row')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });

  const sendButton = workbench.getByTestId('grpc-stream-send').filter({ visible: true }).first();
  await sendButton.click();
  // The ↑ frame and the probe's echo ↓ both land in the timeline.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(2);
  await expect(streamPane()).toContainText('echo: hello');

  // Invoke has morphed into Stop; a local cancel reads 1 CANCELLED
  // display-side while the capture keeps its honest null status.
  await invokeButton().click();
  await workbench
    .getByTestId('grpc-stopped-tag')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await expect(statusTag()).toContainText('1 CANCELLED');
  expect(await timelineMessageRows().count()).toBeGreaterThanOrEqual(2);
  await expectStatusPopover(/Status code 1 CANCELLED is returned if the operation is cancelled by the caller/);
});

// ── D8: compose aids ────────────────────────────────────────────────

test('D8 — vanished method renders unresolved and gates Invoke; example pre-fill works', async () => {
  await openGrpcRequest('e2egrpd8');

  // The persisted-but-vanished rpc stays visible as an unresolved
  // entry instead of silently blanking the select.
  const methodSelect = workbench.getByTestId('grpc-method-select').filter({ visible: true }).first();
  await expect(methodSelect).toContainText('RemovedRpc (unresolved)');

  await expect(invokeButton()).toBeDisabled();
  await invokeButton().hover();
  await workbench
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText('Pick a method that resolves against the linked spec to invoke')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // The dropdown names the unresolved group AND still lists the linked
  // spec's real rpcs; picking one re-arms compose.
  await methodSelect.click();
  const dropdown = workbench.locator('.ant-select-dropdown').filter({ visible: true });
  await dropdown.getByText('Not in linked spec').first().waitFor({ state: 'visible', timeout: 10_000 });
  // Option rows carry the call-shape glyph beside the rpc name, so no
  // element's text is EXACTLY the rpc — filter the option row instead.
  await dropdown.locator('.ant-select-item-option').filter({ hasText: 'GetBook' }).first().click();

  await workbench.getByTestId('grpc-use-example').filter({ visible: true }).first().click();
  const editorText = await workbench
    .locator('.monaco-editor')
    .filter({ visible: true })
    .first()
    .locator('.view-lines')
    .innerText();
  expect(editorText.replace(/\u00a0/g, ' ')).toContain('"name": "name"');
  await expect(invokeButton()).toBeEnabled();
});
