/**
 * Tree-record model for CollectionManager — projects collection trees +
 * rules + pause markers into the antd tree-table's row records, plus the
 * pure tree walks the table shell needs (filter, key collection,
 * expanded-state flattening).
 */

import type { CollectionTree, Rule, RuleCondition, RuleType, TreeNode } from '@openheaders/core/types';
import type { PauseMarkers } from '@openheaders/core/utils';
import { type ActionDetail, getActionDetail, isRuleComplete, isRuleDraft } from '@openheaders/core/utils';
import type { VariableResolver } from '@openheaders/core/variables';
import { resolveRule } from '@openheaders/core/variables';
import type React from 'react';

export interface CollectionTreeRecord {
  key: string;
  uid: string;
  path: string;
  name: string;
  nodeType: 'collection' | 'folder' | 'rule';
  ruleType?: RuleType;
  actionDetail?: ActionDetail;
  domains?: string[];
  conditions?: RuleCondition[];
  isEnabled?: boolean;
  isComplete?: boolean;
  /** True for unpublished rules — derived from `isRuleDraft(rule)`.
   *  Drives the gray "draft" row styling (publication gate, separate
   *  from `isComplete`'s data-shape validity signal). */
  isDraft?: boolean;
  ruleCount?: number;
  enabledCount?: number;
  /** True if this node is effectively paused after marker resolution. */
  effectivelyPaused: boolean;
  /** True if this node has its own marker (regardless of value). */
  hasOwnMarker: boolean;
  children?: CollectionTreeRecord[];
}

function countRules(nodes: TreeNode[]): { total: number; enabled: number } {
  let total = 0;
  let enabled = 0;
  for (const node of nodes) {
    if (node.type === 'rule') {
      total++;
      if (node.enabled) enabled++;
    } else if (node.type === 'folder') {
      const sub = countRules(node.children);
      total += sub.total;
      enabled += sub.enabled;
    }
  }
  return { total, enabled };
}

/**
 * Resolve the effective pause state for one node given its own marker and
 * the inherited state from its ancestors. Mirrors the closest-specifier
 * walk in `resolvePauseState` but is cheaper here because we already
 * carry `inherited` down the tree as we recurse.
 */
function resolveNodeState(
  path: string,
  pauseMarkers: PauseMarkers,
  inherited: boolean,
): { effective: boolean; hasOwn: boolean } {
  const marker = pauseMarkers.get(path);
  if (marker === 'paused') return { effective: true, hasOwn: true };
  if (marker === 'unpaused') return { effective: false, hasOwn: true };
  return { effective: inherited, hasOwn: false };
}

function treeNodesToRecords(
  nodes: TreeNode[],
  rules: Rule[],
  pauseMarkers: PauseMarkers,
  inherited: boolean,
  resolver: VariableResolver,
): CollectionTreeRecord[] {
  return nodes.map((node) => {
    const { effective, hasOwn } = resolveNodeState(node.path, pauseMarkers, inherited);
    if (node.type === 'rule') {
      const rule = rules.find((r) => r.uid === node.uid);
      // Resolve `{{var}}` templates so the row's display reflects what
      // reaches the wire. Completeness checks still use the unresolved
      // rule (structural property).
      const resolved = rule ? resolveRule(rule, resolver) : null;
      return {
        key: node.uid,
        uid: node.uid,
        path: node.path,
        name: node.name,
        nodeType: 'rule' as const,
        ruleType: node.ruleType,
        actionDetail: resolved
          ? getActionDetail(resolved)
          : { ruleType: node.ruleType, label: '', value: '', tooltip: '' },
        domains: resolved
          ? resolved.conditions.filter((c) => c.type === 'request-domains').flatMap((c) => c.values)
          : [],
        conditions: resolved?.conditions ?? [],
        isEnabled: node.enabled,
        isComplete: rule ? isRuleComplete(rule) : true,
        isDraft: rule ? isRuleDraft(rule) : false,
        effectivelyPaused: effective,
        hasOwnMarker: hasOwn,
      };
    }
    if (node.type === 'folder') {
      const { total, enabled } = countRules(node.children);
      const children = treeNodesToRecords(node.children, rules, pauseMarkers, effective, resolver);
      return {
        key: node.uid,
        uid: node.uid,
        path: node.path,
        name: node.name,
        nodeType: 'folder' as const,
        ruleCount: total,
        enabledCount: enabled,
        effectivelyPaused: effective,
        hasOwnMarker: hasOwn,
        children: children.length > 0 ? children : undefined,
      };
    }
    return {
      key: node.uid,
      uid: node.uid,
      path: node.path,
      name: node.name,
      nodeType: 'rule' as const,
      effectivelyPaused: effective,
      hasOwnMarker: hasOwn,
    };
  });
}

export function collectionTreesToRecords(
  trees: CollectionTree[],
  rules: Rule[],
  pauseMarkers: PauseMarkers,
  resolver: VariableResolver,
): CollectionTreeRecord[] {
  return trees.map((tree) => {
    const { effective, hasOwn } = resolveNodeState(tree.path, pauseMarkers, false);
    const { total, enabled } = countRules(tree.tree);
    const children = treeNodesToRecords(tree.tree, rules, pauseMarkers, effective, resolver);
    return {
      key: tree.uid,
      uid: tree.uid,
      path: tree.path,
      name: tree.name,
      nodeType: 'collection' as const,
      ruleCount: total,
      enabledCount: enabled,
      effectivelyPaused: effective,
      hasOwnMarker: hasOwn,
      children: children.length > 0 ? children : undefined,
    };
  });
}

export function filterTree(records: CollectionTreeRecord[], query: string): CollectionTreeRecord[] {
  const q = query.toLowerCase();
  return records
    .map((record) => {
      const nameMatch = record.name.toLowerCase().includes(q);
      if (record.children) {
        const filteredChildren = filterTree(record.children, query);
        if (nameMatch || filteredChildren.length > 0) {
          return { ...record, children: nameMatch ? record.children : filteredChildren };
        }
        return null;
      }
      if (nameMatch) return record;
      if (record.domains?.some((d) => d.toLowerCase().includes(q))) return record;
      if (record.ruleType?.toLowerCase().includes(q)) return record;
      return null;
    })
    .filter((r): r is CollectionTreeRecord => r !== null);
}

export function countAllRulesInRecords(records: CollectionTreeRecord[]): number {
  let count = 0;
  for (const r of records) {
    if (r.nodeType === 'rule') count++;
    if (r.children) count += countAllRulesInRecords(r.children);
  }
  return count;
}

/** Collect all expandable keys from the tree. */
export function collectAllKeys(records: CollectionTreeRecord[]): string[] {
  const keys: string[] = [];
  for (const r of records) {
    if (r.children) {
      keys.push(r.key);
      keys.push(...collectAllKeys(r.children));
    }
  }
  return keys;
}

/**
 * Flatten the tree into a list of all visible rows, respecting expanded state.
 * This matches exactly what Ant Design renders in the DOM.
 */
export function flattenVisible(
  records: CollectionTreeRecord[],
  expandedSet: ReadonlySet<React.Key>,
): CollectionTreeRecord[] {
  const result: CollectionTreeRecord[] = [];
  for (const record of records) {
    result.push(record);
    if (record.children && expandedSet.has(record.key)) {
      result.push(...flattenVisible(record.children, expandedSet));
    }
  }
  return result;
}
