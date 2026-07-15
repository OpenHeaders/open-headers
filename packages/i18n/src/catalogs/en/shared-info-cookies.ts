/**
 * Shared info-popover corpus — Set-Cookie attributes. Prose for the
 * per-attribute popovers on cookie surfaces (workbench response
 * Cookies tab; shared-plane so panel surfaces can key the same
 * entries). Attribute names (Domain / Path / Expires / …) are wire
 * vocabulary and stay raw in the data registry — only summaries,
 * guidance bodies, and the popover chrome live here.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Set-Cookie attribute',
  'shared.info.cookie.fallbackSummary': 'This attribute is not documented in our registry.',
  'shared.info.cookie.fallbackDescription':
    'It may be a vendor-specific or experimental Set-Cookie extension; browsers ignore attributes they do not recognize.',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary': 'The host the cookie is sent to — including subdomains when set.',
  'shared.info.cookie.domain.body':
    'Without Domain, the cookie is scoped to exactly the responding host, excluding subdomains.',
  'shared.info.cookie.path.summary': 'The URL path prefix that must be present for the browser to send the cookie.',
  'shared.info.cookie.expires.summary': 'Absolute expiry date — the cookie persists until this moment.',
  'shared.info.cookie.expires.body':
    'Without Expires or Max-Age the cookie is a session cookie, discarded when the browser session ends.',
  'shared.info.cookie.maxAge.summary':
    'Lifetime in seconds from receipt; takes precedence over Expires when both are present.',
  'shared.info.cookie.maxAge.body': 'Zero or negative expires the cookie immediately — the standard way to delete one.',
  'shared.info.cookie.secure.summary': 'The cookie is only sent over HTTPS connections.',
  'shared.info.cookie.secure.body':
    'Required for SameSite=None cookies — browsers reject cross-site cookies without it.',
  'shared.info.cookie.httponly.summary':
    'The cookie is invisible to page JavaScript (document.cookie) — sent on requests only.',
  'shared.info.cookie.httponly.body': 'Standard defense against session-token theft via script injection.',
  'shared.info.cookie.samesite.summary': 'Controls whether the cookie rides cross-site requests: Strict, Lax, or None.',
  'shared.info.cookie.samesite.body':
    'Strict: same-site only. Lax (the default): plus top-level navigations. None: everywhere, but requires Secure.',
  'shared.info.cookie.partitioned.summary':
    'Stores the cookie per top-level site (CHIPS) — a third-party cookie that cannot track across sites.',
  'shared.info.cookie.priority.summary':
    'Chromium-specific eviction hint (Low / Medium / High) for when the cookie jar is full.',
} as const satisfies Catalog;
