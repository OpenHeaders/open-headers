/**
 * CollectionOverviewShell — shared layout for every collection-family
 * overview tab (rule / request / template).
 *
 * Three families have distinct entity shapes (rules carry enabled/draft
 * state, requests carry method, templates carry ruleType-as-icon) and
 * distinct action sets (Add Rule menu vs Add Request vs no-add for
 * templates), so the per-family overview components own their own
 * stats walks, action rows, and tables. Everything they share — the
 * outer padding/scroll, the description block, the "Contents" caption,
 * and the empty-state call-to-action positioning — lives here.
 *
 * Kept deliberately thin: the per-family components compose the inner
 * pieces; the shell is the layout primitive, not a god-component.
 */

import { Empty, theme } from 'antd';
import type React from 'react';

interface CollectionOverviewShellProps {
  /** Tag-row at the top — counts + status pills. */
  statsBar: React.ReactNode;
  /** Quick-action buttons row. Pass an empty fragment if the family has none. */
  actions: React.ReactNode;
  /** Optional description from the collection — rendered above the contents block. */
  description?: string | null;
  /** Contents table (or whatever the family chooses to render). */
  contents: React.ReactNode;
  /** When true, the shell renders an "X not found" empty state instead of children. */
  notFound?: boolean;
  /** Empty-state copy when `notFound` is true. */
  notFoundLabel?: string;
}

const CollectionOverviewShell: React.FC<CollectionOverviewShellProps> = ({
  statsBar,
  actions,
  description,
  contents,
  notFound,
  notFoundLabel = 'Collection not found',
}) => {
  const { token } = theme.useToken();
  if (notFound) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={notFoundLabel} />
      </div>
    );
  }
  return (
    <div style={{ padding: '24px 32px', maxWidth: 720, overflowY: 'auto', overscrollBehavior: 'none', height: '100%' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {statsBar}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>{actions}</div>
      {description ? (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: token.colorTextTertiary,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Description
          </div>
          <div style={{ fontSize: 13, color: token.colorTextSecondary, lineHeight: 1.6 }}>{description}</div>
        </div>
      ) : null}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: token.colorTextTertiary,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Contents
      </div>
      {contents}
    </div>
  );
};

export default CollectionOverviewShell;
