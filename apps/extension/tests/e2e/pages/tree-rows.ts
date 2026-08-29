/**
 * Sidebar tree rows for the tree-order specs — the gestures and reads
 * every tree-order leg shares: a row by its `data-item-id` (the tree's
 * node-identity attribute), the document order of the rows, expanding
 * a container, a real pointer drag onto a target row's band (dnd-kit's
 * pointer sensor, 4px activation), the Alt+Arrow keyboard move on the
 * focused row, the `+` → Add Folder action on a container row, and the
 * "N items moved" toast.
 */

import { expect, type Locator, type Page } from '@playwright/test';

export class TreeRows {
  constructor(private readonly page: Page) {}

  row(id: string): Locator {
    return this.page.locator(`[data-item-id="${id}"]`);
  }

  /** Document order of the tree rows, as `data-item-id`s. */
  async order(): Promise<string[]> {
    return this.page
      .locator('[data-item-id]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id') ?? ''));
  }

  /** The ids in `ids`, in document order — the rows the assertion cares about, nothing else. */
  async orderOf(ids: readonly string[]): Promise<string[]> {
    const all = await this.order();
    return all.filter((id) => ids.includes(id));
  }

  async expandIfCollapsed(id: string): Promise<void> {
    const target = this.row(id);
    await target.waitFor({ state: 'visible', timeout: 10000 });
    // The caret's inline transform is the expansion state: `rotate(90deg)`
    // open, `rotate(0deg)` closed (a computed style is a matrix either way).
    const caret = target.locator('.rules-sidebar-item-caret .anticon');
    const expanded = await caret
      .evaluate((el) => (el as HTMLElement).style.transform.includes('90deg'))
      .catch(() => false);
    if (!expanded) await target.click();
  }

  /** Drag `source` onto `target` at `band` (0 = top edge … 1 = bottom edge). */
  async drag(source: Locator, target: Locator, band: number): Promise<void> {
    // `hover` waits for the row to be stable — the previous drop's
    // re-render may still be shifting rows when the next drag starts.
    await source.hover();
    const from = (await source.boundingBox())!;
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
    const to = (await target.boundingBox())!;
    await this.page.mouse.move(to.x + to.width / 2, to.y + to.height * band, { steps: 8 });
    // The moving rows collapse once a landing spot resolves and the rows
    // below shift up under the pointer; settle on the target's new box
    // the way a hand keeps tracking it.
    await this.page.waitForTimeout(150);
    const settled = (await target.boundingBox())!;
    await this.page.mouse.move(settled.x + settled.width / 2 + 1, settled.y + settled.height * band, { steps: 3 });
    await this.page.mouse.up();
  }

  /** Focus a row with a plain click, then press an Alt+Arrow move chord on it. */
  async keyboardMove(id: string, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): Promise<void> {
    await this.row(id).click();
    await this.page.keyboard.press(`Alt+${key}`);
  }

  /** The container row's hover `+` → "Add Folder". */
  async addFolder(containerId: string): Promise<void> {
    const container = this.row(containerId);
    await container.hover();
    await container.locator('.rules-sidebar-collection-actions .anticon-plus').click();
    await this.page
      .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: 'Add Folder' })
      .click();
  }

  /** The newest toast — an earlier move's may still be fading out. */
  async expectMovedToast(count: number): Promise<void> {
    const text = count === 1 ? '1 item moved' : `${count} items moved`;
    await expect(this.page.locator('.ant-message-notice-title', { hasText: text }).last()).toBeVisible({
      timeout: 5000,
    });
  }
}
