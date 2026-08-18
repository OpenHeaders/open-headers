/**
 * Migration RPCs — the account pull now runs LOCALLY in this service
 * worker (the extension account-pull plan Phase B): `listWorkspaces` and
 * `start` mirror the desktop pair's vocabulary exactly, so the stepper
 * stays host-blind. The key crosses the bridge per call and reaches
 * only the run host — never state, events, reports, or logs.
 *
 * `getState` answers local-first: a run this host started (or last
 * finished) wins; with no local run it keeps forwarding over the
 * backend wire to a connected desktop's operator-gated peer plane —
 * that is how a desktop-run pull's mirror still hydrates. Every
 * forwarding failure leg — no wire, timeout, a non-operator refusal —
 * answers the initial (idle) run state: "no run to track" is the honest
 * surface answer, and the tenant's `runId === null` guard makes it a
 * no-op.
 */

import { initialPullRunState } from '@openheaders/core/import';
import { wsRequest } from '../../../ws-request';
import { getSwMigrationRunHost, stopLocalMigrationPull } from '../../migration-run/run-host';
import type { HandlerMap } from '../types';

const LIST_WORKSPACES_CHANNEL = 'oh.migration.postmanPull.listWorkspaces';
const START_CHANNEL = 'oh.migration.postmanPull.start';
const GET_STATE_CHANNEL = 'oh.migration.postmanPull.getState';
const STOP_CHANNEL = 'oh.migration.postmanPull.stop';

export const migrationHandlers: HandlerMap = {
  [LIST_WORKSPACES_CHANNEL]: ({ message, respond }) => {
    const apiKey = typeof message.apiKey === 'string' ? message.apiKey.trim() : '';
    if (!apiKey) {
      respond({ ok: false, reason: 'An API key is required to list workspaces.' });
      return;
    }
    getSwMigrationRunHost()
      .listWorkspaces(apiKey)
      .then((result) => respond(result))
      .catch((err: Error) => respond({ ok: false, reason: err.message }));
    return true;
  },
  [START_CHANNEL]: ({ message, respond }) => {
    const apiKey = typeof message.apiKey === 'string' ? message.apiKey.trim() : '';
    if (!apiKey) {
      respond({ started: false, reason: 'An API key is required to start the pull.' });
      return;
    }
    const workspaceIds = Array.isArray(message.workspaceIds)
      ? message.workspaceIds.filter((id): id is string => typeof id === 'string')
      : undefined;
    getSwMigrationRunHost()
      .start(apiKey, workspaceIds)
      .then((result) => respond(result))
      .catch((err: Error) => respond({ started: false, reason: err.message }));
    return true;
  },
  [GET_STATE_CHANNEL]: ({ respond, ctx }) => {
    const local = getSwMigrationRunHost().getState();
    if (local.runId !== null) {
      respond(local);
      return;
    }
    if (!ctx.isWebSocketConnected()) {
      respond(initialPullRunState());
      return;
    }
    wsRequest({ type: GET_STATE_CHANNEL })
      .then((state) => respond(state))
      .catch(() => respond(initialPullRunState()));
    return true;
  },
  // Stops only a LOCAL run — a desktop-run pull mirrored here answers
  // `stopped: false` (stopping a remote peer's run is not this host's
  // call). Never constructs the run host: no host, no run to stop.
  [STOP_CHANNEL]: ({ respond }) => {
    respond({ stopped: stopLocalMigrationPull() });
  },
};
