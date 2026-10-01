/**
 * The `oh.secretManager.*` routes on the browser host — the workbench's
 * reads and gestures forwarded to the desktop app on this device over
 * loopback (the Secret Providers plan's P2), each answered honestly
 * while the desktop app is away: an empty list naming its broker as
 * unreachable, a probe reading `broker-unreachable`, a Test refusing
 * with the same reason, a session's batch resolve reading
 * `broker-unreachable` for every entry (the page realm executes its
 * sessions itself and resolves their secret-manager entries through
 * this worker's loopback broker — P2b). Mutations never ride the wire
 * — a connection is added, edited and removed in the desktop app, and
 * this host says so rather than pretending.
 */

import type { BridgeRpcResponse } from '@openheaders/core/bridge';
import type { SecretBrokerEntry, SecretResolution } from '@openheaders/core/secret-providers';
import {
  askDesktopApp,
  createLoopbackSecretManagerBroker,
  DESKTOP_APP_AWAY_DETAIL,
} from '../../secret-manager/loopback-broker';
import type { HandlerMap } from '../types';

const DESKTOP_ONLY_MUTATION = 'Secret manager connections are added, edited and removed in the desktop app.';

/** The page realm's sessions resolve through the same loopback broker the HTTP sends ride. */
const loopbackBroker = createLoopbackSecretManagerBroker();

function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const secretManagerHandlers: HandlerMap = {
  'oh.secretManager.list': ({ respond }) => {
    const away: BridgeRpcResponse<'oh.secretManager.list'> = { connections: [], broker: 'unreachable' };
    askDesktopApp('oh.secretManager.list', {})
      .then((answer) => respond(answer === null ? away : { connections: answer.connections, broker: 'desktop-app' }))
      .catch(() => respond(away));
    return true;
  },
  'oh.secretManager.probe': ({ message, respond }) => {
    const uid = typeof message.uid === 'string' ? message.uid : '';
    const away: BridgeRpcResponse<'oh.secretManager.probe'> = {
      available: false,
      reason: 'broker-unreachable',
      detail: DESKTOP_APP_AWAY_DETAIL,
    };
    askDesktopApp('oh.secretManager.probe', { uid })
      .then((answer) => respond(answer ?? away))
      .catch((err: unknown) => respond({ ...away, detail: detailOf(err) }));
    return true;
  },
  'oh.secretManager.authorize': ({ message, respond }) => {
    const uid = typeof message.uid === 'string' ? message.uid : '';
    const away: BridgeRpcResponse<'oh.secretManager.authorize'> = {
      ok: false,
      reason: 'broker-unreachable',
      detail: DESKTOP_APP_AWAY_DETAIL,
    };
    askDesktopApp('oh.secretManager.authorize', { uid })
      .then((answer) => respond(answer ?? away))
      .catch((err: unknown) => respond({ ...away, detail: detailOf(err) }));
    return true;
  },
  'oh.secretManager.resolveBatch': ({ message, respond }) => {
    const entries = Array.isArray(message.entries) ? (message.entries as SecretBrokerEntry[]) : [];
    void loopbackBroker.resolveBatch(entries).then((resolved) => {
      const results: Record<string, SecretResolution> = {};
      for (const [name, result] of resolved) results[name] = result;
      const answer: BridgeRpcResponse<'oh.secretManager.resolveBatch'> = { results };
      respond(answer);
    });
    return true;
  },
  'oh.secretManager.add': ({ respond }) => {
    respond({ ok: false, error: DESKTOP_ONLY_MUTATION });
  },
  'oh.secretManager.update': ({ respond }) => {
    respond({ ok: false, error: DESKTOP_ONLY_MUTATION });
  },
  'oh.secretManager.remove': ({ respond }) => {
    respond({ ok: false, error: DESKTOP_ONLY_MUTATION });
  },
};
