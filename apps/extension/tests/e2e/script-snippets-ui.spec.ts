/**
 * Script-snippets e2e — the Scripts tab's snippets popover + the
 * catalog's semantics on the wire.
 *
 * UI half: the popover lists the full per-kind catalog, search filters
 * with a fixed-footprint "No snippet found" state, clicking inserts at
 * the cursor WITHOUT closing the popover, and the action bar's Format
 * button beautifies the buffer.
 *
 * Wire half: every catalog snippet runs against the playground echo.
 * Snippets whose code is self-contained are inserted VERBATIM through
 * the popover (the same executeEdits path a user exercises) and their
 * effect is read back from `/api/echo` / the Console / Assertions tabs.
 * Snippets templated on an external URL or a placeholder the echo can't
 * satisfy (`setUrl`, `sendRequest` × 2, vault, save-response-value) run
 * as single-line adaptations of the same API pointed at the playground —
 * `fillMonaco` requires one line, and the multi-line originals are
 * already covered verbatim by the popover-driven tests.
 *
 * The three template placeholders that deterministically mismatch the
 * echo payload (`string_to_find`, `expected_body`, `data.name`) assert a
 * FAIL badge — proving the snippet registered and ran its assertion.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { DEFAULT_LOCALE, getTranslator } from '../../../../packages/i18n/src';
import { getScriptSnippetGroups } from '../../../../packages/ui/src/workbench/components/script-editor/script-snippets';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
const uids = new Map<string, string>();

const SEEDS: Array<{ name: string; method?: 'GET' | 'POST' }> = [
  { name: 'snip-ui' },
  { name: 'snip-fmt' },
  { name: 'snip-set-header' },
  { name: 'snip-remove-header' },
  { name: 'snip-set-qp' },
  { name: 'snip-remove-qp' },
  { name: 'snip-set-method', method: 'GET' },
  { name: 'snip-json-body' },
  { name: 'snip-set-url' },
  { name: 'snip-adhoc' },
  { name: 'snip-adhoc-body' },
  { name: 'snip-vars' },
  { name: 'snip-vault' },
  { name: 'snip-t-status' },
  { name: 'snip-t-header' },
  { name: 'snip-t-time' },
  { name: 'snip-t-contains' },
  { name: 'snip-t-equals' },
  { name: 'snip-t-json' },
  { name: 'snip-save-val' },
];

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

  for (const seed of SEEDS) {
    uids.set(
      seed.name,
      await workbench.seedRequest({
        name: seed.name,
        method: seed.method ?? 'POST',
        url: API_ECHO_URL,
        auth: { type: 'none' },
        body: { type: 'none' },
      }),
    );
  }
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  method: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body: { kind: string; parsed?: unknown };
}

/** Open a seeded request on its Scripts tab and pin the rail — always
 *  clicked, because rail state survives across tests that reuse a
 *  request (a prior test may have left it on the other script). */
async function openScripts(seed: string, rail: 'Pre-request' | 'Post-response' = 'Pre-request'): Promise<void> {
  await workbench.openRequest(uids.get(seed)!);
  await workbench.openEditorTab(/Scripts/);
  await workbench.selectScriptRail(rail);
}

/** Collapse whitespace so Monaco's rendered lines compare against
 *  multi-line snippet source regardless of indent / line breaks. */
function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const t = getTranslator(DEFAULT_LOCALE);

