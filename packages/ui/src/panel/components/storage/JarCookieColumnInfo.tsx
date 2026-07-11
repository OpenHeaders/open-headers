/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * Cookies grid — the network table's `NetworkColumnInfo` idiom. Every
 * popover leads with the cookie editor's canonical Set-Cookie example
 * (`CookieEditFieldInfo`'s card), each column lighting up its own
 * slice, so the grid and the editor teach against the same cookie.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CookieExampleCard, type CookieExampleToken } from '../detail/cookies/CookieEditFieldInfo';

export type JarCookieColumnKey = 'name' | 'value' | 'scope' | 'expires' | 'sec';

/** Which token(s) of the shared Set-Cookie example each column lights
 *  up. Scope spans Domain + Path; Sec collapses the three attribute
 *  flags into one cell. */
const HIGHLIGHT: Record<JarCookieColumnKey, readonly CookieExampleToken[]> = {
  name: ['name'],
  value: ['value'],
  scope: ['domain', 'path'],
  expires: ['expires'],
  sec: ['secure', 'httponly', 'samesite'],
};

const JAR_COOKIE_COLUMN_INFO: Record<JarCookieColumnKey, InfoPopoverContent> = {
  name: {
    title: 'Name',
    kicker: 'Cookies',
    summary:
      'The cookie identifier. Browsers key on (name, domain, path) — the same name with a different scope is a separate cookie.',
    description:
      'A warning triangle marks a site-jar cookie the browser would NOT attach to a request to the inspected page — hover it for the reason (path scoped elsewhere, Secure-only on http, subdomain scoped, …).',
    diagram: <CookieExampleCard highlight={HIGHLIGHT.name} />,
  },
  value: {
    title: 'Value',
    kicker: 'Cookies',
    summary: 'The cookie payload — what the browser sends back in the Cookie header.',
    description:
      'Click a row to open the cookie as an editor tab with the full value and parsed views; the pencil edits inline.',
    diagram: <CookieExampleCard highlight={HIGHLIGHT.value} />,
  },
  scope: {
    title: 'Domain · Path',
    kicker: 'Cookies',
    summary: 'Where the browser attaches this cookie — its Domain plus, when narrower than /, its Path.',
    description:
      'A domain-wide cookie (stored with a leading dot) flows to subdomains too; a host-only cookie is pinned to exactly its host. The path is a prefix — /api means only requests under /api carry it.',
    diagram: <CookieExampleCard highlight={HIGHLIGHT.scope} />,
  },
  expires: {
    title: 'Expires',
    kicker: 'Cookies',
    summary: 'When the browser deletes the cookie, shown relative to now — hover for the absolute date.',
    description: 'Session means no Expires / Max-Age — the browser drops the cookie when the session ends.',
    diagram: <CookieExampleCard highlight={HIGHLIGHT.expires} />,
  },
  sec: {
    title: 'Security (S H L)',
    kicker: 'Cookies',
    summary:
      'Three glyphs collapse the Secure / HttpOnly / SameSite attributes into one cell. Color carries the meaning.',
    diagram: <CookieExampleCard highlight={HIGHLIGHT.sec} />,
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

export function JarCookieColumnInfo({ infoKey }: { infoKey: JarCookieColumnKey }) {
  return (
    <InfoTrigger
      content={JAR_COOKIE_COLUMN_INFO[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}
