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

import { useState } from 'react';
import type { CookieRow as CookieRowModel } from '../../../data/cookie-model';
import { formatAbsoluteExpiry, formatRelativeExpiry, urlDecodeSafe } from '../../../data/cookie-format';
import type { CookieRole } from '../../../data/cookie-role';
import type { CookieValueIntrospection } from '../../../data/cookie-value-introspect';
import { introspectionHasDepth } from '../../../data/cookie-value-introspect';
import { CookieChips } from './CookieChips';
import { CookieValueExpander } from './CookieValueExpander';
import { SecurityGlyphs } from './SecurityGlyphs';

interface Props {
  row: CookieRowModel;
  role: CookieRole;
  problem: boolean;
  thirdParty: boolean;
  /** `__Host-` / `__Secure-` / null — drives the name-cell tooltip
   *  explaining the RFC prefix's enforced rules. */
  prefixHint: 'host' | 'secure' | null;
  dropped: boolean;
  expiresFormat: 'relative' | 'absolute';
  decodeValues: boolean;
  introspection: CookieValueIntrospection;
  now: number;
  /** Column count for the expander's colSpan — derived from the
   *  fixed slot count (Name/Value/Scope/Expires/Size/Sec/Actions = 7). */
  columnSpan: number;
  onMakeRule: () => void;
  onRemoveCookie: () => void;
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
  problem,
  thirdParty,
  prefixHint,
  dropped,
  expiresFormat,
  decodeValues,
  introspection,
  now,
  columnSpan,
  onMakeRule,
  onRemoveCookie,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = introspectionHasDepth(introspection);

  const valueText = decodeValues ? urlDecodeSafe(row.value) : row.value;
  const valueTitle =
    decodeValues && valueText !== row.value
      ? `raw: ${row.value}\nclick row to expand`
      : canExpand
        ? `${row.value}\nclick row to expand`
        : row.value;

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
          <CookieChips
            row={row}
            role={role}
            problem={problem}
            thirdParty={thirdParty}
            dropped={dropped}
          />
        </td>
        <td className="dt-cookie-value" title={valueTitle}>
          {canExpand && (
            <span className="dt-cookie-caret" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
          )}
          <span className="dt-cookie-value-text">{valueText}</span>
          {introspection.kind === 'jwt' && <span className="dt-cookie-value-hint">JWT</span>}
          {introspection.kind === 'json' && <span className="dt-cookie-value-hint">JSON</span>}
          {introspection.kind === 'base64' && <span className="dt-cookie-value-hint">b64</span>}
        </td>
        <td className="dt-cookie-scope">{scope}</td>
        <td className={`dt-cookie-exp ${expiresUrgencyClass(row, now)}`} title={formatAbsoluteExpiry(row.expirationDate, row.session)}>
          {expiresCell}
        </td>
        <td className="dt-col-right">{row.size}</td>
        <td className="dt-cookie-sec-cell">
          <SecurityGlyphs row={row} />
        </td>
        <td className="dt-cookie-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="dt-btn dt-btn-primary dt-cookie-action"
            title={row.direction === 'response' ? 'Create a rule to override this Set-Cookie' : 'Create a rule to override this Cookie value'}
            onClick={onMakeRule}
          >
            Override
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-primary dt-cookie-action dt-cookie-action--danger"
            title={row.direction === 'response' ? 'Remove this cookie from the response' : 'Remove this cookie from the request'}
            onClick={onRemoveCookie}
          >
            Remove
          </button>
        </td>
      </tr>
      {expanded && canExpand && (
        <CookieValueExpander introspection={introspection} columnSpan={columnSpan} />
      )}
    </>
  );
}
