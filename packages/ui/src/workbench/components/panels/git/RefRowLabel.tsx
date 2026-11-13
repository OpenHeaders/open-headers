/**
 * RefRowLabel — a log row's ref decoration, the reference way; what the
 * labels ARE is `ref-label.ts`'s. The compact form (Show › Compact
 * References View, the default): ONE label for the row — a tag glyph
 * for everything that points at the commit, overlapped, the leading
 * one in front beside the name of the leading branch. The full form: a
 * label per branch (a branch and its same-named remote are one) and a
 * label per tag. A tag is always a glyph; its name shows only while
 * Show › Tag Names is on. Either way a hover lists every ref — HEAD
 * first on the head row — each with its own glyph. The label text is
 * the tertiary grey; a glyph's colour follows the reference's reading
 * (per-theme tokens): HEAD gold, local branches green, remote branches
 * violet, tags grey.
 *
 * The labels hold their room in the row: the subject gives way first,
 * and a label is clipped only once the subject is gone.
 */

import { TagIcon } from '@openheaders/ui/shared/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { GIT_LABEL_GLYPH_SIZE, GIT_TEXT_SIZE } from './git-type-scale';
import { orderedRefs, type RefGlyph, type RefLabel, refLabels } from './ref-label';

export interface RefRowLabelProps {
  refs: readonly WorkspaceTreeRefWire[];
  /** This row is the checked-out tip — HEAD leads its glyphs and its hover list. */
  isHead: boolean;
  /** One label with the hover list (default), or a label per branch and per tag. */
  compact?: boolean;
  /** Show › Tag Names (default on) — off, a tag is its glyph alone. */
  tagNames?: boolean;
}

const GLYPH_COLOR: Record<RefGlyph, string> = {
  head: 'var(--oh-git-ref-head)',
  local: 'var(--oh-git-ref-local)',
  remote: 'var(--oh-git-ref-remote)',
  tag: 'var(--oh-git-ref-tag)',
};

/** How many glyphs a label stacks — the leading ones; the hover list has the rest. */
const STACK_LIMIT = 3;
/** The sliver of a glyph that shows from under the one in front of it. */
const STACK_SLIVER = 6;
/** The hover list's glyphs — a step under the row's. */
const LIST_GLYPH_SIZE = 14;

const nameStyle: React.CSSProperties = { flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };

/** The glyphs of a label: the leading one whole and in front, the ones behind it as slivers to its left. */
const GlyphStack: React.FC<{ glyphs: readonly RefGlyph[] }> = ({ glyphs }) => {
  const [front, ...behind] = glyphs.slice(0, STACK_LIMIT);
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}
      data-testid="git-tool-row-ref-glyphs"
    >
      {behind.reverse().map((glyph, place) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the stack is positional — one sliver per place behind the front
          key={place}
          style={{ display: 'inline-flex', flex: '0 0 auto', width: STACK_SLIVER, overflow: 'hidden' }}
        >
          <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: GLYPH_COLOR[glyph], flex: '0 0 auto' }} />
        </span>
      ))}
      <TagIcon style={{ fontSize: GIT_LABEL_GLYPH_SIZE, color: GLYPH_COLOR[front] }} />
    </span>
  );
};

const RefRowLabel: React.FC<RefRowLabelProps> = ({ refs, isHead, compact = true, tagNames = true }) => {
  const { token } = theme.useToken();
  const labels = refLabels(refs, { isHead, compact, tagNames });
  if (labels.length === 0) return null;

  const draw = (label: RefLabel): React.ReactElement => (
    <span
      key={label.lead}
      className={label.name?.short == null ? 'git-ref-label' : 'git-ref-label git-ref-label--shortens'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flex: '0 1 auto',
        minWidth: 0,
        fontSize: GIT_TEXT_SIZE,
        color: token.colorTextTertiary,
        whiteSpace: 'nowrap',
      }}
      data-testid="git-tool-row-ref"
      data-ref={label.lead}
    >
      <GlyphStack glyphs={label.glyphs} />
      {label.name !== null && (
        <span className="git-ref-label__full" style={nameStyle}>
          {label.name.full}
        </span>
      )}
      {label.name !== null && label.name.short !== null && (
        <span className="git-ref-label__short" style={nameStyle}>
          {label.name.short}
        </span>
      )}
    </span>
  );

  const details = (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: GIT_TEXT_SIZE, padding: 2 }}
      data-testid="git-tool-ref-details"
    >
      {isHead && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} data-ref="HEAD">
          <TagIcon style={{ fontSize: LIST_GLYPH_SIZE, color: GLYPH_COLOR.head }} /> HEAD
        </span>
      )}
      {orderedRefs(refs).map((ref) => (
        <span
          key={`${ref.kind}:${ref.name}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          data-ref={ref.name}
        >
          <TagIcon style={{ fontSize: LIST_GLYPH_SIZE, color: GLYPH_COLOR[ref.kind] }} /> {ref.name}
        </span>
      ))}
    </div>
  );

  return (
    <Tooltip title={details} placement="bottomLeft" mouseEnterDelay={0.3}>
      {compact ? (
        draw(labels[0])
      ) : (
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: '0 1 auto', minWidth: 0 }}
          data-testid="git-tool-row-refs"
        >
          {labels.map(draw)}
        </span>
      )}
    </Tooltip>
  );
};

export default RefRowLabel;
