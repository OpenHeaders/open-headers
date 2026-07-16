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
 *
 * This is a hot row loop — annotation copy arrives pre-resolved through
 * the stable cell context (`buildRowAnnotationMessages`), never `t()`
 * here. The popover kicker is the raw brand mark.
 */

import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { RedirectRewriteKind } from '../../data/redirect-hop-rows';
import {
  classifyRowAnnotations,
  type RowAnnotation,
  type RowAnnotationContext,
  type RowAnnotationMessages,
} from '../../data/row-annotations';

interface RowAnnotationCellProps {
  lifecycle: RequestLifecycle;
  ctx: RowAnnotationContext;
  messages: RowAnnotationMessages;
  redirectRewrite?: RedirectRewriteKind;
  onJump: (requestId: string) => void;
}

function annotationPopoverContent(
  annotations: readonly RowAnnotation[],
  messages: RowAnnotationMessages,
  onJump: () => void,
): InfoPopoverContent {
  const [top, ...rest] = annotations;
  return {
    title: messages.label(top),
    kicker: 'OpenHeaders',
    summary: messages.detail(top),
    ...(rest.length > 0
      ? {
          sections: [
            {
              heading: messages.alsoOnThisRow,
              items: rest.map((a) => ({ label: messages.label(a), desc: messages.detail(a) })),
            },
          ],
        }
      : {}),
    actions: [{ label: messages.openDetails, onClick: onJump, primary: true }],
  };
}

export function RowAnnotationCell({ lifecycle, ctx, messages, redirectRewrite, onJump }: RowAnnotationCellProps) {
  const annotations = classifyRowAnnotations(lifecycle, ctx, redirectRewrite);
  if (annotations.length === 0) return <span className="dt-col-annot" />;
  const top = annotations[0];
  const jump = () => onJump(lifecycle.requestId);
  return (
    <span className="dt-col-annot">
      <InfoPopover
        content={annotationPopoverContent(annotations, messages, jump)}
        trigger="hover"
        placement="bottomLeft"
      >
        <button
          type="button"
          className={`dt-annot-glyph dt-annot-glyph--${top.severity}`}
          aria-label={messages.label(top)}
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