test.describe('Scripts tab — snippets popover UI', () => {
  test('the popover lists the full catalog for each rail', async () => {
    await openScripts('snip-ui');
    await workbench.toggleScriptSnippets();
    const popover = workbench.scriptSnippetsPopover();
    for (const group of getScriptSnippetGroups('pre-request')) {
      await expect(popover.getByText(t(group.labelKey), { exact: true })).toBeVisible();
      for (const snippet of group.snippets) {
        await expect(popover.getByRole('button', { name: t(snippet.labelKey), exact: true })).toBeVisible();
      }
    }
    await expect(popover.getByText('Tests', { exact: true })).toHaveCount(0);

    // Switching rails is an outside click — it closes the popover, so
    // reopen it on the post-response rail.
    await workbench.selectScriptRail('Post-response');
    await workbench.toggleScriptSnippets();
    for (const group of getScriptSnippetGroups('post-response')) {
      await expect(popover.getByText(t(group.labelKey), { exact: true })).toBeVisible();
      for (const snippet of group.snippets) {
        await expect(popover.getByRole('button', { name: t(snippet.labelKey), exact: true })).toBeVisible();
      }
    }
    await expect(popover.getByText('Request', { exact: true })).toHaveCount(0);
    await workbench.toggleScriptSnippets();
  });

  test('search filters the list and shows the fixed-size empty state', async () => {
    await openScripts('snip-ui');
    await workbench.toggleScriptSnippets();
    const popover = workbench.scriptSnippetsPopover();

    await workbench.searchScriptSnippets('query parameter');
    await expect(popover.getByRole('button', { name: 'Set a query parameter' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Remove a query parameter' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Set a header' })).toHaveCount(0);

    await workbench.searchScriptSnippets('no-such-snippet');
    await expect(popover.getByText('No snippet found')).toBeVisible();

    await workbench.searchScriptSnippets('');
    await expect(popover.getByRole('button', { name: 'Set a header' })).toBeVisible();
    await workbench.toggleScriptSnippets();
  });

  test('clicking a snippet inserts at the cursor and keeps the popover open', async () => {
    await openScripts('snip-ui');
    await workbench.fillMonaco(0, '');
    await workbench.toggleScriptSnippets();

    await workbench.insertScriptSnippet('Set a header');
    await expect(workbench.scriptSnippetsPopover()).toBeVisible();
    await workbench.insertScriptSnippet('Remove a header');
    await expect(workbench.scriptSnippetsPopover()).toBeVisible();

    const text = squash(await workbench.monacoText(0));
    expect(text).toContain(`oh.setHeader('X-Api-Key', 'value');`);
    expect(text).toContain(`oh.removeHeader('X-Api-Key');`);
    expect(text.indexOf('setHeader')).toBeLessThan(text.indexOf('removeHeader'));
    await workbench.toggleScriptSnippets();
  });

  test('the action bar Format button beautifies the script', async () => {
    await openScripts('snip-fmt');
    await workbench.fillMonaco(0, `oh.setHeader(  'X-Fmt' ,'v' )`);
    await workbench.formatScript();
    await expect.poll(async () => squash(await workbench.monacoText(0))).toContain(`oh.setHeader("X-Fmt", "v");`);
  });
});

test.describe('Pre-request snippets mutate the outgoing request', () => {
  test('Set a header lands on the wire', async () => {
    await openScripts('snip-set-header');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set a header');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-api-key']).toBe('value');
  });

  test('Remove a header strips a header set before it', async () => {
    await openScripts('snip-remove-header');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set a header');
    await workbench.insertScriptSnippet('Remove a header');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-api-key']).toBeUndefined();
  });

  test('Set a query parameter lands on the wire', async () => {
    await openScripts('snip-set-qp');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set a query parameter');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.query.page).toBe('1');
  });

  test('Remove a query parameter strips a param set before it', async () => {
    await openScripts('snip-remove-qp');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set a query parameter');
    await workbench.insertScriptSnippet('Remove a query parameter');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.query.page).toBeUndefined();
  });

  test('Set the method rewrites a GET into a POST', async () => {
    await openScripts('snip-set-method');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set the method');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.method).toBe('POST');
  });

  test('Set a JSON body lands as parsed JSON', async () => {
    await openScripts('snip-json-body');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set a JSON body');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.body.kind).toBe('json');
    expect(echo.body.parsed).toEqual({ name: 'value' });
  });

  test('oh.setUrl redirects the send (adapted to the playground)', async () => {
    await openScripts('snip-set-url');
    await workbench.fillMonaco(0, `oh.setUrl('${API_ECHO_URL}?viaSetUrl=1');`);
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.query.viaSetUrl).toBe('1');
  });
});

