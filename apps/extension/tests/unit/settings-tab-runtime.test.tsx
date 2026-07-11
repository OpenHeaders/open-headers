// @vitest-environment jsdom
/**
 * SettingsTab per-runtime rendering. The tab keys its knob visibility
 * and its runtime-managed fact sheet off the `requestRuntime`
 * capability: browser surfaces (capability absent) keep the cookies
 * knob and the browser-managed sheet; node hosts (desktop renderer,
 * web surface on a daemon) hide the no-op cookies knob and show the
 * Node fact sheet instead. The Settings tab dot follows the same
 * visibility: a synced `credentialsMode` must not dot a tab that
 * shows no cookies control.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import { buildRequestTabItems } from '@openheaders/ui/workbench/components/request-editor/request-tab-items';
import SettingsTab from '@openheaders/ui/workbench/components/request-editor/SettingsTab';
import type { SectionUnresolved } from '@openheaders/ui/workbench/components/request-editor/useSectionUnresolved';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

const NONE: SectionUnresolved = { url: false, params: false, headers: false, auth: false, body: false };

function renderTab() {
  return render(<SettingsTab value={{}} onChange={() => {}} />);
}

/** Render the Settings tab label and count default-tone dots on it. */
function settingsDotCount(credentialsMode?: 'omit' | 'include'): number {
  const draft = { ...emptyDraft(), ...(credentialsMode ? { credentialsMode } : {}) };
  const item = buildRequestTabItems(draft, NONE).find((i) => i.key === 'settings');
  const { container } = render(<div>{item?.label}</div>);
  return container.querySelectorAll('span[style*="border-radius: 50%"]').length;
}

describe('SettingsTab on a browser runtime (capability absent)', () => {
  it('shows both wired knobs and the browser-managed sheet', () => {
    renderTab();
    expect(screen.getByText('Automatically follow redirects')).toBeTruthy();
    expect(screen.getByText('Send browser cookies')).toBeTruthy();

    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.getByText(/Fixed by the browser for every request sent from an extension/)).toBeTruthy();
    expect(screen.getByText('HTTP version')).toBeTruthy();
    expect(screen.getByText('Auto')).toBeTruthy();
  });

  it('dots the Settings tab when cookies are switched on', () => {
    expect(settingsDotCount('include')).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });
});

describe('SettingsTab on a node runtime', () => {
  it('hides the cookies knob and shows the node fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByText('Automatically follow redirects')).toBeTruthy();
    expect(screen.queryByText('Send browser cookies')).toBeNull();

    fireEvent.click(screen.getByText('11 runtime-managed'));
    expect(screen.getByText(/Fixed by the app’s network runtime for every request/)).toBeTruthy();
    expect(screen.getByText('1.1')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.getByText('Referer header')).toBeTruthy();
    expect(screen.getAllByText('Not sent')).toHaveLength(2);
  });

  it('does not dot the Settings tab for a synced credentialsMode', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount('include')).toBe(0);
  });
});
