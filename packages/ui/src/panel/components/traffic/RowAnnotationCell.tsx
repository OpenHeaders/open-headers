/**
 * The OH annotation rail cell — the always-on column (sibling of the
 * rule-fire dot rail) that carries per-row annotation glyphs for what OH
 * knows beyond what the Chrome-parity columns show. Blank for rows with
 * nothing to say.
 *
 * One glyph per row — the highest-severity annotation (the classifier
 * returns them `warn`-first). Hover opens the shared info popover (the
 * same idiom as the column-header (i)) enumerating every annotation on
 * the row; click jumps to the detail pane, where the same annotations
 * render as insight cards.
 */

import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { classifyRowAnnotations, type RowAnnotation, type RowAnnotationContext } from '../../data/row-annotations';

interface RowAnnotationCellProps {
  lifecycle: RequestLifecycle;
  ctx: RowAnnotationContext;
  onJump: (requestId: string) => void;
}

function annotationPopoverContent(annotations: readonly RowAnnotation[], onJump: () => void): InfoPopoverContent {
  const [top, ...rest] = annotations;
  return {
    title: top.label,
    kicker: 'OpenHeaders',
    summary: top.detail,
    ...(rest.length > 0
      ? {
          sections: [
            {
              heading: 'Also on this row',
              items: rest.map((a) => ({ label: a.label, desc: a.detail })),
            },
          ],
        }
      : {}),
    actions: [{ label: 'Open details', onClick: onJump, primary: true }],
  };
}

export function RowAnnotationCell({ lifecycle, ctx, onJump }: RowAnnotationCellProps) {
  const annotations = classifyRowAnnotations(lifecycle, ctx);
  if (annotations.length === 0) return <span className="dt-col-annot" />;
  const top = annotations[0];
  const jump = () => onJump(lifecycle.requestId);
  return (
    <span className="dt-col-annot">
      <InfoPopover content={annotationPopoverContent(annotations, jump)} trigger="hover" placement="bottomLeft">
        <button
          type="button"
          className={`dt-annot-glyph dt-annot-glyph--${top.severity}`}
          aria-label={top.label}
          onClick={(e) => {
            e.stopPropagation();
            jump();
          }}
        >
          {top.severity === 'warn' ? '⚠' : 'ℹ'}
        </button>
      </InfoPopover>
    </span>
  );
}
