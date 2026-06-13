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
 */

import { Button, Input, Popover, Radio, Select, Switch } from 'antd';
import { type ReactNode, useState } from 'react';
import {
  type CookieEditFormValues,
  type CookieSameSiteValue,
  editFormsEqual,
  formToEdit,
  isEditFormValid,
} from '../../../data/cookie-edit';
import type { JarCookieEdit } from '../../../data/cookie-jar-cache';

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

interface FormBodyProps {
  mode: 'add' | 'edit';
  canonical: CookieEditFormValues;
  busy: boolean;
  onCancel: () => void;
  onSave: (edit: JarCookieEdit) => void;
}

// Mounted fresh each time the popover opens (destroyOnHidden), so its
// local state seeds from the current canonical without an effect.
function CookieEditFormBody({ mode, canonical, busy, onCancel, onSave }: FormBodyProps) {
  const [values, setValues] = useState<CookieEditFormValues>(canonical);

  const set = <K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const dirty = !editFormsEqual(values, canonical);
  const valid = isEditFormValid(values);
  const canSave = valid && (mode === 'add' || dirty);

  return (
    <div className="dt-cookie-edit-popover">
      <div className="dt-cookie-edit-popover-title">{mode === 'add' ? 'Add cookie' : 'Edit cookie'}</div>
      <div className="dt-cookie-edit-form">
        <label className="dt-cookie-edit-field dt-cookie-edit-field--wide">
          <span className="dt-cookie-edit-label">Name</span>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="cookie name"
            disabled={busy}
            size="small"
            status={values.name.trim() === '' ? 'error' : undefined}
          />
        </label>

        <label className="dt-cookie-edit-field dt-cookie-edit-field--wide">
          <span className="dt-cookie-edit-label">Value</span>
          <Input.TextArea
            value={values.value}
            onChange={(e) => set('value', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 3 }}
            disabled={busy}
            size="small"
          />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Domain</span>
          <Input
            value={values.domain}
            onChange={(e) => set('domain', e.target.value)}
            placeholder="openheaders.io"
            disabled={busy}
            size="small"
            status={values.domain.trim() === '' ? 'error' : undefined}
          />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Path</span>
          <Input
            value={values.path}
            onChange={(e) => set('path', e.target.value)}
            placeholder="/"
            disabled={busy}
            size="small"
          />
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
          onClick={() => onSave(formToEdit(values))}
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

  const handleSave = (edit: JarCookieEdit): void => {
    setBusy(true);
    void onSubmit(edit).then((ok) => {
      setBusy(false);
      if (ok) setOpen(false);
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
      trigger="click"
      placement={placement}
      destroyOnHidden
      // Content must be non-empty even while closed — antd refuses to open
      // a popover whose content is falsy, so a `open ? … : null` here would
      // never open on the first click. `destroyOnHidden` keeps it lazy:
      // the body only mounts (and re-seeds from `canonical`) once shown.
      content={
        <CookieEditFormBody
          mode={mode}
          canonical={canonical}
          busy={busy}
          onCancel={() => setOpen(false)}
          onSave={handleSave}
        />
      }
    >
      {children}
    </Popover>
  );
}
