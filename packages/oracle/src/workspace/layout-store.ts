/**
 * Layout Store — per-workspace opaque panel-layout blob.
 *
 * Phase B — every write routes through the sync oracle (the renderer
 * emits envelopes directly via `applyLayoutSet`); this module owns
 * boot-time hydration only. The {@link LayoutStateCache} owns
 * `chrome.storage.local` persistence + drives the local mirror via
 * broadcast-driven re-projection.
 *
 * Layout is opaque at the SW boundary — the renderer computes ratios
 * and tool-window dock state, the SW just LWW's the whole blob. No
 * schema validation here because the layout shape lives entirely in
 * the renderer's `useResponsiveLayout` / `useDockLayoutStorage` hooks.
 */

import { logger } from '@openheaders/core/utils';
import { hostStorage, type PersistedPanelLayout, wsKeys } from '@openheaders/oracle/storage';
import { LAYOUT_STATE_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import type { LayoutStateCache } from '@openheaders/oracle/sync/layout-state-cache';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

// ── Hydration / bridge ────────────────────────────────────────────

async function readLayoutFor(workspaceId: string): Promise<PersistedPanelLayout | null> {
  const raw = await hostStorage.get(wsKeys(workspaceId).panelLayout);
  if (raw && typeof raw === 'object') return raw;
  return null;
}

/**
 * Seed the active workspace's {@link LayoutStateCache} from the
 * persisted layout blob. Idempotent — calling twice in a row replays
 * the same batch through the oracle, which dedups by mutationId.
 */
export async function bridgeLayoutStateSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<LayoutStateCache>(LAYOUT_STATE_REGISTRATION);
  if (!cache) return;
  const workspaceId = requireActiveWorkspaceId();
  const persisted = await readLayoutFor(workspaceId);
  await cache.seedFromPersistedLayout(persisted);
  logger.info('LayoutStore', `Bridged ws=${workspaceId}: ${persisted ? 'seeded' : 'empty'}`);
}
