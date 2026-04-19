/**
 * Layout Store — SW-side serialization of workspace layout writes.
 *
 * Phase 10 — routes every layout mutation through a Web Lock so two
 * tabs dragging different panes simultaneously serialize their
 * read-modify-write at the storage boundary. Before Phase 10 the
 * renderer wrote `chrome.storage.local` directly, racing with itself
 * across tabs; ARCHITECTURE.md §13's Web Locks discipline (and plan
 * §10.2 Option A) puts the writer on the SW side like every other
 * persisted-entity store in this project.
 *
 * Layout is opaque at the SW boundary — the renderer computes ratios
 * and tool-window dock state, the SW just locks + writes. No schema
 * validation here because layout shape lives entirely in the
 * renderer's `useResponsiveLayout` / `useDockLayoutStorage` hooks.
 */

import { logger } from '@utils/logger';
import { layoutLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type PersistedPanelLayout, wsKeys } from '@/shared/storage';
import { getActiveWorkspaceId } from './workspace-store';

/**
 * Replace the active workspace's panel-layout record. Called from the
 * renderer via the `setLayout` bridge RPC. The SW doesn't introspect
 * the layout shape; it just serializes the write through the
 * workspace-scoped layout lock.
 */
export async function setPanelLayout(layout: PersistedPanelLayout): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  await withLock(
    layoutLockName(workspaceId),
    async () => {
      await extensionStorage.set(wsKeys(workspaceId).panelLayout, layout);
      logger.debug('LayoutStore', `Persisted panel layout (ws=${workspaceId})`);
    },
    { op: 'layout-set' },
  );
}
