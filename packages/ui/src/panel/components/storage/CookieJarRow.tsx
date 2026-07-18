/**
 * One jar cookie in the Storage tool window's Cookies section — the
 * thin, request-free counterpart of the detail tab's CookieRow (no
 * direction, HAR joins, attribution chips or override CTA; those only
 * mean something on a captured request). Columns: Name · Value ·
 * Domain·Path · Expires · Sec, with the grid's hover edit/delete lane.
 * A single click opens the cookie as a full editor-tab document; the
 * pencil's CookieEditPopover stays for quick edits.
 */

import { DeleteOutlined, EditOutlined, EyeOutlined, WarningOutlined } from '@ant-design/icons';
import { type Translate, useLocale } from '@openheaders/ui/context/LocaleContext';
import { useValueViewAction } from '@openheaders/ui/workbench/components/value-editors/useValueViewAction';
import { useMemo } from 'react';
import { introspectWithAuthScheme } from '../../data/auth-scheme';
import { jarCookieToEditForm, jarCookieToKey } from '../../data/cookies/cookie-edit';
import { formatAbsoluteExpiry, formatRelativeExpiry } from '../../data/cookies/cookie-format';
import type { JarCookie, JarCookieEdit } from '../../data/cookies/cookie-jar-cache';
import { introspectionDetected, introspectionHint } from '../../data/value-introspect';
import { CookieEditPopover } from '../detail/cookies/CookieEditPopover';
import { SecurityGlyphs } from '../detail/cookies/SecurityGlyphs';

// Row copy resolved once per locale — the cookie loop reads this
// object, never `t()` (per-row law). Data-plane not-sent reasons ride
// as raw holes inside the keyed sentences.
export function buildCookieRowLabels(t: Translate) {
  return {
    notSentTitle: (reason: string) => t('panel.storage.cookieRow.notSentTitle', { reason }),
    notSentAria: (name: string, reason: string) => t('panel.storage.cookieRow.notSentAria', { name, reason }),
    partitionedUnder: (key: string) => t('panel.storage.cookieRow.partitionedUnder', { key }),
    editTitle: t('panel.storage.cookieRow.editTitle'),
    editAria: (name: string) => t('panel.storage.cookieRow.editAria', { name }),
    deleteTitle: t('panel.storage.cookieRow.deleteTitle'),
    deleteAria: (name: string) => t('panel.storage.cookieRow.deleteAria', { name }),
  };
}
export type CookieRowLabels = ReturnType<typeof buildCookieRowLabels>;

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
  labels: CookieRowLabels;
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
  labels,
}: CookieJarRowProps) {
  const { locale } = useLocale();
  // Same registry pass the cookies TAB rows run — memoized per row (the
  // jar renders unwindowed, potentially hundreds of rows). The hit feeds
  // the hint glyph and the read-only view icon; depth beyond the modal
  // stays with the editor-tab document the row click opens.
  const introspection = useMemo(() => introspectWithAuthScheme(cookie.value), [cookie.value]);
  const hintKind = introspectionHint(introspection);
  const { viewProps, viewerModal } = useValueViewAction(introspectionDetected(introspection));
  const hasView = 'onValueView' in viewProps;
  const scope = `${cookie.domain}${cookie.path && cookie.path !== '/' ? ` ${cookie.path}` : ''}`;
  const scopeTitle = `${cookie.domain}${cookie.path || '/'}${
    cookie.partitionKey ? `\n${labels.partitionedUnder(cookie.partitionKey)}` : ''
  }`;
  return (
    <>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: grid row doubles as the open affordance */}
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
              title={labels.notSentTitle(notSentReason)}
              aria-label={labels.notSentAria(cookie.name, notSentReason)}
            />
          )}
          {cookie.name}
        </span>
        <span className="dt-storage-value dt-storage-value--hinted" role="gridcell" title={cookie.value}>
          <span className="dt-storage-value-text">{cookie.value}</span>
          {hintKind === 'jwt' && <span className="dt-cookie-value-hint">JWT</span>}
          {hintKind === 'json' && <span className="dt-cookie-value-hint">JSON</span>}
          {hintKind === 'base64' && <span className="dt-cookie-value-hint">b64</span>}
        </span>
        <span className="dt-storage-cookie-scope" role="gridcell" title={scopeTitle}>
          {scope}
        </span>
        <span
          className="dt-storage-cookie-exp"
          role="gridcell"
          title={formatAbsoluteExpiry(cookie.expirationDate, cookie.session)}
        >
          {formatRelativeExpiry(cookie.expirationDate, cookie.session, now, locale)}
        </span>
        <span className="dt-storage-cookie-sec" role="gridcell">
          <SecurityGlyphs row={cookie} />
        </span>
        {(writable || hasView) && (
          // biome-ignore lint/a11y/noStaticElementInteractions: swallows row-open clicks under the action lane
          <span className="dt-storage-row-actions" onClick={(ev) => ev.stopPropagation()}>
            {hasView && (
              <button
                type="button"
                className="dt-storage-action"
                title={viewProps.viewTooltip}
                aria-label={viewProps.viewTooltip}
                onClick={viewProps.onValueView}
              >
                <EyeOutlined />
              </button>
            )}
            {writable && (
              <>
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
                    title={labels.editTitle}
                    aria-label={labels.editAria(cookie.name)}
                  >
                    <EditOutlined />
                  </button>
                </CookieEditPopover>
                <button
                  type="button"
                  className="dt-storage-action"
                  title={labels.deleteTitle}
                  aria-label={labels.deleteAria(cookie.name)}
                  onClick={() => onDelete(cookie)}
                >
                  <DeleteOutlined />
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {viewerModal}
    </>
  );
}
