/**
 * Add / edit modal for a single jar cookie.
 *
 * Edits a flat {@link CookieEditFormValues} held in local state; `isDirty`
 * derives from a structural compare against the canonical snapshot the
 * modal opened with (never an imperative flag), so Save stays disabled
 * until something actually changed (edit) or the form is first valid
 * (add). HttpOnly is the headline capability — page JS can't set it, the
 * extension's cookies permission can.
 */

import { Input, Modal, Radio, Select, Switch } from 'antd';
import { useEffect, useState } from 'react';
import {
  type CookieEditFormValues,
  type CookieSameSiteValue,
  editFormsEqual,
  formToEdit,
  isEditFormValid,
} from '../../../data/cookie-edit';
import type { JarCookieEdit } from '../../../data/cookie-jar-cache';

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  canonical: CookieEditFormValues;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (edit: JarCookieEdit) => void;
}

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

export function CookieEditModal({ open, mode, canonical, busy, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<CookieEditFormValues>(canonical);

  // Reseed when the modal (re-)opens against a different cookie.
  useEffect(() => {
    if (open) setValues(canonical);
  }, [open, canonical]);

  const set = <K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const dirty = !editFormsEqual(values, canonical);
  const valid = isEditFormValid(values);
  const canSave = valid && (mode === 'add' || dirty);

  return (
    <Modal
      open={open}
      title={mode === 'add' ? 'Add cookie' : 'Edit cookie'}
      okText="Save"
      okButtonProps={{ disabled: !canSave, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      onOk={() => onSubmit(formToEdit(values))}
      onCancel={onCancel}
      maskClosable={!busy}
      destroyOnHidden
      width={460}
    >
      <div className="dt-cookie-edit-form">
        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Name</span>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="cookie name"
            disabled={busy}
            status={values.name.trim() === '' ? 'error' : undefined}
          />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Value</span>
          <Input.TextArea
            value={values.value}
            onChange={(e) => set('value', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={busy}
          />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Domain</span>
          <Input
            value={values.domain}
            onChange={(e) => set('domain', e.target.value)}
            placeholder="openheaders.io"
            disabled={busy}
            status={values.domain.trim() === '' ? 'error' : undefined}
          />
        </label>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Path</span>
          <Input value={values.path} onChange={(e) => set('path', e.target.value)} placeholder="/" disabled={busy} />
        </label>

        <div className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">Expires</span>
          <div className="dt-cookie-edit-expires">
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
        </div>

        <label className="dt-cookie-edit-field">
          <span className="dt-cookie-edit-label">SameSite</span>
          <Select<CookieSameSiteValue>
            value={values.sameSite}
            onChange={(v) => set('sameSite', v)}
            options={SAME_SITE_OPTIONS}
            disabled={busy}
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
    </Modal>
  );
}
