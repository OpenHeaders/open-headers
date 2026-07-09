import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Popover } from 'antd';
import { useCallback, useState } from 'react';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';

/**
 * `Override Cookies ▾` CTA — one primary button for every cookie-rule
 * seeding variant. All three entries create the same action kind (a
 * Cookie / Set-Cookie header rule); only the direction and seeded value
 * differ, so they are menu entries rather than sibling CTAs — same
 * doctrine as `headers/RedirectCtaMenu.tsx`.
 *
 * Every entry opens the create popover anchored to THIS trigger button
 * (not the menu item — the menu unmounts on close, and the popover's
 * placement anchors once).
 */
export function CookieCtaMenu({
  onOverrideRequest,
  onOverrideResponse,
  onRemoveAll,
}: {
  onOverrideRequest: (anchorEl: HTMLElement) => void;
  onOverrideResponse: (anchorEl: HTMLElement) => void;
  onRemoveAll: (anchorEl: HTMLElement) => void;
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
        <div className="dt-morefilters-menu dt-scrollbar" style={maxHeight != null ? { maxHeight } : undefined}>
          <button
            type="button"
            className="dt-morefilters-reset"
            onClick={pick(onOverrideRequest)}
            title="Replace the Cookie header sent on this request"
          >
            Request cookies…
          </button>
          <button
            type="button"
            className="dt-morefilters-reset"
            onClick={pick(onOverrideResponse)}
            title="Replace a Set-Cookie header coming back from the server"
          >
            Response cookies…
          </button>
          <button
            type="button"
            className="dt-morefilters-reset"
            onClick={pick(onRemoveAll)}
            title="Drop the Cookie header entirely, so the server sees no cookies"
          >
            Don’t send any cookies…
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
        className="dt-btn dt-btn-primary dt-btn--oh"
        title="Create a rule that changes the cookies on matching requests"
      >
        Override Cookies
        <span aria-hidden="true" style={{ marginLeft: 4, fontSize: 9 }}>
          ▾
        </span>
      </button>
    </Popover>
  );
}
