/**
 * `reloadTab` — the background reloads a tab for a surface that cannot
 * reload the tab it inspects itself.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigationHandlers } from '@/background/modules/message-handler/handlers/navigation';
import type { MessageHandlerContext } from '@/types/browser';

const reload = vi.fn<(tabId: number) => Promise<void>>();
const tabsApi = chrome.tabs as unknown as { reload?: typeof reload };

function dispatch(message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve) => {
    navigationHandlers.reloadTab({
      message: { type: 'reloadTab', ...message },
      sender: {},
      respond: resolve,
      ctx: {} as MessageHandlerContext,
    });
  });
}

afterEach(() => {
  reload.mockReset();
  delete tabsApi.reload;
});

describe('reloadTab handler', () => {
  it('reloads the named tab and answers ok', async () => {
    tabsApi.reload = reload.mockResolvedValue(undefined);
    await expect(dispatch({ tabId: 195 })).resolves.toEqual({ ok: true });
    expect(reload).toHaveBeenCalledExactlyOnceWith(195);
  });

  it('answers not-ok when the browser refuses', async () => {
    tabsApi.reload = reload.mockRejectedValue(new Error('No tab with id 195'));
    await expect(dispatch({ tabId: 195 })).resolves.toEqual({ ok: false });
  });

  it.each([[-1], [undefined], ['195']])('refuses %s without touching the tabs API', async (tabId) => {
    tabsApi.reload = reload;
    await expect(dispatch({ tabId })).resolves.toEqual({ ok: false });
    expect(reload).not.toHaveBeenCalled();
  });
});
