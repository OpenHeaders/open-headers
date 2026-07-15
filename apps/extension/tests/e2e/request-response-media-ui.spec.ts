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
  'media',
  'latin1',
] as const;

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
    await workbench.filterResponseBody('oh_http_requests{code="500"}');
    const filtered = await workbench.responsePrettyText();
    expect(filtered).toContain('# TYPE oh_http_requests counter');
    expect(filtered).toContain('oh_http_requests_total{code="500",path="/api/echo"} 3');
    expect(filtered).not.toContain('code="200"');
    expect(filtered).not.toContain('oh_build_info');
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
