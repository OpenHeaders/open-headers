import { theme } from 'antd';
import type React from 'react';
import type { TreeNode } from './types';

/** A header's leading slot: its clicks are its own — they neither fold the section nor open the row. */
function Leading({ children }: { children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation guard for nested click handlers
    <span style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()} onKeyDown={() => {}}>
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  expanded,
  onToggle,
  leading,
  actions,
  testid,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  /** Between the fold mark and the title — the Commit tree's checkbox. */
  leading?: React.ReactNode;
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
      <span
        className="rules-sidebar-section-title"
        style={leading ? { display: 'inline-flex', alignItems: 'center', gap: 4 } : undefined}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            marginRight: leading ? 0 : 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        {leading && <Leading>{leading}</Leading>}
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
 * caret over a single nested leaf. `actions` sit at the row's end, as a
 * section header's do. The title wears the node's `labelColor`, as a
 * tree row's name does.
 */
export function SectionOpenerRow({
  title,
  node,
  selected,
  leading,
  actions,
}: {
  title: string;
  node: TreeNode;
  selected: boolean;
  /** Ahead of the icon — the Commit tree's checkbox. */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div
      className={`rules-sidebar-section${selected ? ' rules-sidebar-section--selected' : ''}`}
      data-item-id={node.id}
      style={{ color: token.colorTextSecondary }}
      onClick={() => node.onOpen?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') node.onOpen?.();
      }}
      role="button"
      tabIndex={-1}
    >
      <span className="rules-sidebar-section-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {leading && <Leading>{leading}</Leading>}
        {node.icon}
        {node.labelColor ? <span style={{ color: node.labelColor }}>{title}</span> : title}
      </span>
      {actions}
    </div>
  );
}
