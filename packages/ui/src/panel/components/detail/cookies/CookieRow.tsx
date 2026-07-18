/**
 * One cookie row plus an optional expander row beneath it.
 *
 * Columns (in render order): Name · Value · Scope · Expires · Size · Sec · ⋯
 *
 *   - `Scope` is `domain · path` merged into one column (they're
 *     read together).
 *   - `Sec`   is a three-glyph compact security cell that replaces
 *     the Secure / HttpOnly / SameSite columns.
 *   - `Name`  carries the semantic + lifecycle chips (auth? /
 *     tracking? / pref / __Host- / Partitioned / just set / dropped /
 *     filtered out / problem).
 *
 * Click anywhere on the row (except action buttons) to toggle the
 * value expander when the value has depth (JWT / JSON / base64 /
 * URL-encoded).
 */

import { CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { useValueViewAction } from '@openheaders/ui/workbench/components/value-editors/useValueViewAction';
import { useState } from 'react';
import { deleteKeyForRow, editCanonicalForRow } from '../../../data/cookies/cookie-edit';
import { formatAbsoluteExpiry, formatRelativeExpiry, urlDecodeSafe } from '../../../data/cookies/cookie-format';
import { cookieRowIndicator } from '../../../data/cookies/cookie-indicators';
import type { JarCookieEdit, JarCookieKey } from '../../../data/cookies/cookie-jar-cache';
import type { CookieRow as CookieRowModel } from '../../../data/cookies/cookie-model';
import type { CookieRole } from '../../../data/cookies/cookie-role';
import { introspectionDetected, introspectionHint, type ValueIntrospection } from '../../../data/value-introspect';
import { useOpenValueViewDocument } from '../../../data/value-view-intent';
import { CookieChips } from './CookieChips';
import { CookieEditPopover } from './CookieEditPopover';
import { CookieValueExpander } from './CookieValueExpander';
import { SecurityGlyphs } from './SecurityGlyphs';

interface Props {
  row: CookieRowModel;
  role: CookieRole;
  vendor?: string;
  problem: boolean;
  thirdParty: boolean;
  /** `__Host-` / `__Secure-` / null — drives the name-cell tooltip
   *  explaining the RFC prefix's enforced rules. */
  prefixHint: 'host' | 'secure' | null;
  dropped: boolean;
  expiresFormat: 'relative' | 'absolute';
  decodeValues: boolean;
  showChips: boolean;
  /** Hide just the role chip — the surface groups by role and the
   *  group heading already names it. Lifecycle / context chips stay. */
  suppressRoleChip: boolean;
  introspection: ValueIntrospection;
  now: number;
  /** Column count for the expander's colSpan — derived from the
   *  fixed slot count (Name/Value/Scope/Expires/Size/Sec = 6). */
  columnSpan: number;
  /** Receives the Override button so the caller can anchor the in-panel
   *  create popover to it. */
  onMakeRule: (anchorEl: HTMLElement) => void;
  /** A rule that fired on this request modifies this row's cookie header. */
  ruleTouched: boolean;
  /** Jar-backed rows get Edit / Delete affordances — request rows joined
   *  from the jar, and response rows whose Set-Cookie mapped to a jar
   *  entry. Jar-less rows don't (nothing to write). */
  canEdit: boolean;
  /** The inspected request's URL — the edit popover's live jar sync
   *  reads through it. */
  scopeUrl: string;
  /** Open this cookie as an editor-tab document (the popover footer's
   *  "Open in new tab" link). */
  onOpenDocument?: (cookieKey: JarCookieKey) => void;
  /** Persists an edit from the row's popover; resolves `true` on success. */
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: () => void;
}

function expiresUrgencyClass(row: CookieRowModel, now: number): string {
  if (row.session || row.expirationDate == null) return 'dt-cookie-exp--session';
  const deltaMs = row.expirationDate * 1000 - now;
  if (deltaMs <= 0) return 'dt-cookie-exp--expired';
  if (deltaMs < 3600 * 1000) return 'dt-cookie-exp--soon';
  if (deltaMs < 86400 * 1000) return 'dt-cookie-exp--day';
  return 'dt-cookie-exp--ok';
}

export function CookieRow({
  row,
  role,
  vendor,
  problem,
  thirdParty,
  prefixHint,
  dropped,
  expiresFormat,
  decodeValues,
  showChips,
  suppressRoleChip,
  introspection,
  now,
  columnSpan,
  onMakeRule,
  ruleTouched,
  canEdit,
  scopeUrl,
  onOpenDocument,
  onApplyEdit,
  onDelete,
}: Props) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  // Edit opens on the LIVE jar entry (that's what Save writes) — when
  // its value differs from what this row captured, say so in the form
  // instead of silently showing a value the row doesn't display.
  const editCanonical = canEdit ? editCanonicalForRow(row) : null;
  const jarKey = editCanonical ? deleteKeyForRow(row) : null;
  const editValueNote =
    editCanonical && editCanonical.value !== row.value
      ? row.direction === 'response'
        ? t('panel.inspector.cookies.row.valueNoteResponse', { value: row.value })
        : t('panel.inspector.cookies.row.valueNoteRequest', { value: row.value })
      : undefined;
  // Every row with a value is expandable — depth values (JWT/JSON/…) show
  // their decoded view, plain values show the full raw value (useful when
  // the Value cell truncates a long one).
  const canExpand = row.value.length > 0;
  const hintKind = introspectionHint(introspection);
  // View icon on detected values — anchors the glance popover,
  // escalating to the SHARED modals read-only or the value-view tab
  // document, reusing the row's registry hit (no second detection pass).
  const openValueView = useOpenValueViewDocument();
  const { viewProps, glance, viewerModal } = useValueViewAction(introspectionDetected(introspection), {
    openAsTab: openValueView,
    sourceLabel: row.name,
  });
  const indicator = cookieRowIndicator(!!row.edited, ruleTouched);

  const valueText = decodeValues ? urlDecodeSafe(row.value) : row.value;

  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(row.value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const expiresCell =
    expiresFormat === 'absolute'
      ? formatAbsoluteExpiry(row.expirationDate, row.session)
      : formatRelativeExpiry(row.expirationDate, row.session, now, locale);
  const scope =
    row.domain || row.path
      ? `${row.domain ?? ''}${row.path && row.path !== '/' ? ` ${row.path}` : row.domain ? ' /' : (row.path ?? '')}`
      : '';

  const dim = row.attribution === 'filtered-out' || dropped;
  const toggle = (): void => {
    if (canExpand) setExpanded((v) => !v);
  };

  return (
    <>
      <tr
        className={`dt-cookie-row${dim ? ' dt-cookie-row--dim' : ''}${canExpand ? ' dt-cookie-row--expandable' : ''}`}
        data-problem={problem || undefined}
        data-role={role}
        onClick={toggle}
      >
        <td className="dt-cookie-status">
          {indicator && (
            <span
              className={`dt-cookie-status-dot dt-cookie-status-dot--${indicator}`}
              title={
                indicator === 'rule'
                  ? t('panel.inspector.cookies.row.ruleDotTitle', {
                      header: row.direction === 'response' ? 'Set-Cookie' : 'Cookie',
                    })
                  : t('panel.inspector.cookies.row.editedDotTitle')
              }
              aria-label={
                indicator === 'rule'
                  ? t('panel.inspector.cookies.row.ruleDotAria')
                  : t('panel.inspector.cookies.row.editedDotAria')
              }
            />
          )}
        </td>
        <td className="dt-cookie-name">
          <span
            className="dt-cookie-name-text"
            title={
              prefixHint === 'host'
                ? `${row.name}\n\n${t('panel.inspector.cookies.row.hostPrefixHint')}`
                : prefixHint === 'secure'
                  ? `${row.name}\n\n${t('panel.inspector.cookies.row.securePrefixHint')}`
                  : row.name
            }
          >
            {row.name}
          </span>
          {showChips && (
            <CookieChips
              row={row}
              role={role}
              vendor={vendor}
              problem={problem}
              thirdParty={thirdParty}
              dropped={dropped}
              suppressRoleChip={suppressRoleChip}
            />
          )}
        </td>
        <td className="dt-cookie-value">
          <span className="dt-cookie-value-main">
            {canExpand && (
              <span className="dt-cookie-caret" aria-hidden="true">
                {expanded ? '▾' : '▸'}
              </span>
            )}
            <span
              className="dt-cookie-value-text"
              title={
                row.edited && row.sentValue != null
                  ? t('panel.inspector.cookies.row.editedValueTitle', { value: row.sentValue })
                  : undefined
              }
            >
              {valueText}
            </span>
            {hintKind === 'jwt' && <span className="dt-cookie-value-hint">JWT</span>}
            {hintKind === 'json' && <span className="dt-cookie-value-hint">JSON</span>}
            {hintKind === 'base64' && <span className="dt-cookie-value-hint">b64</span>}
          </span>
          <span className="dt-cookie-row-actions" onClick={(e) => e.stopPropagation()}>
            {'viewTooltip' in viewProps &&
              glance(
                <button
                  type="button"
                  className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
                  title={viewProps.viewTooltip}
                  aria-label={viewProps.viewTooltip}
                >
                  <EyeOutlined />
                </button>,
              )}
            <button
              type="button"
              className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
              title={copied ? t('panel.inspector.cookies.row.copied') : t('panel.inspector.cookies.row.copyValue')}
              aria-label={copied ? t('panel.inspector.cookies.row.copied') : t('panel.inspector.cookies.row.copyValue')}
              onClick={handleCopy}
            >
              {copied ? <CheckOutlined /> : <CopyOutlined />}
            </button>
            <button
              type="button"
              className="dt-btn dt-btn--oh dt-cookie-action"
              title={
                row.direction === 'response'
                  ? t('panel.inspector.cookies.row.overrideSetCookieTitle')
                  : t('panel.inspector.cookies.row.overrideCookieTitle')
              }
              onClick={(e) => onMakeRule(e.currentTarget)}
            >
              {t('panel.inspector.cookies.row.override')}
            </button>
            {canEdit && editCanonical && jarKey && (
              <>
                <CookieEditPopover
                  mode="edit"
                  canonical={editCanonical}
                  valueNote={editValueNote}
                  document={{
                    scopeUrl,
                    cookieKey: jarKey,
                    ...(onOpenDocument ? { onOpen: () => onOpenDocument(jarKey) } : {}),
                  }}
                  onSubmit={onApplyEdit}
                >
                  <button
                    type="button"
                    className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
                    title={t('panel.inspector.cookies.row.editCookieTitle')}
                    aria-label={t('panel.inspector.cookies.row.editCookieAria')}
                  >
                    <EditOutlined />
                  </button>
                </CookieEditPopover>
                <button
                  type="button"
                  className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
                  title={t('panel.inspector.cookies.row.deleteCookieTitle')}
                  aria-label={t('panel.inspector.cookies.row.deleteCookieAria')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <DeleteOutlined />
                </button>
              </>
            )}
          </span>
        </td>
        <td className="dt-cookie-scope">{scope}</td>
        <td className={`dt-cookie-exp ${expiresUrgencyClass(row, now)}`} title={formatAbsoluteExpiry(row.expirationDate, row.session)}>
          {expiresCell}
        </td>
        <td className="dt-col-right">{row.size}</td>
        <td className="dt-cookie-sec-cell">
          <SecurityGlyphs row={row} />
        </td>
      </tr>
      {expanded && canExpand && (
        <CookieValueExpander introspection={introspection} columnSpan={columnSpan} />
      )}
      {viewerModal}
    </>
  );
}