test.describe('Workflow / variable / vault snippets', () => {
  test('oh.sendRequest fires an ad-hoc GET (adapted to the playground)', async () => {
    await openScripts('snip-adhoc');
    await workbench.fillMonaco(
      0,
      `try { const r = await oh.sendRequest({ url: '${API_ECHO_URL}?adhoc=1', method: 'GET' }); console.log('adhoc-status', r.status); } catch (err) { console.error('adhoc-error', err); }`,
    );
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Console/);
    await expect(workbench.responseRegion().getByText(/adhoc-status 200/)).toBeVisible();
  });

  test('oh.sendRequest carries a JSON body (adapted to the playground)', async () => {
    await openScripts('snip-adhoc-body');
    await workbench.fillMonaco(
      0,
      `try { const r = await oh.sendRequest({ url: '${API_ECHO_URL}', method: 'POST', headers: [{ key: 'Content-Type', value: 'application/json' }], body: { type: 'json', content: JSON.stringify({ name: 'value' }) } }); console.log('adhoc-post', r.status, JSON.parse(r.body).body.parsed.name); } catch (err) { console.error('adhoc-post-error', err); }`,
    );
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Console/);
    await expect(workbench.responseRegion().getByText(/adhoc-post 200 value/)).toBeVisible();
  });

  test('Set a variable then Get a variable round-trips (verbatim snippets)', async () => {
    await openScripts('snip-vars');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Set a variable');
    await workbench.insertScriptSnippet('Get a variable');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Console/);
    await expect(workbench.responseRegion().getByText('variable_value')).toBeVisible();
  });

  test('oh.vault.get on a missing secret resolves null (adapted with a log)', async () => {
    await openScripts('snip-vault');
    await workbench.fillMonaco(
      0,
      `const secret = await oh.vault.get('secret_name'); console.log('vault-secret', secret);`,
    );
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Console/);
    await expect(workbench.responseRegion().getByText(/vault-secret null/)).toBeVisible();
  });
});

test.describe('Post-response test snippets surface in the Assertions tab', () => {
  test('Status code is 200 passes against the echo', async () => {
    await openScripts('snip-t-status', 'Post-response');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Status code is 200');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('Status code is 200')).toBeVisible();
    await expect(workbench.responseRegion().getByText('PASS', { exact: true })).toBeVisible();
  });

  test('Response header check passes against the echo JSON', async () => {
    await openScripts('snip-t-header', 'Post-response');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Response header check');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('Content-Type header is present')).toBeVisible();
    await expect(workbench.responseRegion().getByText('PASS', { exact: true })).toBeVisible();
  });

  test('Response time is below 200 ms passes against the local echo', async () => {
    await openScripts('snip-t-time', 'Post-response');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Response time is below 200 ms');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('Response time is below 200 ms')).toBeVisible();
    await expect(workbench.responseRegion().getByText('PASS', { exact: true })).toBeVisible();
  });

  test('Response body contains a string registers its (placeholder) failure', async () => {
    await openScripts('snip-t-contains', 'Post-response');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Response body contains a string');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('Body contains string')).toBeVisible();
    await expect(workbench.responseRegion().getByText('FAIL', { exact: true })).toBeVisible();
  });

  test('Response body equals a string registers its (placeholder) failure', async () => {
    await openScripts('snip-t-equals', 'Post-response');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Response body equals a string');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('Body is the expected string')).toBeVisible();
    await expect(workbench.responseRegion().getByText('FAIL', { exact: true })).toBeVisible();
  });

  test('Response body JSON value check parses the echo and registers its (placeholder) failure', async () => {
    await openScripts('snip-t-json', 'Post-response');
    await workbench.toggleScriptSnippets();
    await workbench.insertScriptSnippet('Response body JSON value check');
    await workbench.toggleScriptSnippets();
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('JSON value is correct')).toBeVisible();
    await expect(workbench.responseRegion().getByText('FAIL', { exact: true })).toBeVisible();
  });

  test('a response value saved to a variable reads back (adapted to the echo shape)', async () => {
    await openScripts('snip-save-val', 'Post-response');
    await workbench.fillMonaco(
      0,
      `const data = JSON.parse(oh.response.body); await oh.variables.set('auth_token', data.method); console.log('saved-token', await oh.variables.get('auth_token'));`,
    );
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Console/);
    await expect(workbench.responseRegion().getByText(/saved-token POST/)).toBeVisible();
  });
});
