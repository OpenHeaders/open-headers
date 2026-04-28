/**
 * Persistence backend — where snapshot bytes and the mutation log
 * live (§10.1). Separate from {@link SyncTransport} so a single device
 * can have both a persistence backend and zero-or-more transports
 * (the two-axis abstraction).
 *
 * `runOnce` is the litmus test: anything CI's path needs from a
 * persistent oracle is a leak in this abstraction.
 */

import type { EntityType, MutationEnvelope } from '../envelope';
import type { HLC } from '../hlc';
import type { MaterializedEntity } from '../store';

export interface PersistenceSession {
  readSnapshot(workspaceId: string, type: EntityType, id: string): Promise<MaterializedEntity | null>;
  writeSnapshot(workspaceId: string, snap: MaterializedEntity): Promise<void>;
  deleteSnapshot(workspaceId: string, type: EntityType, id: string): Promise<void>;
  listSnapshots(workspaceId: string, type: EntityType): AsyncIterable<MaterializedEntity>;
  appendToLog(workspaceId: string, mutation: MutationEnvelope): Promise<void>;
  readLog(workspaceId: string, sinceHlc?: HLC): AsyncIterable<MutationEnvelope>;
  close(): Promise<void>;
}

/**
 * One-shot session for the CLI / CI lifecycle (§20.1). Opens the
 * backend, returns a session bound to a single in-process run, and
 * exits cleanly without holding cross-process coordination state.
 */
export interface OneShotHandle {
  session: PersistenceSession;
  /** Finalize and release the backend. Idempotent. */
  finalize(): Promise<void>;
}

export interface PersistenceBackend {
  openSession(): Promise<PersistenceSession>;
  runOnce(): Promise<OneShotHandle>;
}
