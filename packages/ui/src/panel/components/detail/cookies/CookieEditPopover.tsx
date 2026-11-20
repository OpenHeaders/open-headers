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
 *
 * Add mode leads with a paste row: a `Set-Cookie` or `Cookie` header
 * pasted there fills the fields (see {@link CookiePasteField}); text
 * holding several cookies turns the form into a checklist saved as one
 * batch, on hosts that pass `batch` (see {@link useCookiePasteBatch}).
 */

import { SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useUiTheme } from '@openheaders/ui/context/ui-theme';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { RollbackIcon } from '@openheaders/ui/shared/icons';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/dom/useSaveShortcut';
import { useInfoPopoverContainer } from '@openheaders/ui/shared/info-popover';
import { Button, Popover, Tooltip } from 'antd';
import type { TooltipRef } from 'antd/es/tooltip';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';
import {
  type CookieConflictField,
  type CookieEditFormValues,
  editFormConflictProjection,
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
import {
  type CookiePasteFill,
  fillChangedNothing,
  pasteFillState,
  stackPasteFill,
  undoFill,
  undoFillField,
} from '../../../data/cookies/cookie-paste';
import { useDocumentSync } from '../../../data/storage/use-document-sync';
import { CookieEditFields, useCookieFieldResolution } from './CookieEditFields';
import { CookiePasteField } from './CookiePasteField';
import { type CookiePasteBatchHost, useCookiePasteBatch } from './useCookiePasteBatch';
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
  batch?: CookiePasteBatchHost;
  onCancel: () => void;
  onSave: (edit: JarCookieEdit) => void;
  /** Run a pasted batch's write under the popover's busy / close-on-success. */
  onSaveBatch: (write: () => Promise<boolean>) => void;
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
  batch,
  onCancel,
  onSave,
  onSaveBatch,
}: FormBodyProps) {
  const t = useT();
  const { saveAccent } = useUiTheme();
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
  const canSaveOne = valid && !anyUnresolved && (mode === 'add' || dirty || gone);

  // A pasted batch replaces the single-cookie Save: Name and Value stand
  // down (their drafts gate nothing), the remaining fields are what new
  // cookies take — so only THEIR templates must resolve.
  const pasteBatch = useCookiePasteBatch({
    host: mode === 'add' ? batch : undefined,
    shared: resolvedForm,
    disabled: busy,
  });
  const listing = pasteBatch.total !== null;

  // The last single-cookie paste, tracked FIELD BY FIELD against the
  // form as it is now: a paste replaces everything it states, but the
  // user may want only part of it. A field still holding the pasted
  // value carries a mark — and, where the paste replaced something, says
  // so at the right of its label with its own way back; editing or
  // undoing one field leaves the rest standing.
  const [pasteFill, setPasteFill] = useState<CookiePasteFill | null>(null);
  const fillNow = pasteFill !== null && !listing ? pasteFillState(pasteFill, values) : null;
  const activeFill = fillNow?.live ? pasteFill : null;
  const filledAffixes: Partial<Record<CookieConflictField, ReactNode>> = {};
  if (activeFill !== null && fillNow !== null) {
    const filledLabel = t('panel.inspector.cookies.edit.paste.filledMark');
    const replacedText = t('panel.inspector.cookies.edit.paste.replaced');
    const replaced = editFormConflictProjection(t, activeFill.before);
    for (const field of fillNow.held) {
      if (!fillNow.restorable.includes(field)) {
        filledAffixes[field] = (
          <ThunderboltOutlined className="dt-cookie-edit-filled-mark" title={filledLabel} aria-label={filledLabel} />
        );
        continue;
      }
      const was = replaced[field];
      const undoLabel = t('panel.inspector.cookies.edit.paste.undoField', {
        value: was.length > 60 ? `${was.slice(0, 60)}…` : was,
      });
      filledAffixes[field] = (
        // Inside a toggle's <label>: a press here must not reach the switch.
        // biome-ignore lint/a11y/noStaticElementInteractions: swallows the label's activation, the button is the control
        <span className="dt-cookie-edit-replaced" title={undoLabel} onClick={(e) => e.preventDefault()}>
          <span className="dt-cookie-edit-replaced-text">{replacedText}</span>
          <button
            type="button"
            className="dt-cookie-edit-fill-undo"
            aria-label={undoLabel}
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setValues(undoFillField(values, activeFill, field));
            }}
          >
            <RollbackIcon />
          </button>
        </span>
      );
    }
  }
  const canSave = listing
    ? pasteBatch.savable > 0 && !fields.domain.unresolved && !fields.path.unresolved
    : canSaveOne;
  const runSave = (): void => {
    if (listing) onSaveBatch(pasteBatch.save);
    else onSave(formToEdit(resolvedForm));
  };
  const saveText = listing
    ? `${t('panel.inspector.cookies.edit.save')} (${pasteBatch.savable})`
    : t('panel.inspector.cookies.edit.save');

  // Cmd/Ctrl+S while the popover is open — the body mounts per open
  // (destroyOnHidden), so the claim-stack registration tracks exactly
  // the popover's lifetime and outranks the surfaces beneath it.
  const { saveLabel, handleSaveRef } = useSaveShortcut();
  handleSaveRef.current = canSave && !busy ? runSave : null;

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
      {mode === 'add' && (
        <CookiePasteField
          values={values}
          fill={activeFill}
          onFill={(fill) => {
            // The same text pasted again changes nothing — the standing
            // fill (and its way back) stays as it is.
            if (fillChangedNothing(fill) && activeFill !== null) return;
            setValues(fill.after);
            setPasteFill(activeFill !== null ? stackPasteFill(fill, activeFill) : fill);
          }}
          onUndo={() => {
            if (activeFill !== null) setValues(undoFill(values, activeFill));
            setPasteFill(null);
          }}
          disabled={busy}
          listed={pasteBatch.total}
          onList={batch !== undefined ? pasteBatch.list : undefined}
        />
      )}
      {pasteBatch.node}
      <CookieEditFields
        values={values}
        fields={fields}
        set={set}
        busy={busy}
        affixes={mode === 'add' ? filledAffixes : conflictTier.affixes}
        omitIdentity={listing}
      />
      {!listing && constraintError !== null && <div className="dt-cookie-edit-note">{constraintError}</div>}

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
          title={<ShortcutHintTitle label={saveLabel}>{saveText}</ShortcutHintTitle>}
          placement="bottomRight"
          zIndex={1090}
        >
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            onClick={runSave}
            disabled={!canSave}
            loading={busy}
            style={{ fontSize: 11, ...(canSave ? { background: saveAccent, borderColor: saveAccent } : {}) }}
          >
            {saveText}
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
  /** Add-mode batch tier — a paste holding several cookies becomes a
   *  checklist written through this. Without it such a paste is refused. */
  batch?: CookiePasteBatchHost;
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
  batch,
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

  const runSave = (write: () => Promise<boolean>): void => {
    setBusy(true);
    void write().then((ok) => {
      setBusy(false);
      if (ok) setOpen(false);
    });
  };
  const handleSave = (edit: JarCookieEdit): void => runSave(() => onSubmit(edit));

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
            batch={batch}
            onCancel={() => setOpen(false)}
            onSave={handleSave}
            onSaveBatch={runSave}
          />
        }
      >
        {children}
      </Popover>
    </span>
  );
}
