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

  /** Resolve the browser tab id of the first tab whose URL starts with
   *  `url` — the workbench is an extension page, so `chrome.tabs.query`
   *  is available in its realm. */
  async tabIdForUrl(url: string): Promise<number> {
    const tabId = await this.page.evaluate(
      (prefix: string) =>
        new Promise<number | null>((resolve) => {
          chrome.tabs.query({ url: `${prefix}*` }, (tabs) => resolve(tabs[0]?.id ?? null));
        }),
      url,
    );
    if (typeof tabId !== 'number') throw new Error(`no tab matches ${url}`);
    return tabId;
  }

  /** Persist a request via the real CRUD RPC; returns its generated uid.
   *  On a fresh profile the SW's sync oracle bootstraps async and the
   *  store rejects mutations until it is up — retry that race, bounded. */
  async seedRequest(seed: RequestSeed): Promise<string> {
    let lastError = 'unknown';
    for (let attempt = 0; attempt < 30; attempt++) {
      const res = await this.rpc<{ success: boolean; request?: { uid: string }; error?: string }>(
        'createLocalRequest',
        {
          name: seed.name,
          seed: { method: seed.method, url: seed.url, headers: [], params: [], auth: seed.auth, body: seed.body },
        },
      );
      if (res.success && res.request) return res.request.uid;
      lastError = res.error ?? 'unknown';
      if (!/not initialized|before hydration/.test(lastError)) break;
      await this.page.waitForTimeout(1000);
    }
    throw new Error(`seedRequest failed: ${lastError}`);
  }

  /**
   * Activate the API Requests tool window (the workbench opens on the
   * rules view). The activity-bar icon carries `aria-label="API Requests"`;
   * activating the view auto-expands its section.
   */
  async showRequestsView(): Promise<void> {
    // State-driven, never toggle-and-hope. The dock strip's tool-window
    // tabs carry `data-tool-window="<id>"` + `aria-selected` (open/closed)
    // and the REQUESTS section header carries `aria-expanded` — read the
    // state, click only when it's wrong.
    const viewTab = this.dockTab('api-requests');
    if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
      await viewTab.click();
    }
    // Unanchored name match: the computed accessible name is
    // "▶ REQUESTS plus" — the caret glyph and the header's `+` action
    // icon (an antd `img "plus"`) both fold into it.
    const sectionHeader = this.page
      .getByRole('button', { name: /REQUESTS/ })
      .filter({ visible: true })
      .first();
    await sectionHeader.waitFor({ state: 'visible', timeout: 10000 });
    if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
      await sectionHeader.click();
    }
    await this.page.locator('[data-item-id^="req-col-"]').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  /** Collapse the Docs/Scope dock panel so the API Requests panel fills
   *  the pane. No-op when it is already collapsed (`aria-selected`). */
  async collapseDocsPanel(): Promise<void> {
    const docsTab = this.dockTab('docs');
    if ((await docsTab.getAttribute('aria-selected')) === 'true') {
      await docsTab.click();
    }
  }

  /** A dock-strip tool-window tab by its stable tool-window id. */
  private dockTab(id: string): Locator {
    return this.page.locator(`[data-tool-window="${id}"]`).first();
  }

  /** Make a request row visible, expanding its collection if needed. */
  private async revealRequestRow(uid: string): Promise<Locator> {
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
    return row;
  }

  /** Click a request row, expanding its collection first if it's hidden. */
  async openRequest(uid: string): Promise<void> {
    const row = await this.revealRequestRow(uid);
    await row.click();
  }

  /** Click Send in the active (visible) request editor. The name match
   *  anchors on end-of-string: the accessible name is "caret-right Send"
   *  (icon + label) and a bare substring 'Send' also matches the Settings
   *  tab's "About Send browser cookies" info trigger. */
  async send(): Promise<void> {
    await this.page.getByRole('button', { name: /Send$/ }).filter({ visible: true }).click();
  }

  /** Close any dropdown a previous gesture left open (or mid-closing
   *  animation) — a stale `.ant-dropdown` otherwise double-matches the
   *  menu lookups of the NEXT gesture (strict-mode violation / clicks
   *  landing on a disappearing node). */
  private async dismissOpenDropdowns(): Promise<void> {
    if (await this.page.locator('.ant-dropdown:not(.ant-dropdown-hidden)').count()) {
      await this.page.keyboard.press('Escape');
    }
    await this.page
      .waitForFunction(() => document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)') === null, undefined, {
        timeout: 3000,
      })
      .catch(() => {});
  }

  /** The most recently opened dropdown — antd keeps closed ones in the
   *  DOM (`.ant-dropdown-hidden`), so scope to the last non-hidden. */
  private openDropdown(): Locator {
    return this.page.locator('.ant-dropdown:not(.ant-dropdown-hidden)').last();
  }

  /** Copy a sidebar request row as a snippet: hover the row, open its
   *  `⋯` menu, hover the "Copy as" submenu, click the format entry. */
  async copyAsFromSidebar(uid: string, format: 'cURL' | 'fetch'): Promise<void> {
    await this.dismissOpenDropdowns();
    const row = await this.revealRequestRow(uid);
    await row.hover();
    await row.locator('.rules-sidebar-item-menu').click();
    // Unanchored: the submenu title's accessible name folds in the copy
    // icon and the trailing expand arrow ("copy Copy as right").
    const copyAsItem = this.openDropdown()
      .getByRole('menuitem', { name: /Copy as/ })
      .first();
    await copyAsItem.hover();
    const formatItem = this.page.getByRole('menuitem', { name: format, exact: true }).filter({ visible: true }).last();
    try {
      await formatItem.waitFor({ state: 'visible', timeout: 2000 });
    } catch {
      // Some antd builds open the submenu on click rather than hover.
      await copyAsItem.click();
      await formatItem.waitFor({ state: 'visible', timeout: 3000 });
    }
    await formatItem.click();
  }

  /** Copy the ACTIVE editor's draft as a snippet via the header's `⋯`
   *  overflow menu ("Copy as cURL" / "Copy as fetch"). */
  async copyAsFromEditor(format: 'cURL' | 'fetch'): Promise<void> {
    await this.dismissOpenDropdowns();
    await this.page.getByRole('button', { name: 'More actions' }).filter({ visible: true }).click();
    const item = this.openDropdown().getByRole('menuitem', { name: new RegExp(`Copy as ${format}$`) });
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
  }

  /** Wait for the response status chip in the active editor; return its text. */
  async responseStatusText(): Promise<string> {
    const tag = this.page.getByTestId('oh-response-status').filter({ visible: true });
    await tag.waitFor({ state: 'visible', timeout: 15000 });
    return (await tag.textContent())?.trim() ?? '';
  }

  /** Wait for the failed-send error state in the active editor; return
   *  its message text (the executor's classified failure). */
  async responseErrorText(): Promise<string> {
    const msg = this.page.getByTestId('oh-response-error').filter({ visible: true });
    await msg.waitFor({ state: 'visible', timeout: 15000 });
    return (await msg.textContent())?.trim() ?? '';
  }

  /** The error state's "Open in new tab" recovery affordance — rendered
   *  only when the snapshot carries an `open-in-tab` hint. */
  responseErrorOpenTabButton(): Locator {
    return this.page.getByTestId('oh-response-error-open-tab').filter({ visible: true });
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
   *  own source still renders in the Monaco buffer above. Visible-only:
   *  editors of previously opened requests stay mounted in background
   *  tabs, and their response panels would otherwise strict-mode-collide
   *  (two PASS/FAIL badges once two script tests have run). */
  responseRegion(): Locator {
    return this.page.locator('.rules-response-tabs').filter({ visible: true });
  }

  // ── Key/value tables (Params / Headers) via Bulk Edit ───────────

  /**
   * Drive a Params/Headers table through its Bulk Edit textarea — far
   * more robust than per-cell rich inputs. The Bulk/Key-Value toggle is
   * an inline button in the table's last visible column header (the `⋯`
   * table-options popover only keeps the column toggles): click "Bulk",
   * type the serialized lines, click "Key-Value" (which parses the text
   * back into rows and commits them to the draft). `placeholder`
   * disambiguates the textarea (Params vs Headers carry different
   * formats/placeholders). Name matching is unanchored-prefix: the
   * button's accessible name includes its edit icon ("edit Bulk").
   */
  async fillBulkEdit(placeholder: RegExp, text: string): Promise<void> {
    await this.bulkToggle(/Bulk$/).click();
    const ta = this.page.getByPlaceholder(placeholder);
    await ta.waitFor({ state: 'visible', timeout: 5000 });
    await ta.fill(text);
    // Exit bulk mode → parses the textarea back into rows (the commit point).
    await this.bulkToggle(/Key-Value$/).click();
  }

  private bulkToggle(name: RegExp): Locator {
    return this.page.getByRole('button', { name }).filter({ visible: true }).first();
  }

  // ── Body controls ───────────────────────────────────────────────

  /** Pick a body encoding radio (none / form-data / x-www-form-urlencoded
   *  / raw / GraphQL). Non-exact name match: the hover-revealed `(i)`
   *  InfoTrigger inside each label folds into the accessible name. */
  async selectBodyRadio(label: string): Promise<void> {
    await this.page.getByRole('radio', { name: label }).first().check();
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

  /** Pick which script the Scripts tab's shared editor edits. The rail
   *  row's accessible name starts with the label but also folds in its
   *  inline InfoTrigger ("Pre-request About Pre-request script"), so
   *  match on the prefix — the ⓘ button itself starts with "About" and
   *  can't collide. */
  async selectScriptRail(label: 'Pre-request' | 'Post-response'): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(`^${label}`) })
      .filter({ visible: true })
      .first()
      .click();
  }

  // ── Scripts tab — snippets popover ──────────────────────────────

  /** Toggle the Scripts tab's floating snippets popover (the `</>`
   *  Snippets button in the editor's bottom-right action bar). */
  async toggleScriptSnippets(): Promise<void> {
    await this.page.getByTestId('oh-script-snippets').filter({ visible: true }).first().click();
  }

  /** The open snippets popover — anchored on its search field so the
   *  locator can't match other popovers. */
  scriptSnippetsPopover(): Locator {
    return this.page
      .locator('.ant-popover')
      .filter({ has: this.page.getByPlaceholder('Search snippets') })
      .filter({ visible: true })
      .first();
  }

  async searchScriptSnippets(query: string): Promise<void> {
    await this.scriptSnippetsPopover().getByPlaceholder('Search snippets').fill(query);
  }

  /** Click a snippet entry by its exact label. Inserts at the editor
   *  cursor; the popover intentionally stays open. */
  async insertScriptSnippet(label: string): Promise<void> {
    await this.scriptSnippetsPopover().getByRole('button', { name: label, exact: true }).click();
  }

  /** Run the Scripts tab action bar's Format (beautify) button. */
  async formatScript(): Promise<void> {
    await this.page.getByRole('button', { name: 'Format script' }).filter({ visible: true }).first().click();
  }

  // ── Scripts tab — packages popover ──────────────────────────────

  /** Toggle the Scripts tab's Packages popover (left of Snippets). */
  async toggleScriptPackages(): Promise<void> {
    await this.page.getByTestId('oh-script-packages').filter({ visible: true }).first().click();
  }

  /** The open Packages popover — anchored on its search field. */
  scriptPackagesPopover(): Locator {
    return this.page
      .locator('.ant-popover')
      .filter({ has: this.page.getByPlaceholder('Search packages') })
      .filter({ visible: true })
      .first();
  }

  /** Click a package entry — inserts `const <ident> = oh.require('<name>');`. */
  async insertPackageRequire(name: string): Promise<void> {
    await this.scriptPackagesPopover().getByRole('button', { name, exact: true }).click();
  }

  // ── Package Library tab ─────────────────────────────────────────

  /** Open the Package Library tab from the API Requests view's sidebar
   *  opener row (always visible — no section to expand). */
  async openPackageLibrary(): Promise<void> {
    const row = this.page.locator('[data-item-id="script-packages-row"]');
    await row.waitFor({ state: 'visible', timeout: 5000 });
    await row.click();
  }

  /** Create a package through the Library tab. `source` must be a
   *  single line (see {@link fillMonaco}). */
  async createPackage(name: string, source: string): Promise<void> {
    await this.page.getByRole('button', { name: /New$/ }).filter({ visible: true }).first().click();
    await this.page.getByLabel('Package name').filter({ visible: true }).fill(name);
    await this.fillMonaco(0, source);
    await this.page.getByRole('button', { name: 'Save', exact: true }).filter({ visible: true }).first().click();
  }

  /** A package row in the Library tab's left list. */
  packageRow(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
  }

  // ── Monaco context menu (script editor selection actions) ────────

  /** Select the whole buffer of the Nth visible Monaco editor. */
  async selectAllInMonaco(index: number): Promise<void> {
    const ed = this.page.locator('.monaco-editor').filter({ visible: true }).nth(index);
    await ed.click();
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  }

  /** Right-click INSIDE the current selection (first rendered line) so
   *  Monaco keeps the selection and shows its context menu. */
  async openMonacoContextMenu(index: number): Promise<void> {
    const line = this.page.locator('.monaco-editor').filter({ visible: true }).nth(index).locator('.view-line').first();
    await line.click({ button: 'right', position: { x: 10, y: 5 } });
    await this.page.locator('.monaco-menu').first().waitFor({ state: 'visible', timeout: 5000 });
    // Monaco arms each menu item's mouse-up listener 100 ms AFTER the
    // menu opens ("avoid accidental clicks" scheduler in menu.js) — a
    // click landing earlier is silently dropped and the menu stays open.
    await this.page.waitForTimeout(150);
  }

  /** Click an entry in Monaco's open context menu by its exact label.
   *  Monaco silently drops clicks that land before the item's mouse-up
   *  listener is armed (100 ms scheduler), leaving the menu open —
   *  retry until the menu actually closes. */
  async clickMonacoMenuItem(label: string): Promise<void> {
    const menu = this.page.locator('.monaco-menu').first();
    const item = menu.getByText(label, { exact: true }).first();
    await item.click();
    // Give a successful click's async menu teardown a beat, then retry
    // ONLY while the menu is verifiably still up — a blind retry after
    // close would land on whatever now occupies those coordinates.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.page.waitForTimeout(200);
      if (!(await menu.isVisible().catch(() => false))) return;
      await item.click({ timeout: 2000 }).catch(() => {});
    }
  }

  /** The Save-to-Package popover opened from the editor context menu. */
  saveToPackagePopover(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Save to Package Library' }).first();
  }

  /** The Set-as-variable popover (context menu on inputs + editor). */
  setAsVariablePopover(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Set as new variable' }).first();
  }

  // ── Authorization tab ───────────────────────────────────────────

  /** Pick an auth type in the Authorization tab's left-rail Select
   *  (`oh-auth-type` — the rail can hold several Selects at once). */
  async selectAuthType(label: string): Promise<void> {
    await this.page.getByTestId('oh-auth-type').filter({ visible: true }).first().click();
    await this.page
      .locator('.ant-select-item-option')
      .filter({ hasText: label })
      .filter({ visible: true })
      .first()
      .click();
  }

  /** Pick where the api-key auth rides — 'Header' / 'Query Params'
   *  (`oh-auth-apikey-in`). */
  async selectApiKeyPlacement(label: string): Promise<void> {
    await this.page.getByTestId('oh-auth-apikey-in').filter({ visible: true }).first().click();
    await this.page
      .locator('.ant-select-item-option')
      .filter({ hasText: label })
      .filter({ visible: true })
      .first()
      .click();
  }

  // ── TemplateInput surfaces (by placeholder) ─────────────────────

  /** A TemplateInput's contentEditable surface, found by its
   *  `data-placeholder` — the one attribute every instance carries. */
  templateInput(placeholder: string): Locator {
    return this.page.locator(`[data-placeholder="${placeholder}"]`).filter({ visible: true }).first();
  }

  /** The wrapper around a TemplateInput — owns the hover action rail
   *  (eye / edit / clear icons) next to the editable. */
  templateInputWrapper(placeholder: string): Locator {
    return this.page
      .locator('.oh-template-input-wrapper')
      .filter({ has: this.page.locator(`[data-placeholder="${placeholder}"]`) })
      .filter({ visible: true })
      .first();
  }

  /** Replace a TemplateInput's content. Bulk `insertText` (like
   *  {@link fillMonaco}) so nothing reinterprets the keystrokes. */
  async fillTemplateInput(placeholder: string, text: string): Promise<void> {
    await this.templateInput(placeholder).click();
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.insertText(text);
  }

  // ── TemplateInput selection context menu ────────────────────────

  /** The URL bar's contentEditable surface (TemplateInput). */
  urlInput(): Locator {
    return this.page.locator('[data-placeholder="Enter URL or paste text"]').filter({ visible: true }).first();
  }

  /** Select all text in a TemplateInput and open the custom selection
   *  context menu on it. */
  async openInputContextMenu(input: Locator): Promise<void> {
    await input.click();
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await input.click({ button: 'right' });
  }

  /** A row in the custom selection context menu. */
  inputContextMenuItem(label: string): Locator {
    return this.page.getByRole('menuitem', { name: label, exact: true }).filter({ visible: true }).first();
  }

  /**
   * Read the visible text of the Nth VISIBLE Monaco editor. Short
   * buffers only — Monaco virtualizes long ones, so lines outside the
   * viewport wouldn't be in the DOM. Monaco renders spaces as NBSP;
   * normalize them back.
   */
  async monacoText(index: number): Promise<string> {
    const ed = this.page.locator('.monaco-editor').filter({ visible: true }).nth(index);
    return (await ed.locator('.view-lines').innerText()).replace(/\u00a0/g, ' ');
  }

  // ── Grid value rail (value-detection edit icons) ────────────────

  /** The grid value cell (TemplateInput wrapper) whose action rail
   *  holds the edit icon with the given accessible name — the per-type
   *  tooltip from `useValueEditAction` (e.g. "Edit Base64 value"),
   *  which doubles as the icon's `aria-label`. */
  valueCellByEditIcon(label: string): Locator {
    return this.page
      .locator('.oh-template-input-wrapper')
      .filter({ has: this.page.getByLabel(label, { exact: true }) })
      .filter({ visible: true })
      .first();
  }

  /** Hover a grid value cell (the rail is hover/focus-revealed) and
   *  click its edit icon — opens that value type's editor modal. */
  async openValueEditor(label: string): Promise<void> {
    const cell = this.valueCellByEditIcon(label);
    await cell.scrollIntoViewIfNeeded();
    await cell.hover();
    await cell.getByLabel(label, { exact: true }).click();
  }

  /** Read the literal text of a grid value cell located by
   *  {@link valueCellByEditIcon} — TemplateInput renders spaces as
   *  NBSP; normalize them back. */
  async valueCellText(cell: Locator): Promise<string> {
    return (await cell.locator('.oh-template-input-editable').innerText()).replace(/\u00a0/g, ' ').trim();
  }

  /** Toggle a Settings-tab switch by its accessible name (aria-label). */
  async toggleSwitch(name: string): Promise<void> {
    await this.page.getByRole('switch', { name, exact: true }).filter({ visible: true }).first().click();
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
    await this.fillMonacoEditor(this.page.locator('.monaco-editor').filter({ visible: true }).nth(index), text);
  }

  /** Replace the contents of the Nth Monaco editor INSIDE `scope` (e.g.
   *  a modal dialog) — same single-line bulk-insert contract as
   *  {@link fillMonaco}, WITHOUT the suggest-dismissing Escape: inside
   *  an antd Modal the unconsumed Escape bubbles to the dialog and
   *  closes it, discarding the edit. */
  async fillMonacoWithin(scope: Locator, index: number, text: string): Promise<void> {
    await this.fillMonacoEditor(scope.locator('.monaco-editor').nth(index), text, { dismissSuggest: false });
  }

  /** Read the visible text of the Nth Monaco editor inside `scope` —
   *  same short-buffer caveat as {@link monacoText}. */
  async monacoTextWithin(scope: Locator, index: number): Promise<string> {
    const ed = scope.locator('.monaco-editor').nth(index);
    return (await ed.locator('.view-lines').innerText()).replace(/\u00a0/g, ' ');
  }

  private async fillMonacoEditor(ed: Locator, text: string, opts?: { dismissSuggest?: boolean }): Promise<void> {
    await ed.click();
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.insertText(text);
    // Inserting identifier characters opens Monaco's suggest widget; a
    // later click anywhere near it can ACCEPT a completion and corrupt
    // the buffer (`c` → `clearInterval`). Dismiss it while it exists.
    if (text.trim() && opts?.dismissSuggest !== false) await this.page.keyboard.press('Escape');
  }

  // ── Response readback ───────────────────────────────────────────

  /**
   * Read the rendered response body and parse it as the `/api/echo`
   * reflection. The Body tab defaults to the Pretty view (Monaco, whose
   * DOM virtualizes long buffers), so switch to Raw first — that view
   * renders the verbatim wire text in a plain `<pre>` carrying
   * `data-testid="oh-response-body"` (the same role-less-element
   * exception as the status chip).
   */
  async responseEcho<T = unknown>(): Promise<T> {
    return JSON.parse(await this.responseRawBody()) as T;
  }

  /** Switch the response Body pane to a picker view by its trailing
   *  label text (menu labels carry a glyph prefix). While Preview holds
   *  the selection the picker's FIRST click only takes it back to the
   *  base view without opening the menu (the two-way toggle law), so a
   *  second click may be needed before the menu items exist. */
  async pickResponseView(label: RegExp): Promise<void> {
    const picker = this.page.getByTestId('oh-response-view-picker').filter({ visible: true }).first();
    await picker.waitFor({ state: 'visible', timeout: 15000 });
    await picker.click();
    const item = this.page
      .locator('.ant-dropdown-menu-item')
      .filter({ hasText: label })
      .filter({ visible: true })
      .first();
    try {
      await item.waitFor({ state: 'visible', timeout: 2000 });
    } catch {
      await picker.click();
      await item.waitFor({ state: 'visible', timeout: 15000 });
    }
    await item.click();
  }

  /** Read the rendered response body verbatim via the Raw view — the
   *  plain `<pre>` under `data-testid="oh-response-body"` (Pretty is
   *  Monaco, whose DOM virtualizes long buffers). */
  async responseRawBody(): Promise<string> {
    await this.pickResponseView(/Raw$/);
    const body = this.page.getByTestId('oh-response-body').filter({ visible: true });
    await body.waitFor({ state: 'visible', timeout: 15000 });
    // innerText, not textContent: the Raw view renders a numbered grid
    // whose line breaks are layout (one row per line) — innerText keeps
    // them and excludes the pseudo-content line numbers.
    return (await body.innerText()).trim();
  }

  /** Read the Hex view's dump text — hex pairs + ASCII columns; the
   *  offsets live in their own column (`responseHexOffsetsText`).
   *  Switches the pane to Hex first. */
  async responseHexText(): Promise<string> {
    await this.pickResponseView(/Hex$/);
    const hex = this.page.getByTestId('oh-response-hex').filter({ visible: true });
    await hex.waitFor({ state: 'visible', timeout: 15000 });
    return (await hex.textContent()) ?? '';
  }

  /** A magic-signature highlight in the Hex dump by its label (e.g.
   *  `TAR header`) — the ASCII-column span buildHexDump splits off for
   *  a detected file signature (assumes Hex is active). */
  responseHexMagic(label: string): Locator {
    return this.page.getByTestId('oh-response-hex').filter({ visible: true }).locator(`span[title="${label}"]`);
  }

  /** Read the Hex view's offset column (assumes Hex is active). */
  async responseHexOffsetsText(): Promise<string> {
    const offsets = this.page.getByTestId('oh-response-hex-offsets').filter({ visible: true });
    await offsets.waitFor({ state: 'visible', timeout: 15000 });
    return (await offsets.textContent()) ?? '';
  }

  /** The response Body pane's Preview toggle — rendered only when the
   *  body previews (PDF, HTML, or parseable JSON), so its absence is
   *  itself an assertable state. */
  responsePreviewToggle(): Locator {
    return this.page.getByRole('button', { name: /Preview$/ }).filter({ visible: true });
  }

  /** The PDF preview iframe — the browser's viewer over a blob URL. */
  responsePdfPreview(): Locator {
    return this.page.getByTestId('oh-response-pdf-preview').filter({ visible: true });
  }

  /** The image preview `<img>` — the captured bytes over a blob URL. */
  responseImagePreview(): Locator {
    return this.page.getByTestId('oh-response-image-preview').filter({ visible: true });
  }

  /** The audio/video preview element — the captured bytes over a blob URL. */
  responseMediaPreview(): Locator {
    return this.page.getByTestId('oh-response-media-preview').filter({ visible: true });
  }

  /** The JSON tree preview — collapsible key/value rows over the parsed body. */
  responseJsonPreview(): Locator {
    return this.page.getByTestId('oh-response-json-preview').filter({ visible: true });
  }

  /** A response body pane notice by its text (truncation, duplicate keys…). */
  responseBodyNotice(text: string | RegExp): Locator {
    return this.page.getByText(text).filter({ visible: true });
  }

  /** The Raw view's ANSI toggle — rendered only while the display text
   *  carries SGR escapes, so its absence is itself an assertable state. */
  responseAnsiToggle(): Locator {
    return this.page.getByTestId('oh-response-ansi-toggle').filter({ visible: true });
  }

  /** Styled run spans in the Raw grid matching `text` — the span-per-run
   *  ANSI render (assumes Raw is the active view). */
  responseAnsiRuns(text: string): Locator {
    return this.page
      .getByTestId('oh-response-body')
      .filter({ visible: true })
      .locator('span[style*="color"]')
      .filter({ hasText: text });
  }

  /** Open the response body Filter bar (switches the pane to Pretty)
   *  and type a query into its one-line Monaco input — which autofocuses
   *  on open. Esc dismisses the suggest widget so it can't swallow later
   *  interactions (same trap as `fillMonacoEditor`). */
  async filterResponseBody(query: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Filter body' }).filter({ visible: true }).first().click();
    await this.page.keyboard.type(query);
    await this.page.keyboard.press('Escape');
  }

  /** Read the Pretty view's rendered text (Monaco virtualizes — only
   *  suitable for short buffers, e.g. a filtered result). Monaco paints
   *  spaces as U+00A0; the readback normalizes them to plain spaces. */
  async responsePrettyText(): Promise<string> {
    const lines = this.page.locator('.rules-code-editor .monaco-editor .view-lines').filter({ visible: true }).last();
    await lines.waitFor({ state: 'visible', timeout: 15000 });
    return (await lines.innerText()).replace(/ /g, ' ');
  }

  /** The in-flight Stop button — Send morphs into it for every send;
   *  clicking it materializes a streamed send's partial snapshot. */
  requestStopButton(): Locator {
    return this.page.getByTestId('oh-request-stop').filter({ visible: true });
  }

  /** The streaming send's live phase — head status + live body tail,
   *  rendered while frames arrive (before the snapshot materializes). */
  responseLiveTail(): Locator {
    return this.page.getByTestId('oh-response-live-tail').filter({ visible: true });
  }

  /** The live phase's status tag — the response head, shown as soon as
   *  it arrives, while the body still streams. */
  responseLiveStatus(): Locator {
    return this.page.getByTestId('oh-response-live-status').filter({ visible: true });
  }

  /** The live phase's tab-bar meta strip — pulsing dot, head status,
   *  ticking elapsed time, bytes received so far. */
  responseLiveMeta(): Locator {
    return this.page.getByTestId('oh-response-live-meta').filter({ visible: true });
  }

  /** The live phase's ticking elapsed-time fact. */
  responseLiveElapsed(): Locator {
    return this.page.getByTestId('oh-response-live-elapsed').filter({ visible: true });
  }

  /** The meta strip's streamed-capture attribution tag — present only
   *  when the live stream phase engaged or the read ended early. */
  responseStreamedTag(): Locator {
    return this.page.getByTestId('oh-response-streamed').filter({ visible: true });
  }

  /** The SSE event-list surface — one list, both phases (live feed and
   *  materialized snapshot). */
  responseSseEventList(): Locator {
    return this.page.getByTestId('oh-sse-event-list').filter({ visible: true });
  }

  /** The event list's rows, newest-first. */
  responseSseEventRows(): Locator {
    return this.responseSseEventList().getByTestId('oh-sse-event-row');
  }

  /** The list's ended lifecycle row (closed / stopped / capped …). */
  responseSseLifecycleRow(): Locator {
    return this.responseSseEventList().getByTestId('oh-sse-lifecycle-row');
  }

  /** The list's connected lifecycle row — always at the bottom. */
  responseSseConnectedRow(): Locator {
    return this.responseSseEventList().getByTestId('oh-sse-connected-row');
  }

  /** Per-event session timestamps — rendered only when the events
   *  streamed in live this editor session. */
  responseSseEventTimes(): Locator {
    return this.responseSseEventList().getByTestId('oh-sse-event-time');
  }

  /** The event list's stream-level search input. */
  responseSseSearch(): Locator {
    return this.responseSseEventList().getByTestId('oh-sse-search');
  }

  /** An expanded row's mini viewer (Monaco over the event payload). */
  responseSseEventViewer(): Locator {
    return this.responseSseEventList().getByTestId('oh-sse-event-viewer');
  }

  /** Text of the response Body view picker — the language the viewer
   *  detected from the Content-Type (or the active encoding view). */
  async responseViewPickerLabel(): Promise<string> {
    const picker = this.page.getByTestId('oh-response-view-picker').filter({ visible: true }).first();
    await picker.waitFor({ state: 'visible', timeout: 15000 });
    return (await picker.textContent())?.trim() ?? '';
  }
}
