/**
 * Row renders for {@link SaveToCollectionModal}'s collection/folder
 * browser — the collection list at root and the folder + rule rows
 * inside a collection. Pure factories rebuilt every render (as the
 * inline `.map` blocks were); focus/hover styling keys off the ids the
 * keyboard-nav hook tracks (`col-<uid>` / `fld-<uid>`).
 */

import { FolderOpenOutlined, FolderOutlined, RightOutlined } from '@ant-design/icons';
import type { Collection, Rule, TreeNode } from '@openheaders/core/types';
import { isRuleComplete } from '@openheaders/core/utils';
import type { GlobalToken } from 'antd/es/theme/interface';
import { buildRuleIcon } from '../shared/rule-icon';

export interface CollectionRowsOptions {
  filteredCollections: Collection[];
  effectiveFocusId: string | null;
  token: GlobalToken;
  setSelectedCollectionId: (id: string | null) => void;
  setSearch: (search: string) => void;
  setFocusedId: (id: string | null) => void;
}

export function renderCollectionRows({
  filteredCollections,
  effectiveFocusId,
  token,
  setSelectedCollectionId,
  setSearch,
  setFocusedId,
}: CollectionRowsOptions) {
  return filteredCollections.map((col) => {
    const rowId = `col-${col.uid}`;
    const isFocused = rowId === effectiveFocusId;
    return (
      <div
        key={col.uid}
        data-row-id={rowId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 12,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: isFocused ? token.colorPrimaryBg : undefined,
        }}
        onClick={() => {
          setSelectedCollectionId(col.uid);
          setSearch('');
          setFocusedId(null);
        }}
        onMouseEnter={(e) => {
          setFocusedId(rowId);
          if (!isFocused) (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
        }}
        onMouseLeave={(e) => {
          if (!isFocused) (e.currentTarget as HTMLElement).style.background = '';
        }}
        role="option"
        aria-selected={isFocused}
        tabIndex={-1}
      >
        <FolderOpenOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
        <span style={{ flex: 1, color: token.colorText }}>{col.name}</span>
        <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
      </div>
    );
  });
}

export interface NodeRowsOptions {
  filteredCurrentNodes: TreeNode[];
  effectiveFocusId: string | null;
  token: GlobalToken;
  setSelectedFolderPath: (path: string | undefined) => void;
  setCreatingFolder: (creating: boolean) => void;
  setFocusedId: (id: string | null) => void;
  rules?: Rule[];
  pausedUids?: Set<string>;
  unresolvableRuleUids?: Set<string>;
}

export function renderNodeRows({
  filteredCurrentNodes,
  effectiveFocusId,
  token,
  setSelectedFolderPath,
  setCreatingFolder,
  setFocusedId,
  rules,
  pausedUids,
  unresolvableRuleUids,
}: NodeRowsOptions) {
  return filteredCurrentNodes.map((node) => {
    if (node.type === 'folder') {
      const rowId = `fld-${node.uid}`;
      const isFocused = rowId === effectiveFocusId;
      return (
        <div
          key={node.uid}
          data-row-id={rowId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: isFocused ? token.colorPrimaryBg : undefined,
          }}
          onClick={() => {
            setSelectedFolderPath(node.path);
            setCreatingFolder(false);
            setFocusedId(null);
          }}
          onMouseEnter={(e) => {
            setFocusedId(rowId);
            if (!isFocused) (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
          }}
          onMouseLeave={(e) => {
            if (!isFocused) (e.currentTarget as HTMLElement).style.background = '';
          }}
          role="option"
          aria-selected={isFocused}
          tabIndex={-1}
        >
          <FolderOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
          <span style={{ flex: 1, color: token.colorText }}>{node.name}</span>
          <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
        </div>
      );
    }
    if (node.type === 'rule') {
      // Mirror the sidebar's stateful icon: arrow (direction) +
      // color (active/draft) computed from the full rule, same
      // predicates as `useRulesTreeNodes`.
      const fullRule = rules?.find((r) => r.uid === node.uid);
      const complete = fullRule ? isRuleComplete(fullRule) : true;
      const paused = pausedUids?.has(node.uid) ?? false;
      const unresolved = complete && (unresolvableRuleUids?.has(node.uid) ?? false);
      const isActive = node.enabled && complete && !paused && !unresolved;
      return (
        <div
          key={node.uid}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            fontSize: 12,
            color: token.colorTextSecondary,
          }}
        >
          {buildRuleIcon({ ruleType: node.ruleType, rule: fullRule, isActive, paused })}
          <span>{node.name}</span>
        </div>
      );
    }
    return null;
  });
}
