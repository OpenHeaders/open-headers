/**
 * The wizard's sign-in step — `BackendSignInStep` (the client sign-in
 * plan D4). Pins the ONE shared component over its two seams, with the
 * `serverSignIn` capability and `openExternalUrl` faked:
 *   - without the capability the admin-issued code / token entry is the
 *     only path, with no link to anything else;
 *   - on a password or SSO server the primary starts a pair, opens the
 *     approval page, shows the code and waits; the poll writes the
 *     approved secret onto the record like a pasted token; Cancel stops
 *     the loop; a denied verdict and a refused start each say one
 *     honest thing and offer Try again;
 *   - an unclaimed server draws no sign-in and says where the
 *     administrator is created; a no-login server makes the secondary
 *     path the only one and says why;
 *   - the verdict line names the person and the place off the WELCOME;
 *   - the secondary link reveals the code + token entry on demand.
 */

import {
  __clearBackendsForTests,
  createBackend,
  getBackend,
  refreshBackendsFromHostStorage,
} from '@openheaders/core/backends';
import {
  registerCapability,
  type ServerSignInApi,
  type ServerSignInPollResult,
  type ServerSignInStartResult,
  unregisterCapability,
} from '@openheaders/core/capabilities';
import { type HostStorage, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { BackendRecordProvider } from '@openheaders/ui/workbench/settings/components/backend-record-context';
import BackendSignInStep, {
  SIGN_IN_POLL_INTERVAL_MS,
} from '@openheaders/ui/workbench/settings/components/backend-sign-in-step';
import type { SignInVerdict } from '@openheaders/ui/workbench/settings/components/backend-wizard';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const NEEDS_SIGN_IN: SignInVerdict = { kind: 'needs-pairing' };
const STARTED: ServerSignInStartResult = {
  ok: true,
  code: '424242',
  pollToken: 'handle-1',
  expiresAt: Date.now() + 5 * 60_000,
  approveUrl: 'http://10.0.0.5:8137/pair/424242',
};

interface FakeApi {
  api: ServerSignInApi;
  start: ReturnType<typeof vi.fn>;
  poll: ReturnType<typeof vi.fn>;
}

/** A server in one gate state; `start` and `poll` answer what the test queues. */
function fakeApi(meta: Record<string, unknown>): FakeApi {
  const start = vi.fn(async (): Promise<ServerSignInStartResult> => STARTED);
  const poll = vi.fn(async (): Promise<ServerSignInPollResult> => ({ status: 'pending', expiresAt: null }));
  const api: ServerSignInApi = {
    start,
    poll,
    fetchMeta: async ({ path }) => meta[path] ?? null,
  };
  return { api, start, poll };
}

const PASSWORD_SERVER = { '/auth/setup/meta': { unclaimed: false }, '/auth/password/meta': { enabled: true } };

function renderStep(record: BackendConnection, verdict: SignInVerdict | null = NEEDS_SIGN_IN): void {
  render(
    <AntApp>
      <BackendRecordProvider record={record}>
        <BackendSignInStep verdict={verdict} probing={false} onProbe={() => undefined} />
      </BackendRecordProvider>
    </AntApp>,
  );
}

/** The primary once the gate resolved — a loading button ignores clicks. */
async function findPrimary(host: string): Promise<HTMLElement> {
  const button = await screen.findByRole('button', { name: new RegExp(`Sign in on ${host.replace(/\./g, '\\.')}`) });
  await waitFor(() => {
    expect(button.className).not.toContain('ant-btn-loading');
  });
  return button;
}

const flush = (): Promise<void> =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });

type OpenExternal = (url: string) => Promise<{ ok: boolean; error?: string }>;
let openExternal: ReturnType<typeof vi.fn<OpenExternal>>;

beforeEach(async () => {
  setCurrentHost('extension');
  setHostStorage(createHostStorageFake());
  __clearBackendsForTests();
  await refreshBackendsFromHostStorage();
  openExternal = vi.fn<OpenExternal>(async () => ({ ok: true }));
  registerCapability('openExternalUrl', openExternal);
});

afterEach(() => {
  vi.useRealTimers();
  unregisterCapability('serverSignIn');
  unregisterCapability('openExternalUrl');
  cleanup();
});

