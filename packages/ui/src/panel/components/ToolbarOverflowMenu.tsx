/**
 * ToolbarOverflowMenu — the "⋯" trigger the top toolbar folds its
 * secondary control clusters into at narrow panel widths (md tier and
 * below). The clusters render UNCHANGED inside the popover, stacked as
 * rows — each is already a self-contained control (checkbox or popover
 * trigger), so folding is pure relocation, never duplicated logic.
 *
 * The body carries `.dt-toolbar-overflow-body`, which the panel's
 * InfoPopoverContainerProvider resolver matches FIRST — so popovers
 * opened from inside (More filters, the throttle menu, info triggers)
 * portal into this body rather than the panel root. That keeps their
 * DOM inside this popover's subtree, which is what stops antd's
 * outside-click handling from closing the overflow menu the moment the
 * user interacts with a nested menu.
 */

import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Popover } from 'antd';
import { type ReactNode, useCallback } from 'react';

function IconEllipsis() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}

export function ToolbarOverflowMenu({ title, children }: { title: string; children: ReactNode }) {
  const resolveContainer = useInfoPopoverContainer();
  const getPopupContainer = useCallback(
    (triggerNode: HTMLElement) => resolveContainer?.(triggerNode) ?? document.body,
    [resolveContainer],
  );
  return (
    <Popover
      content={<div className="dt-toolbar-overflow-body">{children}</div>}
      trigger="click"
      placement="bottomLeft"
      autoAdjustOverflow={false}
      arrow={false}
      classNames={{ root: 'dt-morefilters-popover dt-toolbar-overflow-popover' }}
      {...(resolveContainer ? { getPopupContainer } : {})}
    >
      <button type="button" className="dt-toolbar-icon" title={title} aria-label={title}>
        <IconEllipsis />
      </button>
    </Popover>
  );
}
