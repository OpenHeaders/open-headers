/**
 * Shared attribute-field grid for editing one jar cookie — the inline
 * quick-edit popover and the full editor-tab document both render it,
 * so the two surfaces can never drift on field vocabulary or template
 * semantics.
 *
 * Name, Value, Domain and Path accept `{{var}}` templates, resolved
 * ONCE at Save into the concrete strings the jar stores (static — later
 * variable changes never rewrite the jar; a Cookie override rule is the
 * dynamic path). `useCookieFieldResolution` derives the per-field
 * resolution + the resolved form both surfaces gate Save on. A
 * `readOnly` render keeps the same grid but swaps the text fields for
 * static values — hosts without a jar write path show the document
 * honestly instead of a dead form.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { Radio, Select, Switch } from 'antd';
import { type ReactNode, useMemo } from 'react';
import {
  COOKIE_SAME_SITE_VALUES,
  type CookieConflictField,
  type CookieEditFormValues,
  type CookieSameSiteValue,
  cookieSameSiteLabels,
  expirationFromLocalInput,
  expirationToLocalInput,
} from '../../../data/cookies/cookie-edit';
import { containsUnresolvedRef } from '../../../data/rule-create/rule-applicability';
import { CookieEditFieldInfo } from './CookieEditFieldInfo';

export interface ResolvedField {
  isTemplate: boolean;
  unresolved: boolean;
  resolved: string;
}

export interface CookieFieldResolution {
  fields: { name: ResolvedField; value: ResolvedField; domain: ResolvedField; path: ResolvedField };
  anyUnresolved: boolean;
  /** The form with every templated text field resolved — what Save
   *  actually writes (validity runs on this, never the raw drafts). */
  resolvedForm: CookieEditFormValues;
}

/** Per-field template resolution over the four text fields. Any
 *  unresolvable / deferred-vault ref gates Save: writing a literal
 *  `{{…}}` into the browser jar is always wrong. */
