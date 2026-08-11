/**
 * RefRowLabel — a log row's ref decoration, the IDE way: ONE
 * right-aligned tag-shaped label naming the row's most relevant ref
 * (local branch over remote over tag; HEAD alone only when nothing
 * else points here), a stacked double-tag glyph when the sha carries
 * more labels, and a hover popup listing every ref — HEAD first on the
 * head row — each with its own icon. Label colors follow the IDE's
 * palette: branches green, tags and HEAD yellow (token-mapped so both
 * themes hold).
 */

import { TagOutlined } from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme, Tooltip } from 'antd';
import type React from 'react';

export interface RefRowLabelProps {
  refs: readonly WorkspaceTreeRefWire[];
  /** This row is the checked-out tip — HEAD leads its hover details. */
  isHead: boolean;
}

const refColor = (
  kind: WorkspaceTreeRefWire['kind'],
  token: ReturnType<typeof theme.useToken>['token'],
): string => (kind === 'tag' ? token.colorWarning : token.colorSuccess);

const RefRowLabel: React.FC<RefRowLabelProps> = ({ refs, isHead }) => {
  const { token } = theme.useToken();
  const primary = refs.find((ref) => ref.kind === 'local') ?? refs.find((ref) => ref.kind === 'remote') ?? refs[0];
  if (primary === undefined && !isHead) return null;

  const label = primary?.name ?? 'HEAD';
  const labelColor = primary !== undefined ? refColor(primary.kind, token) : token.colorWarning;
  // Labels beyond the named one — the stacked back tag says "more here".
  const extraCount = (primary !== undefined ? refs.length - 1 : 0) + (isHead && primary !== undefined ? 1 : 0);
  const backColor =
    isHead && primary !== undefined
      ? token.colorWarning
      : (() => {
          const second = refs.find((ref) => ref !== primary);
          return second !== undefined ? refColor(second.kind, token) : labelColor;
        })();

  const glyph =
    extraCount > 0 ? (
      <span style={{ position: 'relative', display: 'inline-flex', width: 14, height: 12, flex: '0 0 auto' }}>
        <TagOutlined style={{ fontSize: 10, position: 'absolute', left: 3, top: 0, color: backColor, opacity: 0.85 }} />
        <TagOutlined style={{ fontSize: 10, position: 'absolute', left: 0, top: 2, color: labelColor }} />
      </span>
    ) : (
      <TagOutlined style={{ fontSize: 10, color: labelColor, flex: '0 0 auto' }} />
    );

  const details = (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, padding: 2 }}
      data-testid="git-tool-ref-details"
    >
      {isHead && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} data-ref="HEAD">
          <TagOutlined style={{ fontSize: 11, color: token.colorWarning }} /> HEAD
        </span>
      )}
      {refs.map((ref) => (
        <span
          key={`${ref.kind}:${ref.name}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          data-ref={ref.name}
        >
          <TagOutlined style={{ fontSize: 11, color: refColor(ref.kind, token) }} /> {ref.name}
        </span>
      ))}
    </div>
  );

  return (
    <Tooltip title={details} placement="bottom" mouseEnterDelay={0.3}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flex: '0 1 auto',
          minWidth: 0,
          fontSize: 11.5,
          color: token.colorTextSecondary,
          whiteSpace: 'nowrap',
        }}
        data-testid="git-tool-row-ref"
        data-ref={label}
      >
        {glyph}
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </span>
    </Tooltip>
  );
};

export default RefRowLabel;
