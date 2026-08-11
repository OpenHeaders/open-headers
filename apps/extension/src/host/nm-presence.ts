/**
 * Extension implementation of the `nmHostPresence` capability — OS
 * truth for "was the desktop app ever installed on this machine", and
 * whether that install could actually be launched.
 *
 * The probe sends one `presence` message at the NM host: a spawn error
 * means no manifest/binary is registered (never installed, or dev
 * desktop without the packed binary); ANY framed answer proves the
 * registered binary exists and runs. A host with the `presence` verb
 * also reports `anchored` — whether its `launch` verb would open an
 * app (a dev-layout host answers `anchored: false`); only that
 * explicit refusal demotes, because a packaged host predating the verb
 * answers `bad-request` with no field and is anchored by construction
 * (it ships inside the app bundle). No daemon dial, no token, no side
 * effects. Cached briefly: the status popover re-opens far more often
 * than an install state changes, and each probe spawns a real process.
 */

import type { NmHostPresenceVerdict } from '@openheaders/core/capabilities';
import { defaultSendNativeMessage, NM_HOST_NAME, type SendNativeMessage } from '../shared/nm-handoff';

const CACHE_TTL_MS = 30_000;

let cached: { value: NmHostPresenceVerdict; at: number } | null = null;

export function resetNmPresenceForTests(): void {
  cached = null;
}

export async function nmHostPresence(send?: SendNativeMessage): Promise<NmHostPresenceVerdict> {
  if (send === undefined && cached !== null && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const sendImpl = send ?? defaultSendNativeMessage;
  let verdict: NmHostPresenceVerdict;
  try {
    const raw = await sendImpl(NM_HOST_NAME, { kind: 'presence' });
    const anchored = !(raw !== null && typeof raw === 'object' && (raw as { anchored?: unknown }).anchored === false);
    verdict = { present: true, anchored };
  } catch {
    verdict = { present: false, anchored: false };
  }
  if (send === undefined) cached = { value: verdict, at: Date.now() };
  return verdict;
}
