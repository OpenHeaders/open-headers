/**
 * The host's Debug mode control under the "content is available only with
 * DevTools opened, or with Debug mode on" notice — shown by the Response
 * and Preview panes for a request recorded with its tab's DevTools closed,
 * and only for that reason.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import '@openheaders/ui/workbench/settings/schema/keyboard';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import BodyStateView from '@openheaders/ui/panel/components/detail/BodyStateView';
import PreviewPane from '@openheaders/ui/panel/components/detail/PreviewPane';
import { BodyCaptureControlContext } from '@openheaders/ui/panel/data/body-capture-control';
import type { BodyState } from '@openheaders/ui/panel/data/response-body-state';
import { OwnDebugModeSwitch } from '@openheaders/ui/shared/debug-mode';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  get as getSetting,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HINT = /available in Chrome and Edge/i;
const NOTICE = 'Content is available only with DevTools opened, or with Debug mode on.';
const FEED_CLOSED: BodyState = { kind: 'unavailable', reason: 'feed-closed' };
const CONTROL = <span data-testid="host-control">host control</span>;

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  unregisterCapability('cdpInspection');
  setCurrentHost('extension');
  __resetStoreForTests();
});

describe('the Response pane', () => {
  it('shows the short notice with the host’s control under it', () => {
    render(
      <BodyCaptureControlContext.Provider value={CONTROL}>
        <BodyStateView state={FEED_CLOSED} declaredMime="application/json" />
      </BodyCaptureControlContext.Provider>,
    );
    expect(screen.getByText('Response body not available')).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByTestId('host-control')).toBeTruthy();
  });

  it('shows the notice alone on a surface that offers no control', () => {
    render(<BodyStateView state={FEED_CLOSED} declaredMime="application/json" />);
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.queryByTestId('host-control')).toBeNull();
  });

  it.each(['host', 'cache', 'opaque', 'redirect', 'unknown'] as const)(
    'offers no control under the %s notice',
    (reason) => {
      render(
        <BodyCaptureControlContext.Provider value={CONTROL}>
          <BodyStateView state={{ kind: 'unavailable', reason }} declaredMime="application/json" />
        </BodyCaptureControlContext.Provider>,
      );
      expect(screen.queryByTestId('host-control')).toBeNull();
    },
  );

  it('offers no control while the response is still loading', () => {
    render(
      <BodyCaptureControlContext.Provider value={CONTROL}>
        <BodyStateView state={{ kind: 'loading' }} declaredMime="application/json" />
      </BodyCaptureControlContext.Provider>,
    );
    expect(screen.queryByTestId('host-control')).toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe('the Preview pane', () => {
  it('shows the same notice and control', () => {
    render(
      <BodyCaptureControlContext.Provider value={CONTROL}>
        <PreviewPane state={FEED_CLOSED} mime="application/json" size={0} />
      </BodyCaptureControlContext.Provider>,
    );
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByTestId('host-control')).toBeTruthy();
  });

  it('offers no control under another notice', () => {
    render(
      <BodyCaptureControlContext.Provider value={CONTROL}>
        <PreviewPane state={{ kind: 'unavailable', reason: 'host' }} mime="application/json" size={0} />
      </BodyCaptureControlContext.Provider>,
    );
    expect(screen.queryByTestId('host-control')).toBeNull();
  });
});

describe('OwnDebugModeSwitch — the in-browser panel’s control', () => {
  it('drives this browser’s own Debug mode', async () => {
    registerCapability('cdpInspection', () => true);
    render(<OwnDebugModeSwitch />);
    const toggle = screen.getByRole('switch') as HTMLButtonElement;
    await waitFor(() => expect(toggle.className).not.toContain('ant-switch-loading'));
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(getSetting('inspection.cdpEnabled')).toBe(true);
  });

  it('is disabled with the Chrome / Edge hint where the browser cannot drive its debugger', () => {
    const { container } = render(<OwnDebugModeSwitch />);
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[aria-disabled="true"]')?.getAttribute('aria-label')).toMatch(HINT);
  });

  it('renders nothing on a host that is not a browser', () => {
    setCurrentHost('desktop');
    const { container } = render(<OwnDebugModeSwitch />);
    expect(container.firstChild).toBeNull();
  });
});
