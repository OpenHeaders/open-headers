/**
 * Add/edit wizard — `BackendWizard`.
 *
 * Pins the flow-level invariants over the `OH.backends` registry:
 *   - cancelling a fresh ADD removes the just-created record; cancelling
 *     an EDIT keeps it (blur-committed changes stand, record disabled);
 *   - an ENABLED record's wizard opens on the disable-first gate — no
 *     connection fields render for a live wire;
 *   - the final step routes through the enable-switch handle (the
 *     probe-gated path), closing only when the flip committed.
 */

import {
  __clearBackendsForTests,
  createBackend,
  getBackend,
  refreshBackendsFromHostStorage,
  updateBackend,
} from '@openheaders/core/backends';
import { type HostStorage, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type { BackendEnableSwitchHandle } from '@openheaders/ui/workbench/settings/components/use-backend-enable-switch';
import { BackendWizard } from '@openheaders/ui/workbench/settings/components/backend-wizard';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ant's responsive observer (Steps/Modal) probes matchMedia, which jsdom lacks.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

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

function createEnableSwitchStub(committed = true): BackendEnableSwitchHandle & {
  setEnabled: ReturnType<typeof vi.fn>;
} {
  return {
    setEnabled: vi.fn(async (_record: BackendConnection, _next: boolean) => committed),
    busy: false,
    overlayElement: null,
  };
}

function renderWizard(
  recordId: string,
  mode: 'add' | 'edit',
  enableSwitch: BackendEnableSwitchHandle,
): { onClose: ReturnType<typeof vi.fn> } {
  const onClose = vi.fn();
  render(
    <AntApp>
      <BackendWizard target={{ recordId, mode }} enableSwitch={enableSwitch} onClose={onClose} />
    </AntApp>,
  );
  return { onClose };
}

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  setCurrentHost('extension');
  setHostStorage(createHostStorageFake());
  __clearBackendsForTests();
  await refreshBackendsFromHostStorage();
});

describe('BackendWizard', () => {
  it('cancelling a fresh add removes the just-created record', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137' });
    const { onClose } = renderWizard(record.id, 'add', createEnableSwitchStub());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(getBackend(record.id)).toBeNull();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelling an edit keeps the record', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', label: 'Loopback desktop' });
    const { onClose } = renderWizard(record.id, 'edit', createEnableSwitchStub());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(getBackend(record.id)).not.toBeNull();
  });

  it('an enabled record opens on the disable-first gate, no connection fields', async () => {
    const created = await createBackend({ url: 'ws://127.0.0.1:8137' });
    await updateBackend(created.id, { enabled: true });
    renderWizard(created.id, 'edit', createEnableSwitchStub());

    expect(screen.getByRole('button', { name: 'Disconnect and edit' })).toBeTruthy();
    expect(screen.queryByLabelText('Address')).toBeNull();
    expect(screen.queryByLabelText('Auth token')).toBeNull();
  });

  it('the disable-first gate flips through the enable-switch kill path', async () => {
    const created = await createBackend({ url: 'ws://127.0.0.1:8137' });
    const record = await updateBackend(created.id, { enabled: true });
    const enableSwitch = createEnableSwitchStub();
    renderWizard(created.id, 'edit', enableSwitch);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect and edit' }));

    expect(enableSwitch.setEnabled).toHaveBeenCalledWith(record, false);
  });

  it('Verify & connect routes through the enable switch and closes on commit', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', authToken: 'tok' });
    const enableSwitch = createEnableSwitchStub(true);
    const { onClose } = renderWizard(record.id, 'edit', enableSwitch);

    // Edit starts on Connect; walk to the final step.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /Verify & connect/ }));

    await waitFor(() => {
      expect(enableSwitch.setEnabled).toHaveBeenCalledWith(record, true);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('a probe abort keeps the wizard open', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', authToken: 'tok' });
    const enableSwitch = createEnableSwitchStub(false);
    const { onClose } = renderWizard(record.id, 'edit', enableSwitch);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /Verify & connect/ }));

    await waitFor(() => {
      expect(enableSwitch.setEnabled).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
