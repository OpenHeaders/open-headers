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
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

const NONE: SectionUnresolved = { url: false, params: false, headers: false, auth: false, body: false };

interface KnobValues {
  credentialsMode?: 'omit' | 'include';
  sslVerification?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

function renderTab(value: KnobValues = {}) {
  return render(<SettingsTab value={value} onChange={() => {}} />);
}

/** Render the Settings tab label and count default-tone dots on it. */
function settingsDotCount(knobs: KnobValues = {}): number {
  const draft = { ...emptyDraft(), ...knobs };
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

  it('keeps SSL verification a browser-managed fact, not a knob', () => {
    renderTab();
    expect(screen.queryByText('SSL certificate verification')).toBeNull();
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.getByText('SSL certificate verification')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'SSL certificate verification' })).toBeNull();
  });

  it('dots the Settings tab when cookies are switched on', () => {
    expect(settingsDotCount({ credentialsMode: 'include' })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });

  it('does not dot the Settings tab for a synced sslVerification', () => {
    expect(settingsDotCount({ sslVerification: false })).toBe(0);
  });

  it('shows the timeout knob but no per-request size-cap knob', () => {
    renderTab();
    expect(screen.getByRole('spinbutton', { name: 'Request timeout' })).toBeTruthy();
    expect(screen.queryByRole('spinbutton', { name: 'Response size limit' })).toBeNull();
  });

  it('dots the tab for a set timeout, never for a synced size cap', () => {
    expect(settingsDotCount({ timeoutMs: 15000 })).toBe(1);
    expect(settingsDotCount({ maxResponseBytes: 4096 })).toBe(0);
  });

  it('reports the timeout in ms and clears to undefined when emptied', () => {
    const onChange = vi.fn();
    render(<SettingsTab value={{ timeoutMs: 15000 }} onChange={onChange} />);
    const knob = screen.getByRole('spinbutton', { name: 'Request timeout' }) as HTMLInputElement;
    expect(knob.value).toBe('15000');
    fireEvent.change(knob, { target: { value: '' } });
    fireEvent.blur(knob);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));
  });
});

describe('SettingsTab on a node runtime', () => {
  it('hides the cookies knob and shows the node fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByText('Automatically follow redirects')).toBeTruthy();
    expect(screen.queryByText('Send browser cookies')).toBeNull();

    fireEvent.click(screen.getByText('10 runtime-managed'));
    expect(screen.getByText(/Fixed by the app’s network runtime for every request/)).toBeTruthy();
    expect(screen.getByText('1.1')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.getByText('Referer header')).toBeTruthy();
    expect(screen.getAllByText('Not sent')).toHaveLength(2);
  });

  it('graduates SSL verification to a live knob, defaulting to Enabled', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const knob = screen.getByRole('switch', { name: 'SSL certificate verification' });
    expect(knob.getAttribute('aria-checked')).toBe('true');
    // Graduated out of the fact sheet — the row lives above the reveal.
    fireEvent.click(screen.getByText('10 runtime-managed'));
    expect(screen.getAllByText('SSL certificate verification')).toHaveLength(1);
  });

  it('shows the off-state warning and no warning while enabled', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ sslVerification: false });
    const knob = screen.getByRole('switch', { name: 'SSL certificate verification' });
    expect(knob.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/any certificate is accepted/)).toBeTruthy();

    cleanup();
    renderTab();
    expect(screen.queryByText(/any certificate is accepted/)).toBeNull();
  });

  it('does not dot the Settings tab for a synced credentialsMode', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ credentialsMode: 'include' })).toBe(0);
  });

  it('dots the Settings tab when verification is off', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ sslVerification: false })).toBe(1);
    expect(settingsDotCount({ sslVerification: true })).toBe(0);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows both numeric knobs, displaying the size cap in KB', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ maxResponseBytes: 4096 }} onChange={onChange} />);
    expect(screen.getByRole('spinbutton', { name: 'Request timeout' })).toBeTruthy();
    const cap = screen.getByRole('spinbutton', { name: 'Response size limit' }) as HTMLInputElement;
    expect(cap.value).toBe('4');
    fireEvent.change(cap, { target: { value: '8' } });
    fireEvent.blur(cap);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxResponseBytes: 8192 }));
  });

  it('dots the tab for either numeric knob', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ timeoutMs: 15000 })).toBe(1);
    expect(settingsDotCount({ maxResponseBytes: 4096 })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });
});
