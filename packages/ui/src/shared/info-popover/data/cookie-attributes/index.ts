/**
 * Set-Cookie attribute docs registry — powers the response Cookies
 * tab's per-attribute popovers. Same in-app-docs discipline as the
 * http-headers and http-status corpora: `getCookieAttributeInfoContent`
 * always returns content — curated attributes get specific copy,
 * anything else an honest fallback.
 */

import type { InfoPopoverContent } from '../../types';

interface CookieAttributeEntry {
  /** Canonical spelling, shown regardless of the server's casing. */
  display: string;
  /** One-sentence meaning. */
  summary: string;
  /** Optional extra guidance. */
  body?: string;
}

const ATTRIBUTE_INFO: ReadonlyMap<string, CookieAttributeEntry> = new Map<string, CookieAttributeEntry>([
  [
    'domain',
    {
      display: 'Domain',
      summary: 'The host the cookie is sent to — including subdomains when set.',
      body: 'Without Domain, the cookie is scoped to exactly the responding host, excluding subdomains.',
    },
  ],
  [
    'path',
    {
      display: 'Path',
      summary: 'The URL path prefix that must be present for the browser to send the cookie.',
    },
  ],
  [
    'expires',
    {
      display: 'Expires',
      summary: 'Absolute expiry date — the cookie persists until this moment.',
      body: 'Without Expires or Max-Age the cookie is a session cookie, discarded when the browser session ends.',
    },
  ],
  [
    'max-age',
    {
      display: 'Max-Age',
      summary: 'Lifetime in seconds from receipt; takes precedence over Expires when both are present.',
      body: 'Zero or negative expires the cookie immediately — the standard way to delete one.',
    },
  ],
  [
    'secure',
    {
      display: 'Secure',
      summary: 'The cookie is only sent over HTTPS connections.',
      body: 'Required for SameSite=None cookies — browsers reject cross-site cookies without it.',
    },
  ],
  [
    'httponly',
    {
      display: 'HttpOnly',
      summary: 'The cookie is invisible to page JavaScript (document.cookie) — sent on requests only.',
      body: 'Standard defense against session-token theft via script injection.',
    },
  ],
  [
    'samesite',
    {
      display: 'SameSite',
      summary: 'Controls whether the cookie rides cross-site requests: Strict, Lax, or None.',
      body: 'Strict: same-site only. Lax (the default): plus top-level navigations. None: everywhere, but requires Secure.',
    },
  ],
  [
    'partitioned',
    {
      display: 'Partitioned',
      summary: 'Stores the cookie per top-level site (CHIPS) — a third-party cookie that cannot track across sites.',
    },
  ],
  [
    'priority',
    {
      display: 'Priority',
      summary: 'Chromium-specific eviction hint (Low / Medium / High) for when the cookie jar is full.',
    },
  ],
]);

export function getCookieAttributeInfoContent(name: string): InfoPopoverContent {
  const entry = ATTRIBUTE_INFO.get(name.trim().toLowerCase());
  if (!entry) {
    return {
      title: name,
      kicker: 'Set-Cookie attribute',
      summary: 'This attribute is not documented in our registry.',
      description:
        'It may be a vendor-specific or experimental Set-Cookie extension; browsers ignore attributes they do not recognize.',
    };
  }
  return {
    title: entry.display,
    kicker: 'Set-Cookie attribute',
    summary: entry.summary,
    ...(entry.body !== undefined ? { description: entry.body } : {}),
  };
}

/** Count of curated attributes, exposed for tests + sanity checks. */
export function cookieAttributeInfoCount(): number {
  return ATTRIBUTE_INFO.size;
}
