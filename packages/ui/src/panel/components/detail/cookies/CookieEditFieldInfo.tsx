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

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

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
  domain: 'Domain=.openheaders.io',
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
  const lit = new Set<CookieExampleToken>(highlight);
  const tok = (id: CookieExampleToken, text: string) => (
    <span className={`dt-col-eg-tok${lit.has(id) ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example Set-Cookie</div>
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

const TEMPLATE_NOTE =
  'Accepts {{variable}} references, resolved once when you save — the jar stores the resolved text.';

const COOKIE_EDIT_FIELD_INFO: Record<CookieEditFieldKey, InfoPopoverContent> = {
  name: {
    diagram: <ExampleCard field="name" />,
    title: 'Name',
    kicker: 'Cookie field',
    summary: 'The cookie identifier. Browsers key on (name, domain, path) — same name with a different scope is a separate cookie.',
    description: `Prefixes are enforced by the browser: __Host- requires Secure, Path=/ and no Domain; __Secure- requires Secure. ${TEMPLATE_NOTE}`,
  },
  value: {
    diagram: <ExampleCard field="value" />,
    title: 'Value',
    kicker: 'Cookie field',
    summary: 'The cookie payload — what the browser sends back in the Cookie header.',
    description: `${TEMPLATE_NOTE} The value is a snapshot: if the variable changes later the jar keeps this text — use an Override Cookies rule when the value should track the variable.`,
  },
  domain: {
    diagram: <ExampleCard field="domain" />,
    title: 'Domain',
    kicker: 'Cookie field',
    summary: 'Which hosts receive the cookie.',
    description: `A plain domain like openheaders.io includes its subdomains (the browser stores it with a leading dot) unless Host-only is on, which pins the cookie to exactly this host. ${TEMPLATE_NOTE}`,
  },
  path: {
    diagram: <ExampleCard field="path" />,
    title: 'Path',
    kicker: 'Cookie field',
    summary: 'URL path prefix the cookie rides on — /api means only requests under /api carry it.',
    description: `Defaults to /. ${TEMPLATE_NOTE}`,
  },
  expires: {
    diagram: <ExampleCard field="expires" />,
    title: 'Expires',
    kicker: 'Cookie field',
    summary: 'When the browser deletes the cookie.',
    description:
      'Session cookies live until the browser session ends; On date sets an absolute expiry (stored as the Expires attribute).',
  },
  samesite: {
    diagram: <ExampleCard field="samesite" />,
    title: 'SameSite',
    kicker: 'Cookie field',
    summary: 'When cross-site requests may carry the cookie.',
    sections: [
      {
        heading: 'Values',
        items: [
          { label: 'Strict', desc: 'Same-site requests only.' },
          { label: 'Lax', desc: 'Same-site plus top-level cross-site navigations (GET).' },
          { label: 'None', desc: 'Sent cross-site too — the browser requires Secure with it.' },
          { label: 'Unspecified', desc: 'Browser default (treated as Lax in Chrome).' },
        ],
      },
    ],
  },
  httponly: {
    diagram: <ExampleCard field="httponly" />,
    title: 'HttpOnly',
    kicker: 'Cookie flag',
    summary: 'Hides the cookie from page JavaScript — document.cookie can’t read or overwrite it.',
    description:
      'Only servers (Set-Cookie) and this editor can create HttpOnly cookies; page scripts can’t. The standard hardening for session tokens.',
  },
  secure: {
    diagram: <ExampleCard field="secure" />,
    title: 'Secure',
    kicker: 'Cookie flag',
    summary: 'The cookie travels only over HTTPS — plain http requests never carry it.',
    description: 'Required for SameSite=None and for the __Host- / __Secure- name prefixes.',
  },
  hostonly: {
    diagram: <ExampleCard field="hostonly" />,
    title: 'Host-only',
    kicker: 'Cookie flag',
    summary: 'Pins the cookie to exactly the Domain host — subdomains don’t receive it.',
    description:
      'Off, the cookie is stored domain-wide (leading-dot form) and flows to subdomains. The browser’s own cookies are host-only when the server omitted the Domain attribute.',
  },
};

export function CookieEditFieldInfo({ infoKey }: { infoKey: CookieEditFieldKey }) {
  return (
    <InfoTrigger
      content={COOKIE_EDIT_FIELD_INFO[infoKey]}
      className="dt-header-info-trigger dt-cookie-edit-info-trigger"
    />
  );
}
