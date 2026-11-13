/**
 * RefRowLabel — a log row's ref decoration, the reference way. The
 * compact form (Show › Compact References View, the default): ONE
 * right-aligned tag-shaped label naming the row's most relevant ref
 * (local branch over remote over tag; HEAD alone only when nothing
 * else points here), a stacked double-tag glyph when the sha carries
 * more labels, and a hover popup listing every ref — HEAD first on the
 * head row — each with its own icon. The full form: every label inline
 * in kind order (local, remote, tag), HEAD first on the head row, each
 * with its own icon. The label text is the tertiary grey; the icon
 * colour follows the reference's reading of the ref's kind (per-theme
 * tokens): the checked-out branch and HEAD gold, local branches green,
 * remote branches violet, tags grey.
 */

import { TagIcon } from '@openheaders/ui/shared/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { GIT_LABEL_GLYPH_SIZE, GIT_TEXT_SIZE } from './git-type-scale';

export interface RefRowLabelProps {
  refs: readonly WorkspaceTreeRefWire[];
  /** This row is the checked-out tip — HEAD leads its hover details. */
  isHead: boolean;
  /** One label with the hover list (default), or every label inline. */
  compact?: boolean;
}

const HEAD_COLOR = 'var(--oh-git-ref-head)';

const refColor = (kind: WorkspaceTreeRefWire['kind']): string => {
  if (kind === 'tag') return 'var(--oh-git-ref-tag)';
  if (kind === 'remote') return 'var(--oh-git-ref-remote)';
  return 'var(--oh-git-ref-local)';
};

/** The named label's colour — the checked-out branch reads gold on its own row. */
const labelColorFor = (primary: WorkspaceTreeRefWire | undefined, isHead: boolean): string => {
  if (primary === undefined) return HEAD_COLOR;
  return isHead && primary.kind === 'local' ? HEAD_COLOR : refColor(primary.kind);
};

const KIND_ORDER: Record<WorkspaceTreeRefWire['kind'], number> = { local: 0, remote: 1, tag: 2 };

const labelStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flex: '0 1 auto',
  minWidth: 0,
  fontSize: GIT_TEXT_SIZE,
  color,
  whiteSpace: 'nowrap',
});

const RefRowLabel: React.FC<RefRowLabelProps> = ({ refs, isHead, compact = true }) => {
  const { token } = theme.useToken();
  const primary = refs.find((ref) => ref.kind === 'local') ?? refs.find((ref) => ref.kind === 'remote') ?? refs[0];
  if (primary === undefined && !isHead) return null;

  if (!compact) {
    const ordered = [...refs].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 1 auto', minWidth: 0 }}
        data-testid="git-tool-row-refs"
      >
        {isHead && (
          <span style={labelStyle(token.colorTextTertiary)} data-testid="git-tool-row-ref" data-ref="HEAD">
            <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: HEAD_COLOR, flex: '0 0 auto' }} />
            <span>HEAD</span>
          </span>
        )}
        {ordered.map((ref) => (
          <span
            key={`${ref.kind}:${ref.name}`}
            style={labelStyle(token.colorTextTertiary)}
            data-testid="git-tool-row-ref"
            data-ref={ref.name}
          >
            <TagIcon
              style={{
                fontSize: GIT_LABEL_GLYPH_SIZE,
                color: ref === primary ? labelColorFor(primary, isHead) : refColor(ref.kind),
                flex: '0 0 auto',
              }}
            />
            <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ref.name}</span>
          </span>
        ))}
      </span>
    );
  }

  const label = primary?.name ?? 'HEAD';
  const labelColor = labelColorFor(primary, isHead);
  // Labels beyond the named one — the stacked back tag says "more here".
  const extraCount = (primary !== undefined ? refs.length - 1 : 0) + (isHead && primary !== undefined ? 1 : 0);
  const backColor =
    isHead && primary !== undefined
      ? HEAD_COLOR
      : (() => {
          const second = refs.find((ref) => ref !== primary);
          return second !== undefined ? refColor(second.kind) : labelColor;
        })();

  // Side-by-side tags, the extra label's color first so the named
  // ref's tag sits beside its name.
  const glyph =
    extraCount > 0 ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
        <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: backColor }} />
        <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: labelColor }} />
      </span>
    ) : (
      <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: labelColor, flex: '0 0 auto' }} />
    );

  const details = (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, padding: 2 }}
      data-testid="git-tool-ref-details"
    >
      {isHead && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} data-ref="HEAD">
          <TagIcon style={{ fontSize: 11, color: HEAD_COLOR }} /> HEAD
        </span>
      )}
      {refs.map((ref) => (
        <span
          key={`${ref.kind}:${ref.name}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          data-ref={ref.name}
        >
          <TagIcon style={{ fontSize: 11, color: refColor(ref.kind) }} /> {ref.name}
        </span>
      ))}
    </div>
  );

  return (
    <Tooltip title={details} placement="bottom" mouseEnterDelay={0.3}>
      <span style={labelStyle(token.colorTextTertiary)} data-testid="git-tool-row-ref" data-ref={label}>
        {glyph}
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </span>
    </Tooltip>
  );
};

export default RefRowLabel;
