/**
 * Response viewer content-type sweep e2e — one probe per media family
 * the viewer treats specially (see `playground/server/api-binary.ts`),
 * driven through the real editor UI: seed → open → Send → assert the
 * viewer's default view, picker label, preview availability, and byte
 * views against the probe's known bytes.
 *
 * Sibling of `request-editor-ui.spec.ts` (which keeps the auth × body
 * matrix and the original PDF probe); selectors follow the same
 * semantic-first rules. Playwright boots the playground webServer, so
 * the probes are up at 127.0.0.1:3000.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PROBE_URL = (name: string) => `http://127.0.0.1:3000/api/${name}`;

/** Probe requests seeded once — names double as sidebar labels. */
const PROBE_REQUESTS = [
  'image',
  'svg',
  'zip',
  'gzip',
  'wasm',
  'csv',
  'yaml',
  'ndjson',
  'bigint-json',
  'metrics',
  'sse',
  'ansi-log',
  'json-seq',
  'tar',
  'cbor',
  'msgpack',
  'protobuf',
  'grpc',
  'media',
  'latin1',
] as const;

/** Live streamers from the /net scenarios — the F1 streaming cases:
 *  an SSE source that never ends inside the test window (Stop is the
 *  only way out) and a finite k8s-watch-shaped ndjson stream. */
const STREAM_REQUESTS: Record<string, string> = {
  'sse-stream': 'http://127.0.0.1:3000/net/sse/9999?ms=300',
  'watch-stream': 'http://127.0.0.1:3000/net/watch/3?ms=150',
};

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
const seededUids = new Map<string, string>();

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  const page: Page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  for (const name of PROBE_REQUESTS) {
    seededUids.set(
      name,
      await workbench.seedRequest({
        name: `GET ${name} probe`,
        method: 'GET',
        url: PROBE_URL(name),
        auth: { type: 'none' },
        body: { type: 'none' },
      }),
    );
  }
  for (const [name, url] of Object.entries(STREAM_REQUESTS)) {
    seededUids.set(
      name,
      await workbench.seedRequest({
        name: `GET ${name}`,
        method: 'GET',
        url,
        auth: { type: 'none' },
        body: { type: 'none' },
      }),
    );
  }
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
});

test.afterAll(async () => {
  await context.close();
});

async function sendProbe(name: (typeof PROBE_REQUESTS)[number]): Promise<void> {
  const uid = seededUids.get(name);
  expect(uid, `no seeded uid for ${name}`).toBeTruthy();
  await workbench.openRequest(uid!);
  await workbench.send();
  const status = await workbench.responseStatusText();
  expect(status).toContain('200');
}

