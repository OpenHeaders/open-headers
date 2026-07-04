/**
 * Per-field `(i)` info-popover content for the Add / Edit cookie form.
 * Same pattern as `CookieColumnInfo.tsx` — explains what the field
 * means and what the browser does with it. Popovers stay small; the
 * text fields all share the template note (resolved once at Save).
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

const TEMPLATE_NOTE =
  'Accepts {{variable}} references, resolved once when you save — the jar stores the resolved text.';

const COOKIE_EDIT_FIELD_INFO: Record<CookieEditFieldKey, InfoPopoverContent> = {
  name: {
    title: 'Name',
    kicker: 'Cookie field',
    summary: 'The cookie identifier. Browsers key on (name, domain, path) — same name with a different scope is a separate cookie.',
    description: `Prefixes are enforced by the browser: __Host- requires Secure, Path=/ and no Domain; __Secure- requires Secure. ${TEMPLATE_NOTE}`,
  },
  value: {
    title: 'Value',
    kicker: 'Cookie field',
    summary: 'The cookie payload — what the browser sends back in the Cookie header.',
    description: `${TEMPLATE_NOTE} The value is a snapshot: if the variable changes later the jar keeps this text — use an Override Cookies rule when the value should track the variable.`,
  },
  domain: {
    title: 'Domain',
    kicker: 'Cookie field',
    summary: 'Which hosts receive the cookie.',
    description: `A plain domain like openheaders.io includes its subdomains (the browser stores it with a leading dot) unless Host-only is on, which pins the cookie to exactly this host. ${TEMPLATE_NOTE}`,
  },
  path: {
    title: 'Path',
    kicker: 'Cookie field',
    summary: 'URL path prefix the cookie rides on — /api means only requests under /api carry it.',
    description: `Defaults to /. ${TEMPLATE_NOTE}`,
  },
  expires: {
    title: 'Expires',
    kicker: 'Cookie field',
    summary: 'When the browser deletes the cookie.',
    description:
      'Session cookies live until the browser session ends; On date sets an absolute expiry (stored as the Expires attribute).',
  },
  samesite: {
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
    title: 'HttpOnly',
    kicker: 'Cookie flag',
    summary: 'Hides the cookie from page JavaScript — document.cookie can’t read or overwrite it.',
    description:
      'Only servers (Set-Cookie) and this editor can create HttpOnly cookies; page scripts can’t. The standard hardening for session tokens.',
  },
  secure: {
    title: 'Secure',
    kicker: 'Cookie flag',
    summary: 'The cookie travels only over HTTPS — plain http requests never carry it.',
    description: 'Required for SameSite=None and for the __Host- / __Secure- name prefixes.',
  },
  hostonly: {
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
