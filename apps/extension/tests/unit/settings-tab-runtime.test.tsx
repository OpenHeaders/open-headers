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
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { VaultContext, type VaultContextValue } from '@openheaders/ui/context';
import { emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import { buildRequestTabItems } from '@openheaders/ui/workbench/components/request-editor/request-tab-items';
import SettingsTab from '@openheaders/ui/workbench/components/request-editor/SettingsTab';
import type { SectionUnresolved } from '@openheaders/ui/workbench/components/request-editor/useSectionUnresolved';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The antd Select dropdown measures itself via rc-resize-observer;
// jsdom doesn't ship a ResizeObserver.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

const NONE: SectionUnresolved = { url: false, params: false, headers: false, auth: false, body: false };

const t = getTranslator(DEFAULT_LOCALE);

interface KnobValues {
  credentialsMode?: 'omit' | 'include';
  followRedirects?: boolean;
  sslVerification?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  followOriginalHttpMethod?: boolean;
  followAuthorizationHeader?: boolean;
  tlsMinVersion?: '1.0' | '1.1' | '1.2' | '1.3';
  tlsMaxVersion?: '1.0' | '1.1' | '1.2' | '1.3';
  tlsCipherSuites?: string;
  httpVersion?: 'auto' | '1.1' | '2' | '2-prior-knowledge' | '3';
  resolveToAddress?: string;
  clientCertificateRef?: string;
  proxyMode?: 'direct' | 'url';
  proxyUrl?: string;
  proxyCredentialRef?: string;
  unixSocketPath?: string;
  cookieJar?: boolean;
}

function renderTab(value: KnobValues = {}) {
  return render(<SettingsTab value={value} onChange={() => {}} />);
}

/** Open an AntD Select dropdown; subsequent queries find the rendered items. */
function openCombobox(combobox: HTMLElement): void {
  fireEvent.mouseDown(combobox);
  fireEvent.click(combobox);
}

/** The dropdown item for `label` in the currently open Select. AntD
 *  renders items outside the RTL container, so query the document. */
function dropdownOption(label: string): HTMLElement {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
  const hit = items.find((el) => el.getAttribute('title') === label);
  if (!hit) throw new Error(`no open dropdown option "${label}"`);
  return hit;
}

/** Render the Settings tab label and count default-tone dots on it. */
function settingsDotCount(knobs: KnobValues = {}): number {
  const draft = { ...emptyDraft(), ...knobs };
  const item = buildRequestTabItems(draft, NONE, t).find((i) => i.key === 'settings');
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
    expect(screen.getByRole('combobox', { name: 'Request timeout' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Response size limit' })).toBeNull();
  });

  it('dots the tab for a set timeout, never for a synced size cap', () => {
    expect(settingsDotCount({ timeoutMs: 15000 })).toBe(1);
    expect(settingsDotCount({ maxResponseBytes: 4096 })).toBe(0);
  });

  it('shows a set timeout as a human label and clears to undefined when emptied', () => {
    const onChange = vi.fn();
    render(<SettingsTab value={{ timeoutMs: 15000 }} onChange={onChange} />);
    const knob = screen.getByRole('combobox', { name: 'Request timeout' }) as HTMLInputElement;
    expect(knob.value).toBe('15 s');
    fireEvent.change(knob, { target: { value: '' } });
    fireEvent.blur(knob);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));
  });

  it('interprets free timeout text into a committed ms value on blur', () => {
    const onChange = vi.fn();
    render(<SettingsTab value={{}} onChange={onChange} />);
    const knob = screen.getByRole('combobox', { name: 'Request timeout' }) as HTMLInputElement;
    fireEvent.change(knob, { target: { value: '5s' } });
    fireEvent.blur(knob);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('reverts ambiguous timeout text instead of guessing', () => {
    const onChange = vi.fn();
    render(<SettingsTab value={{}} onChange={onChange} />);
    const knob = screen.getByRole('combobox', { name: 'Request timeout' }) as HTMLInputElement;
    // "5" reads as 5 s or 5 min (5 ms is below the schema floor) —
    // two candidates, so blur must not commit either.
    fireEvent.change(knob, { target: { value: '5' } });
    fireEvent.blur(knob);
    expect(onChange).not.toHaveBeenCalled();
    expect(knob.value).toBe('');
  });

  it('keeps the redirect trio as browser-managed facts, not knobs', () => {
    renderTab();
    expect(screen.queryByRole('combobox', { name: 'Maximum redirects' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Follow original HTTP method' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Follow Authorization header' })).toBeNull();
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.getByText('Maximum redirects')).toBeTruthy();
    expect(screen.getByText('Follow original HTTP method')).toBeTruthy();
    expect(screen.getByText('Follow Authorization header')).toBeTruthy();
  });

  it('does not dot the Settings tab for a synced redirect trio', () => {
    expect(settingsDotCount({ maxRedirects: 5 })).toBe(0);
    expect(settingsDotCount({ followOriginalHttpMethod: true })).toBe(0);
    expect(settingsDotCount({ followAuthorizationHeader: true })).toBe(0);
  });

  it('keeps the TLS version window + cipher suites browser-managed facts, not knobs', () => {
    renderTab();
    expect(screen.queryByRole('combobox', { name: 'TLS version minimum' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'TLS version maximum' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'TLS cipher suites' })).toBeNull();
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.getByText('TLS/SSL protocol versions')).toBeTruthy();
    expect(screen.getByText('Server cipher suite order')).toBeTruthy();
  });

  it('does not dot the Settings tab for synced TLS fields', () => {
    expect(settingsDotCount({ tlsMinVersion: '1.0' })).toBe(0);
    expect(settingsDotCount({ tlsMaxVersion: '1.2' })).toBe(0);
    expect(settingsDotCount({ tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' })).toBe(0);
  });

  it('keeps HTTP version a browser-managed fact and never dots a synced httpVersion', () => {
    renderTab();
    expect(screen.queryByRole('combobox', { name: 'HTTP version' })).toBeNull();
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.getByText('HTTP version')).toBeTruthy();
    expect(settingsDotCount({ httpVersion: '2' })).toBe(0);
  });

  it('shows no resolve-to-address control or fact row and never dots a synced value', () => {
    renderTab();
    expect(screen.queryByRole('textbox', { name: 'Resolve to address' })).toBeNull();
    // Resolution was never a sheet-listed fact — the sheet stays at 10
    // rows with no DNS/resolution row.
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.queryByText('Resolve to address')).toBeNull();
    expect(settingsDotCount({ resolveToAddress: '10.0.0.7' })).toBe(0);
  });

  it('shows no client-certificate control or fact row and never dots a synced ref', () => {
    renderTab();
    expect(screen.queryByRole('combobox', { name: 'Client certificate' })).toBeNull();
    // Not a sheet-listed fact — the browser sheet stays at 10 rows.
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.queryByText('Client certificate')).toBeNull();
    expect(settingsDotCount({ clientCertificateRef: 'gateway-mtls' })).toBe(0);
  });

  it('shows no proxy controls or fact row and never dots a synced proxy', () => {
    renderTab({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' });
    expect(screen.queryByRole('combobox', { name: 'Proxy' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Proxy URL' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Proxy credentials' })).toBeNull();
    // Not a sheet-listed fact — the browser sheet stays at 10 rows.
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.queryByText('Proxy')).toBeNull();
    expect(settingsDotCount({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128' })).toBe(0);
  });

  it('shows no Unix-socket control or fact row and never dots a synced path', () => {
    renderTab({ unixSocketPath: '/var/run/openheaders/api.sock' });
    expect(screen.queryByRole('textbox', { name: 'Unix socket' })).toBeNull();
    // Not a sheet-listed fact — the browser sheet stays at 10 rows.
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.queryByText('Unix socket')).toBeNull();
    expect(settingsDotCount({ unixSocketPath: '/var/run/openheaders/api.sock' })).toBe(0);
  });

  it('shows no cookie-jar control and never dots a synced cookieJar', () => {
    renderTab({ cookieJar: true });
    // The browser rides its own jar via 'Send browser cookies' — the
    // app-jar knob is node-only.
    expect(screen.queryByRole('switch', { name: 'Use cookie jar' })).toBeNull();
    expect(settingsDotCount({ cookieJar: true })).toBe(0);
  });
});

describe('SettingsTab on a node runtime', () => {
  it('hides the browser cookies knob and shows the node fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByText('Automatically follow redirects')).toBeTruthy();
    expect(screen.queryByText('Send browser cookies')).toBeNull();

    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getByText(/Fixed by the app’s network runtime for every request/)).toBeTruthy();
    // The 'Cookies · Not sent' fact row graduated into the cookie-jar
    // knob — only the Referer fact still reads 'Not sent', and the one
    // 'Cookies' text on the tab is the settings-group divider label.
    // Without a script runtime on either side (this surface's browser
    // host), the sheet's fourth row is the honest scripts posture.
    expect(screen.getAllByText('Cookies')).toHaveLength(1);
    expect(screen.getByText('Referer header')).toBeTruthy();
    expect(screen.getAllByText('Not sent')).toHaveLength(1);
    expect(screen.getByText('Don’t run here')).toBeTruthy();
  });

  it('graduates the cookie fact into a live cookie-jar knob, defaulting to Disabled', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const knob = screen.getByRole('switch', { name: 'Use cookie jar' });
    expect(knob.getAttribute('aria-checked')).toBe('false');
    // Graduated out of the fact sheet — the label exists exactly once.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('Use cookie jar')).toHaveLength(1);
  });

  it('reports cookieJar true when switched on and clears to undefined when switched off', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Use cookie jar' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cookieJar: true }));

    cleanup();
    const onChangeOff = vi.fn();
    render(<SettingsTab value={{ cookieJar: true }} onChange={onChangeOff} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Use cookie jar' }));
    expect(onChangeOff).toHaveBeenCalledWith(expect.objectContaining({ cookieJar: undefined }));
  });

  it('dots the tab only while the cookie jar is on', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ cookieJar: true })).toBe(1);
    expect(settingsDotCount({ cookieJar: false })).toBe(0);
    expect(settingsDotCount()).toBe(0);
  });

  it('graduates SSL verification to a live knob, defaulting to Enabled', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const knob = screen.getByRole('switch', { name: 'SSL certificate verification' });
    expect(knob.getAttribute('aria-checked')).toBe('true');
    // Graduated out of the fact sheet — the row lives above the reveal.
    fireEvent.click(screen.getByText('4 runtime-managed'));
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

  it('shows both numeric knobs, displaying the size cap as a unit label', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ maxResponseBytes: 4096 }} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Request timeout' })).toBeTruthy();
    const cap = screen.getByRole('combobox', { name: 'Response size limit' }) as HTMLInputElement;
    expect(cap.value).toBe('4 KB');
    fireEvent.change(cap, { target: { value: '8 KB' } });
    fireEvent.blur(cap);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxResponseBytes: 8192 }));
  });

  it('dots the tab for either numeric knob', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ timeoutMs: 15000 })).toBe(1);
    expect(settingsDotCount({ maxResponseBytes: 4096 })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });

  it('graduates the redirect trio to live knobs, defaulting to runtime behavior', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const cap = screen.getByRole('combobox', { name: 'Maximum redirects' }) as HTMLInputElement;
    expect(cap.value).toBe('');
    // rc-select renders the placeholder as a sibling span, not an
    // input attribute.
    expect(screen.getByText('20 hops (default)')).toBeTruthy();
    const method = screen.getByRole('switch', { name: 'Follow original HTTP method' });
    const auth = screen.getByRole('switch', { name: 'Follow Authorization header' });
    expect(method.getAttribute('aria-checked')).toBe('false');
    expect(auth.getAttribute('aria-checked')).toBe('false');
    // Graduated out of the fact sheet — each label exists exactly once.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('Maximum redirects')).toHaveLength(1);
    expect(screen.getAllByText('Follow original HTTP method')).toHaveLength(1);
    expect(screen.getAllByText('Follow Authorization header')).toHaveLength(1);
  });

  it('hides the trio while automatic redirect following is off', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ followRedirects: false });
    expect(screen.queryByRole('combobox', { name: 'Maximum redirects' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Follow original HTTP method' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Follow Authorization header' })).toBeNull();
  });

  it('warns while Follow Authorization header is on, not while off', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ followAuthorizationHeader: true });
    expect(screen.getByText(/Credentials travel to whatever host/)).toBeTruthy();

    cleanup();
    renderTab();
    expect(screen.queryByText(/Credentials travel to whatever host/)).toBeNull();
  });

  it('clears Maximum redirects to undefined when emptied', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ maxRedirects: 5 }} onChange={onChange} />);
    const cap = screen.getByRole('combobox', { name: 'Maximum redirects' }) as HTMLInputElement;
    expect(cap.value).toBe('5 hops');
    fireEvent.change(cap, { target: { value: '' } });
    fireEvent.blur(cap);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxRedirects: undefined }));
  });

  it('dots modified rows and arms Reset to default', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ timeoutMs: 15000 }} onChange={onChange} />);
    expect(screen.getAllByTestId('oh-setting-modified-dot')).toHaveLength(1);
    const reset = screen.getByRole('button', { name: 'Reset to default' }) as HTMLButtonElement;
    expect(reset.disabled).toBe(false);
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('disables Reset to default while every knob is at its default', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.queryAllByTestId('oh-setting-modified-dot')).toHaveLength(0);
    const reset = screen.getByRole('button', { name: 'Reset to default' }) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
  });

  it('dots the tab for each trio knob only while redirects are followed', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ maxRedirects: 5 })).toBe(1);
    expect(settingsDotCount({ followOriginalHttpMethod: true })).toBe(1);
    expect(settingsDotCount({ followAuthorizationHeader: true })).toBe(1);
    // Hidden rows must not dot: with follow-redirects off, only the
    // follow-redirects knob itself contributes.
    expect(settingsDotCount({ followRedirects: false, maxRedirects: 5 })).toBe(1);
    expect(settingsDotCount({ followRedirects: false })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });

  it('graduates the TLS version window + cipher list to live controls', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByRole('combobox', { name: 'TLS version minimum' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'TLS version maximum' })).toBeTruthy();
    const cipher = screen.getByRole('textbox', { name: 'TLS cipher suites' }) as HTMLInputElement;
    expect(cipher.value).toBe('');
    expect(cipher.placeholder).toBe('Runtime default suites');
    // Graduated out of the fact sheet — the cipher label exists exactly
    // once, and the protocol-versions fact row is gone entirely.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('TLS cipher suites')).toHaveLength(1);
    expect(screen.queryByText('TLS/SSL protocol versions')).toBeNull();
  });

  it('selecting a minimum below 1.2 reports it and warns in place', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{}} onChange={onChange} />);
    openCombobox(screen.getByRole('combobox', { name: 'TLS version minimum' }));
    fireEvent.click(dropdownOption('1.0'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tlsMinVersion: '1.0' }));

    cleanup();
    renderTab({ tlsMinVersion: '1.1' });
    expect(screen.getByText(/protocol versions with known weaknesses/)).toBeTruthy();

    cleanup();
    renderTab({ tlsMinVersion: '1.3' });
    expect(screen.queryByText(/protocol versions with known weaknesses/)).toBeNull();
  });

  it('disables minimum options above a pinned maximum', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ tlsMaxVersion: '1.2' });
    openCombobox(screen.getByRole('combobox', { name: 'TLS version minimum' }));
    const disabledOf = (label: string) => dropdownOption(label).classList.contains('ant-select-item-option-disabled');
    expect(disabledOf('1.3')).toBe(true);
    expect(disabledOf('1.1')).toBe(false);
  });

  it('reports the cipher list verbatim, clears to undefined, and flags a malformed one', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' }} onChange={onChange} />);
    const cipher = screen.getByRole('textbox', { name: 'TLS cipher suites' }) as HTMLInputElement;
    expect(cipher.value).toBe('TLS_AES_128_GCM_SHA256');
    fireEvent.change(cipher, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tlsCipherSuites: undefined }));
    expect(screen.queryByText(/no spaces/)).toBeNull();

    cleanup();
    renderTab({ tlsCipherSuites: 'AES128, AES256' });
    expect(screen.getByText(/no spaces/)).toBeTruthy();
  });

  it('dots the tab for each TLS field', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ tlsMinVersion: '1.0' })).toBe(1);
    expect(settingsDotCount({ tlsMaxVersion: '1.2' })).toBe(1);
    expect(settingsDotCount({ tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });

  it('graduates HTTP version to a live select knob, defaulting to Auto (empty)', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const knob = screen.getByRole('combobox', { name: 'HTTP version' });
    expect(knob).toBeTruthy();
    expect(screen.getByText('Auto — server picks')).toBeTruthy();
    // Graduated out of the fact sheet — no HTTP version fact row
    // remains (the knob's own label is the one occurrence).
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('HTTP version')).toHaveLength(1);
  });

  it('reports the picked version and clears back to undefined (Auto)', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{}} onChange={onChange} />);
    openCombobox(screen.getByRole('combobox', { name: 'HTTP version' }));
    fireEvent.click(dropdownOption('HTTP/2'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ httpVersion: '2' }));

    cleanup();
    const onChangeOff = vi.fn();
    const { container } = render(<SettingsTab value={{ httpVersion: '2' }} onChange={onChangeOff} />);
    const clear = container.querySelector('.ant-select-clear');
    if (!clear) throw new Error('no clear affordance on the HTTP version select');
    fireEvent.mouseDown(clear);
    fireEvent.click(clear);
    expect(onChangeOff).toHaveBeenCalledWith(expect.objectContaining({ httpVersion: undefined }));
  });

  it('offers the not-yet-honored versions too — the schema carries them forward', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    openCombobox(screen.getByRole('combobox', { name: 'HTTP version' }));
    expect(dropdownOption('HTTP/1.1')).toBeTruthy();
    expect(dropdownOption('HTTP/2')).toBeTruthy();
    expect(dropdownOption('HTTP/2 (prior knowledge)')).toBeTruthy();
    expect(dropdownOption('HTTP/3')).toBeTruthy();
  });

  it('dots the tab only while a non-Auto version is picked', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ httpVersion: '2' })).toBe(1);
    expect(settingsDotCount({ httpVersion: '1.1' })).toBe(1);
    expect(settingsDotCount({ httpVersion: 'auto' })).toBe(0);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows the resolve-to-address knob without touching the fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const pin = screen.getByRole('textbox', { name: 'Resolve to address' }) as HTMLInputElement;
    expect(pin.value).toBe('');
    expect(pin.placeholder).toBe('System DNS');
    // Nothing graduates — resolution was never a sheet-listed fact, so
    // the node sheet stays at 4 rows (incl. the scripts posture fact) and the label exists exactly once.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('Resolve to address')).toHaveLength(1);
  });

  it('reports the address verbatim, clears to undefined, and flags a malformed one', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ resolveToAddress: '10.0.0.7' }} onChange={onChange} />);
    const pin = screen.getByRole('textbox', { name: 'Resolve to address' }) as HTMLInputElement;
    expect(pin.value).toBe('10.0.0.7');
    fireEvent.change(pin, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ resolveToAddress: undefined }));
    expect(screen.queryByText(/IPv4 or IPv6 address only/)).toBeNull();

    cleanup();
    renderTab({ resolveToAddress: 'backend.openheaders.io' });
    expect(screen.getByText(/IPv4 or IPv6 address only/)).toBeTruthy();

    cleanup();
    renderTab({ resolveToAddress: '2001:db8::1' });
    expect(screen.queryByText(/IPv4 or IPv6 address only/)).toBeNull();
  });

  it('dots the tab only while an address is set', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ resolveToAddress: '10.0.0.7' })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows the client-certificate picker without touching the fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByRole('combobox', { name: 'Client certificate' })).toBeTruthy();
    expect(screen.getByText('No client certificate')).toBeTruthy();
    // Not trust-relaxing, not a sheet-listed fact — the node sheet
    // stays at 4 rows (incl. the scripts posture fact) and the label exists exactly once.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('Client certificate')).toHaveLength(1);
  });

  it('offers the vault client-certificate entries as picker options', () => {
    registerCapability('requestRuntime', () => 'node');
    const vault: VaultContextValue = {
      vault: {
        schemaVersion: 5,
        secrets: [
          { uid: 'stri0001', kind: 'string', name: 'api-token', value: 't' },
          { uid: 'cert0001', kind: 'client-certificate', name: 'gateway-mtls', cert: 'CERT', key: 'KEY' },
        ],
      },
      isReady: true,
      isLocked: false,
      setVaultSecret: () => Promise.resolve({ ok: true }),
      removeVaultSecret: () => Promise.resolve({ ok: true }),
      replaceVault: () => Promise.resolve({ ok: true }),
    };
    const onChange = vi.fn();
    render(
      <VaultContext.Provider value={vault}>
        <SettingsTab value={{}} onChange={onChange} />
      </VaultContext.Provider>,
    );
    openCombobox(screen.getByRole('combobox', { name: 'Client certificate' }));
    // Only certificate-kind entries are options — string entries never appear.
    expect(dropdownOption('gateway-mtls')).toBeTruthy();
    expect(document.querySelectorAll('.ant-select-item-option')).toHaveLength(1);
    fireEvent.click(dropdownOption('gateway-mtls'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clientCertificateRef: 'gateway-mtls' }));
  });

  it('warns in place when the ref names no vault entry on this device', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ clientCertificateRef: 'gateway-mtls' });
    expect(screen.getByText(/No vault certificate entry named "gateway-mtls" on this device/)).toBeTruthy();
  });

  it('dots the tab only while a certificate ref is set', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ clientCertificateRef: 'gateway-mtls' })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows the tri-state proxy select; the URL and credentials rows hide while the mode is not Custom', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    // Inherit is the default — the cleared select states it as live behavior.
    expect(screen.getByRole('combobox', { name: 'Proxy' })).toBeTruthy();
    expect(screen.getByText('Inherit — environment decides')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Proxy URL' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Proxy credentials' })).toBeNull();
    // Not trust-relaxing, not a sheet-listed fact — the node sheet
    // stays at 4 rows (incl. the scripts posture fact) and the label exists exactly once.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('Proxy')).toHaveLength(1);
  });

  it('writes the MODE+URL pair: Direct clears the URL and its credentials; Custom keeps the URL', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(
      <SettingsTab
        value={{ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' }}
        onChange={onChange}
      />,
    );
    openCombobox(screen.getByRole('combobox', { name: 'Proxy' }));
    fireEvent.click(dropdownOption('Direct — no proxy'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ proxyMode: 'direct', proxyUrl: undefined, proxyCredentialRef: undefined }),
    );
  });

  it('Custom URL mode with no URL yet flags the missing URL in place', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyMode: 'url' });
    expect(screen.getByRole('textbox', { name: 'Proxy URL' })).toBeTruthy();
    expect(screen.getByText(/Custom URL mode needs a proxy URL/)).toBeTruthy();
  });

  it('flags a malformed, userinfo-bearing, or SOCKS proxy URL in place', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyMode: 'url', proxyUrl: 'socks5://127.0.0.1:1080' });
    expect(screen.getByText(/no credentials in the URL, no SOCKS/)).toBeTruthy();

    cleanup();
    renderTab({ proxyMode: 'url', proxyUrl: 'http://user:pass@proxy.openheaders.io' });
    expect(screen.getByText(/no credentials in the URL, no SOCKS/)).toBeTruthy();

    cleanup();
    renderTab({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128' });
    expect(screen.queryByText(/no credentials in the URL, no SOCKS/)).toBeNull();
  });

  it('warns in place while both a proxy and a resolve-to-address pin are set', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128', resolveToAddress: '10.0.0.7' });
    expect(screen.getByText(/a proxy resolves the hostname itself/)).toBeTruthy();

    cleanup();
    renderTab({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128' });
    expect(screen.queryByText(/a proxy resolves the hostname itself/)).toBeNull();
  });

  it('offers the vault string entries as credential options once a proxy URL is set', () => {
    registerCapability('requestRuntime', () => 'node');
    const vault: VaultContextValue = {
      vault: {
        schemaVersion: 5,
        secrets: [
          { uid: 'stri0001', kind: 'string', name: 'corp-proxy', value: 'user:secret' },
          { uid: 'cert0001', kind: 'client-certificate', name: 'gateway-mtls', cert: 'CERT', key: 'KEY' },
        ],
      },
      isReady: true,
      isLocked: false,
      setVaultSecret: () => Promise.resolve({ ok: true }),
      removeVaultSecret: () => Promise.resolve({ ok: true }),
      replaceVault: () => Promise.resolve({ ok: true }),
    };
    const onChange = vi.fn();
    render(
      <VaultContext.Provider value={vault}>
        <SettingsTab value={{ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128' }} onChange={onChange} />
      </VaultContext.Provider>,
    );
    openCombobox(screen.getByRole('combobox', { name: 'Proxy credentials' }));
    // Only string-kind entries are options — certificate entries never appear.
    expect(dropdownOption('corp-proxy')).toBeTruthy();
    expect(document.querySelectorAll('.ant-select-item-option')).toHaveLength(1);
    fireEvent.click(dropdownOption('corp-proxy'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ proxyCredentialRef: 'corp-proxy' }));
  });

  it('warns in place when the credential ref names no vault entry on this device', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' });
    expect(screen.getByText(/No vault string entry named "corp-proxy" on this device/)).toBeTruthy();
  });

  it('clearing the proxy URL also clears its credential ref', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(
      <SettingsTab
        value={{ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Proxy URL' }), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ proxyUrl: undefined, proxyCredentialRef: undefined }),
    );
  });

  it('dots the tab on any explicit proxy mode; a bare synced credential ref never dots', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128' })).toBe(1);
    // Direct is off the Inherit default and dots too.
    expect(settingsDotCount({ proxyMode: 'direct' })).toBe(1);
    // The credentials row hides while the mode isn't Custom — no control, no dot.
    expect(settingsDotCount({ proxyCredentialRef: 'corp-proxy' })).toBe(0);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows the Unix-socket field without touching the fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByRole('textbox', { name: 'Unix socket' })).toBeTruthy();
    expect(screen.getByPlaceholderText('No socket — TCP connection')).toBeTruthy();
    // Not trust-relaxing, not a sheet-listed fact — the node sheet
    // stays at 4 rows (incl. the scripts posture fact) and the label exists exactly once.
    fireEvent.click(screen.getByText('4 runtime-managed'));
    expect(screen.getAllByText('Unix socket')).toHaveLength(1);
  });

  it('flags a malformed socket path in place', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ unixSocketPath: 'var/run/docker.sock' });
    expect(screen.getByText(/Absolute Unix socket path/)).toBeTruthy();

    cleanup();
    renderTab({ unixSocketPath: '/var/run/docker.sock' });
    expect(screen.queryByText(/Absolute Unix socket path/)).toBeNull();

    cleanup();
    renderTab({ unixSocketPath: '\\\\.\\pipe\\openheaders' });
    expect(screen.queryByText(/Absolute Unix socket path/)).toBeNull();
  });

  it('warns in place while the socket is combined with a proxy or an address pin', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({
      unixSocketPath: '/var/run/docker.sock',
      proxyMode: 'url',
      proxyUrl: 'http://proxy.openheaders.io:3128',
    });
    expect(screen.getByText(/a proxy tunnel can’t dial a local socket/)).toBeTruthy();

    cleanup();
    renderTab({ unixSocketPath: '/var/run/docker.sock', resolveToAddress: '10.0.0.7' });
    expect(screen.getByText(/a socket dial resolves no hostname/)).toBeTruthy();

    cleanup();
    renderTab({ unixSocketPath: '/var/run/docker.sock' });
    expect(screen.queryByText(/a proxy tunnel can’t dial a local socket/)).toBeNull();
    expect(screen.queryByText(/a socket dial resolves no hostname/)).toBeNull();
  });

  it('reports the socket path verbatim and clears to undefined when emptied', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ unixSocketPath: '/var/run/docker.sock' }} onChange={onChange} />);
    const knob = screen.getByRole('textbox', { name: 'Unix socket' }) as HTMLInputElement;
    expect(knob.value).toBe('/var/run/docker.sock');
    fireEvent.change(knob, { target: { value: '/tmp/other.sock' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ unixSocketPath: '/tmp/other.sock' }));
    fireEvent.change(knob, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ unixSocketPath: undefined }));
  });

  it('dots the tab while a socket path is set', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ unixSocketPath: '/var/run/openheaders/api.sock' })).toBe(1);
    expect(settingsDotCount()).toBe(0);
  });
});

