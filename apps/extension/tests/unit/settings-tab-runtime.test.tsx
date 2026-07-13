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
  allowHttp2?: boolean;
  resolveToAddress?: string;
  clientCertificateRef?: string;
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

  it('keeps the redirect trio as browser-managed facts, not knobs', () => {
    renderTab();
    expect(screen.queryByRole('spinbutton', { name: 'Maximum redirects' })).toBeNull();
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

  it('keeps HTTP version a browser-managed fact and never dots a synced allowHttp2', () => {
    renderTab();
    expect(screen.queryByRole('switch', { name: 'Allow HTTP/2' })).toBeNull();
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.getByText('HTTP version')).toBeTruthy();
    expect(settingsDotCount({ allowHttp2: true })).toBe(0);
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
    renderTab({ proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' });
    expect(screen.queryByRole('textbox', { name: 'Proxy' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Proxy credentials' })).toBeNull();
    // Not a sheet-listed fact — the browser sheet stays at 10 rows.
    fireEvent.click(screen.getByText('10 browser-managed'));
    expect(screen.queryByText('Proxy')).toBeNull();
    expect(settingsDotCount({ proxyUrl: 'http://proxy.openheaders.io:3128' })).toBe(0);
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

    fireEvent.click(screen.getByText('3 runtime-managed'));
    expect(screen.getByText(/Fixed by the app’s network runtime for every request/)).toBeTruthy();
    // The 'Cookies · Not sent' fact row graduated into the cookie-jar
    // knob — only the Referer fact still reads 'Not sent'.
    expect(screen.queryByText('Cookies')).toBeNull();
    expect(screen.getByText('Referer header')).toBeTruthy();
    expect(screen.getAllByText('Not sent')).toHaveLength(1);
  });

  it('graduates the cookie fact into a live cookie-jar knob, defaulting to Disabled', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const knob = screen.getByRole('switch', { name: 'Use cookie jar' });
    expect(knob.getAttribute('aria-checked')).toBe('false');
    // Graduated out of the fact sheet — the label exists exactly once.
    fireEvent.click(screen.getByText('3 runtime-managed'));
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
    fireEvent.click(screen.getByText('3 runtime-managed'));
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

  it('graduates the redirect trio to live knobs, defaulting to runtime behavior', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const cap = screen.getByRole('spinbutton', { name: 'Maximum redirects' }) as HTMLInputElement;
    expect(cap.value).toBe('');
    expect(cap.placeholder).toBe('20');
    const method = screen.getByRole('switch', { name: 'Follow original HTTP method' });
    const auth = screen.getByRole('switch', { name: 'Follow Authorization header' });
    expect(method.getAttribute('aria-checked')).toBe('false');
    expect(auth.getAttribute('aria-checked')).toBe('false');
    // Graduated out of the fact sheet — each label exists exactly once.
    fireEvent.click(screen.getByText('3 runtime-managed'));
    expect(screen.getAllByText('Maximum redirects')).toHaveLength(1);
    expect(screen.getAllByText('Follow original HTTP method')).toHaveLength(1);
    expect(screen.getAllByText('Follow Authorization header')).toHaveLength(1);
  });

  it('hides the trio while automatic redirect following is off', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ followRedirects: false });
    expect(screen.queryByRole('spinbutton', { name: 'Maximum redirects' })).toBeNull();
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
    const cap = screen.getByRole('spinbutton', { name: 'Maximum redirects' }) as HTMLInputElement;
    expect(cap.value).toBe('5');
    fireEvent.change(cap, { target: { value: '' } });
    fireEvent.blur(cap);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxRedirects: undefined }));
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
    fireEvent.click(screen.getByText('3 runtime-managed'));
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

  it('graduates Allow HTTP/2 to a live knob, defaulting to Disabled', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const knob = screen.getByRole('switch', { name: 'Allow HTTP/2' });
    expect(knob.getAttribute('aria-checked')).toBe('false');
    // Graduated out of the fact sheet — no HTTP version fact row remains.
    fireEvent.click(screen.getByText('3 runtime-managed'));
    expect(screen.queryByText('HTTP version')).toBeNull();
  });

  it('reports allowHttp2 true when switched on and clears to undefined when switched off', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(<SettingsTab value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Allow HTTP/2' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ allowHttp2: true }));

    cleanup();
    const onChangeOff = vi.fn();
    render(<SettingsTab value={{ allowHttp2: true }} onChange={onChangeOff} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Allow HTTP/2' }));
    expect(onChangeOff).toHaveBeenCalledWith(expect.objectContaining({ allowHttp2: undefined }));
  });

  it('dots the tab only while Allow HTTP/2 is on', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ allowHttp2: true })).toBe(1);
    expect(settingsDotCount({ allowHttp2: false })).toBe(0);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows the resolve-to-address knob without touching the fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    const pin = screen.getByRole('textbox', { name: 'Resolve to address' }) as HTMLInputElement;
    expect(pin.value).toBe('');
    expect(pin.placeholder).toBe('System DNS');
    // Nothing graduates — resolution was never a sheet-listed fact, so
    // the node sheet stays at 3 rows and the label exists exactly once.
    fireEvent.click(screen.getByText('3 runtime-managed'));
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
    // stays at 3 rows and the label exists exactly once.
    fireEvent.click(screen.getByText('3 runtime-managed'));
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

  it('shows the proxy URL field without touching the fact sheet; credentials row hides while empty', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByRole('textbox', { name: 'Proxy' })).toBeTruthy();
    expect(screen.getByPlaceholderText('No proxy — direct connection')).toBeTruthy();
    // No proxy URL set — nothing to authenticate against, no row.
    expect(screen.queryByRole('combobox', { name: 'Proxy credentials' })).toBeNull();
    // Not trust-relaxing, not a sheet-listed fact — the node sheet
    // stays at 3 rows and the label exists exactly once.
    fireEvent.click(screen.getByText('3 runtime-managed'));
    expect(screen.getAllByText('Proxy')).toHaveLength(1);
  });

  it('flags a malformed, userinfo-bearing, or SOCKS proxy URL in place', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyUrl: 'socks5://127.0.0.1:1080' });
    expect(screen.getByText(/no credentials in the URL, no SOCKS/)).toBeTruthy();

    cleanup();
    renderTab({ proxyUrl: 'http://user:pass@proxy.openheaders.io' });
    expect(screen.getByText(/no credentials in the URL, no SOCKS/)).toBeTruthy();

    cleanup();
    renderTab({ proxyUrl: 'http://proxy.openheaders.io:3128' });
    expect(screen.queryByText(/no credentials in the URL, no SOCKS/)).toBeNull();
  });

  it('warns in place while both a proxy and a resolve-to-address pin are set', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab({ proxyUrl: 'http://proxy.openheaders.io:3128', resolveToAddress: '10.0.0.7' });
    expect(screen.getByText(/a proxy resolves the hostname itself/)).toBeTruthy();

    cleanup();
    renderTab({ proxyUrl: 'http://proxy.openheaders.io:3128' });
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
        <SettingsTab value={{ proxyUrl: 'http://proxy.openheaders.io:3128' }} onChange={onChange} />
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
    renderTab({ proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' });
    expect(screen.getByText(/No vault string entry named "corp-proxy" on this device/)).toBeTruthy();
  });

  it('clearing the proxy URL also clears its credential ref', () => {
    registerCapability('requestRuntime', () => 'node');
    const onChange = vi.fn();
    render(
      <SettingsTab
        value={{ proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Proxy' }), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ proxyUrl: undefined, proxyCredentialRef: undefined }),
    );
  });

  it('dots the tab while a proxy URL is set; a bare synced credential ref never dots', () => {
    registerCapability('requestRuntime', () => 'node');
    expect(settingsDotCount({ proxyUrl: 'http://proxy.openheaders.io:3128' })).toBe(1);
    // The credentials row hides while no URL is set — no control, no dot.
    expect(settingsDotCount({ proxyCredentialRef: 'corp-proxy' })).toBe(0);
    expect(settingsDotCount()).toBe(0);
  });

  it('shows the Unix-socket field without touching the fact sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab();
    expect(screen.getByRole('textbox', { name: 'Unix socket' })).toBeTruthy();
    expect(screen.getByPlaceholderText('No socket — TCP connection')).toBeTruthy();
    // Not trust-relaxing, not a sheet-listed fact — the node sheet
    // stays at 3 rows and the label exists exactly once.
    fireEvent.click(screen.getByText('3 runtime-managed'));
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
    renderTab({ unixSocketPath: '/var/run/docker.sock', proxyUrl: 'http://proxy.openheaders.io:3128' });
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
