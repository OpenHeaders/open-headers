/**
 * Migration pull mirror — client-plane inbound (MIGRATION_STATUS.md
 * S5 addendum: progress auto-syncs to every connected surface).
 *
 * Frame-router companion to the awareness receiver: claims
 * `migrationPullEvent` frames arriving from a backend wire (the desktop
 * host forwarding its run's events to the operator's peers) and
 * re-broadcasts the payload to every open extension surface. The S9
 * background-tasks tenant (`useMigrationPullTask`) folds the events
 * host-agnostically — mirroring the broadcast is the whole job; no
 * state lives here.
 */

import type { PostmanPullEvent } from '@openheaders/core/import';
import { broadcast } from '@utils/bridge';
import { logger } from '@utils/logger';

const FRAME_TYPE = 'migrationPullEvent';

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
 * Attempt to handle one parsed WS frame. Returns `true` if the frame
 * type matched (a malformed frame is still ours to drop), `false`
 * otherwise so the next handler can claim it.
 */
export function handleIncomingMigrationPullFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== FRAME_TYPE) return false;
  if (!isMigrationPullFrame(raw)) {
    logger.info('MigrationMirror', `dropping malformed ${FRAME_TYPE} frame`);
    return true;
  }
  broadcast(FRAME_TYPE, raw.payload);
  return true;
}