export function useCookieFieldResolution(values: CookieEditFormValues): CookieFieldResolution {
  const resolver = useVariableResolver();
  const fields = useMemo(() => {
    const resolveField = (raw: string): ResolvedField => {
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
  const anyUnresolved =
    fields.name.unresolved || fields.value.unresolved || fields.domain.unresolved || fields.path.unresolved;
  const resolvedForm: CookieEditFormValues = {
    ...values,
    name: fields.name.resolved,
    value: fields.value.resolved,
    domain: fields.domain.resolved,
    path: fields.path.resolved,
  };
  return { fields, anyUnresolved, resolvedForm };
}

/** What Save will actually write — shown only while the field holds a
 *  `{{…}}` template. */
function ResolvedLine({ field }: { field: ResolvedField }) {
  const t = useT();
  if (!field.isTemplate) return null;
  return (
    <span className={`dt-cookie-edit-resolved${field.unresolved ? ' dt-cookie-edit-resolved--error' : ''}`}>
      {field.unresolved
        ? t('panel.inspector.cookies.edit.unresolved')
        : t('panel.inspector.cookies.edit.writes', { value: field.resolved })}
    </span>
  );
}

interface CookieEditFieldsProps {
  values: CookieEditFormValues;
  fields: CookieFieldResolution['fields'];
  set: <K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]) => void;
  busy: boolean;
  /** Static render — text fields become plain values, controls disable. */
  readOnly?: boolean;
  /** Per-field label affix — the document editor mounts its conflict
   *  chips here so they sit on the row they belong to. */
  affixes?: Partial<Record<CookieConflictField, ReactNode>>;
}

export function CookieEditFields({ values, fields, set, busy, readOnly = false, affixes }: CookieEditFieldsProps) {
  const t = useT();
  const sameSiteOptions = useMemo<Array<{ value: CookieSameSiteValue; label: string }>>(() => {
    const labels = cookieSameSiteLabels(t);
    return COOKIE_SAME_SITE_VALUES.map((value) => ({ value, label: labels[value] }));
  }, [t]);
  const textField = (
    key: 'name' | 'value' | 'domain' | 'path',
    placeholder: string,
    extra: { wrap?: boolean; maxRows?: number } = {},
  ) =>
    readOnly ? (
      <span className="dt-cookie-edit-static">{values[key]}</span>
    ) : (
      <>
        <TemplateInput
          value={values[key]}
          onChange={(v) => set(key, v)}
          size="small"
          placeholder={placeholder}
          {...extra}
        />
        <ResolvedLine field={fields[key]} />
      </>
    );

  return (
    <div className="dt-cookie-edit-form">
      <div className="dt-cookie-edit-field dt-cookie-edit-field--wide">
        <span className="dt-cookie-edit-label">
          {t('panel.inspector.cookies.edit.field.name')}
          <CookieEditFieldInfo infoKey="name" />
          {affixes?.name}
        </span>
        {textField('name', t('panel.inspector.cookies.edit.namePlaceholder'))}
      </div>

      <div className="dt-cookie-edit-field dt-cookie-edit-field--wide">
        <span className="dt-cookie-edit-label">
          {t('panel.inspector.cookies.edit.field.value')}
          <CookieEditFieldInfo infoKey="value" />
          {affixes?.value}
        </span>
        {textField('value', t('panel.inspector.cookies.edit.valuePlaceholder'), { wrap: true, maxRows: 3 })}
      </div>

      <div className="dt-cookie-edit-field">
        <span className="dt-cookie-edit-label">
          Domain
          <CookieEditFieldInfo infoKey="domain" />
          {affixes?.domain}
        </span>
        {textField('domain', 'openheaders.com')}
      </div>

      <div className="dt-cookie-edit-field">
        <span className="dt-cookie-edit-label">
          Path
          <CookieEditFieldInfo infoKey="path" />
          {affixes?.path}
        </span>
        {textField('path', '/')}
      </div>

      <div className="dt-cookie-edit-field">
        <span className="dt-cookie-edit-label">
          Expires
          <CookieEditFieldInfo infoKey="expires" />
          {affixes?.expires}
        </span>
        <Radio.Group
          value={values.session ? 'session' : 'date'}
          onChange={(e) => set('session', e.target.value === 'session')}
          disabled={busy || readOnly}
          options={[
            { value: 'session', label: t('panel.inspector.cookies.edit.session') },
            { value: 'date', label: t('panel.inspector.cookies.edit.onDate') },
          ]}
          optionType="button"
          size="small"
        />
        {!values.session && (
          <input
            type="datetime-local"
            className="dt-cookie-edit-datetime"
            value={expirationToLocalInput(values.expirationDate)}
            onChange={(e) => set('expirationDate', expirationFromLocalInput(e.target.value))}
            disabled={busy || readOnly}
          />
        )}
      </div>

      <div className="dt-cookie-edit-field">
        <span className="dt-cookie-edit-label">
          SameSite
          <CookieEditFieldInfo infoKey="samesite" />
          {affixes?.sameSite}
        </span>
        <Select<CookieSameSiteValue>
          value={values.sameSite}
          onChange={(v) => set('sameSite', v)}
          options={sameSiteOptions}
          disabled={busy || readOnly}
          size="small"
          popupMatchSelectWidth={false}
        />
      </div>

      <div className="dt-cookie-edit-toggles">
        <label className="dt-cookie-edit-toggle">
          <Switch checked={values.httpOnly} onChange={(v) => set('httpOnly', v)} size="small" disabled={busy || readOnly} />
          <span>
            HttpOnly
            <CookieEditFieldInfo infoKey="httponly" />
            {affixes?.httpOnly}
          </span>
        </label>
        <label className="dt-cookie-edit-toggle">
          <Switch checked={values.secure} onChange={(v) => set('secure', v)} size="small" disabled={busy || readOnly} />
          <span>
            Secure
            <CookieEditFieldInfo infoKey="secure" />
            {affixes?.secure}
          </span>
        </label>
        <label className="dt-cookie-edit-toggle">
          <Switch checked={values.hostOnly} onChange={(v) => set('hostOnly', v)} size="small" disabled={busy || readOnly} />
          <span>
            {t('panel.inspector.cookies.edit.field.hostOnly')}
            <CookieEditFieldInfo infoKey="hostonly" />
            {affixes?.hostOnly}
          </span>
        </label>
      </div>
    </div>
  );
}
