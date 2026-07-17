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
 * Edit mode with a {@link CookieEditPopoverDocument} binding is LIVE:
 * the canonical tracks the jar while the popover is open (clean fields
 * silently adopt external changes, touched fields keep their drafts)
 * and genuine both-sides divergence surfaces through the same conflict
 * tier the editor-tab document uses — chips, banner, merge review. The
 * footer's "Open in new tab" link escalates to that full document.
 *
 * Name, Value, Domain and Path accept `{{var}}` templates, resolved
 * ONCE at Save into the concrete strings the jar stores (static — later
 * variable changes never rewrite the jar; a Cookie override rule is the
 * dynamic path). Save is resolve-gated per field with a live preview of
 * what will be written. Expires / SameSite / flags are date, enum and
 * boolean controls — nothing to template.
 */

import { SaveOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/dom/useSaveShortcut';
import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Button, Popover, Tooltip } from 'antd';
import type { TooltipRef } from 'antd/es/tooltip';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';
import {
  type CookieEditFormValues,
  editFormConstraintError,
  editFormsEqual,
  formToEdit,
  isEditFormValid,
  jarCookieToEditForm,
  jarCookieToKey,
  jarKeysSameCookie,
  mergeEditFormWithCanonical,
} from '../../../data/cookies/cookie-edit';
import {
  fetchSiteJarCookiesOnce,
  type JarCookieEdit,
  type JarCookieKey,
  subscribeCookieJar,
} from '../../../data/cookies/cookie-jar-cache';
import { useDocumentSync } from '../../../data/storage/use-document-sync';
import { CookieEditFields, useCookieFieldResolution } from './CookieEditFields';
import { useCookieConflictTier } from './useCookieConflictTier';

/** Live-document binding for edit mode — identifies the jar row the
 *  popover edits so the form can sync against it while open, and (via
 *  `onOpen`) escalate to the full editor-tab document. */
export interface CookieEditPopoverDocument {
  /** The inspected scope's URL — the jar is read through it. */
  scopeUrl: string;
  /** The cookie's jar identity at popover open. */
  cookieKey: JarCookieKey;
  /** Open the cookie as an editor-tab document (footer link). */
  onOpen?: () => void;
}

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
  document?: CookieEditPopoverDocument;
  onCancel: () => void;
  onSave: (edit: JarCookieEdit) => void;
}

