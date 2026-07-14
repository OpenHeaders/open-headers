/**
 * Migration pull mirror — the web tab's face of the MIGRATION_PLAN.md
 * S5-addendum law: progress auto-syncs to every connected surface.
 *
 * The serving daemon fans the operator's `migrationPullEvent` frames to
 * its WS peers (operator-filtered server-side); this tab is such a
 * peer, so the mirror claims those frames off the single wire and
 * re-broadcasts the payload into the in-tab fan-out the S9
 * background-tasks tenant subscribes to. Mirroring the broadcast is the
 * whole job — no state lives here; the tenant folds the events with the
 * core `foldPullEvent` reducer.
 *
 * Hydration rides the operator-gated `oh.migration.postmanPull.getState`
 * peer channel. Every failure leg — a dead wire, a daemon without the
 * migration ladder (it silently ignores the channel, so the call times
 * out), a non-operator refusal — answers the initial (idle) run state:
 * "no run to track" is the honest surface answer, and the tenant's
 * `runId === null` guard makes it a no-op.
 */

import { initialPullRunState, type MigrationPullRunState, type PostmanPullEvent } from '@openheaders/core/import';
import { hostLogger as logger } from '@openheaders/core/logger';
import { broadcastLocal } from './web-broadcast';
import { callWireRpc, registerWireRpcChannels } from './wire-rpc';

const SCOPE = 'WireMigrationMirror';

const FRAME_TYPE = 'migrationPullEvent';

export const MIGRATION_GET_STATE_CHANNEL = 'oh.migration.postmanPull.getState';

registerWireRpcChannels([MIGRATION_GET_STATE_CHANNEL]);

interface MigrationPullFrame {
  type: string;
  payload: { runId: string; seq: number; event: PostmanPullEvent };
}

function isMigrationPullFrame(raw: unknown): raw is MigrationPullFrame {
  if (!raw || typeof raw !== 'object') return false;
  if ((raw as { type?: unknown }).type !== FRAME_TYPE) return false;
  const payload = (raw as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return false;
  const { runId, seq, event } = payload as { runId?: unknown; seq?: unknown; event?: unknown };
  return (
    typeof runId === 'string' &&
    typeof seq === 'number' &&
    typeof event === 'object' &&
    event !== null &&
    typeof (event as { kind?: unknown }).kind === 'string'
  );
}

/**
 * Attempt to handle one parsed wire frame. Returns `true` if the frame
 * type matched (a malformed frame is still ours to drop), `false`
 * otherwise so the caller routes it onward.
 */
export function handleIncomingMigrationPullFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== FRAME_TYPE) return false;
  if (!isMigrationPullFrame(raw)) {
    logger.info(SCOPE, `dropping malformed ${FRAME_TYPE} frame`);
    return true;
  }
  broadcastLocal(FRAME_TYPE, raw.payload);
  return true;
}

/**
 * Forward the tenant's mount-time hydration up the wire. Never rejects
 * — see the module doc's failure-leg posture.
 */
export function fetchMigrationPullState(): Promise<MigrationPullRunState> {
  return callWireRpc({ type: MIGRATION_GET_STATE_CHANNEL }).then(
    (state) => state as MigrationPullRunState,
    () => initialPullRunState(),
  );
}