describe('BackendSignInStep', () => {
  it('without the capability the code and token entry is the only path', async () => {
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);
    expect(screen.queryByRole('button', { name: /Sign in on/ })).toBeNull();
    expect(screen.queryByText('Have a pairing code or token from an administrator?')).toBeNull();
    expect(screen.getByLabelText('Auth token')).toBeTruthy();
  });

  it('starts a pair on a password server, opens the approval page and shows the code', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);

    fireEvent.click(await findPrimary('10.0.0.5'));

    expect((await screen.findByTestId('backend-sign-in-code')).textContent).toBe('424242');
    expect(fake.start).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137' });
    expect(openExternal).toHaveBeenCalledWith('http://10.0.0.5:8137/pair/424242');
    expect(screen.getByText('Waiting for you to approve this device in the browser…')).toBeTruthy();
    // The link is shown beside the code so the person can paste it into
    // any browser — the open is a convenience, not the only path.
    expect(screen.getByText("Browser didn't open? Open this link in any browser:")).toBeTruthy();
    expect(screen.getByTestId('backend-sign-in-url').textContent).toContain('http://10.0.0.5:8137/pair/424242');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    // The secondary path stays one link away, never gone.
    expect(screen.getByText('Have a pairing code or token from an administrator?')).toBeTruthy();
  });

  it('polls the handle and writes the approved secret onto the record like a pasted token', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    fake.poll
      .mockResolvedValueOnce({ status: 'pending', expiresAt: null })
      .mockResolvedValueOnce({ status: 'approved', secret: 'oh_session', tokenId: 'tid' });
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);
    const primary = await findPrimary('10.0.0.5');

    vi.useFakeTimers();
    fireEvent.click(primary);
    await flush();
    expect(screen.getByTestId('backend-sign-in-code').textContent).toBe('424242');

    await act(() => vi.advanceTimersByTimeAsync(SIGN_IN_POLL_INTERVAL_MS));
    expect(fake.poll).toHaveBeenCalledTimes(1);
    expect(fake.poll).toHaveBeenCalledWith({ url: 'ws://10.0.0.5:8137', pollToken: 'handle-1' });
    expect(screen.getByTestId('backend-sign-in-code')).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(SIGN_IN_POLL_INTERVAL_MS));
    expect(fake.poll).toHaveBeenCalledTimes(2);
    vi.useRealTimers();

    await waitFor(() => {
      expect(getBackend(record.id)?.authToken).toBe('oh_session');
    });
    // The loop ended with the verdict — nothing polls a consumed handle.
    expect(screen.queryByTestId('backend-sign-in-code')).toBeNull();
  });

  it('Cancel stops the poll and returns to the offer', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);
    const primary = await findPrimary('10.0.0.5');

    vi.useFakeTimers();
    fireEvent.click(primary);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(() => vi.advanceTimersByTimeAsync(SIGN_IN_POLL_INTERVAL_MS * 3));

    expect(fake.poll).not.toHaveBeenCalled();
    expect(screen.queryByTestId('backend-sign-in-code')).toBeNull();
    expect(screen.getByRole('button', { name: /Sign in on 10\.0\.0\.5/ })).toBeTruthy();
  });

  it('a denied verdict says so and offers Try again', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    fake.poll.mockResolvedValue({ status: 'denied' });
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);
    const primary = await findPrimary('10.0.0.5');

    vi.useFakeTimers();
    fireEvent.click(primary);
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(SIGN_IN_POLL_INTERVAL_MS));
    vi.useRealTimers();

    expect(await screen.findByText("The sign-in was denied on the server's page.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(getBackend(record.id)?.authToken).toBe('');
  });

  it('a refused start says one honest thing per reason', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    fake.start.mockResolvedValue({ ok: false, reason: 'too-many-pending' });
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);

    fireEvent.click(await findPrimary('10.0.0.5'));

    expect(await screen.findByText('10.0.0.5 has too many sign-ins waiting. Try again in a few minutes.')).toBeTruthy();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('an unclaimed server draws no sign-in and says where the administrator is created', async () => {
    const fake = fakeApi({ '/auth/setup/meta': { unclaimed: true, requiresCode: true } });
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);

    expect(
      await screen.findByText(
        'This server has no administrator yet — set it up at http://10.0.0.5:8137 first, then sign in from here.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sign in on/ })).toBeNull();
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('a no-login server makes the admin-issued path the only one and says why', async () => {
    const fake = fakeApi({ '/auth/setup/meta': { unclaimed: false } });
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);

    expect(
      await screen.findByText(
        'Nobody can sign in to 10.0.0.5 from a browser, so a pairing code or token from its administrator is the only way in.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sign in on/ })).toBeNull();
    expect(screen.getByLabelText('Auth token')).toBeTruthy();
    expect(screen.queryByText('Have a pairing code or token from an administrator?')).toBeNull();
  });

  it('offers the sign-in on an SSO server too — the page shows the provider', async () => {
    const fake = fakeApi({ '/auth/oidc/meta': { enabled: true, provider: 'Okta' } });
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'wss://sync.openheaders.io' });
    renderStep(record);
    expect(await findPrimary('sync.openheaders.io')).toBeTruthy();
  });

  it('names the person and the place off the WELCOME, and the person alone without an Org', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137', authToken: 'tok' });
    renderStep(record, { kind: 'signed-in', name: 'Acme', person: 'Alice' });
    expect(screen.getByText('Signed in as Alice · Acme.')).toBeTruthy();
    // Signed in — no sign-in offered, the secondary stays one link away.
    expect(screen.queryByRole('button', { name: /Sign in on/ })).toBeNull();
    expect(screen.getByText('Have a pairing code or token from an administrator?')).toBeTruthy();
    cleanup();

    renderStep(record, { kind: 'signed-in', name: null, person: 'Alice' });
    expect(screen.getByText('Signed in as Alice.')).toBeTruthy();
    cleanup();

    renderStep(record, { kind: 'signed-in', name: 'Acme', person: null });
    expect(screen.getByText('Signed in to Acme.')).toBeTruthy();
  });

  it('the secondary link reveals the code and token entry', async () => {
    const fake = fakeApi(PASSWORD_SERVER);
    registerCapability('serverSignIn', () => fake.api);
    const record = await createBackend({ url: 'ws://10.0.0.5:8137' });
    renderStep(record);
    await findPrimary('10.0.0.5');
    expect(screen.queryByLabelText('Auth token')).toBeNull();

    fireEvent.click(screen.getByText('Have a pairing code or token from an administrator?'));

    expect(screen.getByLabelText('Auth token')).toBeTruthy();
  });
});
