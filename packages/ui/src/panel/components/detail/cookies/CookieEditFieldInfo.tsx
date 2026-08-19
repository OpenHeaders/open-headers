/**
 * Per-field `(i)` info-popover content for the Add / Edit cookie form.
 * Same pattern as `CookieColumnInfo.tsx` — explains what the field
 * means and what the browser does with it. Popovers stay small; the
 * text fields all share the template note (resolved once at Save).
 *
 * Every popover leads with the same canonical Set-Cookie example
 * (`NetworkColumnInfo`'s example-request pattern): the field's own
 * slice is the highlighted token, so reading across the popovers
 * builds one coherent picture of a single cookie field by field.
 */

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';

export type CookieEditFieldKey =
  | 'name'
  | 'value'
  | 'domain'
  | 'path'
  | 'expires'
  | 'samesite'
  | 'httponly'
  | 'secure'
  | 'hostonly';

/** The single cookie every field popover illustrates — also reused by
 *  the Storage tool window's Cookies grid column popovers, so both
 *  surfaces teach against the same example. */
const EX = {
  name: 'session',
  value: 'a81f52ce4b21',
  domain: 'Domain=.openheaders.com',
  path: 'Path=/account',
  expires: 'Expires=Mon, 04 Jan 2027 18:00:00 GMT',
  secure: 'Secure',
  httponly: 'HttpOnly',
  samesite: 'SameSite=Lax',
} as const;

export type CookieExampleToken = keyof typeof EX;

/** Which token(s) of the example each field lights up. Host-only is the
 *  ABSENCE of a Domain attribute, so it lights the Domain token — its
 *  text explains the omission. */
const HIGHLIGHT: Record<CookieEditFieldKey, readonly CookieExampleToken[]> = {
  name: ['name'],
  value: ['value'],
  domain: ['domain'],
  path: ['path'],
  expires: ['expires'],
  samesite: ['samesite'],
  httponly: ['httponly'],
  secure: ['secure'],
  hostonly: ['domain'],
};

export function CookieExampleCard({ highlight }: { highlight: readonly CookieExampleToken[] }) {
  const t = useT();
  const lit = new Set<CookieExampleToken>(highlight);
  const tok = (id: CookieExampleToken, text: string) => (
    <span className={`dt-col-eg-tok${lit.has(id) ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{t('panel.inspector.cookies.fieldInfo.exampleCaption')}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('name', EX.name)}
          <span className="dt-col-eg-sep">=</span>
          {tok('value', EX.value)}
          <span className="dt-col-eg-sep">;</span>
        </div>
        <div className="dt-col-eg-line">
          {tok('domain', EX.domain)}
          <span className="dt-col-eg-sep">; </span>
          {tok('path', EX.path)}
          <span className="dt-col-eg-sep">;</span>
        </div>
        <div className="dt-col-eg-line">
          {tok('expires', EX.expires)}
          <span className="dt-col-eg-sep">;</span>
        </div>
        <div className="dt-col-eg-line">
          {tok('secure', EX.secure)}
          <span className="dt-col-eg-sep">; </span>
          {tok('httponly', EX.httponly)}
          <span className="dt-col-eg-sep">; </span>
          {tok('samesite', EX.samesite)}
        </div>
      </div>
    </div>
  );
}

function ExampleCard({ field }: { field: CookieEditFieldKey }) {
  return <CookieExampleCard highlight={HIGHLIGHT[field]} />;
}

function cookieEditFieldInfo(t: Translate, key: CookieEditFieldKey): InfoPopoverContent {
  const fieldKicker = t('panel.inspector.cookies.fieldInfo.fieldKicker');
  const flagKicker = t('panel.inspector.cookies.fieldInfo.flagKicker');
  const templateNote = t('panel.inspector.cookies.fieldInfo.templateNote');
  switch (key) {
    case 'name':
      return {
        diagram: <ExampleCard field="name" />,
        title: 'Name',
        kicker: fieldKicker,
        summary: t('panel.inspector.cookies.fieldInfo.name.summary'),
        description: `${t('panel.inspector.cookies.fieldInfo.name.description')} ${templateNote}`,
      };
    case 'value':
      return {
        diagram: <ExampleCard field="value" />,
        title: 'Value',
        kicker: fieldKicker,
        summary: t('panel.inspector.cookies.fieldInfo.value.summary'),
        description: `${templateNote} ${t('panel.inspector.cookies.fieldInfo.value.description')}`,
      };
    case 'domain':
      return {
        diagram: <ExampleCard field="domain" />,
        title: 'Domain',
        kicker: fieldKicker,
        summary: t('panel.inspector.cookies.fieldInfo.domain.summary'),
        description: `${t('panel.inspector.cookies.fieldInfo.domain.description')} ${templateNote}`,
      };
    case 'path':
      return {
        diagram: <ExampleCard field="path" />,
        title: 'Path',
        kicker: fieldKicker,
        summary: t('panel.inspector.cookies.fieldInfo.path.summary'),
        description: `${t('panel.inspector.cookies.fieldInfo.path.description')} ${templateNote}`,
      };
    case 'expires':
      return {
        diagram: <ExampleCard field="expires" />,
        title: 'Expires',
        kicker: fieldKicker,
        summary: t('panel.inspector.cookies.fieldInfo.expires.summary'),
        description: t('panel.inspector.cookies.fieldInfo.expires.description'),
      };
    case 'samesite':
      return {
        diagram: <ExampleCard field="samesite" />,
        title: 'SameSite',
        kicker: fieldKicker,
        summary: t('panel.inspector.cookies.fieldInfo.samesite.summary'),
        sections: [
          {
            heading: t('panel.inspector.cookies.fieldInfo.samesite.valuesHeading'),
            items: [
              { label: 'Strict', desc: t('panel.inspector.cookies.fieldInfo.samesite.strict') },
              { label: 'Lax', desc: t('panel.inspector.cookies.fieldInfo.samesite.lax') },
              { label: 'None', desc: t('panel.inspector.cookies.fieldInfo.samesite.none') },
              { label: 'Unspecified', desc: t('panel.inspector.cookies.fieldInfo.samesite.unspecified') },
            ],
          },
        ],
      };
    case 'httponly':
      return {
        diagram: <ExampleCard field="httponly" />,
        title: 'HttpOnly',
        kicker: flagKicker,
        summary: t('panel.inspector.cookies.fieldInfo.httponly.summary'),
        description: t('panel.inspector.cookies.fieldInfo.httponly.description'),
      };
    case 'secure':
      return {
        diagram: <ExampleCard field="secure" />,
        title: 'Secure',
        kicker: flagKicker,
        summary: t('panel.inspector.cookies.fieldInfo.secure.summary'),
        description: t('panel.inspector.cookies.fieldInfo.secure.description'),
      };
    case 'hostonly':
      return {
        diagram: <ExampleCard field="hostonly" />,
        title: 'Host-only',
        kicker: flagKicker,
        summary: t('panel.inspector.cookies.fieldInfo.hostonly.summary'),
        description: t('panel.inspector.cookies.fieldInfo.hostonly.description'),
      };
  }
}

export function CookieEditFieldInfo({ infoKey }: { infoKey: CookieEditFieldKey }) {
  const t = useT();
  const content = useMemo(() => cookieEditFieldInfo(t, infoKey), [t, infoKey]);
  return <InfoTrigger content={content} className="dt-header-info-trigger dt-cookie-edit-info-trigger" />;
}
