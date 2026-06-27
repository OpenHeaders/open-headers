/**
 * Page object for the workbench — the UI seam the request-editor e2e
 * drives, exposing intent-level actions over the DOM.
 *
 * Selector strategy is semantic-first (the Testing Library / Playwright
 * priority): the Send button is found by its role + accessible name, and
 * sidebar rows by their existing `data-item-id` (the tree's node-identity
 * attribute). The one exception is the response status chip — a styled
 * `<Tag>` with no role or label — which carries a single `data-testid`.
 */

import type { Page } from '@playwright/test';

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
}
