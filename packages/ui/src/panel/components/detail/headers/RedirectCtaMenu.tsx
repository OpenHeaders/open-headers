import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Popover } from 'antd';
import { useCallback, useState } from 'react';
import { usePopoverViewportFit } from '../../use-popover-viewport-fit';

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

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    font: 'inherit',
    cursor: 'pointer',
  };

  return (
    <Popover
      content={
        <div className="dt-morefilters-menu dt-scrollbar" style={maxHeight != null ? { maxHeight } : undefined}>
          <button
            type="button"
            className="dt-morefilters-item"
            style={itemStyle}
            onClick={pick(onCreateRedirect)}
            title="Send matching requests to a different URL — the target seeds as a per-domain variable"
          >
            Redirect URL…
          </button>
          <button
            type="button"
            className="dt-morefilters-item"
            style={itemStyle}
            onClick={pick(onCreateReplaceHost)}
            title="Keep path and query, swap the host — seeds a per-domain host variable"
          >
            Replace host…
          </button>
          <button
            type="button"
            className="dt-morefilters-item"
            style={itemStyle}
            onClick={pick(onCreateLocalhost)}
            title="Keep path and query, send to your local dev server over http — seeds a per-domain localhost variable"
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
