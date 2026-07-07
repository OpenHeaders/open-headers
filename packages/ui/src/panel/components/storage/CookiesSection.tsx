/**
 * The Storage tool window's Cookies section — the selected scope's slice
 * of the browser jar (the jar fans domain cookies into the scope URL's
 * lookup), rendered as a grid of jar-only rows. Purely presentational:
 * the panel owns the data (sticky jar hook), filtering, and the write
 * plumbing it passes down.
 */

import { cookieEditKey, type JarCookie, type JarCookieEdit } from '../../data/cookies/cookie-jar-cache';
import { CookieJarRow } from './CookieJarRow';

interface CookiesSectionProps {
  cookies: ReadonlyArray<JarCookie>;
  writable: boolean;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
}

function rowKey(c: JarCookie): string {
  return `${cookieEditKey(c.name, c.domain, c.path)}|${c.partitionKey ?? ''}`;
}

export function CookiesSection({ cookies, writable, onApplyEdit, onDelete }: CookiesSectionProps) {
  const now = Date.now();
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
          onApplyEdit={onApplyEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
