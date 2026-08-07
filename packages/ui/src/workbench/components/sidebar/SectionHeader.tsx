import { theme } from 'antd';
import type React from 'react';
import type { TreeNode } from './types';

export function SectionHeader({
  title,
  expanded,
  onToggle,
  actions,
  testid,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  testid?: string;
}) {
  const { token } = theme.useToken();
  return (
    <div
      className="rules-sidebar-section"
      data-testid={testid}
      style={{ color: token.colorTextSecondary }}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onToggle();
      }}
      role="button"
      tabIndex={-1}
      aria-expanded={expanded}
    >
      <span className="rules-sidebar-section-title">
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            marginRight: 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        {title}
      </span>
      {actions && (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation guard for nested click handlers
        <span onClick={(e) => e.stopPropagation()} onKeyDown={() => {}}>
          {actions}
        </span>
      )}
    </div>
  );
}

/**
 * Header-styled opener for singleton sections (Vault, Package Library…):
 * one row — the node's icon plus the section-title typography — whose
 * click opens the node's editor tab directly instead of expanding a
 * caret over a single nested leaf.
 */
export function SectionOpenerRow({ title, node, selected }: { title: string; node: TreeNode; selected: boolean }) {
  const { token } = theme.useToken();
  return (
    <div
      className="rules-sidebar-section"
      data-item-id={node.id}
      style={{
        color: token.colorTextSecondary,
        backgroundColor: selected ? 'rgba(24, 144, 255, 0.08)' : undefined,
      }}
      onClick={() => node.onOpen?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') node.onOpen?.();
      }}
      role="button"
      tabIndex={-1}
    >
      <span className="rules-sidebar-section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {node.icon}
        {title}
      </span>
    </div>
  );
}
