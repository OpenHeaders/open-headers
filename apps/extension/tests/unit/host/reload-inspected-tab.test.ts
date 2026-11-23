import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSPECTED_TAB_PARAM } from '@/host/inspected-tab-id';
import { reloadInspectedTab } from '@/host/reload-inspected-tab';
import { chrome as chromeMock } from '../../__mocks__/chrome';

const { call } = vi.hoisted(() => ({ call: vi.fn(() => Promise.resolve({ ok: true })) }));
vi.mock('@utils/bridge', () => ({ call }));

const inspectedReload = vi.fn();

function stubPanelFrame(tabId: number | undefined): void {
  vi.stubGlobal('chrome', { ...chromeMock, devtools: { inspectedWindow: { tabId, reload: inspectedReload } } });
}

function setPanelSearch(search: string): void {
  window.history.replaceState(null, '', `/panel.html${search}`);
}

describe('reloadInspectedTab', () => {
  afterEach(() => {
    vi.stubGlobal('chrome', chromeMock);
    setPanelSearch('');
    inspectedReload.mockClear();
    call.mockClear();
  });

  it("uses the host's own reload where the panel frame is bound to its tab", () => {
    stubPanelFrame(42);
    setPanelSearch(`?${INSPECTED_TAB_PARAM}=7`);
    reloadInspectedTab();
    expect(inspectedReload).toHaveBeenCalledOnce();
    expect(call).not.toHaveBeenCalled();
  });

  it('asks the background to reload the named tab where the panel frame is unbound (the host answers -1)', () => {
    stubPanelFrame(-1);
    setPanelSearch(`?${INSPECTED_TAB_PARAM}=8531`);
    reloadInspectedTab();
    expect(call).toHaveBeenCalledExactlyOnceWith('reloadTab', { tabId: 8531 });
    expect(inspectedReload).not.toHaveBeenCalled();
  });

  it('does nothing in an unbound frame that names no tab', () => {
    stubPanelFrame(-1);
    reloadInspectedTab();
    expect(call).not.toHaveBeenCalled();
    expect(inspectedReload).not.toHaveBeenCalled();
  });

  it('does nothing outside a DevTools context', () => {
    reloadInspectedTab();
    expect(call).not.toHaveBeenCalled();
  });
});
