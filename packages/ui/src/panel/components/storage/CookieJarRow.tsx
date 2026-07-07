/**
 * One jar cookie in the Storage tool window's Cookies section — the
 * thin, request-free counterpart of the detail tab's CookieRow (no
 * direction, HAR joins, attribution chips or override CTA; those only
 * mean something on a captured request). Columns: Name · Value ·
 * Domain·Path · Expires · Sec, with the grid's hover edit/delete lane.
 * Edits reuse the shipped CookieEditPopover + jar write path.
 */

import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { jarCookieToEditForm } from '../../data/cookies/cookie-edit';
import { formatAbsoluteExpiry, formatRelativeExpiry } from '../../data/cookies/cookie-format';
import type { JarCookie, JarCookieEdit } from '../../data/cookies/cookie-jar-cache';
import { CookieEditPopover } from '../detail/cookies/CookieEditPopover';
import { SecurityGlyphs } from '../detail/cookies/SecurityGlyphs';

interface CookieJarRowProps {
  cookie: JarCookie;
  writable: boolean;
  now: number;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
}

export function CookieJarRow({ cookie, writable, now, onApplyEdit, onDelete }: CookieJarRowProps) {
  const scope = `${cookie.domain}${cookie.path && cookie.path !== '/' ? ` ${cookie.path}` : ''}`;
  const scopeTitle = `${cookie.domain}${cookie.path || '/'}${cookie.partitionKey ? `\nPartitioned under ${cookie.partitionKey}` : ''}`;
  return (
    <div className="dt-storage-row" role="row">
      <span className="dt-storage-key" role="cell" title={cookie.name}>
        {cookie.name}
      </span>
      <span className="dt-storage-value" role="cell" title={cookie.value}>
        {cookie.value}
      </span>
      <span className="dt-storage-cookie-scope" role="cell" title={scopeTitle}>
        {scope}
      </span>
      <span
        className="dt-storage-cookie-exp"
        role="cell"
        title={formatAbsoluteExpiry(cookie.expirationDate, cookie.session)}
      >
        {formatRelativeExpiry(cookie.expirationDate, cookie.session, now)}
      </span>
      <span className="dt-storage-cookie-sec" role="cell">
        <SecurityGlyphs row={cookie} />
      </span>
      {writable && (
        <span className="dt-storage-row-actions">
          <CookieEditPopover mode="edit" canonical={jarCookieToEditForm(cookie)} onSubmit={onApplyEdit}>
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
