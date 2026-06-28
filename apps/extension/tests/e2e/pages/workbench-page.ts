/**
 * Page object for the workbench — the UI seam the request-editor e2e
 * drives, exposing intent-level actions over the DOM.
 *
 * Selector strategy is semantic-first (the Testing Library / Playwright
 * priority): the Send button is found by its role + accessible name, and
 * sidebar rows by their existing `data-item-id` (the tree's node-identity
 * attribute). The only `data-testid` exceptions are the two role-less
 * response elements with no accessible name — the status chip
 * (`oh-response-status`) and the rendered body (`oh-response-body`).
 */

import type { Locator, Page } from '@playwright/test';

export interface RequestSeed {
  name: string;
  method: string;
  url: string;
  auth: unknown;
  body: unknown;
}

export class WorkbenchPage {
  constructor(private readonly page: Page) {}

  /** Open `workbench.html` and wait for the React root to mount. */
  static async open(page: Page, extensionId: string): Promise<WorkbenchPage> {
    await page.goto(`chrome-extension://${extensionId}/workbench.html`);
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root !== null && root.children.length > 0;
      },
      { timeout: 15000 },
    );
    return new WorkbenchPage(page);
  }

  /** Reload the workbench (e.g. after seeding) and wait for the root. */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root !== null && root.children.length > 0;
      },
      { timeout: 15000 },
    );
  }

  rpc<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    return this.page.evaluate(
      ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
        new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
            void chrome.runtime.lastError;
            resolve(response);
          });
        }),
      { type, payload },
    ) as Promise<T>;
  }

  /** Persist a request via the real CRUD RPC; returns its generated uid. */
  async seedRequest(seed: RequestSeed): Promise<string> {
    const res = await this.rpc<{ success: boolean; request?: { uid: string }; error?: string }>('createLocalRequest', {
      name: seed.name,
      seed: { method: seed.method, url: seed.url, headers: [], params: [], auth: seed.auth, body: seed.body },
    });
    if (!res.success || !res.request) throw new Error(`seedRequest failed: ${res.error ?? 'unknown'}`);
    return res.request.uid;
  }

  /**
   * Activate the API Requests tool window (the workbench opens on the
   * rules view). The activity-bar icon carries `aria-label="API Requests"`;
   * activating the view auto-expands its section.
   */
  async showRequestsView(): Promise<void> {
    await this.page.getByLabel('API Requests', { exact: true }).first().click();
    await this.page.locator('[data-item-id^="req-col-"]').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  /** Collapse the Docs/Scope dock panel so the API Requests panel fills the pane. */
  async collapseDocsPanel(): Promise<void> {
    await this.page.getByLabel('Docs', { exact: true }).first().click();
  }

  /** Click a request row, expanding its collection first if it's hidden. */
  async openRequest(uid: string): Promise<void> {
    const row = this.page.locator(`[data-item-id="request-${uid}"]`);
    if (!(await row.isVisible().catch(() => false))) {
      const cols = await this.rpc<{ collections?: Array<{ uid: string }> }>('getLocalRequestCollections');
      for (const c of cols.collections ?? []) {
        if (await row.isVisible().catch(() => false)) break;
        const colRow = this.page.locator(`[data-item-id="req-col-${c.uid}"]`);
        if (await colRow.count()) {
          await colRow.click();
          await row.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
        }
      }
    }
    await row.waitFor({ state: 'visible', timeout: 5000 });
    await row.scrollIntoViewIfNeeded();
    await row.click();
  }

  /** Click Send in the active (visible) request editor. */
  async send(): Promise<void> {
    await this.page.getByRole('button', { name: 'Send' }).filter({ visible: true }).click();
  }

  /** Wait for the response status chip in the active editor; return its text. */
  async responseStatusText(): Promise<string> {
    const tag = this.page.getByTestId('oh-response-status').filter({ visible: true });
    await tag.waitFor({ state: 'visible', timeout: 15000 });
    return (await tag.textContent())?.trim() ?? '';
  }

  // ── Editor tab navigation ───────────────────────────────────────

  /** Open a request-editor tab (Params / Headers / Body / Scripts …) by
   *  its accessible name. Tab labels carry trailing counts/dots, so pass
   *  a regex. */
  async openEditorTab(name: RegExp): Promise<void> {
    await this.page.getByRole('tab', { name }).filter({ visible: true }).first().click();
  }

  /** Open a RESPONSE-panel tab (Body / Headers / Assertions / Console),
   *  scoped to the response tab strip so it can't collide with the
   *  request editor's same-named tabs. */
  async openResponseTab(name: RegExp): Promise<void> {
    await this.responseRegion().getByRole('tab', { name }).first().click();
  }

  /** The response panel's tab region. Scope text assertions here so they
   *  can't also match the request editor — e.g. a post-response script's
   *  own source still renders in the Monaco buffer above. */
  responseRegion(): Locator {
    return this.page.locator('.rules-response-tabs');
  }

  // ── Key/value tables (Params / Headers) via Bulk Edit ───────────

  /**
   * Drive a Params/Headers table through its Bulk Edit textarea — far
   * more robust than per-cell rich inputs. Opens the table-options
   * popover, switches to Bulk Edit, types the serialized lines, then
   * switches back (which parses the text into rows and commits them to
   * the draft). `placeholder` disambiguates the textarea (Params vs
   * Headers carry different formats/placeholders).
   */
  async fillBulkEdit(placeholder: RegExp, text: string): Promise<void> {
    await this.openTableOptions();
    await this.page.getByRole('button', { name: 'Bulk Edit' }).click();
    const ta = this.page.getByPlaceholder(placeholder);
    await ta.waitFor({ state: 'visible', timeout: 5000 });
    await ta.fill(text);
    // Exit bulk mode → parses the textarea back into rows (the commit point).
    await this.openTableOptions();
    await this.page.getByRole('button', { name: 'Key-Value Edit' }).click();
  }

  private async openTableOptions(): Promise<void> {
    await this.page.getByRole('button', { name: 'Table options' }).filter({ visible: true }).first().click();
  }

  // ── Body controls ───────────────────────────────────────────────

  /** Pick a body encoding radio (none / form-data / x-www-form-urlencoded
   *  / raw / GraphQL). */
  async selectBodyRadio(label: string): Promise<void> {
    await this.page.getByRole('radio', { name: label, exact: true }).check();
  }

  /** Pick the raw-body format from the Select next to the `raw` radio
   *  (Text / JavaScript / JSON / HTML / XML).
   *
   *  The Select is the `.ant-select` that follows the body radio group in
   *  the same row. We click the CONTAINER, not its `role=combobox` input —
   *  that input is a zero-width readonly element that doesn't open the
   *  dropdown (and `combobox` is ambiguous here: the method picker, URL
   *  bar, and every key/value cell all carry that role). The `visible`
   *  filter drops the hidden duplicate each background document tab keeps. */
  async selectRawFormat(label: string): Promise<void> {
    await this.page
      .locator('.ant-radio-group')
      .filter({ visible: true })
      .locator('xpath=following-sibling::div[contains(@class,"ant-select")]')
      .first()
      .click();
    await this.page
      .locator('.ant-select-item-option')
      .filter({ hasText: label })
      .filter({ visible: true })
      .first()
      .click();
  }

  /** Pick which script the Scripts tab's shared editor edits. */
  async selectScriptRail(label: 'Pre-request' | 'Post-response'): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click();
  }

  // ── Monaco editors (body content, scripts) ──────────────────────

  /**
   * Replace the contents of the Nth VISIBLE Monaco editor. Uses
   * `insertText` (a single bulk insert) rather than per-key typing so
   * Monaco's auto-closing brackets don't mangle JSON / script braces.
   *
   * Keep `text` to a SINGLE LINE. Monaco applies per-line auto-indent +
   * bracket-close on the `\n`s in a multi-line insert, which lands stray
   * `}` and shifting indentation — collapse multi-statement scripts onto
   * one line instead.
   */
  async fillMonaco(index: number, text: string): Promise<void> {
    const ed = this.page.locator('.monaco-editor').filter({ visible: true }).nth(index);
    await ed.click();
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.insertText(text);
  }

  // ── Response readback ───────────────────────────────────────────

  /**
   * Read the rendered response body and parse it as the `/api/echo`
   * reflection. The Body tab is active by default after a Send, and the
   * body `<pre>` carries `data-testid="oh-response-body"` (the same
   * role-less-element exception as the status chip), so we target it
   * directly rather than guessing among the page's `<pre>` elements.
   */
  async responseEcho<T = unknown>(): Promise<T> {
    const body = this.page.getByTestId('oh-response-body').filter({ visible: true });
    await body.waitFor({ state: 'visible', timeout: 15000 });
    const txt = (await body.textContent())?.trim() ?? '';
    return JSON.parse(txt) as T;
  }
}
