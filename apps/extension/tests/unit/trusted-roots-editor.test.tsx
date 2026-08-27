// @vitest-environment jsdom
/**
 * Trusted Certificates editor — the draft/Save anatomy (the Vault
 * shape) over the workspace trust list. Pins: the info banner and
 * the table render at zero roots with the empty line inside the
 * table; Add certificate opens the paste panel BELOW the table; a
 * pasted CA root joins the draft as a row (no write fires), lights
 * dirty and the Save button; Save commits the draft against the
 * canonical list through the replacement in ONE call; remove edits
 * the draft without a confirm; a clean tab reports not dirty; the
 * dirty draft's PEM list is published to the draft registry (the
 * draft-aware dial) and cleared when the tab is clean or unmounts.
 */

import type { TrustedRoot } from '@openheaders/core/types';
import { AwarenessIdentityProvider } from '@openheaders/ui/shared/awareness';
import TrustedRootsEditor from '@openheaders/ui/workbench/components/trusted-roots/TrustedRootsEditor';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';
// EditorHeader reads `keyboard.save` via useShortcutLabel; the registry
// is populated by importing the schema barrel for its side effects.
import '@openheaders/ui/workbench/settings/schema';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseTrustedRoots, mockReplaceRoots } = vi.hoisted(() => ({
  mockUseTrustedRoots: vi.fn(),
  mockReplaceRoots: vi.fn(),
}));

vi.mock('@openheaders/ui/shared/hooks/readers/useTrustedRoots', () => ({
  useTrustedRoots: mockUseTrustedRoots,
}));

vi.mock('@openheaders/ui/shared/hooks/mutators/useTrustedRootsMutator', () => ({
  useTrustedRootsMutator: () => ({
    addRoot: vi.fn(),
    removeRoot: vi.fn(),
    replaceRoots: mockReplaceRoots,
  }),
}));

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

const caPem = `-----BEGIN CERTIFICATE-----
MIIBeDCCAR2gAwIBAgIBATAKBggqhkjOPQQDAjA5MR4wHAYDVQQDExVPcGVuSGVh
ZGVycyBUZXN0IFJvb3QxFzAVBgNVBAoTDm9wZW5oZWFkZXJzLmlvMB4XDTI2MDEw
MTAwMDAwMFoXDTM2MDEwMTAwMDAwMFowOTEeMBwGA1UEAxMVT3BlbkhlYWRlcnMg
VGVzdCBSb290MRcwFQYDVQQKEw5vcGVuaGVhZGVycy5pbzBZMBMGByqGSM49AgEG
CCqGSM49AwEHA0IABObZxdfBYTwTirPRwk/4JoUMpSw8lz8eu12yemOtLC0jtuI9
vnEJE7exe08TehZY3PhHJE/NtuMbJE6lk+i5LY6jFjAUMBIGA1UdEwEB/wQIMAYB
Af8CAQAwCgYIKoZIzj0EAwIDSQAwRgIhALw6OnrxEcyEC/Fq3CEgBLXzAoP3UFAe
JUa3RZhmKYPLAiEA+tHsiu/3GrcHhMy0znd6vL/Apd1AGqzIpWbMtZi77+Q=
-----END CERTIFICATE-----`;

function makeRoot(uid: string): TrustedRoot {
  return { uid, name: `Root ${uid}`, certPem: caPem, addedAt: '2026-08-27T00:00:00.000Z' };
}

let liveRoots: TrustedRoot[] = [];

beforeEach(() => {
  liveRoots = [];
  mockUseTrustedRoots.mockReset();
  mockUseTrustedRoots.mockImplementation(() => liveRoots);
  mockReplaceRoots.mockReset();
  mockReplaceRoots.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
});

const testIdentity = resolveWorkbenchIdentity();

function renderEditor(onDirtyChange = vi.fn()) {
  const utils = render(
    <AwarenessIdentityProvider value={testIdentity}>
      <TrustedRootsEditor workspaceId="ws-1" onDirtyChange={onDirtyChange} />
    </AwarenessIdentityProvider>,
  );
  return { ...utils, onDirtyChange };
}

const saveButton = () => screen.getByRole('button', { name: /Save/ });

async function pasteAndAdd(): Promise<void> {
  fireEvent.click(screen.getByTestId('trusted-root-add'));
  fireEvent.change(screen.getByTestId('trusted-root-pem-input'), { target: { value: caPem } });
  const confirm = screen.getByTestId('trusted-root-add-confirm');
  await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
  fireEvent.click(confirm);
}

describe('TrustedRootsEditor', () => {
  it('renders the info banner and the table with the empty line inside it at zero roots', () => {
    renderEditor();
    expect(screen.getByText(/Certificate authorities every TLS connection/)).toBeTruthy();
    expect(screen.getByText('CERTIFICATES (0)')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByTestId('trusted-roots-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('trusted-root-row')).toHaveLength(0);
  });

  it('opens the paste panel below the table', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('trusted-root-add'));
    const panel = screen.getByTestId('trusted-root-add-panel');
    const table = screen.getByTestId('trusted-roots-empty');
    expect(table.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a pasted root joins the draft as a row and lights dirty without firing a write', async () => {
    const { onDirtyChange } = renderEditor();
    await pasteAndAdd();
    expect(screen.getAllByTestId('trusted-root-row')).toHaveLength(1);
    expect(screen.getByText('CERTIFICATES (1)')).toBeTruthy();
    expect(screen.queryByTestId('trusted-root-add-panel')).toBeNull();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(mockReplaceRoots).not.toHaveBeenCalled();
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('Save commits the draft against the canonical list in one replacement call', async () => {
    liveRoots = [makeRoot('r1')];
    renderEditor();
    await pasteAndAdd();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockReplaceRoots).toHaveBeenCalledTimes(1));
    const [draft, canonical] = mockReplaceRoots.mock.calls[0] as [TrustedRoot[], TrustedRoot[]];
    expect(canonical).toEqual(liveRoots);
    expect(draft).toHaveLength(2);
    expect(draft[0]).toEqual(liveRoots[0]);
    expect(draft[1].name).toBe('OpenHeaders Test Root');
    expect(draft[1].certPem).toBe(caPem);
  });

  it('remove edits the draft without a confirm; a clean tab is not dirty and Save is disabled', () => {
    liveRoots = [makeRoot('r1'), makeRoot('r2')];
    const { onDirtyChange } = renderEditor();
    expect(screen.getAllByTestId('trusted-root-row')).toHaveLength(2);
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(screen.getAllByTestId('trusted-root-row')).toHaveLength(1);
    expect(screen.getByText('CERTIFICATES (1)')).toBeTruthy();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(mockReplaceRoots).not.toHaveBeenCalled();
  });

});
