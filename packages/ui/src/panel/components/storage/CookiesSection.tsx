/**
 * The Storage tool window's Cookies section — the selected scope's slice
 * of the browser jar (the jar fans domain cookies into the scope URL's
 * lookup), rendered as a grid of jar-only rows. Purely presentational:
 * the panel owns the data (sticky jar hook), filtering, and the write
 * plumbing it passes down.
 */

import type React from 'react';
import { explainFilteredOut } from '../../data/cookies/cookie-enrich';
import { cookieEditKey, type JarCookie, type JarCookieEdit, type SiteJarCookie } from '../../data/cookies/cookie-jar-cache';
import { walkListSelection } from '../walk-list-selection';
import { CookieJarRow } from './CookieJarRow';
import { JarCookieColumnInfo } from './JarCookieColumnInfo';
import { StorageColumnHeaderCell } from './StorageColumnHeaderCell';

interface CookiesSectionProps {
  cookies: ReadonlyArray<SiteJarCookie>;
  /** The inspected scope's URL — the not-sent badge explains a row
   *  against it ("why doesn't this page receive this cookie?"). */
  scopeUrl: string;
  writable: boolean;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
  /** Open one cookie as an editor-tab document (single-click gesture). */
  onOpen?: (cookie: SiteJarCookie) => void;
  /** Whether a cookie is the ACTIVE editor tab's document — exactly
   *  that row renders highlighted, tracking tab switches. */
  isActive?: (cookie: SiteJarCookie) => boolean;
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

export function CookiesSection({
  cookies,
  scopeUrl,
  writable,
  onApplyEdit,
  onDelete,
  onOpen,
  isActive,
}: CookiesSectionProps) {
  const now = Date.now();
  const parsedScope = safeParseUrl(scopeUrl);

  // Keyboard row navigation — StorageGrid's selection model verbatim:
  // no grid-local selection state; an arrow move opens the cookie
  // document like a click (`onOpen`) and the row highlight follows the
  // same active-editor-tab derivation the click rides (`isActive`).
  // Two deltas from the DOM-storage grid. There is no inline edit row —
  // edits ride the pencil's CookieEditPopover — so the stand-down
  // watches for an OPEN popover instead of a mounted edit row: the
  // popover body exists in the document exactly while open
  // (`destroyOnHidden`), and its fields' presses bubble here through
  // the React tree despite the portal. And Enter has NO gesture: the
  // inline edit it twins on the DOM grid doesn't exist here, the
  // popover is trigger-anchored antd state only its pencil opens, and
  // the document Enter could otherwise open is already open — the
  // arrow move that made the row active opened it. PageUp/PageDown
  // stay unhandled (`pageRows: null` — panel-shell scroller, rows not
  // pinned-height).
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea') !== null) return;
    if (e.currentTarget.ownerDocument.querySelector('.dt-cookie-edit-popover') !== null) return;
    if (cookies.length === 0) return;
    const pos = isActive ? cookies.findIndex((c) => isActive(c)) : -1;
    const next = walkListSelection(cookies.length, pos, e.key, null);
    if (next === null) return;
    e.preventDefault();
    if (next !== pos) onOpen?.(cookies[next]);
    // Rows aren't windowed — a plain nearest reveal suffices; the rows'
    // scroll-margin-top keeps the target clear of the sticky header.
    e.currentTarget.querySelector(`.dt-storage-row[data-entry-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    // role="grid" + focusable container, StorageGrid's anatomy: the rows
    // are plain divs, so a row click focuses the grid as the nearest
    // focusable ancestor; the active-row highlight is the focus
    // affordance, no ring on the box.
    <div
      className="dt-storage-grid dt-storage-grid--cookies"
      role="grid"
      aria-label="Cookies"
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
    >
      <div className="dt-storage-grid-header" role="row">
        <StorageColumnHeaderCell label="Name" info={<JarCookieColumnInfo infoKey="name" />} />
        <StorageColumnHeaderCell label="Value" info={<JarCookieColumnInfo infoKey="value" />} />
        <StorageColumnHeaderCell label="Domain · Path" info={<JarCookieColumnInfo infoKey="scope" />} />
        <StorageColumnHeaderCell label="Expires" info={<JarCookieColumnInfo infoKey="expires" />} />
        <StorageColumnHeaderCell label="Sec" info={<JarCookieColumnInfo infoKey="sec" />} />
      </div>
      {cookies.map((c, i) => (
        <CookieJarRow
          key={rowKey(c)}
          cookie={c}
          entryIndex={i}
          scopeUrl={scopeUrl}
          writable={writable}
          now={now}
          notSentReason={!c.sendable && parsedScope ? explainFilteredOut(c, parsedScope, now) : undefined}
          active={isActive?.(c)}
          onOpen={onOpen ? () => onOpen(c) : undefined}
          onApplyEdit={onApplyEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
