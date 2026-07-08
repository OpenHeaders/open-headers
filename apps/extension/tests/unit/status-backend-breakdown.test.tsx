/**
 * Per-backend breakdown in the StatusPill popover — the `sync` extras
 * rows contributed by `productStatusExtras` (Multi-Backend Phase 4:
 * popup/status indicators).
 *
 * Pins the row ladder against the registry + the per-backend slot feed:
 *   - disabled record → "Off" (wire truth, same as the settings row);
 *   - enabled record with no slot → "Connecting…";
 *   - slotted record → the slot's own live message;
 *   - no registered backend → no rows at all (tier zero alone);
 *   - non-`sync` subsystems contribute nothing.
 */

import {
  __clearBackendsForTests,
  createBackend,
  refreshBackendsFromHostStorage,
  updateBackend,
} from '@openheaders/core/backends';
import { type HostStorage, setHostStorage } from '@openheaders/core/storage';
import type { BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let syncSnapshot: BackendSyncStatusSnapshot = {};

vi.mock('@openheaders/core/bridge', () => ({
  hostBridge: {
    call: vi.fn(async (method: string) => {
      if (method === 'getBackendSyncStatusSnapshot') return { snapshot: syncSnapshot };
      if (method === 'getObservabilityLog') return { entries: [] };
      return null;
    }),
    subscribe: () => () => undefined,
  },
}));

import { productStatusExtras } from '@openheaders/ui/shared/status';

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
}

function renderSyncExtras(): ReturnType<typeof render> {
  return render(<>{productStatusExtras('sync', undefined)}</>);
}

beforeEach(async () => {
  syncSnapshot = {};
  setHostStorage(createHostStorageFake());
  __clearBackendsForTests();
  await refreshBackendsFromHostStorage();
});

afterEach(cleanup);

describe('productStatusExtras — per-backend sync breakdown', () => {
  it('renders one row per record: Off / Connecting… / the slot message', async () => {
    const off = await createBackend({ label: 'Desk', url: 'ws://127.0.0.1:8137' });
    const connecting = await createBackend({ label: 'LAN box', url: 'ws://192.168.1.20:8137' });
    const green = await createBackend({ label: 'Work VM', url: 'wss://vm.openheaders.io' });
    await updateBackend(connecting.id, { enabled: true });
    await updateBackend(green.id, { enabled: true });
    syncSnapshot = { [green.id]: { state: 'green', message: 'Synced' } };
    void off;

    renderSyncExtras();

    await waitFor(() => {
      expect(screen.getByText('Desk')).toBeTruthy();
      expect(screen.getByText('Off')).toBeTruthy();
      expect(screen.getByText('LAN box')).toBeTruthy();
      expect(screen.getByText('Connecting…')).toBeTruthy();
      expect(screen.getByText('Work VM')).toBeTruthy();
      expect(screen.getByText('Synced')).toBeTruthy();
    });
  });

  it('falls back to the URL when a record has no label', async () => {
    await createBackend({ url: 'ws://192.168.1.20:8137' });
    renderSyncExtras();
    await waitFor(() => {
      expect(screen.getByText('ws://192.168.1.20:8137')).toBeTruthy();
    });
  });

  it('renders no rows while no backend is registered', () => {
    const { container } = renderSyncExtras();
    expect(container.textContent).not.toContain('Off');
    expect(container.textContent).not.toContain('Connecting…');
  });

  it('contributes nothing to non-sync subsystems', () => {
    expect(productStatusExtras('rules', undefined)).toBeNull();
  });
});
