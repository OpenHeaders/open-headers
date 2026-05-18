/**
 * Per-column `(i)` info-popover content for the Cookies table. Same
 * pattern as `headers/GeneralRow.tsx` and the Timing tab's column
 * trigger — explains what the column means, its possible values, and
 * how to read the visual treatments (colour coding, glyphs).
 *
 * Popovers stay small — at most a summary + one short `sections`
 * block. Deeper material belongs in the docs panel, not here.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type CookieColumnInfoKey = 'name' | 'value' | 'scope' | 'expires' | 'size' | 'sec';

const COOKIE_COLUMN_INFO: Record<CookieColumnInfoKey, InfoPopoverContent> = {
  name: {
    title: 'Name',
    kicker: 'Cookies',
    summary: 'The cookie identifier. Browsers key on (name, domain, path) — two cookies with the same name but different scope are distinct.',
    description:
      'Chips on the right of the name surface things that are not in any column. Hover a row to swap the chips out for the Override action.',
    sections: [
      {
        heading: 'Role (heuristic)',
        items: [
          { label: 'auth?', desc: 'Looks like an auth / session cookie — name matches sess / session / auth / sid / token / csrf / xsrf / __Host- / __Secure-, or the cookie is HttpOnly with a long random value.' },
          { label: 'tracking?', desc: 'Looks like an analytics / tracking cookie — name matches a known tracker (_ga, _gid, _fbp, NID, IDE, MUID, _hjid, …), or the cookie is third-party with no other classification.' },
          { label: 'pref', desc: 'A user-preference cookie — tz, lang, locale, theme, color-mode, currency, cpu-bucket, font-size, …' },
        ],
      },
      {
        heading: 'Lifecycle',
        items: [
          { label: 'just set', desc: 'Set-Cookie landed on this response and the browser accepted it.' },
          { label: 'dropped', desc: 'Set-Cookie landed but the browser will reject it — failed a rule like SameSite=None without Secure, __Host- prefix violation, __Secure- prefix without Secure, or Partitioned without Secure.' },
          { label: 'filtered out', desc: 'The jar holds this cookie but it was not sent on this request (path mismatch, Secure on http, expired, SameSite restriction, …). Only appears when "Show filtered-out request cookies" is on.' },
        ],
      },
      {
        heading: 'Context',
        items: [
          { label: '3rd-party', desc: 'The cookie\'s domain is cross-site to the page\'s top-frame origin.' },
          { label: 'partitioned', desc: 'CHIPS-style isolation — the cookie is keyed to the top-level site as well as its own scope. Hover for the partition key.' },
          { label: '!', desc: 'This cookie triggered an insight (the warning cards at the top of the tab). See the callout to know why.' },
        ],
      },
      {
        heading: 'Prefixes (visible in the name)',
        items: [
          { label: '__Host-', desc: 'Host-locked — browser enforces Secure, Path=/, no Domain. Violations are rejected.' },
          { label: '__Secure-', desc: 'HTTPS-only — browser enforces Secure. Violations are rejected.' },
        ],
      },
    ],
  },
  value: {
    title: 'Value',
    kicker: 'Cookies',
    summary: 'The cookie payload. Click a row to expand a panel with parsed views when the value carries structure.',
    sections: [
      {
        heading: 'Auto-detected formats',
        items: [
          { label: 'JWT', desc: 'Three base64url segments — header and payload are decoded; exp / iat / nbf claims show as relative times.' },
          { label: 'JSON', desc: 'Pretty-printed in the expander (works after URL-decoding too).' },
          { label: 'b64', desc: 'Plain base64 — decoded body shown when printable.' },
          { label: '%-encoded', desc: 'Percent-encoded text — toggle "Decode URL-encoded values" in View to show decoded inline.' },
        ],
      },
    ],
  },
  scope: {
    title: 'Scope',
    kicker: 'Cookies',
    summary: 'Where the browser will attach this cookie — the combined Domain + Path.',
    description:
      'A leading dot on the domain (e.g. `.openheaders.io`) means subdomains are included. A trailing path like `/api` means the cookie is only sent on requests under that path.',
  },
  expires: {
    title: 'Expires',
    kicker: 'Cookies',
    summary: 'When the browser will stop sending this cookie. Color tracks urgency.',
    sections: [
      {
        heading: 'Reading the color',
        items: [
          { label: 'red', desc: 'Already expired, or expires in under an hour.' },
          { label: 'yellow', desc: 'Expires within 24 hours.' },
          { label: 'plain', desc: 'Future — more than a day away.' },
          { label: 'Session', desc: 'No Expires / Max-Age — the browser drops it when the session ends.' },
        ],
      },
      {
        heading: 'Format',
        items: [
          { label: 'Relative (default)', desc: '"in 7mo", "30s ago" — relative to now. Hover for the absolute date.' },
          { label: 'Absolute', desc: 'UTC date. Toggle in View → Expires.' },
        ],
      },
    ],
  },
  size: {
    title: 'Size',
    kicker: 'Cookies',
    summary: 'Serialized cookie size in bytes — `name=value` length, used for the per-request payload total.',
    description:
      'Most servers and intermediaries cap the combined Cookie header at 4 KB. Oversized payloads can cause 4xx / 5xx responses without a clear error.',
  },
  sec: {
    title: 'Security (S H L)',
    kicker: 'Cookies',
    summary: 'Three glyphs collapse the Secure / HttpOnly / SameSite attributes into one cell. Color carries the meaning.',
    sections: [
      {
        heading: 'Glyphs',
        items: [
          { label: 'S', desc: 'Secure — sent only over HTTPS.' },
          { label: 'H', desc: 'HttpOnly — not readable from JavaScript.' },
          { label: 'L', desc: 'SameSite restriction (Lax / Strict / None).' },
        ],
      },
      {
        heading: 'Color',
        items: [
          { label: 'green', desc: 'On / strict — locked down.' },
          { label: 'yellow', desc: 'Lax — sent on top-level cross-site GETs.' },
          { label: 'red', desc: 'Missing where required (SameSite=None without Secure, __Host- without Secure, …) — browser will reject.' },
          { label: 'gray', desc: 'Off / unspecified.' },
        ],
      },
    ],
  },
};

export function CookieColumnInfo({ infoKey }: { infoKey: CookieColumnInfoKey }) {
  return (
    <InfoTrigger
      content={COOKIE_COLUMN_INFO[infoKey]}
      className="dt-header-info-trigger dt-cookie-col-info-trigger"
    />
  );
}