describe('SettingsTab row chrome and group folds', () => {
  it('offers a per-row undo on a modified row and resets only that knob', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ timeoutMs: 15000, maxRedirects: 5 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Request timeout to default' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined, maxRedirects: 5 }));
  });

  it('shows no per-row undo while a row sits at its default', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.queryByRole('button', { name: 'Reset Request timeout to default' })).toBeNull();
    // The footer's full reset is unaffected by the per-row affordance.
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeTruthy();
  });

  it('resets a switch row to undefined, not merely back on', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{ sslVerification: false }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset SSL certificate verification to default' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sslVerification: undefined }));
  });

  it('resetting the proxy row returns all three fields to Inherit', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(
      <SettingsTab
        value={{ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Proxy to default' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ proxyMode: undefined, proxyUrl: undefined, proxyCredentialRef: undefined }),
    );
  });

  it('toggles a group fold from the keyboard with Space and Enter', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const header = screen.getByRole('button', { name: 'TLS & trust' });
    expect(header.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(header, { key: ' ' });
    expect(screen.queryByRole('switch', { name: 'SSL certificate verification' })).toBeNull();
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.getByRole('switch', { name: 'SSL certificate verification' })).toBeTruthy();
  });

  it('remembers a fold across a remount for the session', () => {
    registerCapability('requestRuntime', () => 'node');
    const first = render(<SettingsTab value={{}} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Execution & limits' }));
    expect(screen.queryByRole('combobox', { name: 'Request timeout' })).toBeNull();
    first.unmount();

    render(<SettingsTab value={{}} onChange={() => {}} />);
    expect(screen.queryByRole('combobox', { name: 'Request timeout' })).toBeNull();
    // Unfold again so the session store ends the suite at the default.
    fireEvent.click(screen.getByRole('button', { name: 'Execution & limits' }));
    expect(screen.getByRole('combobox', { name: 'Request timeout' })).toBeTruthy();
  });
});

