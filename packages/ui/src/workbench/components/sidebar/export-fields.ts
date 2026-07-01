/**
 * Helper for tree-node hooks that builds the `onExport` + `exportEntity`
 * pair on a TreeNode. Both fields carry the same identity, but one drives
 * the right-click "Export…" menu (single-entity flow) and the other lets
 * the sidebar's multi-select aggregator fold this node into a combined
 * export when the user cmd/ctrl-clicks across heterogeneous picks.
 */

import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
import type { TreeNode } from './types';

export function exportNodeFields(
  entity: SidebarExportEntity,
  onExportEntity: ((e: SidebarExportEntity) => void) | undefined,
): Pick<TreeNode, 'onExport' | 'exportEntity'> {
  if (!onExportEntity) return {};
  return {
    onExport: () => onExportEntity(entity),
    exportEntity: entity,
  };
}