test.describe('Response viewer — content-type sweep (UI)', () => {
  test('PNG opens on the image Preview; Hex shows the signature bytes', async () => {
    await sendProbe('image');
    await workbench.responseImagePreview().waitFor({ state: 'visible', timeout: 15000 });
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);

    const hex = await workbench.responseHexText();
    expect(hex.trimStart().startsWith('89 50 4E 47 0D 0A 1A 0A')).toBe(true);
  });

  test('SVG stays a text body (XML grammar) with the image Preview on top', async () => {
    await sendProbe('svg');
    await workbench.responseImagePreview().waitFor({ state: 'visible', timeout: 15000 });

    // Toggling Preview off lands on Pretty — the picker names the
    // detected language, not an encoding view (svg is TEXT).
    await workbench.responsePreviewToggle().click();
    expect(await workbench.responseViewPickerLabel()).toMatch(/XML$/);
    expect(await workbench.responseRawBody()).toContain('<svg xmlns=');
  });

  test('ZIP defaults to Hex with no preview offered', async () => {
    await sendProbe('zip');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(0);

    const hex = await workbench.responseHexText();
    expect(hex.trimStart().startsWith('50 4B 03 04')).toBe(true);
  });

  test('gzip defaults to Hex, magic bytes first', async () => {
    await sendProbe('gzip');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    const hex = await workbench.responseHexText();
    expect(hex.trimStart().startsWith('1F 8B')).toBe(true);
  });

  test('wasm defaults to Hex, magic bytes first', async () => {
    await sendProbe('wasm');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    const hex = await workbench.responseHexText();
    expect(hex.trimStart().startsWith('00 61 73 6D 01 00 00 00')).toBe(true);
  });

  test('CSV renders as plain text with no preview', async () => {
    await sendProbe('csv');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Text$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(0);
    expect(await workbench.responseRawBody()).toContain('1,Echo,api.openheaders.io');
  });

  test('YAML detects its grammar', async () => {
    await sendProbe('yaml');
    expect(await workbench.responseViewPickerLabel()).toMatch(/YAML$/);
    expect(await workbench.responseRawBody()).toContain('probe: yaml');
  });

  test('NDJSON keeps the json grammar and offers the tree Preview', async () => {
    await sendProbe('ndjson');
    expect(await workbench.responseViewPickerLabel()).toMatch(/JSON$/);
    // Line-wise parse feeds the tree preview — a whole-body JSON.parse
    // of the three records would fail and hide the toggle.
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
  });

  test('big-number JSON displays losslessly with a duplicate-key notice', async () => {
    await sendProbe('bigint-json');
    expect(await workbench.responseViewPickerLabel()).toMatch(/JSON$/);
    // JSON.parse-based display would round …993 to …992 and silently
    // swallow the duplicate key.
    await expect(workbench.responseBodyNotice('Duplicate JSON keys — the last value is shown: dup')).toBeVisible();
    await workbench.responsePreviewToggle().click();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    const text = await tree.innerText();
    expect(text).toContain('9007199254740993');
    expect(text).toContain('3.14159265358979323846');
  });

  test('Prometheus metrics detect their grammar; the family filter narrows the pane', async () => {
    await sendProbe('metrics');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Prometheus$/);
    // Raw shows the exposition text verbatim, exemplar included.
    const raw = await workbench.responseRawBody();
    expect(raw).toContain('# TYPE oh_request_duration_seconds histogram');
    expect(raw).toContain('oh_request_duration_seconds_bucket{le="0.1"} 512 # {trace_id="4bf92f3577b34da6"}');

    // Selector query: series-level narrowing, header lines riding along.
    // Poll until the filter has evaluated — the pane shows the whole
    // body until then, and the negative assertions would race it.
    await workbench.filterResponseBody('oh_http_requests{code="500"}');
    await expect
      .poll(() => workbench.responsePrettyText(), { timeout: 15000 })
      .toContain('oh_http_requests_total{code="500",path="/api/echo"} 3');
    const filtered = await workbench.responsePrettyText();
    expect(filtered).toContain('# TYPE oh_http_requests counter');
    expect(filtered).not.toContain('code="200"');
    expect(filtered).not.toContain('oh_build_info');
  });

  test('SSE lands on the event list: rows newest-first, expansion lossless, search narrows', async () => {
    await sendProbe('sse');
    // The body stays TEXT (picker law) — the event list is a view,
    // never a reclassification — and it is the LANDING view (Preview
    // holds the toggle), so a streamed send's Stop never switches.
    expect(await workbench.responseViewPickerLabel()).toMatch(/Text$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    const list = workbench.responseSseEventList();
    await list.waitFor({ state: 'visible', timeout: 15000 });

    // One row per wire block, newest-first: the bare-data closer tops
    // the list, the named events and the heartbeat comment all show.
    const rows = workbench.responseSseEventRows();
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText('joined after an empty data line');
    await expect(list).toContainText('tick');
    await expect(list).toContainText('config');
    await expect(list).toContainText('heartbeat');
    // Lifecycle rows derive, never invented: connected at the bottom,
    // the completed capture's closed row on top. A saved-body reopen
    // renders no per-event times (session-only law).
    await expect(workbench.responseSseConnectedRow()).toContainText('Connected to');
    await expect(workbench.responseSseLifecycleRow()).toContainText('Connection closed');

    // Row expansion: the mini viewer prints the JSON payload lossless
    // (F3 law — int64 verbatim).
    await rows.filter({ hasText: 'tick' }).first().click();
    const viewer = workbench.responseSseEventViewer();
    await viewer.waitFor({ state: 'visible', timeout: 15000 });
    await expect(viewer).toContainText('9007199254740993');

    // Stream-level search narrows the rows, display-only.
    await workbench.responseSseSearch().fill('sse-probe');
    await expect(workbench.responseSseEventRows()).toHaveCount(1);
    await workbench.responseSseSearch().fill('');

    // JSONPath still narrows over the record list, lossless in the
    // result (the filter opens the Pretty pane).
    await workbench.filterResponseBody('$..resourceVersion');
    await expect.poll(() => workbench.responsePrettyText(), { timeout: 15000 }).toContain('9007199254740993');
  });

  test('SSE Raw stays the wire verbatim behind the event list', async () => {
    await sendProbe('sse');
    // Raw is the wire verbatim — framing, comments, split data lines.
    const raw = await workbench.responseRawBody();
    expect(raw).toContain(': openheaders playground sse probe');
    expect(raw).toContain('data: {"seq":1,"resourceVersion":9007199254740993}');
    expect(raw).toContain('data:   "kind": "sse-probe",');
  });

  test('ANSI log renders SGR colors in Raw; the toggle falls back to plain text', async () => {
    await sendProbe('ansi-log');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Text$/);

    // Rendered by default: escapes vanish from the display text and
    // styled runs paint (the INFO badge gets its color span); the plain
    // line stays span-free — the fast path.
    const raw = await workbench.responseRawBody();
    expect(raw).toContain('INFO  server started on api.openheaders.io:59210');
    expect(raw).toContain('redrawn progress line (cursor controls strip)');
    expect(raw).not.toContain('[32m');
    expect(raw).not.toContain('[2K');
    expect(await workbench.responseAnsiRuns('INFO').count()).toBe(1);

    // Plain-text fallback: the wire text verbatim, escape noise visible.
    await workbench.responseAnsiToggle().click();
    const plain = await workbench.responseRawBody();
    expect(plain).toContain('[32mINFO');
    await workbench.responseAnsiToggle().click();
  });

  test('json-seq strips the record separator in the line-wise JSON paths', async () => {
    await sendProbe('json-seq');
    expect(await workbench.responseViewPickerLabel()).toMatch(/JSON$/);
    // The RS byte would fail every per-line parse — stripping it makes
    // the records parse, which is what lights the tree Preview.
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    await workbench.responsePreviewToggle().click();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    // Record rows start collapsed — open the second record to read it.
    await tree.getByRole('button', { name: /^1\b/ }).click();
    expect(await tree.innerText()).toContain('api.openheaders.io');
  });

  test('tar stays text (NULs are valid UTF-8) with the ustar magic flagged in Hex', async () => {
    await sendProbe('tar');
    // Bytes decide: a tar of ASCII names + NUL padding decodes as text.
    expect(await workbench.responseViewPickerLabel()).toMatch(/Text$/);
    const hex = await workbench.responseHexText();
    expect(hex).toContain('ustar');
    await expect(workbench.responseHexMagic('TAR header')).toBeVisible();
  });

  test('CBOR defaults to Hex and decodes into the JSON tree Preview', async () => {
    await sendProbe('cbor');
    // Binary-like: Hex is the base view; the schema-less decode rides
    // the Preview toggle, exactly the image/PDF pattern.
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    await workbench.responsePreviewToggle().click();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    const text = await tree.innerText();
    // int64 past double precision displays exactly (F3 law) …
    expect(text).toContain('9007199254740993');
    expect(text).toContain('18446744073709551616');
    // … and non-JSON values render in diagnostic notation.
    expect(text).toContain("h'00FF10'");
    expect(text).toContain('1(1720000000)');
    expect(text).toContain('undefined');
  });

  test('MessagePack defaults to Hex and decodes into the JSON tree Preview', async () => {
    await sendProbe('msgpack');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    await workbench.responsePreviewToggle().click();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    const text = await tree.innerText();
    expect(text).toContain('9007199254740993');
    expect(text).toContain("h'00FF10'");
    expect(text).toContain("ext(42, h'DEADBEEF')");
  });

  test('protobuf defaults to Hex; the structural decode rides the labeled Preview', async () => {
    await sendProbe('protobuf');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    await workbench.responsePreviewToggle().click();
    // Schema-less: the tree is a structural guess and says so.
    await expect(workbench.responseBodyNotice('Schema-less decode (best effort)')).toBeVisible();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    const text = await tree.innerText();
    // Field numbers key the tree; varints past double precision display
    // exactly (F3 law); the guess ladder yields text, nested-message,
    // fixed-word, and byte leaves.
    expect(text).toContain('9007199254740993');
    expect(text).toContain('api.openheaders.io');
    expect(text).toContain('fixed64(4614256656552045848, double 3.141592653589793)');
    expect(text).toContain("h'00FF10'");
  });

  test('gRPC unwraps its message framing into the labeled Preview', async () => {
    await sendProbe('grpc');
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    await workbench.responsePreviewToggle().click();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    // The compressed frame degrades to a primitive diagnostic — visible
    // without expanding its (non-existent) children.
    expect(await tree.innerText()).toContain('compressed(3 bytes)');
    // Flag-0 message frames and the grpc-web trailers frame are
    // containers — expand them to reach their leaves.
    await tree.getByRole('button', { name: /^0\b/ }).click();
    await tree.getByRole('button', { name: /^3\b/ }).click();
    const text = await tree.innerText();
    expect(text).toContain('unary-ok');
    expect(text).toContain('grpc-status');
  });

  test('WAV opens on the media Preview with the byte views behind it', async () => {
    await sendProbe('media');
    await workbench.responseMediaPreview().waitFor({ state: 'visible', timeout: 15000 });
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);

    const hex = await workbench.responseHexText();
    expect(hex.trimStart().startsWith('52 49 46 46')).toBe(true);
  });

  test('latin-1 text decodes with its declared charset in Raw', async () => {
    await sendProbe('latin1');
    // 0xE9 bytes make the capture binary — base view is Hex — but the
    // declared charset renders Raw as the text, not U+FFFD noise.
    expect(await workbench.responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await workbench.responseRawBody()).toContain('café au lait à volonté');
  });
});

