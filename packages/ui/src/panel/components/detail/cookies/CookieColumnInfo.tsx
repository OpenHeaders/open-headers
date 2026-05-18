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
    summary: 'The cookie identifier. Hover a row to swap the chips out for Override. Hover a __Host- / __Secure- name for its rule.',
    sections: [
      {
        heading: 'Role',
        items: [
          { label: 'auth?', desc: 'Session / auth shape — name or HttpOnly + long random value.' },
          { label: 'tracking?', desc: 'Known tracker name (_ga, _fbp, NID, …) or third-party.' },
          { label: 'pref', desc: 'User preference (tz, lang, theme, color-mode, …).' },
        ],
      },
      {
        heading: 'Lifecycle',
        items: [
          { label: 'just set', desc: 'Set-Cookie on this response, accepted.' },
          { label: 'dropped', desc: 'Set-Cookie sent but browser will reject it (see insight).' },
          { label: 'filtered out', desc: 'In jar, not sent this request — path / Secure / SameSite / expiry mismatch.' },
        ],
      },
      {
        heading: 'Context',
        items: [
          { label: '3rd-party', desc: 'Cross-site to the top-frame origin.' },
          { label: 'partitioned', desc: 'CHIPS-isolated to one top-level site.' },
          { label: '!', desc: 'Triggered an insight — see the callout above.' },
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
