/**
 * Migration RPCs — the extension has no migration ladder of its own
 * (detect/scan/pull need fs; the desktop runs them), so the only
 * channel here is the pull-state hydration the S9 background-tasks
 * tenant calls on mount: it forwards over the backend wire to the
 * connected desktop's operator-gated peer plane.
 *
 * Every failure leg — no wire, timeout, a non-operator refusal —
 * answers the initial (idle) run state: "no run to track" is the
 * honest surface answer, and the tenant's `runId === null` guard
 * makes it a no-op.
 */

import { initialPullRunState } from '@openheaders/core/import';
import { wsRequest } from '../../../ws-request';
import type { HandlerMap } from '../types';

const GET_STATE_CHANNEL = 'oh.migration.postmanPull.getState';

export const migrationHandlers: HandlerMap = {
  [GET_STATE_CHANNEL]: ({ respond, ctx }) => {
    if (!ctx.isWebSocketConnected()) {
      respond(initialPullRunState());
      return;
    }
    wsRequest({ type: GET_STATE_CHANNEL })
      .then((state) => respond(state))
      .catch(() => respond(initialPullRunState()));
    return true;
  },
};
