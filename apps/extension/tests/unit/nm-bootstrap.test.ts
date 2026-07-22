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
 *     to the pairing gesture — an `error` outcome, no throw;
 *   - silent auto-join: an empty registry (no loopback record at all)
 *     probes the default loopback address once per SW life and a
 *     verified mint CREATES the record, enabled; a disabled loopback
 *     record suppresses the probe (the kill switch outranks
 *     automation), and the `backend.nmAutoJoin` consent gate turns the
 *     whole silent plane off.
 */

import '@openheaders/ui/workbench/settings/schema';
import {
  __clearBackendsForTests,
  getBackend,
  getBackends,
  refreshBackendsFromHostStorage,
} from '@openheaders/core/backends';
import { hostStorage, OH } from '@openheaders/core/storage';
import { set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  handleNmAutoJoinAlarm,
  resetNmBootstrapForTests,
  runNmBootstrap,
} from '../../src/background/modules/nm-bootstrap';
import { NM_HOST_NAME } from '../../src/shared/nm-handoff';
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
    setSetting('backend.nmAutoJoin', true);
    setSetting('backend.nmAutoJoinProbe', true);
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

  it('auto-joins on an empty registry: a verified mint creates the record, enabled', async () => {
    await seedBackends([]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_joined', tokenId: 't3', browser: 'Google Chrome' }),
    });
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe('auto-joined');
    expect(sent).toHaveLength(1);
    expect(sent[0].message.url).toBe('ws://127.0.0.1:8137');
    const record = getBackend(results[0].backendId);
    expect(record?.enabled).toBe(true);
    expect(record?.authToken).toBe('oh_joined');
    expect(record?.url).toBe('ws://127.0.0.1:8137');
  });

  it('auto-joins beside a LAN-only registry — no loopback record means no desktop was configured', async () => {
    await seedBackends([makeTestBackend({ id: LAN_ID, url: 'ws://192.168.1.20:8137', authToken: 'oh_lan' })]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_joined', tokenId: 't4', browser: 'Google Chrome' }),
    });
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe('auto-joined');
    expect(getBackends()).toHaveLength(2);
  });

  it('a disabled loopback record suppresses auto-join — the kill switch outranks automation', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:8137', enabled: false })]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_never', tokenId: 't5', browser: 'Google Chrome' }),
    });
    expect(results).toEqual([]);
    expect(sent).toEqual([]);
    expect(getBackends()).toHaveLength(1);
  });

  it('probes auto-join once per SW life — a refused join never loops', async () => {
    await seedBackends([]);
    const first = await runNmBootstrap({ sendNativeMessage: sendAnswering({ ok: false, reason: 'refused' }) });
    expect(first).toEqual([]);
    const second = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_late', tokenId: 't6', browser: 'Google Chrome' }),
    });
    expect(second).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(getBackends()).toHaveLength(0);
  });

  it('the periodic alarm re-arms the auto-join probe after a failed round', async () => {
    await seedBackends([]);
    // A cold-boot probe against an absent desktop consumed the guard.
    await runNmBootstrap({ sendNativeMessage: sendAnswering({ ok: false, reason: 'refused' }) });
    expect(sent).toHaveLength(1);
    // The alarm tick re-arms it — the desktop installed in between now
    // joins with no SW restart. The handler rides the module's own
    // wiring; the guard reset is what this pins, so probe again via the
    // seam-carrying entry point.
    await handleNmAutoJoinAlarm();
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_late', tokenId: 't8', browser: 'Google Chrome' }),
    });
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe('auto-joined');
  });

  it('the probe opt-out keeps the alarm tick from re-arming', async () => {
    setSetting('backend.nmAutoJoinProbe', false);
    await seedBackends([]);
    await runNmBootstrap({ sendNativeMessage: sendAnswering({ ok: false, reason: 'refused' }) });
    await handleNmAutoJoinAlarm();
    const again = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_never', tokenId: 't9', browser: 'Google Chrome' }),
    });
    expect(again).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(getBackends()).toHaveLength(0);
  });

  it('the consent gate turns the whole silent plane off', async () => {
    setSetting('backend.nmAutoJoin', false);
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    const results = await runNmBootstrap({
      sendNativeMessage: sendAnswering({ ok: true, token: 'oh_never', tokenId: 't7', browser: 'Google Chrome' }),
    });
    expect(results).toEqual([]);
    expect(sent).toEqual([]);
    expect(getBackend(LOOPBACK_ID)?.authToken).toBe('');
  });
});
