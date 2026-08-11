/**
 * RefChips — the branch/tag labels the IDE log paints in the detail
 * pane: small monospace pills for every ref pointing at a sha (plus
 * HEAD where asked). List rows use {@link RefRowLabel} instead — the
 * collapsed right-aligned label with hover details.
 */

import { BranchesOutlined, TagOutlined } from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';

export interface RefChipsProps {
  refs: readonly WorkspaceTreeRefWire[];
  /** Prepend a HEAD chip (the detail pane's `HEAD` marker). */
  showHead?: boolean;
  /** Cap rendered chips, overflowing into `+N`; omit for all. */
  max?: number;
}

const chipStyle = (token: ReturnType<typeof theme.useToken>['token']): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '0 5px',
  borderRadius: 4,
  fontSize: 10.5,
  lineHeight: '16px',
  fontFamily: token.fontFamilyCode,
  background: token.colorFillSecondary,
  color: token.colorTextSecondary,
  whiteSpace: 'nowrap',
});

const RefChips: React.FC<RefChipsProps> = ({ refs, showHead = false, max }) => {
  const { token } = theme.useToken();
  if (refs.length === 0 && !showHead) return null;
  const visible = max !== undefined ? refs.slice(0, max) : refs;
  const overflow = refs.length - visible.length;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 1 auto', minWidth: 0 }}>
      {showHead && (
        <span style={chipStyle(token)} data-testid="git-tool-ref-chip" data-ref="HEAD">
          HEAD
        </span>
      )}
      {visible.map((ref) => (
        <span
          key={`${ref.kind}:${ref.name}`}
          style={chipStyle(token)}
          title={ref.name}
          data-testid="git-tool-ref-chip"
          data-ref={ref.name}
        >
          {ref.kind === 'tag' ? <TagOutlined style={{ fontSize: 9 }} /> : <BranchesOutlined style={{ fontSize: 9 }} />}
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ref.name}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span style={chipStyle(token)} title={refs.slice(visible.length).map((ref) => ref.name).join(', ')}>
          +{overflow}
        </span>
      )}
    </span>
  );
};

export default RefChips;
