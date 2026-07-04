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
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { Button, Popover, Radio, Select, Switch } from 'antd';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { usePopoverViewportFit } from '../../use-popover-viewport-fit';
import {
  type CookieEditFormValues,
  type CookieSameSiteValue,
  editFormsEqual,
  formToEdit,
  isEditFormValid,
} from '../../../data/cookies/cookie-edit';
import type { JarCookieEdit } from '../../../data/cookies/cookie-jar-cache';
import { containsUnresolvedRef } from '../../../data/rule-create/rule-applicability';

const SAME_SITE_OPTIONS: Array<{ value: CookieSameSiteValue; label: string }> = [
  { value: 'unspecified', label: 'Unspecified' },
  { value: 'no_restriction', label: 'None (cross-site)' },
  { value: 'lax', label: 'Lax' },
  { value: 'strict', label: 'Strict' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Unix seconds → `datetime-local` value in the user's local zone. */
function toLocalInput(sec: number | undefined): string {
  if (sec == null) return '';
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): number | undefined {
  if (!s) return undefined;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

interface ResolvedField {
  isTemplate: boolean;
  unresolved: boolean;
  resolved: string;
}

/** What Save will actually write — shown only while the field holds a
 *  `{{…}}` template. */
function ResolvedLine({ field }: { field: ResolvedField }) {
  if (!field.isTemplate) return null;
  return (
    <span className={`dt-cookie-edit-resolved${field.unresolved ? ' dt-cookie-edit-resolved--error' : ''}`}>
      {field.unresolved ? 'Doesn’t resolve — create the variable or fix the reference.' : `Writes: ${field.resolved}`}
    </span>
  );
}

interface FormBodyProps {
  mode: 'add' | 'edit';
  canonical: CookieEditFormValues;
  busy: boolean;
  /** Viewport-fit cap (room beneath the trigger); the form scrolls inside it. */
  maxHeight?: number;
  onCancel: () => void;
  onSave: (edit: JarCookieEdit) => void;
}

// Mounted fresh each time the popover opens (destroyOnHidden), so its
// local state seeds from the current canonical without an effect.
function CookieEditFormBody({ mode, canonical, busy, maxHeight, onCancel, onSave }: FormBodyProps) {
  const [values, setValues] = useState<CookieEditFormValues>(canonical);

  const set = <K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  // The text fields accept {{var}} templates but the jar needs CONCRETE
  // strings — Save resolves once at click time (static; the jar never
  // tracks later variable changes — a Cookie override rule does that).
  // Any unresolvable / deferred-vault ref gates Save: writing a literal
  // `{{…}}` into the browser jar is always wrong.
  const resolver = useVariableResolver();
  const fields = useMemo(() => {
    const resolveField = (raw: string) => {
      const isTemplate = raw.includes('{{');
      const unresolved = isTemplate && containsUnresolvedRef(resolver, raw, undefined);
      const resolved = isTemplate && !unresolved ? resolver.resolveTemplate(raw).result : raw;
      return { isTemplate, unresolved, resolved };
    };
    return {
      name: resolveField(values.name),
      value: resolveField(values.value),
      domain: resolveField(values.domain),
      path: resolveField(values.path),
    };
  }, [resolver, values.name, values.value, values.domain, values.path]);
  const anyUnresolved = fields.name.unresolved || fields.value.unresolved || fields.domain.unresolved || fields.path.unresolved;
  const resolvedForm: CookieEditFormValues = {
    ...values,
    name: fields.name.resolved,
    value: fields.value.resolved,
    domain: fields.domain.resolved,
    path: fields.path.resolved,
  };

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
      <div className="dt-cookie-edit-popover-title">{mode === 'add' ? 'Add cookie' : 'Edit cookie'}</div>
      <div className="dt-cookie-edit-form">
        <label className="dt-cookie-edit-field dt-cookie-edit-field--wide">
          <span className="dt-cookie-edit-label">Name</span>
          <TemplateInput
            value={values.name}
            onChange={(v) => set('name', v)}
            size="small"
            placeholder="cookie name"
          />
          <ResolvedLine field={fields.name} />
        </label>

        <label className="dt-cookie-edit-field dt-cookie-edit-field--wide">
          <span className="dt-cookie-edit-label">Value</span>
          <TemplateInput
            value={values.value}
            onChange={(v) => set('value', v)}
            wrap
            maxRows={3}
            size="small"
            placeholder="value or {{variable}}"
          />
          <ResolvedLine field={fields.value} />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Domain</span>
          <TemplateInput
            value={values.domain}
            onChange={(v) => set('domain', v)}
            size="small"
            placeholder="openheaders.io"
          />
          <ResolvedLine field={fields.domain} />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Path</span>
          <TemplateInput
            value={values.path}
            onChange={(v) => set('path', v)}
            size="small"
            placeholder="/"
          />
          <ResolvedLine field={fields.path} />
        </label>

        <div className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Expires</span>
          <Radio.Group
            value={values.session ? 'session' : 'date'}
            onChange={(e) => set('session', e.target.value === 'session')}
            disabled={busy}
            options={[
              { value: 'session', label: 'Session' },
              { value: 'date', label: 'On date' },
            ]}
            optionType="button"
            size="small"
          />
          {!values.session && (
            <input
              type="datetime-local"
              className="dt-cookie-edit-datetime"
              value={toLocalInput(values.expirationDate)}
              onChange={(e) => set('expirationDate', fromLocalInput(e.target.value))}
              disabled={busy}
            />
          )}
        </div>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">SameSite</span>
          <Select<CookieSameSiteValue>
            value={values.sameSite}
            onChange={(v) => set('sameSite', v)}
            options={SAME_SITE_OPTIONS}
            disabled={busy}
            size="small"
            popupMatchSelectWidth={false}
          />
        </label>

        <div className="dt-cookie-edit-toggles">
          <label className="dt-cookie-edit-toggle">
            <Switch checked={values.httpOnly} onChange={(v) => set('httpOnly', v)} size="small" disabled={busy} />
            <span>HttpOnly</span>
          </label>
          <label className="dt-cookie-edit-toggle">
            <Switch checked={values.secure} onChange={(v) => set('secure', v)} size="small" disabled={busy} />
            <span>Secure</span>
          </label>
          <label className="dt-cookie-edit-toggle">
            <Switch checked={values.hostOnly} onChange={(v) => set('hostOnly', v)} size="small" disabled={busy} />
            <span>Host-only</span>
          </label>
        </div>
      </div>

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
  /** Persists the edit; resolves `true` on success so the popover closes. */
  onSubmit: (edit: JarCookieEdit) => Promise<boolean>;
  placement?: 'bottomRight' | 'bottomLeft' | 'leftTop';
  children: ReactNode;
}

export function CookieEditPopover({ mode, canonical, onSubmit, placement = 'bottomRight', children }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Height-aware like the View / toolbar menus: measure the room beneath the
  // trigger on open and cap the form to it, so the popover stays pinned to its
  // button and shrinks + scrolls inside as it nears the footer instead of
  // overflowing. `autoAdjustOverflow={false}` keeps it on its anchor (no flip);
  // the measured cap handles the overflow.
  const { triggerRef, onOpenChange: onFitOpenChange, maxHeight } = usePopoverViewportFit<HTMLSpanElement>();
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
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          onFitOpenChange(next);
          setOpen(next);
        }}
        trigger="click"
        placement={placement}
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
