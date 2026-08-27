// @vitest-environment jsdom
/**
 * The global Settings door to trusted certificates — API Requests › TLS.
 * Pins the registry shape (an `info` def with the custom editor under
 * the leading `tls` subcategory, tagging a declared section like every
 * requests def) and the row's face: the canonical count of the
 * editing-scope workspace, the manage link firing the shell's opener, and the disabled
 * picker with the honest caption on a non-node host. Also pins that
 * the navigator's variables view no longer offers the singleton row —
 * trust is not a variable.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/requests';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { TrustedRoot } from '@openheaders/core/types';
import { useVariableSingletonNodes } from '@openheaders/ui/workbench/components/sidebar/useVariableSingletonNodes';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { OpenTrustedRootsProvider } from '@openheaders/ui/workbench/hooks/OpenTrustedRootsContext';
import TrustedRootsRow from '@openheaders/ui/workbench/settings/components/trusted-roots-row';
import { byCategory, getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseTrustedRoots } = vi.hoisted(() => ({ mockUseTrustedRoots: vi.fn() }));

vi.mock('@openheaders/ui/shared/hooks/readers/useTrustedRoots', () => ({
  useTrustedRoots: mockUseTrustedRoots,
}));

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

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

function makeRoot(uid: string): TrustedRoot {
  return {
    uid,
    name: `Root ${uid}`,
    certPem: `-----BEGIN CERTIFICATE-----\n${uid}\n-----END CERTIFICATE-----`,
    addedAt: '2026-08-27T00:00:00.000Z',
  };
}

beforeEach(async () => {
  mockUseTrustedRoots.mockReset();
  mockUseTrustedRoots.mockImplementation((workspaceId: string | null) =>
    workspaceId === 'ws-two' ? [makeRoot('r1'), makeRoot('r2')] : [],
  );
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
  __resetStoreForTests();
});

function requireTrustedRootsDef() {
  const def = getDef('requests.trustedRoots');
  if (!def) throw new Error('requests.trustedRoots not registered');
  return def;
}

function renderRow(workspaceId: string, openTrustedRoots: () => void) {
  return render(
    <OpenTrustedRootsProvider openTrustedRoots={openTrustedRoots}>
      <EditingScopeWorkspaceProvider workspaceId={workspaceId}>
        <TrustedRootsRow def={requireTrustedRootsDef()} />
      </EditingScopeWorkspaceProvider>
    </OpenTrustedRootsProvider>,
  );
}

describe('requests.trustedRoots — the Settings › API Requests door', () => {
  it('registers an info def with the custom editor under the leading tls section', () => {
    const def = requireTrustedRootsDef();
    expect(def.type).toBe('info');
    expect(def.category).toBe('requests');
    expect(def.subcategory).toBe('tls');
    expect(def.customEditor).toBe(TrustedRootsRow);
    const subcategories = getCategory('requests')?.subcategories ?? [];
    expect(subcategories[0]?.id).toBe('tls');
    const declared = new Set(subcategories.map((s) => s.id));
    for (const other of byCategory('requests')) {
      expect(declared.has(other.subcategory ?? '')).toBe(true);
    }
  });

  it('faces the editing-scope count and opens the editor from the manage link (node runtime)', () => {
    registerCapability('requestRuntime', () => 'node');
    const open = vi.fn();
    renderRow('ws-two', open);
    expect(screen.getByText('Trusted Certificates:')).toBeTruthy();
    expect(screen.getByText('2 from this workspace')).toBeTruthy();
    const combobox = screen.getByRole('combobox', { name: 'Trusted Certificates' });
    fireEvent.mouseDown(combobox);
    fireEvent.click(combobox);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Root r1', 'Root r2']);
    fireEvent.click(screen.getByRole('button', { name: 'Manage trusted certificates' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('disables the picker with the honest caption on a browser host', () => {
    registerCapability('requestRuntime', () => 'browser');
    renderRow('ws-two', () => {});
    expect(screen.getByText('Browser store')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Trusted Certificates' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/verifies with its own trust store/)).toBeTruthy();
    expect(mockUseTrustedRoots).toHaveBeenCalledWith(null);
  });
});

describe('variables view singletons', () => {
  it('no longer offers a trusted-roots row beside the vault', () => {
    const { result } = renderHook(() => useVariableSingletonNodes({}));
    expect(Object.keys(result.current).sort()).toEqual([
      'liveVarsNode',
      'scriptPackagesNode',
      'vaultNode',
      'workspaceVarsNode',
    ]);
  });
});
