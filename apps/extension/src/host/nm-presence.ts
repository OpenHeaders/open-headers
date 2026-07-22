/**
 * Extension implementation of the `nmHostPresence` capability — OS
 * truth for "was the desktop app ever installed on this machine".
 *
 * The probe sends one non-bootstrap message at the NM host: a spawn
 * error means no manifest/binary is registered (never installed, or
 * dev desktop without the packed binary); ANY framed answer — the
 * host's `bad-request` refusal included — proves the registered
 * binary exists and runs. No daemon dial, no token, no side effects.
 * Cached briefly: the status popover re-opens far more often than an
 * install state changes, and each probe spawns a real process.
 */

import { defaultSendNativeMessage, NM_HOST_NAME, type SendNativeMessage } from '../shared/nm-handoff';

const CACHE_TTL_MS = 30_000;

let cached: { value: boolean; at: number } | null = null;

export function resetNmPresenceForTests(): void {
  cached = null;
}

export async function nmHostPresence(send?: SendNativeMessage): Promise<boolean> {
  if (send === undefined && cached !== null && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const sendImpl = send ?? defaultSendNativeMessage;
  let present: boolean;
  try {
    await sendImpl(NM_HOST_NAME, { kind: 'presence' });
    present = true;
  } catch {
    present = false;
  }
  if (send === undefined) cached = { value: present, at: Date.now() };
  return present;
}
