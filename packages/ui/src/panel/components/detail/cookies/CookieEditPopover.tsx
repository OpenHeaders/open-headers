/**
 * Add / edit popover for a single jar cookie — anchored to the trigger
 * (the row's Edit pencil, or the toolbar's "Add cookie"), mirroring the
 * inline rule-edit popover the Headers tab uses rather than a centered
 * modal.
 *
 * Edits a flat {@link CookieEditFormValues} held in local state; `isDirty`
 * derives from a structural compare against the canonical snapshot the
 * popover opened with (never an imperative flag), so Save stays disabled
 * until something changed (edit) or the form is first valid (add).
 * HttpOnly is the headline capability — page JS can't set it, the
 * extension's cookies permission can.
 *
 * Name, Value, Domain and Path accept `{{var}}` templates, resolved
 * ONCE at Save into the concrete strings the jar stores (static — later
 * variable changes never rewrite the jar; a Cookie override rule is the
 * dynamic path). Save is resolve-gated per field with a live preview of
 * what will be written. Expires / SameSite / flags are date, enum and
 * boolean controls — nothing to template.
 */

import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Button, Popover } from 'antd';
import type { TooltipRef } from 'antd/es/tooltip';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';
import {
  type CookieEditFormValues,
  editFormsEqual,
  formToEdit,
  isEditFormValid,
} from '../../../data/cookies/cookie-edit';
import type { JarCookieEdit } from '../../../data/cookies/cookie-jar-cache';
import { CookieEditFields, useCookieFieldResolution } from './CookieEditFields';

interface FormBodyProps {
  mode: 'add' | 'edit';
  canonical: CookieEditFormValues;
  busy: boolean;
  /** Viewport-fit cap (room beneath the trigger); the form scrolls inside it. */
  maxHeight?: number;
  /** Set when the edit opens on the LIVE jar value and the clicked row
   *  captured a different one — renders the Request Rules-style "value
   *  changed" tag in the title row, with this text as its tooltip (e.g.
   *  "This response set: …" while newer traffic re-set the cookie). */
  valueNote?: string;
  onCancel: () => void;
  onSave: (edit: JarCookieEdit) => void;
}

// Mounted fresh each time the popover opens (destroyOnHidden), so its
// local state seeds from the current canonical without an effect.
function CookieEditFormBody({ mode, canonical, busy, maxHeight, valueNote, onCancel, onSave }: FormBodyProps) {
  const [values, setValues] = useState<CookieEditFormValues>(canonical);

  const set = <K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const { fields, anyUnresolved, resolvedForm } = useCookieFieldResolution(values);

  const dirty = !editFormsEqual(values, canonical);
  // Validity runs on the RESOLVED form — a `{{var}}` resolving to '' in
  // Name / Domain must block like a literal empty would.
  const valid = isEditFormValid(resolvedForm);
  const canSave = valid && !anyUnresolved && (mode === 'add' || dirty);

  return (
    <div
      className="dt-cookie-edit-popover dt-scrollbar"
      style={maxHeight != null ? { maxHeight, overflowY: 'auto' } : undefined}
    >
      <div className="dt-cookie-edit-popover-title">
        {mode === 'add' ? 'Add cookie' : 'Edit cookie'}
        {valueNote && (
          <span className="dt-exec-badge dt-exec-badge--rule-modified" title={valueNote}>
            value changed
          </span>
        )}
      </div>
      <CookieEditFields values={values} fields={fields} set={set} busy={busy} />

      <div className="dt-cookie-edit-actions">
        <Button size="small" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={() => onSave(formToEdit(resolvedForm))}
          disabled={!canSave}
          loading={busy}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

interface Props {
  mode: 'add' | 'edit';
  canonical: CookieEditFormValues;
  /** See {@link FormBodyProps.valueNote}. */
  valueNote?: string;
  /** Persists the edit; resolves `true` on success so the popover closes. */
  onSubmit: (edit: JarCookieEdit) => Promise<boolean>;
  placement?: 'bottomRight' | 'bottomLeft' | 'leftTop';
  children: ReactNode;
}

export function CookieEditPopover({ mode, canonical, valueNote, onSubmit, placement = 'bottomRight', children }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Height-aware like the View / toolbar menus: measure the room around the
  // trigger on open and cap the form to it, so the popover stays pinned to its
  // button and shrinks + scrolls inside instead of overflowing.
  // `autoAdjustOverflow={false}` keeps antd from sliding it off its anchor;
  // the hook's `flip` handles the one adjustment a form this tall needs — a
  // bottom-row trigger leaves no usable room below, so the popover opens
  // ABOVE the pencil (top* twin placement) capped to the room up there.
  const { triggerRef, onOpenChange: onFitOpenChange, maxHeight, flipUp } = usePopoverViewportFit<HTMLSpanElement>({
    flip: true,
  });
  const effectivePlacement = flipUp
    ? placement === 'bottomLeft'
      ? 'topLeft'
      : placement === 'bottomRight'
        ? 'topRight'
        : placement
    : placement;
  // A top-placed popup is aligned by gluing its BOTTOM edge to the
  // trigger, using the popup's height at align time — but the library's
  // own realign (window resize / pane scroll) runs before React commits
  // the re-measured `maxHeight`, so a flipped popup would land one
  // resize behind. Re-align explicitly AFTER the new cap is in the DOM.
  const popoverRef = useRef<TooltipRef | null>(null);
  useEffect(() => {
    if (open) popoverRef.current?.forceAlign();
  }, [open, maxHeight, effectivePlacement]);
  // Portal into the inspector pane root (like View) so the root's
  // `overflow: hidden` clips the form and its footer covers any graze —
  // instead of floating in `<body>` where nothing contains it.
  const resolveContainer = useInfoPopoverContainer();
  const getPopupContainer = useCallback(
    (node: HTMLElement) => resolveContainer?.(node) ?? document.body,
    [resolveContainer],
  );

  const handleSave = (edit: JarCookieEdit): void => {
    setBusy(true);
    void onSubmit(edit).then((ok) => {
      setBusy(false);
      if (ok) setOpen(false);
    });
  };

  return (
    <span ref={triggerRef} className="dt-cookie-edit-trigger">
      <Popover
        ref={popoverRef}
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          onFitOpenChange(next);
          setOpen(next);
        }}
        trigger="click"
        placement={effectivePlacement}
        autoAdjustOverflow={false}
        destroyOnHidden
        {...(resolveContainer ? { getPopupContainer } : {})}
        // Content must be non-empty even while closed — antd refuses to open
        // a popover whose content is falsy, so a `open ? … : null` here would
        // never open on the first click. `destroyOnHidden` keeps it lazy:
        // the body only mounts (and re-seeds from `canonical`) once shown.
        content={
          <CookieEditFormBody
            mode={mode}
            canonical={canonical}
            busy={busy}
            maxHeight={maxHeight}
            valueNote={valueNote}
            onCancel={() => setOpen(false)}
            onSave={handleSave}
          />
        }
      >
        {children}
      </Popover>
    </span>
  );
}
