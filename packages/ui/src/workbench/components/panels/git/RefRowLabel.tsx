/**
 * RefRowLabel — a log row's ref decoration, the reference way. The
 * compact form (Show › Compact References View, the default): ONE
 * label naming the row's leading ref (local branch over remote over
 * tag; HEAD alone only when nothing else points here), led by a tag
 * glyph per ref — overlapped, the leading ref's in front beside the
 * name — and a hover list of every ref, HEAD first on the head row,
 * each with its own glyph. A branch and its same-named remote on one
 * commit read as one name (`origin & feature/x`), which a narrow list
 * shortens (`../x`). The full form: every label inline in kind order
 * (local, remote, tag), HEAD first on the head row. The label text is
 * the tertiary grey; a glyph's colour follows the reference's reading
 * of the ref's kind (per-theme tokens): HEAD gold, local branches
 * green, remote branches violet, tags grey.
 *
 * The label holds its room in the row: the subject gives way first,
 * and the label is clipped only once the subject is gone.
 */

import { TagIcon } from '@openheaders/ui/shared/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { GIT_LABEL_GLYPH_SIZE, GIT_TEXT_SIZE } from './git-type-scale';
import { orderedRefs, refLabelName } from './ref-label';

export interface RefRowLabelProps {
  refs: readonly WorkspaceTreeRefWire[];
  /** This row is the checked-out tip — HEAD leads its glyphs and its hover list. */
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

/** How many glyphs a label stacks — the leading refs; the hover list has the rest. */
const STACK_LIMIT = 3;
/** The sliver of a glyph that shows from under the one in front of it. */
const STACK_SLIVER = 6;
/** The hover list's glyphs — a step under the row's. */
const LIST_GLYPH_SIZE = 14;

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

const nameStyle: React.CSSProperties = { flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };

/** The glyphs of a label: the leading ref's whole and in front, the ones behind it as slivers to its left. */
const GlyphStack: React.FC<{ colors: readonly string[] }> = ({ colors }) => {
  const [front, ...behind] = colors.slice(0, STACK_LIMIT);
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}
      data-testid="git-tool-row-ref-glyphs"
    >
      {behind.reverse().map((color, place) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the stack is positional — one sliver per place behind the front
          key={place}
          style={{ display: 'inline-flex', flex: '0 0 auto', width: STACK_SLIVER, overflow: 'hidden' }}
        >
          <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color, flex: '0 0 auto' }} />
        </span>
      ))}
      <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: front }} />
    </span>
  );
};

const RefRowLabel: React.FC<RefRowLabelProps> = ({ refs, isHead, compact = true }) => {
  const { token } = theme.useToken();
  const ordered = orderedRefs(refs);
  if (ordered.length === 0 && !isHead) return null;

  if (!compact) {
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
            <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: refColor(ref.kind), flex: '0 0 auto' }} />
            <span style={nameStyle}>{ref.name}</span>
          </span>
        ))}
      </span>
    );
  }

  const name = refLabelName(ordered) ?? { full: 'HEAD', short: null };
  // HEAD is named only when it stands alone; beside a ref it is the glyph in front.
  const colors = [...(isHead ? [HEAD_COLOR] : []), ...ordered.map((ref) => refColor(ref.kind))];

  const details = (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: GIT_TEXT_SIZE, padding: 2 }}
      data-testid="git-tool-ref-details"
    >
      {isHead && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} data-ref="HEAD">
          <TagIcon style={{ fontSize: LIST_GLYPH_SIZE, color: HEAD_COLOR }} /> HEAD
        </span>
      )}
      {ordered.map((ref) => (
        <span
          key={`${ref.kind}:${ref.name}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          data-ref={ref.name}
        >
          <TagIcon style={{ fontSize: LIST_GLYPH_SIZE, color: refColor(ref.kind) }} /> {ref.name}
        </span>
      ))}
    </div>
  );

  return (
    <Tooltip title={details} placement="bottomLeft" mouseEnterDelay={0.3}>
      <span
        className={name.short === null ? 'git-ref-label' : 'git-ref-label git-ref-label--shortens'}
        style={labelStyle(token.colorTextTertiary)}
        data-testid="git-tool-row-ref"
        data-ref={ordered[0]?.name ?? 'HEAD'}
      >
        <GlyphStack colors={colors} />
        <span className="git-ref-label__full" style={nameStyle}>
          {name.full}
        </span>
        {name.short !== null && (
          <span className="git-ref-label__short" style={nameStyle}>
            {name.short}
          </span>
        )}
      </span>
    </Tooltip>
  );
};

export default RefRowLabel;
