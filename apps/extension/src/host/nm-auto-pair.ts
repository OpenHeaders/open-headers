/**
 * Extension implementation of the `nmAutoPair` capability
 * (the observability plan Phase 7) — the wizard's explicit
 * pair-without-a-code gesture over the shared NM handoff primitive.
 *
 * Extension pages hold the same `nativeMessaging` permission as the
 * service worker, so the exchange runs from the calling surface with no
 * SW relay — same posture as `pairWithCode`. The install id is hydrated
 * here (idempotent, storage-backed) so a wizard-minted token still
 * scopes the daemon's rotation hygiene; identity is never claimed by
 * it — the daemon verifies the caller from OS truth regardless.
 */

import type { NmAutoPairResult } from '@openheaders/core/capabilities';
import { hydrateSyncInstallId, peekSyncInstallId } from '../background/modules/sync-install-id';
import { performNmHandoff, type SendNativeMessage } from '../shared/nm-handoff';

export async function nmAutoPair(input: { readonly url: string }, send?: SendNativeMessage): Promise<NmAutoPairResult> {
  await hydrateSyncInstallId();
  return performNmHandoff(input.url, peekSyncInstallId(), send);
}
