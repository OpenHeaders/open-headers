/**
 * CtaMenu — a General-summary CTA dropdown in the header sections'
 * `Copy ▾` format: plain trigger with a text caret, absolutely
 * positioned `dt-header-copy-menu` list. Options lead with the OH mark
 * so they keep reading as Open Headers rule actions after moving off
 * the row into the menu.
 *
 * Every option receives the TRIGGER button as its anchor (not the menu
 * item — the menu unmounts on close, and the create popover's placement
 * anchors once).
 */

import { useRef, useState } from 'react';

export interface CtaMenuItem {
  label: string;
  title: string;
  onPick: (anchorEl: HTMLElement) => void;
}

export function CtaMenu({
  label,
  title,
  ohTrigger = false,
  items,
}: {
  label: string;
  title: string;
  /** OH-brand the trigger itself (`Redirect ▾`); plain otherwise (`More ▾`). */
  ohTrigger?: boolean;
  items: readonly CtaMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="dt-header-cta-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={ohTrigger ? 'dt-btn dt-btn--oh' : 'dt-btn'}
        title={title}
        /* The trigger sits inside a <details> summary — preventDefault
         * stops the disclosure toggle. */
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        {label} ▾
      </button>
      {open && (
        <div className="dt-header-copy-menu dt-header-copy-menu--left" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              title={item.title}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                if (triggerRef.current) item.onPick(triggerRef.current);
              }}
            >
              <span className="dt-oh-mark" style={{ marginRight: 5 }} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
