// @vitest-environment jsdom
/**
 * The node runtime's remedy under a verification failure: the error
 * state renders the TrustCertificateOffer for a `trust-certificate`
 * hint, which probes the endpoint, shows the presented leaf and the
 * code, pins the self-signed anchor on this device (then resends),
 * offers the workspace only for a CA anchor, says so when the server
 * presents no pinnable root, and lets a failed probe retry. Browser
 * hosts never see it (no probe, no gesture).
 */

import { type HostBridge, type PresentedCertificateWire, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { TrustCertificateErrorHint } from '@openheaders/core/types';
import ResponseErrorState from '@openheaders/ui/workbench/components/request-editor/response/ResponseErrorState';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAddRoot } = vi.hoisted(() => ({ mockAddRoot: vi.fn() }));

// The device-trust client runs for real over a fake host bridge — the
// probe and the pin are the two routes the offer drives.
const mockProbe = vi.fn();
const mockAddDevice = vi.fn();
const bridge: HostBridge = {
  call: ((type: string, payload?: unknown) => {
    if (type === 'oh.deviceTrust.probe') return Promise.resolve(mockProbe(payload));
    if (type === 'oh.deviceTrust.add') return Promise.resolve(mockAddDevice(payload));
    return Promise.reject(new Error(`unexpected `));
  }) as HostBridge['call'],
  broadcast: () => {},
  subscribe: () => () => {},
  presence: () => () => {},
};

vi.mock('@openheaders/ui/shared/hooks/mutators/useTrustedRootsMutator', () => ({
  useTrustedRootsMutator: () => ({ addRoot: mockAddRoot, removeRoot: vi.fn(), replaceRoots: vi.fn() }),
}));

const PEM = '-----BEGIN CERTIFICATE-----\nLEAF\n-----END CERTIFICATE-----\n';

function link(overrides: Partial<PresentedCertificateWire['summary']>, selfSigned: boolean): PresentedCertificateWire {
  return {
    pem: PEM,
    selfSigned,
    summary: {
      subject: 'CN=localhost',
      issuer: 'CN=localhost',
      fingerprintSha256: 'ab'.repeat(32),
      notBefore: '2026-01-01T00:00:00.000Z',
      notAfter: '2036-01-01T00:00:00.000Z',
      isCa: false,
      chainLength: 1,
      ...overrides,
    },
  };
}

const hint: TrustCertificateErrorHint = {
  kind: 'trust-certificate',
  certificate: true,
  host: '127.0.0.1',
  port: 3443,
  code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
  netError: 'DEPTH_ZERO_SELF_SIGNED_CERT',
};

beforeEach(() => {
  setHostBridge(bridge);
  registerCapability('requestRuntime', () => 'node');
  mockProbe.mockReset();
  mockAddDevice.mockReset();
  mockAddDevice.mockReturnValue({ ok: true, certificate: { uid: 'pin00001', name: 'localhost', certPem: PEM } });
  mockAddRoot.mockReset();
  mockAddRoot.mockResolvedValue({ ok: true, root: { uid: 'root0001', name: 'x', certPem: PEM } });
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

function renderError(onResend = vi.fn(), workspaceId: string | null = 'ws-1') {
  render(
    <App>
      <EditingScopeWorkspaceProvider workspaceId={workspaceId}>
        <ResponseErrorState error="TLS certificate error" hint={hint} layout="vertical" onResend={onResend} />
      </EditingScopeWorkspaceProvider>
    </App>,
  );
  return onResend;
}

describe('TrustCertificateOffer', () => {
  it('probes the failed endpoint, shows the presented leaf and pins the self-signed anchor on this device, then resends', async () => {
    mockProbe.mockReturnValue({ ok: true, chain: [link({}, true)] });
    const onResend = renderError();
    expect(screen.getByText('Trust the certificate 127.0.0.1:3443 presented')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('oh-trust-presented')).toBeTruthy());
    expect(mockProbe).toHaveBeenCalledWith({ host: '127.0.0.1', port: 3443 });
    expect(screen.getAllByText('CN=localhost')).toHaveLength(2);
    expect(screen.getByText('DEPTH_ZERO_SELF_SIGNED_CERT')).toBeTruthy();
    expect(screen.queryByTestId('oh-trust-add-workspace')).toBeNull();
    fireEvent.click(screen.getByTestId('oh-trust-on-device'));
    await waitFor(() => expect(mockAddDevice).toHaveBeenCalledTimes(1));
    expect(mockAddDevice.mock.calls[0]?.[0]).toEqual({ certPem: PEM, name: 'localhost', origin: '127.0.0.1:3443' });
    await waitFor(() => expect(onResend).toHaveBeenCalledTimes(1));
  });

  it('offers the workspace for a CA anchor and commits through the mutator', async () => {
    mockProbe.mockReturnValue({
      ok: true,
      chain: [
        link({ issuer: 'CN=Team Root' }, false),
        link({ subject: 'CN=Team Root', issuer: 'CN=Team Root', isCa: true }, true),
      ],
    });
    const onResend = renderError();
    await waitFor(() => expect(screen.getByTestId('oh-trust-add-workspace')).toBeTruthy());
    fireEvent.click(screen.getByTestId('oh-trust-add-workspace'));
    await waitFor(() => expect(mockAddRoot).toHaveBeenCalledWith({ certPem: PEM, name: 'Team Root' }));
    await waitFor(() => expect(onResend).toHaveBeenCalledTimes(1));
    expect(mockAddDevice).not.toHaveBeenCalled();
  });

  it('says so when the server presents no pinnable root and keeps the device gesture disabled', async () => {
    mockProbe.mockReturnValue({ ok: true, chain: [link({ issuer: 'CN=Missing Root' }, false)] });
    renderError();
    await waitFor(() => expect(screen.getByTestId('oh-trust-no-anchor')).toBeTruthy());
    expect(screen.getByTestId('oh-trust-on-device').hasAttribute('disabled')).toBe(true);
  });

  it('a failed probe reports and retries', async () => {
    mockProbe.mockReturnValueOnce({ ok: false, error: 'ECONNREFUSED' });
    mockProbe.mockReturnValueOnce({ ok: true, chain: [link({}, true)] });
    renderError();
    await waitFor(() => expect(screen.getByTestId('oh-trust-probe-failed')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('oh-trust-presented')).toBeTruthy());
    expect(mockProbe).toHaveBeenCalledTimes(2);
  });

  it('never probes on a browser host', () => {
    unregisterCapability('requestRuntime');
    registerCapability('requestRuntime', () => 'browser');
    renderError();
    expect(mockProbe).not.toHaveBeenCalled();
    expect(screen.queryByTestId('oh-trust-on-device')).toBeNull();
  });
});
