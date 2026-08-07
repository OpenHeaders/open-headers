/**
 * Extension implementation of the `desktopLaunch` capability — the
 * explicit "Open the desktop app" gesture over the NM host's `launch`
 * verb. One `sendNativeMessage` exchange, same posture as
 * `nm-presence.ts`: extension pages hold the `nativeMessaging`
 * permission themselves, so the launch runs from the calling surface
 * with no SW relay. The host anchors WHAT it launches to its own
 * install root — nothing here names a binary, and every failure (no
 * registered host, unanchored dev layout, failed spawn) folds to
 * `{ ok: false }` for the caller's honest fallback.
 */

import { defaultSendNativeMessage, NM_HOST_NAME, type SendNativeMessage } from '../shared/nm-handoff';

export async function desktopLaunch(send?: SendNativeMessage): Promise<{ ok: boolean }> {
  const sendImpl = send ?? defaultSendNativeMessage;
  let raw: unknown;
  try {
    raw = await sendImpl(NM_HOST_NAME, { kind: 'launch' });
  } catch {
    return { ok: false };
  }
  const ok = raw !== null && typeof raw === 'object' && (raw as { ok?: unknown }).ok === true;
  return { ok };
}
