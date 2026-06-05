/**
 * Status types — the unified "what's the state of my world?" API.
 *
 * Every subsystem that can go wrong emits through `Status.report(...)`
 * (see `store.ts`). The footer renders one pill per subsystem; the
 * worst-state subsystem's colour bleeds into the popup/sidepanel's
 * inline indicator. See ARCHITECTURE.md §25.
 *
 * The pure data shapes (`StatusSubsystem`, `StatusLevel`, `StatusEntry`,
 * `StatusSnapshot`) are host-bridge wire payloads and now live in
 * `@openheaders/core/types`; this module re-exports them and keeps the
 * UI-side render helpers + listener alias alongside.
 */

import type { StatusLevel, StatusSnapshot, StatusSubsystem } from '@openheaders/core/types';

export type { StatusEntry, StatusLevel, StatusSnapshot, StatusSubsystem } from '@openheaders/core/types';

export type StatusListener = (snapshot: StatusSnapshot) => void;

// ── Render helpers ────────────────────────────────────────────────

/** Display label for each subsystem. Kept here so the pill render and
 *  the settings/log render stay in lockstep. */
export const SUBSYSTEM_LABELS: Record<StatusSubsystem, string> = {
  sync: 'Sync',
  rules: 'Rules',
  requests: 'Requests',
  permissions: 'Permissions',
  secrets: 'Secrets',
  live: 'Live',
  activity: 'Activity',
  cdp: 'CDP',
};

/** Worst-state aggregator (red > yellow > green). Used for the compact
 *  inline pill shown in popup/sidepanel. */
export function worstLevel(snapshot: StatusSnapshot): StatusLevel {
  let worst: StatusLevel = 'green';
  for (const entry of Object.values(snapshot)) {
    if (!entry) continue;
    if (entry.state === 'red') return 'red';
    if (entry.state === 'yellow') worst = 'yellow';
  }
  return worst;
}
