/**
 * Add/edit wizard — `BackendWizard`.
 *
 * Pins the flow-level invariants over the `OH.backends` registry:
 *   - the dialog's title is the verb that opened it (Sign in to a server /
 *     Connect desktop app) or the place being edited;
 *   - cancelling a fresh ADD removes the just-created record; cancelling
 *     an EDIT keeps it (blur-committed changes stand, record disabled);
 *   - an ENABLED record's wizard opens on the disable-first gate — no
 *     connection fields render for a live wire;
 *   - the sign-in step reads its verdict off the probe — auth-required
 *     asks to pair, an accepted WELCOME names the place;
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
import type { ProbeConnectionResult } from '@openheaders/ui/shared/backend';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { BackendWizard, type BackendWizardTarget } from '@openheaders/ui/workbench/settings/components/backend-wizard';
import type { BackendEnableSwitchHandle } from '@openheaders/ui/workbench/settings/components/use-backend-enable-switch';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The sign-in step probes the address on entry; no test opens a socket.
const probe = vi.fn<(url: string) => Promise<ProbeConnectionResult>>();
vi.mock('@openheaders/ui/shared/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/ui/shared/backend')>()),
  probeBackendConnection: (url: string) => probe(url),
}));

const AUTH_REQUIRED: ProbeConnectionResult = { ok: false, reason: 'handshake-rejected', rejectReason: 'auth-required' };
const ACCEPTED_BY_ACME: ProbeConnectionResult = {
  ok: true,
  latencyMs: 3,
  protocolVersion: 1,
  role: 'daemon',
  agent: 'test',
  orgName: 'Acme',
};

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
  target: BackendWizardTarget,
  enableSwitch: BackendEnableSwitchHandle = createEnableSwitchStub(),
): { onClose: ReturnType<typeof vi.fn> } {
  const onClose = vi.fn();
  render(
    <AntApp>
      <BackendWizard target={target} enableSwitch={enableSwitch} onClose={onClose} />
    </AntApp>,
  );
  return { onClose };
}

const next = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
};

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  setCurrentHost('extension');
  setHostStorage(createHostStorageFake());
  __clearBackendsForTests();
  await refreshBackendsFromHostStorage();
  probe.mockReset();
  probe.mockResolvedValue(AUTH_REQUIRED);
});

describe('BackendWizard', () => {
  it('a fresh add is titled by its verb', async () => {
    const server = await createBackend({ url: 'ws://' });
    renderWizard({ recordId: server.id, mode: 'add', kind: 'server' });
    expect(screen.getByRole('dialog', { name: 'Sign in to a server' })).toBeTruthy();
    cleanup();

    const desktop = await createBackend({ url: 'ws://127.0.0.1:8137' });
    renderWizard({ recordId: desktop.id, mode: 'add', kind: 'desktop-app' });
    expect(screen.getByRole('dialog', { name: 'Connect desktop app' })).toBeTruthy();
  });

  it('an edit is titled by the place the row named', async () => {
    const record = await createBackend({ url: 'ws://10.0.0.5:8137', label: 'Daemon A' });
    renderWizard({ recordId: record.id, mode: 'edit', place: 'Daemon A' });
    expect(screen.getByRole('dialog', { name: 'Edit Daemon A' })).toBeTruthy();
  });

  it('cancelling a fresh add removes the just-created record', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137' });
    const { onClose } = renderWizard({ recordId: record.id, mode: 'add', kind: 'server' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(getBackend(record.id)).toBeNull();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelling an edit keeps the record', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', label: 'Loopback desktop' });
    const { onClose } = renderWizard({ recordId: record.id, mode: 'edit' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(getBackend(record.id)).not.toBeNull();
  });

  it('an enabled record opens on the disable-first gate, no connection fields', async () => {
    const created = await createBackend({ url: 'ws://127.0.0.1:8137' });
    await updateBackend(created.id, { enabled: true });
    renderWizard({ recordId: created.id, mode: 'edit' });

    expect(screen.getByRole('button', { name: 'Disconnect and edit' })).toBeTruthy();
    expect(screen.queryByLabelText('Address')).toBeNull();
    expect(screen.queryByLabelText('Auth token')).toBeNull();
  });

  it('the disable-first gate flips through the enable-switch kill path', async () => {
    const created = await createBackend({ url: 'ws://127.0.0.1:8137' });
    const record = await updateBackend(created.id, { enabled: true });
    const enableSwitch = createEnableSwitchStub();
    renderWizard({ recordId: created.id, mode: 'edit' }, enableSwitch);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect and edit' }));

    expect(enableSwitch.setEnabled).toHaveBeenCalledWith(record, false);
  });

  it('Next is held until the address is complete', async () => {
    const record = await createBackend({ url: 'ws://' });
    renderWizard({ recordId: record.id, mode: 'add', kind: 'server' });
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the sign-in step asks to pair when the server answers auth-required', async () => {
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderWizard({ recordId: record.id, mode: 'add', kind: 'server' });

    next();

    await waitFor(() => {
      expect(screen.getByText('10.0.0.5 asks this device to pair. Enter the code it shows, or paste a token.')).toBeTruthy();
    });
    expect(probe).toHaveBeenCalledWith('ws://10.0.0.5:8137');
    // The loading icon's leave motion never ends under jsdom, so its
    // label lingers in the accessible name.
    expect(screen.getByRole('button', { name: /Check again/ })).toBeTruthy();
  });

  it('the sign-in step names the place when the credential already signs in', async () => {
    probe.mockResolvedValue(ACCEPTED_BY_ACME);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137', authToken: 'tok' });
    renderWizard({ recordId: record.id, mode: 'edit' });

    next();

    await waitFor(() => {
      expect(screen.getByText('Signed in to Acme.')).toBeTruthy();
    });
  });

  it("the desktop verb's failed automatic pairing is explained on the address step", async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137' });
    renderWizard({ recordId: record.id, mode: 'add', kind: 'desktop-app', autoPairFailed: true });
    expect(screen.getByText(/Automatic pairing with the desktop app didn't go through/)).toBeTruthy();
  });

  it('Connect routes through the enable switch and closes on commit', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', authToken: 'tok' });
    const enableSwitch = createEnableSwitchStub(true);
    const { onClose } = renderWizard({ recordId: record.id, mode: 'edit' }, enableSwitch);

    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /^Connect$/ }));

    await waitFor(() => {
      expect(enableSwitch.setEnabled).toHaveBeenCalledWith(record, true);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('adding a connection beyond the first explains what an additional one changes', async () => {
    await createBackend({ url: 'ws://127.0.0.1:8137', label: 'First desktop' });
    const second = await createBackend({ url: 'ws://127.0.0.1:8138', authToken: 'tok' });
    renderWizard({ recordId: second.id, mode: 'add', kind: 'server' });

    next();
    next();

    expect(screen.getByText(/This is an additional back-end/)).toBeTruthy();
  });

  it('the first add carries no additional-connection note', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', authToken: 'tok' });
    renderWizard({ recordId: record.id, mode: 'add', kind: 'server' });

    next();
    next();

    expect(screen.queryByText(/This is an additional back-end/)).toBeNull();
  });

  it('a probe abort keeps the wizard open', async () => {
    const record = await createBackend({ url: 'ws://127.0.0.1:8137', authToken: 'tok' });
    const enableSwitch = createEnableSwitchStub(false);
    const { onClose } = renderWizard({ recordId: record.id, mode: 'edit' }, enableSwitch);

    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: /^Connect$/ }));

    await waitFor(() => {
      expect(enableSwitch.setEnabled).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
