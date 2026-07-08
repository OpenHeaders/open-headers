/**
 * Status seam — the spine's view of the host's status store.
 *
 * The data shapes (`StatusSubsystem`, `StatusLevel`, `StatusSnapshot`)
 * are host-bridge wire payloads in `@openheaders/core/types`; the
 * canonical store implementation lives beside the UI so renderers share
 * one vocabulary. The engine spine must not depend on that package, so
 * hosts hand it the store surface it needs through this interface —
 * the UI-side store satisfies it as-is.
 */

import type { StatusLevel, StatusSnapshot, StatusSubsystem } from '@openheaders/core/types';

export interface SpineStatusReport {
  subsystem: StatusSubsystem;
  state: StatusLevel;
  message: string;
  context?: Record<string, unknown>;
}

/** `report` alone — what the sync + live status reporters receive. */
export type SpineStatusReporter = (input: SpineStatusReport) => void;

/**
 * The full store surface the boot spine wires: `report` for the sync +
 * live reporters, `getSnapshot` for the `getStatusSnapshot` RPC,
 * `subscribe` for the `statusUpdated` local broadcast, and `clear` for
 * teardown.
 */
export interface SpineStatusStore {
  report: SpineStatusReporter;
  getSnapshot(): StatusSnapshot;
  subscribe(listener: (snapshot: StatusSnapshot) => void): () => void;
  clear(): void;
}