// Mounted fresh each time the popover opens (destroyOnHidden), so its
// local state seeds from the current canonical without an effect.
function CookieEditFormBody({
  mode,
  canonical: openCanonical,
  busy,
  maxHeight,
  valueNote,
  document: binding,
  onCancel,
  onSave,
}: FormBodyProps) {
  const t = useT();
  const [values, setValues] = useState<CookieEditFormValues>(openCanonical);
  // Live canonical — advances while the popover is open (jar sync);
  // dirty always compares against the CURRENT jar truth, so a form the
  // catch-up realigned reads clean again.
  const [canonical, setCanonical] = useState<CookieEditFormValues>(openCanonical);
  // The cookie vanished from the jar under the open form — an honest
  // note replaces the chips; Save still writes the drafts back.
  const [gone, setGone] = useState(false);

  const live = binding !== undefined && mode === 'edit';

  const conflictTier = useCookieConflictTier({
    enabled: live && !gone,
    values,
    setValues,
    canonical,
  });
  const seedConflicts = conflictTier.seed;
  // Seed once from the open-time canonical — the body mounts fresh on
  // every open (destroyOnHidden), so mount IS popover-open.
  useEffect(() => {
    if (live) seedConflicts(openCanonical);
    // biome-ignore lint/correctness/useExhaustiveDependencies: seed only from the open-time canonical, once per mount
  }, []);

  // Latest-state mirrors for the sync path — it lands after an await
  // and must merge against the CURRENT canonical + form.
  const canonicalRef = useRef(canonical);
  canonicalRef.current = canonical;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const syncTokenRef = useRef(0);

  // Live canonical catch-up while the popover is open — same free-tier
  // merge as the editor-tab document: clean fields silently adopt the
  // jar's new value, touched fields keep their drafts (the conflict
  // tier surfaces genuine both-sides divergence).
  const syncFromJar = useCallback(async () => {
    if (binding === undefined) return;
    const token = ++syncTokenRef.current;
    const site = await fetchSiteJarCookiesOnce(binding.scopeUrl);
    if (token !== syncTokenRef.current || site === null) return;
    const jar = site.find((c) => jarKeysSameCookie(jarCookieToKey(c), binding.cookieKey)) ?? null;
    if (jar === null) {
      setGone(true);
      return;
    }
    setGone(false);
    const next = jarCookieToEditForm(jar);
    const current = canonicalRef.current;
    if (editFormsEqual(next, current)) return;
    setValues(mergeEditFormWithCanonical(current, valuesRef.current, next));
    setCanonical(next);
  }, [binding]);

  const runSync = useCallback(() => {
    void syncFromJar();
  }, [syncFromJar]);

  useDocumentSync({
    enabled: live && !busy,
    sync: runSync,
    subscribe: subscribeCookieJar,
  });

  const set = <K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const { fields, anyUnresolved, resolvedForm } = useCookieFieldResolution(values);

  const dirty = !editFormsEqual(values, canonical);
  // Validity runs on the RESOLVED form — a `{{var}}` resolving to '' in
  // Name / Domain must block like a literal empty would. Same for the
  // prefix/Secure constraints: the jar would reject the write, so the
  // form blocks with the reason inline instead.
  const constraintError = editFormConstraintError(t, resolvedForm);
  const valid = isEditFormValid(resolvedForm) && constraintError === null;
  // A gone cookie is savable even when clean — Save re-creates it.
  const canSave = valid && !anyUnresolved && (mode === 'add' || dirty || gone);

  // Cmd/Ctrl+S while the popover is open — the body mounts per open
  // (destroyOnHidden), so the claim-stack registration tracks exactly
  // the popover's lifetime and outranks the surfaces beneath it.
  const { saveLabel, handleSaveRef } = useSaveShortcut();
  handleSaveRef.current = canSave && !busy ? () => onSave(formToEdit(resolvedForm)) : null;

  const openDocument = binding?.onOpen;

  return (
    <div
      className="dt-cookie-edit-popover dt-scrollbar"
      style={maxHeight != null ? { maxHeight, overflowY: 'auto', overscrollBehavior: 'none' } : undefined}
    >
      <div className="dt-cookie-edit-popover-title">
        {mode === 'add' ? t('panel.inspector.cookies.cta.addCookie') : t('panel.inspector.cookies.edit.editTitle')}
        {valueNote && (
          <span className="dt-exec-badge dt-exec-badge--rule-modified" title={valueNote}>
            {t('panel.inspector.cookies.edit.valueChanged')}
          </span>
        )}
      </div>
      {conflictTier.banner}
      {conflictTier.dialog}
      {gone && (
        <div className="dt-cookie-edit-note">{t('panel.inspector.cookies.edit.goneNote')}</div>
      )}
      <CookieEditFields values={values} fields={fields} set={set} busy={busy} affixes={conflictTier.affixes} />
      {constraintError !== null && <div className="dt-cookie-edit-note">{constraintError}</div>}

      <div className="dt-cookie-edit-actions">
        {openDocument !== undefined && (
          <span
            className="dt-cookie-edit-open"
            title={
              dirty
                ? t('panel.inspector.cookies.edit.openDirtyTitle')
                : t('panel.inspector.cookies.edit.openTitle')
            }
          >
            <Button
              type="link"
              size="small"
              disabled={busy || dirty}
              onClick={() => {
                openDocument();
                onCancel();
              }}
            >
              {t('panel.inspector.cookies.edit.openInTab')} →
            </Button>
          </span>
        )}
        <Tooltip
          title={<ShortcutHintTitle label={saveLabel}>{t('panel.inspector.cookies.edit.save')}</ShortcutHintTitle>}
          placement="bottomRight"
          zIndex={1090}
        >
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => onSave(formToEdit(resolvedForm))}
            disabled={!canSave}
            loading={busy}
            style={{ fontSize: 11, ...(canSave ? { background: '#f5722d', borderColor: '#f5722d' } : {}) }}
          >
            {t('panel.inspector.cookies.edit.save')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

interface Props {
  mode: 'add' | 'edit';
  canonical: CookieEditFormValues;
  /** See {@link FormBodyProps.valueNote}. */
  valueNote?: string;
  /** Edit-mode live binding — jar sync + conflict tier + the footer's
   *  "Open in new tab" escalation. */
  document?: CookieEditPopoverDocument;
  /** Persists the edit; resolves `true` on success so the popover closes. */
  onSubmit: (edit: JarCookieEdit) => Promise<boolean>;
  placement?: 'bottomRight' | 'bottomLeft' | 'leftTop';
  children: ReactNode;
}

export function CookieEditPopover({
  mode,
  canonical,
  valueNote,
  document,
  onSubmit,
  placement = 'bottomRight',
  children,
}: Props) {
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
    (node: HTMLElement) => resolveContainer?.(node) ?? window.document.body,
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
            document={document}
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
