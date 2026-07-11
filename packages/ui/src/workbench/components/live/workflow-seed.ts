/**
 * Pure helpers for seeding a Live Workflow draft from the request
 * tree ("Create Workflow…" on a collection / folder row). The sidebar
 * hands the container's `TreeNode[]` subtree to the picker modal;
 * these walk it depth-first so seed order — and therefore step order
 * in the draft — always matches the sidebar's visual order.
 */

import type { TreeNode } from '@openheaders/core/types';
import type { WorkflowSeedStep } from '../../types';

/**
 * Collect the request nodes under `tree` in depth-first (sidebar)
 * order as workflow seed steps. When `selectedUids` is given, only
 * requests in the set are kept — tree order still decides the result
 * order, not the selection's insertion order.
 */
export function collectRequestSeeds(tree: readonly TreeNode[], selectedUids?: ReadonlySet<string>): WorkflowSeedStep[] {
  const seeds: WorkflowSeedStep[] = [];
  for (const node of tree) {
    if (node.type === 'request') {
      if (selectedUids && !selectedUids.has(node.uid)) continue;
      seeds.push({ requestUid: node.uid, requestName: node.name, method: node.method });
    } else if (node.type === 'folder') {
      seeds.push(...collectRequestSeeds(node.children, selectedUids));
    }
  }
  return seeds;
}
