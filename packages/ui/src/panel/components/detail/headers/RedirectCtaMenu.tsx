import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Popover } from 'antd';
import { useCallback, useState } from 'react';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';

/**
 * `Redirect ▾` CTA — one primary button for every redirect-seeding
 * variant. The variants share a rule type and a popover; only the seeded
 * target differs, so they are menu entries rather than sibling CTAs:
 * the row spends one slot per ACTION KIND, and seeding strategies are
 * chosen at decision time, where each option can explain itself.
 *
 * Every entry opens the create popover anchored to THIS trigger button
 * (not the menu item — the menu unmounts on close, and the popover's
 * placement anchors once).
 */
export function RedirectCtaMenu({
  onCreateRedirect,
  onCreateReplaceHost,
  onCreateLocalhost,
}: {
  onCreateRedirect: (anchorEl: HTMLElement) => void;
  onCreateReplaceHost: (anchorEl: HTMLElement) => void;
  onCreateLocalhost: (anchorEl: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const { triggerRef, onOpenChange, maxHeight } = usePopoverViewportFit<HTMLButtonElement>();
  const resolveContainer = useInfoPopoverContainer();
  const getPopupContainer = useCallback(
    (triggerNode: HTMLElement) => resolveContainer?.(triggerNode) ?? document.body,
    [resolveContainer],
  );
  const pick = (fn: (anchorEl: HTMLElement) => void) => () => {
    setOpen(false);
    if (triggerRef.current) fn(triggerRef.current);
  };

  return (
    <Popover
      content={
        // `dt-morefilters-reset` is the panel's "button styled as a menu
        // row" class — 12px font (same scale as the CTA buttons), hover
        // wash, full button reset.
        <div className="dt-morefilters-menu dt-scrollbar" style={maxHeight != null ? { maxHeight } : undefined}>
          <button
            type="button"
            className="dt-morefilters-reset"
            onClick={pick(onCreateRedirect)}
            title="Send matching requests to a different URL — the target seeds as a per-domain variable"
          >
            Redirect URL…
          </button>
          <button
            type="button"
            className="dt-morefilters-reset"
            onClick={pick(onCreateReplaceHost)}
            title="Keep path and query, swap the host — seeds a per-domain host variable"
          >
            Replace host…
          </button>
          <button
            type="button"
            className="dt-morefilters-reset"
            onClick={pick(onCreateLocalhost)}
            title="Keep path and query, send to your local dev server over http — seeds a per-domain port variable"
          >
            Point to localhost…
          </button>
        </div>
      }
      trigger="click"
      placement="bottomLeft"
      autoAdjustOverflow={false}
      arrow={false}
      classNames={{ root: 'dt-morefilters-popover' }}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        onOpenChange(o);
      }}
      {...(resolveContainer ? { getPopupContainer } : {})}
    >
      <button
        ref={triggerRef}
        type="button"
        className="dt-btn dt-btn-primary"
        /* The trigger may sit inside a <details> summary (General section) —
         * preventDefault stops the disclosure toggle; the Popover still opens
         * because antd merges this handler with its own. */
        onClick={(e) => e.preventDefault()}
        title="Send matching requests somewhere else — pick how the target is pre-filled"
      >
        Redirect
        <span aria-hidden="true" style={{ marginLeft: 4, fontSize: 9 }}>
          ▾
        </span>
      </button>
    </Popover>
  );
}
