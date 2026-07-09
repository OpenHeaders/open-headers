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

import { CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { editCanonicalForRow } from '../../../data/cookies/cookie-edit';
import { formatAbsoluteExpiry, formatRelativeExpiry, urlDecodeSafe } from '../../../data/cookies/cookie-format';
import { cookieRowIndicator } from '../../../data/cookies/cookie-indicators';
import type { JarCookieEdit } from '../../../data/cookies/cookie-jar-cache';
import type { CookieRow as CookieRowModel } from '../../../data/cookies/cookie-model';
import type { CookieRole } from '../../../data/cookies/cookie-role';
import { introspectionHint, type ValueIntrospection } from '../../../data/value-introspect';
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
  onApplyEdit,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  // Edit opens on the LIVE jar entry (that's what Save writes) — when
  // its value differs from what this row captured, say so in the form
  // instead of silently showing a value the row doesn't display.
  const editCanonical = canEdit ? editCanonicalForRow(row) : null;
  const editValueNote =
    editCanonical && editCanonical.value !== row.value
      ? `${row.direction === 'response' ? 'This response set' : 'This request sent'}: ${row.value} — the jar value has changed since.`
      : undefined;
  // Every row with a value is expandable — depth values (JWT/JSON/…) show
  // their decoded view, plain values show the full raw value (useful when
  // the Value cell truncates a long one).
  const canExpand = row.value.length > 0;
  const hintKind = introspectionHint(introspection);
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
      : formatRelativeExpiry(row.expirationDate, row.session, now);
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
                  ? `A rule modifies the ${row.direction === 'response' ? 'Set-Cookie' : 'Cookie'} header on this request`
                  : 'Edited from this panel'
              }
              aria-label={indicator === 'rule' ? 'Rule applies' : 'Edited'}
            />
          )}
        </td>
        <td className="dt-cookie-name">
          <span
            className="dt-cookie-name-text"
            title={
              prefixHint === 'host'
                ? `${row.name}\n\nThe __Host- prefix locks this cookie to one host: the browser enforces Secure, Path=/, and no Domain attribute. Set-Cookie lines that violate any of those are rejected.`
                : prefixHint === 'secure'
                  ? `${row.name}\n\nThe __Secure- prefix forces this cookie to be Secure (HTTPS-only). Set-Cookie lines missing Secure are rejected.`
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
              title={row.edited && row.sentValue != null ? `Edited — request carried: ${row.sentValue}` : undefined}
            >
              {valueText}
            </span>
            {hintKind === 'jwt' && <span className="dt-cookie-value-hint">JWT</span>}
            {hintKind === 'json' && <span className="dt-cookie-value-hint">JSON</span>}
            {hintKind === 'base64' && <span className="dt-cookie-value-hint">b64</span>}
          </span>
          <span className="dt-cookie-row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
              title={copied ? 'Copied' : 'Copy value'}
              aria-label={copied ? 'Copied' : 'Copy value'}
              onClick={handleCopy}
            >
              {copied ? <CheckOutlined /> : <CopyOutlined />}
            </button>
            <button
              type="button"
              className="dt-btn dt-btn-primary dt-btn--oh dt-cookie-action"
              title={row.direction === 'response' ? 'Create a rule to override this Set-Cookie' : 'Create a rule to override this Cookie value'}
              onClick={(e) => onMakeRule(e.currentTarget)}
            >
              Override
            </button>
            {canEdit && editCanonical && (
              <>
                <CookieEditPopover mode="edit" canonical={editCanonical} valueNote={editValueNote} onSubmit={onApplyEdit}>
                  <button
                    type="button"
                    className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
                    title="Edit this cookie in the browser jar"
                    aria-label="Edit cookie"
                  >
                    <EditOutlined />
                  </button>
                </CookieEditPopover>
                <button
                  type="button"
                  className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--icon"
                  title="Delete this cookie from the browser jar"
                  aria-label="Delete cookie"
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
    </>
  );
}