test.describe('Response viewer — streaming sends (UI)', () => {
  test('a live SSE send feeds the event list, and Stop keeps the SAME list over the snapshot', async () => {
    await workbench.openRequest(seededUids.get('sse-stream')!);
    await workbench.send();
    // Send morphs into Stop for every in-flight send (S8 law 5).
    await workbench.requestStopButton().waitFor({ state: 'visible', timeout: 15000 });
    // The live phase: the head status paints as soon as it arrives and
    // the SSE head lights the event LIST (not a text tail) — rows land
    // newest-first with session timestamps and the connected row below.
    await workbench.responseLiveTail().waitFor({ state: 'visible', timeout: 15000 });
    await expect(workbench.responseLiveStatus()).toContainText('200');
    // The live phase keeps the real tab chrome: the meta facts sit in
    // the tab bar (pulsing dot · status · ticking elapsed · bytes) and
    // the Headers tab already serves the head's fields.
    await expect(workbench.responseLiveMeta()).toBeVisible();
    const elapsedBefore = await workbench.responseLiveElapsed().innerText();
    await expect
      .poll(async () => workbench.responseLiveElapsed().innerText(), { timeout: 5000 })
      .not.toBe(elapsedBefore);
    await workbench.openResponseTab(/Headers/);
    await expect(workbench.responseRegion()).toContainText('text/event-stream');
    await workbench.openResponseTab(/Body/);
    const liveList = workbench.responseSseEventList();
    await liveList.waitFor({ state: 'visible', timeout: 15000 });
    // Odd ticks carry two JSON data lines — the row preview shows the
    // payload verbatim (collapsed to one line), not a re-spaced print.
    await expect(liveList).toContainText('{"seq":1}', { timeout: 15000 });
    await expect(workbench.responseSseConnectedRow()).toContainText('Connected to');
    expect(await workbench.responseSseEventTimes().count()).toBeGreaterThan(0);

    // Stop-and-snapshot: the partial body materializes as a normal
    // response (NOT truncation, NOT an error) with the streamed tag —
    // and the SAME event list renders over the snapshot: the stopped
    // lifecycle row appends on top, session timestamps retained.
    await workbench.requestStopButton().click();
    expect(await workbench.responseStatusText()).toContain('200');
    await expect(workbench.responseStreamedTag()).toBeVisible();
    expect(await workbench.responseViewPickerLabel()).toMatch(/Text$/);
    const list = workbench.responseSseEventList();
    await list.waitFor({ state: 'visible', timeout: 15000 });
    await expect(list).toContainText('{"seq":1}');
    await expect(workbench.responseSseLifecycleRow()).toContainText('Connection stopped');
    expect(await workbench.responseSseEventTimes().count()).toBeGreaterThan(0);

    // Raw stays the wire verbatim behind the list.
    const raw = await workbench.responseRawBody();
    expect(raw).toContain(': oh-playground sse stream');
    expect(raw).toContain('data: {"seq":1}');
  });

  test('a finite watch stream materializes with the streamed tag and rides line-wise JSON', async () => {
    await workbench.openRequest(seededUids.get('watch-stream')!);
    await workbench.send();
    expect(await workbench.responseStatusText()).toContain('200');
    // The server closed after live frames — neutral streamed attribution.
    await expect(workbench.responseStreamedTag()).toBeVisible();
    // application/json shaped one record per line (the k8s watch
    // pattern) lights the ndjson line-wise machinery: the tree preview
    // lists the records.
    expect(await workbench.responseViewPickerLabel()).toMatch(/JSON$/);
    expect(await workbench.responsePreviewToggle().count()).toBe(1);
    await workbench.responsePreviewToggle().click();
    const tree = workbench.responseJsonPreview();
    await tree.waitFor({ state: 'visible', timeout: 15000 });
    // Rows start collapsed — walk down to the last record's name.
    await tree.getByRole('button', { name: /^2\b/ }).click();
    await tree.getByRole('button', { name: /^object\b/ }).click();
    await tree.getByRole('button', { name: /^metadata\b/ }).click();
    const text = await tree.innerText();
    expect(text).toContain('MODIFIED');
    expect(text).toContain('oh-probe-3');
  });
});
