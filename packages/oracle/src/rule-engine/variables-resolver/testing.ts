// ── Test helpers ────────────────────────────────────────────────────

import { states } from './state';
import { __setSyncWarmRunner } from './sync-warm';

/** Test-only: drop every workspace's resolver state so each test starts
 *  from a clean slate. The sync-warm runner registration is also
 *  cleared so a stale scheduler hook from a prior test can't leak. */
export function __resetForTests(): void {
  states.clear();
  __setSyncWarmRunner(null);
}
