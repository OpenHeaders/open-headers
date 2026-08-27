/**
 * Pane chrome — the settings-page anatomy every category shares: the
 * padded body, the page header (label + description), and the section
 * header with its 16px-indented rows. `CategoryPane` renders schema
 * rows through it; custom panes that carry non-schema blocks (the Git
 * pages) compose the same pieces so the two read identically.
 */

import { theme } from 'antd';
import type React from 'react';
import type { ReactNode } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { resolveLabel, resolveOptionalDescription } from '../localize';
import type { CategoryDef } from '../types';

export const Pane: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div style={{ padding: '14px 18px 20px' }}>{children}</div>
);

export const PaneHeader: React.FC<{ category: CategoryDef }> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const description = resolveOptionalDescription(category, t);
  return (
    <header style={{ marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
        {resolveLabel(category, t)}
      </h2>
      {description && (
        <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>{description}</p>
      )}
    </header>
  );
};

/** One section: a row-label-styled header over a rule, rows indented beneath. No title → rows flush. */
export const PaneSection: React.FC<{ title?: string; children: ReactNode }> = ({ title, children }) => {
  const { token } = theme.useToken();
  return (
    <section style={{ marginBottom: 14 }}>
      {title !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 400, color: token.colorText, flex: 'none' }}>{title}</h3>
          <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
        </div>
      )}
      <div style={title !== undefined ? { paddingLeft: 16 } : undefined}>{children}</div>
    </section>
  );
};
