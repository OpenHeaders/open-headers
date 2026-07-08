/**
 * The Storage tool window's Cookies section — the selected scope's slice
 * of the browser jar (the jar fans domain cookies into the scope URL's
 * lookup), rendered as a grid of jar-only rows. Purely presentational:
 * the panel owns the data (sticky jar hook), filtering, and the write
 * plumbing it passes down.
 */

import { explainFilteredOut } from '../../data/cookies/cookie-enrich';
import { cookieEditKey, type JarCookie, type JarCookieEdit, type SiteJarCookie } from '../../data/cookies/cookie-jar-cache';
import { CookieJarRow } from './CookieJarRow';

interface CookiesSectionProps {
  cookies: ReadonlyArray<SiteJarCookie>;
  /** The inspected scope's URL — the not-sent badge explains a row
   *  against it ("why doesn't this page receive this cookie?"). */
  scopeUrl: string;
  writable: boolean;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
}

function rowKey(c: JarCookie): string {
  return `${cookieEditKey(c.name, c.domain, c.path)}|${c.partitionKey ?? ''}`;
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function CookiesSection({ cookies, scopeUrl, writable, onApplyEdit, onDelete }: CookiesSectionProps) {
  const now = Date.now();
  const parsedScope = safeParseUrl(scopeUrl);
  return (
    <div className="dt-storage-grid dt-storage-grid--cookies" role="table" aria-label="Cookies">
      <div className="dt-storage-grid-header" role="row">
        <span role="columnheader">Name</span>
        <span role="columnheader">Value</span>
        <span role="columnheader">Domain · Path</span>
        <span role="columnheader">Expires</span>
        <span role="columnheader">Sec</span>
      </div>
      {cookies.map((c) => (
        <CookieJarRow
          key={rowKey(c)}
          cookie={c}
          writable={writable}
          now={now}
          notSentReason={!c.sendable && parsedScope ? explainFilteredOut(c, parsedScope, now) : undefined}
          onApplyEdit={onApplyEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
