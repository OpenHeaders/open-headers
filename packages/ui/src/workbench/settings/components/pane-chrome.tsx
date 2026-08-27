/**
 * Pane chrome — the settings-page anatomy every category shares: the
 * padded body, the page header (label + description), and the section
 * header with its 16px-indented rows. `CategoryPane` renders schema
 * rows through it; custom panes that carry non-schema blocks (the Git
 * pages) compose the same pieces so the two read identically.
 */

import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import type { ReactNode } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { categoryPath } from '../localize';
import type { CategoryDef } from '../types';

export const Pane: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div style={{ padding: '14px 18px 20px' }}>{children}</div>
);

/** The page title: the category's path from its root, `›`-separated. */
export const PaneTitle: React.FC<{ category: CategoryDef }> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const segments = categoryPath(category, t);
  return (
    <h2
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0 8px',
        margin: 0,
        fontSize: 13,
        fontWeight: 600,
        color: token.colorText,
        letterSpacing: -0.1,
      }}
    >
      {segments.map((segment, i) => (
        <span key={segment} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && (
            <span aria-hidden style={{ fontSize: 11, fontWeight: 400, color: token.colorTextTertiary }}>
              ›
            </span>
          )}
          {segment}
        </span>
      ))}
    </h2>
  );
};

/**
 * The header of a page that carries settings: title only, then a blank
 * row. The category description belongs to landing pages (children,
 * no settings of their own — `GroupLandingPane`), IntelliJ-style.
 */
export const PaneHeader: React.FC<{ category: CategoryDef }> = ({ category }) => (
  <header style={{ marginBottom: 20 }}>
    <PaneTitle category={category} />
  </header>
);

/**
 * One section: a row-label-styled header over a rule, rows indented
 * beneath. No title → rows flush. With `onToggle` the header is a
 * button that folds the rows away (caret in front, `aria-expanded`).
 */
export const PaneSection: React.FC<{
  title?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}> = ({ title, collapsed = false, onToggle, children }) => {
  const { token } = theme.useToken();
  const titleStyle = { margin: 0, fontSize: 13, fontWeight: 400, color: token.colorText, flex: 'none' } as const;
  return (
    <section style={{ marginBottom: 14 }}>
      {title !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}>
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                ...titleStyle,
              }}
            >
              {collapsed ? (
                <RightOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
              ) : (
                <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
              )}
              {title}
            </button>
          ) : (
            <h3 style={titleStyle}>{title}</h3>
          )}
          <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
        </div>
      )}
      {!collapsed && <div style={title !== undefined ? { paddingLeft: 16 } : undefined}>{children}</div>}
    </section>
  );
};
