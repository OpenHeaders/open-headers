import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSPECTED_TAB_PARAM, inspectedTabId } from '@/host/inspected-tab-id';
import { chrome as chromeMock } from '../../__mocks__/chrome';

function stubDevtoolsTabId(tabId: number | undefined): void {
  vi.stubGlobal('chrome', { ...chromeMock, devtools: { inspectedWindow: { tabId } } });
}

function setPanelSearch(search: string): void {
  window.history.replaceState(null, '', `/panel.html${search}`);
}

describe('inspectedTabId', () => {
  afterEach(() => {
    vi.stubGlobal('chrome', chromeMock);
    setPanelSearch('');
  });

  it('is null when nothing names a tab', () => {
    expect(inspectedTabId()).toBeNull();
  });

  it("reads the host's own id inside a DevTools window", () => {
    stubDevtoolsTabId(42);
    expect(inspectedTabId()).toBe(42);
  });

  it("keeps the host's own id over the one on the URL", () => {
    stubDevtoolsTabId(42);
    setPanelSearch(`?${INSPECTED_TAB_PARAM}=7`);
    expect(inspectedTabId()).toBe(42);
  });

  it('takes the id on the URL when the host answers -1 in the panel frame', () => {
    stubDevtoolsTabId(-1);
    setPanelSearch(`?${INSPECTED_TAB_PARAM}=8531`);
    expect(inspectedTabId()).toBe(8531);
  });

  it('is null when the host answers -1 and the URL carries no id', () => {
    stubDevtoolsTabId(-1);
    expect(inspectedTabId()).toBeNull();
  });

  it('takes the id on the URL in a panel page loaded outside DevTools', () => {
    setPanelSearch(`?${INSPECTED_TAB_PARAM}=12`);
    expect(inspectedTabId()).toBe(12);
  });

  it.each(['-1', '1.5', 'abc'])('refuses %j on the URL', (raw) => {
    setPanelSearch(`?${INSPECTED_TAB_PARAM}=${raw}`);
    expect(inspectedTabId()).toBeNull();
  });
});
