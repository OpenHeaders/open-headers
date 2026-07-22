/**
 * NM identity bootstrap (extension side) — the token handoff's
 * candidate selection and loop discipline:
 *
 *   - only loopback backends with no credential (or an actively
 *     evicting one) are attempted; LAN backends and healthy tokens
 *     never spawn a host;
 *   - a successful handoff writes the minted token into the backend
 *     record (the redial trigger) and settles the attempt guard on it;
 *   - one attempt per backend per stored-token value — repeated calls
 *     (boot + every socket close) never loop a failed bootstrap;
 *   - a missing native host (dev desktop, Firefox) degrades silently
 *     to the pairing gesture — an `error` outcome, no throw.
 */

import { __clearBackendsForTests, getBackend, refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { hostStorage, OH } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NM_HOST_NAME, resetNmBootstrapForTests, runNmBootstrap } from '../../src/background/modules/nm-bootstrap';
import { installSyntheticIdentityForTests, makeTestBackend } from './sync/_identity-test-setup';

const LOOPBACK_ID = '01900000-0000-7000-8000-00000000aaaa';
const LAN_ID = '01900000-0000-7000-8000-00000000bbbb';

interface SentMessage {
  host: string;
  message: Record<string, unknown>;
}

describe('runNmBootstrap', () => {
  let teardown: () => void;
  let sent: SentMessage[];

  beforeEach(async () => {
    teardown = await installSyntheticIdentityForTests();
    resetNmBootstrapForTests();
    sent = [];
  });

  afterEach(() => {
    __clearBackendsForTests();
    teardown();
  });

  async function seedBackends(records: ReturnType<typeof makeTestBackend>[]): Promise<void> {
    await hostStorage.set(OH.backends, records);
    await refreshBackendsFromHostStorage();
  }

  function sendAnswering(response: unknown) {
    return async (host: string, message: Record<string, unknown>): Promise<unknown> => {
      sent.push({ host, message });
      return response;
    };
  }

  it('exchanges a token for a credential-less loopback backend and writes it', async () => {
    await seedBackends([
      makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' }),
      makeTestBackend({ id: LAN_ID, url: 'ws://192.168.1.20:8137', authToken: '' }),
    ]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_minted', tokenId: 't1', browser: 'Google Chrome' }),
    });
    expect(results).toEqual([{ backendId: LOOPBACK_ID, outcome: 'token-written' }]);
    expect(sent).toHaveLength(1);
    expect(sent[0].host).toBe(NM_HOST_NAME);
    expect(sent[0].message.kind).toBe('bootstrap');
    expect(sent[0].message.url).toBe('ws://127.0.0.1:59210');
    expect(getBackend(LOOPBACK_ID)?.authToken).toBe('oh_minted');
    // The LAN backend was never a candidate.
    expect(getBackend(LAN_ID)?.authToken).toBe('');
  });

  it('skips a loopback backend whose token is present and not evicting', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210', authToken: 'oh_live' })]);
    const results = await runNmBootstrap({ sendNativeMessage: sendAnswering({ ok: true, token: 'x' }) });
    expect(results).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('re-attempts an evicting backend (revoked token) and rotates the credential', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210', authToken: 'oh_revoked' })]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_fresh', tokenId: 't2', browser: 'Google Chrome' }),
      isBackendEvicting: (backendId) => backendId === LOOPBACK_ID,
    });
    expect(results).toEqual([{ backendId: LOOPBACK_ID, outcome: 'token-written' }]);
    expect(getBackend(LOOPBACK_ID)?.authToken).toBe('oh_fresh');
  });

  it('attempts once per stored-token value — a failed bootstrap never loops', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    const first = await runNmBootstrap({ sendNativeMessage: sendAnswering({ ok: false, reason: 'refused' }) });
    expect(first).toEqual([{ backendId: LOOPBACK_ID, outcome: 'refused' }]);
    const second = await runNmBootstrap({ sendNativeMessage: sendAnswering({ ok: false, reason: 'refused' }) });
    expect(second).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it('a successful mint settles the guard on the new token — no immediate re-attempt', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_minted', tokenId: 't1', browser: 'Google Chrome' }),
    });
    // The registry now carries the minted token; even an eviction claim
    // for the SAME token value must not re-spawn the host.
    const again = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_other' }),
      isBackendEvicting: () => true,
    });
    expect(again).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it('degrades to an error outcome when the native host is missing', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    const results = await runNmBootstrap({
      sendNativeMessage: async () => {
        throw new Error('Specified native messaging host not found.');
      },
    });
    expect(results).toEqual([{ backendId: LOOPBACK_ID, outcome: 'error' }]);
    expect(getBackend(LOOPBACK_ID)?.authToken).toBe('');
  });

  it('maps the host unreachable answer distinctly (daemon not running)', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: false, reason: 'unreachable' }),
    });
    expect(results).toEqual([{ backendId: LOOPBACK_ID, outcome: 'unreachable' }]);
  });
});
