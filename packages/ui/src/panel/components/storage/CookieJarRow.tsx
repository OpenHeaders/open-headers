/**
 * One jar cookie in the Storage tool window's Cookies section — the
 * thin, request-free counterpart of the detail tab's CookieRow (no
 * direction, HAR joins, attribution chips or override CTA; those only
 * mean something on a captured request). Columns: Name · Value ·
 * Domain·Path · Expires · Sec, with the grid's hover edit/delete lane.
 * A single click opens the cookie as a full editor-tab document; the
 * pencil's CookieEditPopover stays for quick edits.
 */

import { DeleteOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import { jarCookieToEditForm, jarCookieToKey } from '../../data/cookies/cookie-edit';
import { formatAbsoluteExpiry, formatRelativeExpiry } from '../../data/cookies/cookie-format';
import type { JarCookie, JarCookieEdit } from '../../data/cookies/cookie-jar-cache';
import { CookieEditPopover } from '../detail/cookies/CookieEditPopover';
import { SecurityGlyphs } from '../detail/cookies/SecurityGlyphs';

interface CookieJarRowProps {
  cookie: JarCookie;
  /** Position in the section's display order — the grid's keyboard
   *  reveal finds the row through it (`data-entry-index`). */
  entryIndex: number;
  /** The inspected scope's URL — the edit popover's live jar sync
   *  reads through it. */
  scopeUrl: string;
  writable: boolean;
  now: number;
  /** Set on site-jar rows the browser would NOT attach to a request to
   *  the inspected scope — renders the not-sent badge with this reason. */
  notSentReason?: string;
  /** This cookie is the ACTIVE editor tab's document — the row renders
   *  highlighted. */
  active?: boolean;
  /** Open the cookie as an editor-tab document (single-click gesture). */
  onOpen?: (cookie: JarCookie) => void;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
}

export function CookieJarRow({
  cookie,
  entryIndex,
  scopeUrl,
  writable,
  now,
  notSentReason,
  active,
  onOpen,
  onApplyEdit,
  onDelete,
}: CookieJarRowProps) {
  const scope = `${cookie.domain}${cookie.path && cookie.path !== '/' ? ` ${cookie.path}` : ''}`;
  const scopeTitle = `${cookie.domain}${cookie.path || '/'}${cookie.partitionKey ? `\nPartitioned under ${cookie.partitionKey}` : ''}`;
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: grid row doubles as the open affordance
    <div
      className={`dt-storage-row${active ? ' dt-storage-row--active' : ''}`}
      role="row"
      aria-selected={active ?? false}
      data-entry-index={entryIndex}
      onClick={() => onOpen?.(cookie)}
    >
      <span className="dt-storage-key" role="gridcell" title={cookie.name}>
        {notSentReason !== undefined && (
          <WarningOutlined
            className="dt-storage-cookie-warn"
            title={`Not sent to this page — ${notSentReason}`}
            aria-label={`Cookie ${cookie.name} is not sent to this page: ${notSentReason}`}
          />
        )}
        {cookie.name}
      </span>
      <span className="dt-storage-value" role="gridcell" title={cookie.value}>
        {cookie.value}
      </span>
      <span className="dt-storage-cookie-scope" role="gridcell" title={scopeTitle}>
        {scope}
      </span>
      <span
        className="dt-storage-cookie-exp"
        role="gridcell"
        title={formatAbsoluteExpiry(cookie.expirationDate, cookie.session)}
      >
        {formatRelativeExpiry(cookie.expirationDate, cookie.session, now)}
      </span>
      <span className="dt-storage-cookie-sec" role="gridcell">
        <SecurityGlyphs row={cookie} />
      </span>
      {writable && (
        // biome-ignore lint/a11y/noStaticElementInteractions: swallows row-open clicks under the action lane
        <span className="dt-storage-row-actions" onClick={(ev) => ev.stopPropagation()}>
          <CookieEditPopover
            mode="edit"
            canonical={jarCookieToEditForm(cookie)}
            document={{
              scopeUrl,
              cookieKey: jarCookieToKey(cookie),
              ...(onOpen ? { onOpen: () => onOpen(cookie) } : {}),
            }}
            onSubmit={onApplyEdit}
          >
            <button
              type="button"
              className="dt-storage-action"
              title="Edit this cookie in the browser jar"
              aria-label={`Edit cookie ${cookie.name}`}
            >
              <EditOutlined />
            </button>
          </CookieEditPopover>
          <button
            type="button"
            className="dt-storage-action"
            title="Delete this cookie from the browser jar"
            aria-label={`Delete cookie ${cookie.name}`}
            onClick={() => onDelete(cookie)}
          >
            <DeleteOutlined />
          </button>
        </span>
      )}
    </div>
  );
}
