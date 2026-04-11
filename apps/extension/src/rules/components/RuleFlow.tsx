/**
 * RuleFlow — vertical pipeline visualization of rule execution order.
 *
 * Shows how Chrome processes rules: Block → Redirect → Headers → Script-based.
 * Scope selector: This Page | Collection | Folder | All Active.
 * Supports inline rule management: toggle, reorder, add, delete, open editor.
 */

import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { isRuleComplete } from '@openheaders/core/utils';
import { Checkbox, Empty, Segmented, Space, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RuleFlowScope } from '../types';
import { Connector, Terminus } from './rule-flow/Connector';
import { ruleMatchesUrl } from './rule-flow/match-url';
import PriorityGroup, { PRIORITY_TIERS } from './rule-flow/PriorityGroup';

interface RuleFlowProps {
  scope: RuleFlowScope;
  entityId?: string;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }) => void;
}

const RuleFlow: React.FC<RuleFlowProps> = ({ scope: initialScope, entityId, onSelectRule, onCreateRule }) => {
  const { token } = theme.useToken();
  const { rules, localCollectionTrees } = useRules();
  const [scope, setScope] = useState<RuleFlowScope>(initialScope);
  const [tabUrl, setTabUrl] = useState<string>('');
  const [showDrafts, setShowDrafts] = useState(false);
  const [showDisabled, setShowDisabled] = useState(initialScope === 'collection' || initialScope === 'folder');
  const [compact, setCompact] = useState(true);

  // Fetch the active tab URL for "This Page" filtering.
  // Only useful when the active tab is a real page (not workspace.html itself).
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url ?? '';
        // Skip extension pages — "This Page" is meaningless for chrome-extension:// URLs
        if (url && !url.startsWith('chrome-extension://') && !url.startsWith('chrome://')) {
          setTabUrl(url);
        }
      });
    }
  }, []);

  // Build available scope options based on context
  const availableScopes = useMemo((): Array<{ label: string; value: RuleFlowScope }> => {
    const opts: Array<{ label: string; value: RuleFlowScope }> = [];
    // Only show "This Page" if we have a real tab URL (not when opened from workspace.html)
    if (tabUrl) {
      opts.push({ label: 'This Page', value: 'this-page' });
    }
    if (entityId) {
      const isCollection = localCollectionTrees.some((c) => c.uid === entityId);
      if (isCollection) {
        opts.push({ label: 'Collection', value: 'collection' });
      } else {
        opts.push({ label: 'Folder', value: 'folder' });
      }
    }
    opts.push({ label: 'All Active', value: 'all-active' });
    return opts;
  }, [entityId, localCollectionTrees, tabUrl]);

  // Fall back to first available scope if current scope isn't available
  useEffect(() => {
    if (availableScopes.length > 0 && !availableScopes.some((o) => o.value === scope)) {
      setScope(availableScopes[0].value);
    }
  }, [availableScopes, scope]);

  // Find the collection context for "Add Rule" functionality
  const collectionContext = useMemo(() => {
    if (!entityId) return undefined;
    // Direct collection match
    const col = localCollectionTrees.find((c) => c.uid === entityId);
    if (col) return { collectionId: col.uid, folderPath: undefined };

    // Folder match — find parent collection
    for (const col of localCollectionTrees) {
      const walk = (nodes: V5.TreeNode[]): string | null => {
        for (const n of nodes) {
          if (n.type === 'folder') {
            if (n.uid === entityId) return n.path;
            const found = walk(n.children);
            if (found) return found;
          }
        }
        return null;
      };
      const folderPath = walk(col.tree);
      if (folderPath) return { collectionId: col.uid, folderPath };
    }
    return undefined;
  }, [entityId, localCollectionTrees]);

  // Get rules for the current scope
  const scopedRules = useMemo(() => {
    let filtered: V5.Rule[];

    switch (scope) {
      case 'this-page':
        // All enabled rules that match the current tab URL
        filtered = rules.filter((r) => r.enabled && tabUrl && ruleMatchesUrl(r, tabUrl));
        break;

      case 'collection': {
        if (!entityId) return [];
        const col = localCollectionTrees.find((c) => c.uid === entityId);
        if (!col) return [];
        const ruleUids = new Set<string>();
        const collectUids = (nodes: V5.TreeNode[]) => {
          for (const n of nodes) {
            if (n.type === 'rule') ruleUids.add(n.uid);
            else if (n.type === 'folder') collectUids(n.children);
          }
        };
        collectUids(col.tree);
        filtered = rules.filter((r) => ruleUids.has(r.uid));
        break;
      }

      case 'folder': {
        if (!entityId) return [];
        const folderUids = new Set<string>();
        for (const col of localCollectionTrees) {
          const findFolder = (nodes: V5.TreeNode[]): V5.FolderNode | null => {
            for (const n of nodes) {
              if (n.type === 'folder') {
                if (n.uid === entityId) return n;
                const found = findFolder(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const folder = findFolder(col.tree);
          if (folder) {
            const collectUids = (nodes: V5.TreeNode[]) => {
              for (const n of nodes) {
                if (n.type === 'rule') folderUids.add(n.uid);
                else if (n.type === 'folder') collectUids(n.children);
              }
            };
            collectUids(folder.children);
            break;
          }
        }
        filtered = rules.filter((r) => folderUids.has(r.uid));
        break;
      }

      default:
        filtered = rules.filter((r) => r.enabled);
        break;
    }

    return filtered;
  }, [scope, rules, entityId, localCollectionTrees, tabUrl]);

  // Apply sub-filters (drafts + disabled)
  const filteredRules = useMemo(() => {
    return scopedRules.filter((r) => {
      if (!showDrafts && !isRuleComplete(r)) return false;
      if (!showDisabled && !r.enabled) return false;
      return true;
    });
  }, [scopedRules, showDrafts, showDisabled]);

  // Group rules by priority tier
  const rulesByTier = useMemo(() => {
    const map = new Map<string, V5.Rule[]>();
    for (const tier of PRIORITY_TIERS) {
      map.set(tier.key, []);
    }
    for (const rule of filteredRules) {
      const tier = PRIORITY_TIERS.find((t) => t.ruleTypes.includes(rule.type));
      if (tier) {
        map.get(tier.key)!.push(rule);
      }
    }
    return map;
  }, [filteredRules]);

  // Stats
  const totalRules = filteredRules.length;
  const activeRules = filteredRules.filter((r) => r.enabled && isRuleComplete(r)).length;
  const draftRules = filteredRules.filter((r) => !isRuleComplete(r)).length;
  const disabledRules = filteredRules.filter((r) => !r.enabled).length;
  const hiddenCount = scopedRules.length - filteredRules.length;

  // dnd-kit sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Find which tier both items belong to
      for (const tier of PRIORITY_TIERS) {
        const tierRules = rulesByTier.get(tier.key) ?? [];
        const oldIndex = tierRules.findIndex((r) => r.uid === active.id);
        const newIndex = tierRules.findIndex((r) => r.uid === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          // TODO: persist reorder — for now this is visual only
          // Would need a sortOrder field on rules or a separate ordering store
          break;
        }
      }
    },
    [rulesByTier],
  );

  const nonEmptyTiers = PRIORITY_TIERS.filter((t) => (rulesByTier.get(t.key) ?? []).length > 0);
  const showAll = scope !== 'this-page'; // "This Page" hides empty tiers

  return (
    <div className="rule-flow" data-compact={compact} style={{ height: '100%', overflowY: 'auto' }}>
      {/* Scope selector + stats */}
      <div className="rule-flow-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Space size={12} wrap>
          <Segmented
            size="small"
            value={scope}
            onChange={(v) => setScope(v as RuleFlowScope)}
            options={availableScopes}
          />
          <Space size={8}>
            <Checkbox checked={compact} onChange={(e) => setCompact(e.target.checked)} style={{ fontSize: 11 }}>
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>Compact</span>
            </Checkbox>
            <Checkbox
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              style={{ fontSize: 11 }}
            >
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>Disabled</span>
            </Checkbox>
            <Checkbox checked={showDrafts} onChange={(e) => setShowDrafts(e.target.checked)} style={{ fontSize: 11 }}>
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>Drafts</span>
            </Checkbox>
          </Space>
        </Space>
        <div className="rule-flow-stats" style={{ color: token.colorTextSecondary }}>
          <span>
            {totalRules} rule{totalRules !== 1 ? 's' : ''}
          </span>
          {activeRules > 0 && <span style={{ color: token.colorSuccess }}>{activeRules} active</span>}
          {disabledRules > 0 && <span style={{ color: token.colorTextQuaternary }}>{disabledRules} disabled</span>}
          {draftRules > 0 && <span style={{ color: token.colorTextTertiary }}>{draftRules} draft</span>}
          {hiddenCount > 0 && (
            <span style={{ color: token.colorTextQuaternary, fontSize: 10 }}>{hiddenCount} hidden</span>
          )}
          {scope === 'this-page' && tabUrl && (
            <span
              style={{
                fontSize: 10,
                color: token.colorTextQuaternary,
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tabUrl}
            >
              {tabUrl}
            </span>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div className="rule-flow-pipeline">
        {totalRules === 0 ? (
          <Empty
            description={
              scope === 'this-page'
                ? tabUrl
                  ? 'No rules match this page'
                  : 'Open a page to see matching rules'
                : 'No rules in this scope'
            }
            style={{ marginTop: 48 }}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Terminus type="start" compact={compact} />
            <Connector label="evaluate conditions" compact={compact} />

            {(showAll ? PRIORITY_TIERS : nonEmptyTiers).map((tier, i) => {
              const tierRules = rulesByTier.get(tier.key) ?? [];
              if (!showAll && tierRules.length === 0) return null;
              return (
                <div key={tier.key}>
                  <PriorityGroup
                    tier={tier}
                    rules={tierRules}
                    onSelectRule={onSelectRule}
                    onCreateRule={onCreateRule}
                    collectionId={collectionContext?.collectionId}
                    folderPath={collectionContext?.folderPath}
                    compact={compact}
                  />
                  {i < (showAll ? PRIORITY_TIERS.length : nonEmptyTiers.length) - 1 && (
                    <Connector label={i === 0 ? 'then' : undefined} compact={compact} />
                  )}
                </div>
              );
            })}

            <Connector compact={compact} />
            <Terminus type="end" compact={compact} />
          </DndContext>
        )}
      </div>
    </div>
  );
};

export default RuleFlow;