describe('SettingsTab info popovers', () => {
  /** Highlighted example-card tokens of the currently open popover. */
  const litTokens = (): string[] =>
    Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

  it('opens a structured row popover: kicker, example card with the slice lit, glossary', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About HTTP version' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Connection');
    expect(litTokens()).toEqual(['h2']);
    expect(screen.getByText('HTTP/3')).toBeTruthy();
    expect(screen.getByText('Dials the server directly over QUIC, with no fallback to TCP.')).toBeTruthy();
  });

  it('swaps the dial slot to the INHERITED environment leg on the proxy-mode popover', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Proxy' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(litTokens()).toEqual(['proxy corp.example:8080 (system)']);
  });

  it('swaps the dial slot to the request leg on the proxy-URL popover', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyMode: 'url' });
    fireEvent.click(screen.getByRole('button', { name: 'About Proxy URL' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(litTokens()).toEqual(['proxy 127.0.0.1:8080']);
  });

  it('lights the whole sub-slice on a group-header popover', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About TLS & trust' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(litTokens()).toEqual(['TLS 1.2–1.3', 'verify ✓', 'TLS_AES_128_GCM_SHA256', 'cert: acme-mtls']);
  });

  it('keeps Enter on a header (i) from toggling the fold', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    fireEvent.keyDown(screen.getByRole('button', { name: 'About TLS & trust' }), { key: 'Enter' });
    expect(screen.getByRole('switch', { name: 'SSL certificate verification' })).toBeTruthy();
  });

  it('leads a runtime-managed fact row with the same card when it has a slice', async () => {
    renderTab();
    fireEvent.click(screen.getByText('10 browser-managed'));
    fireEvent.click(screen.getByRole('button', { name: 'About HTTP version' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(litTokens()).toEqual(['h2']);
  });

  it('keeps the card, unlit, on a slice-less managed fact', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    fireEvent.click(screen.getByText('4 runtime-managed'));
    fireEvent.click(screen.getByRole('button', { name: 'About Referer header' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(litTokens()).toEqual([]);
  });

  it('gives the fact-sheet group headers the same group popover', async () => {
    renderTab();
    fireEvent.click(screen.getByText('10 browser-managed'));
    fireEvent.click(screen.getByRole('button', { name: 'About Connection' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(litTokens()).toEqual(['h2', 'direct']);
  });
});
