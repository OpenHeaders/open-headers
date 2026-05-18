/**
 * Single cookie row — name + value + per-column cells + per-row action
 * menu. Mirrors the shape of `HeaderRow` so users get the same feel:
 * compact, monospace, with a right-aligned action button.
 */

import type { CookieRow as CookieRowModel } from '../../../data/cookie-model';
import { formatAbsoluteExpiry, formatRelativeExpiry, urlDecodeSafe } from '../../../data/cookie-format';
import { CookieChips } from './CookieChips';

export interface CookieRowColumns {
  domain: boolean;
  path: boolean;
  expires: boolean;
  size: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite: boolean;
  partition: boolean;
  priority: boolean;
}

interface Props {
  row: CookieRowModel;
  columns: CookieRowColumns;
  problem: boolean;
  thirdParty: boolean;
  hostPrefix: boolean;
  securePrefix: boolean;
  expired: boolean;
  expiresFormat: 'relative' | 'absolute';
  decodeValues: boolean;
  now: number;
  onMakeRule: () => void;
  onStripCookie: () => void;
}

function fmtSameSite(raw: string | undefined): string {
  if (!raw) return '';
  const r = String(raw).toLowerCase();
  if (r === 'no_restriction') return 'None';
  if (r === 'lax') return 'Lax';
  if (r === 'strict') return 'Strict';
  if (r === 'unspecified') return '';
  return raw;
}

export function CookieRow({
  row,
  columns,
  problem,
  thirdParty,
  hostPrefix,
  securePrefix,
  expired,
  expiresFormat,
  decodeValues,
  now,
  onMakeRule,
  onStripCookie,
}: Props) {
  const decoded = decodeValues ? urlDecodeSafe(row.value) : row.value;
  const valueTitle =
    decodeValues && decoded !== row.value ? `raw: ${row.value}` : row.value;

  const expiresCell =
    expiresFormat === 'absolute'
      ? formatAbsoluteExpiry(row.expirationDate, row.session)
      : formatRelativeExpiry(row.expirationDate, row.session, now);

  const sentDimmed = row.attribution === 'filtered-out';

  return (
    <tr className={`dt-cookie-row${sentDimmed ? ' dt-cookie-row--dim' : ''}`} data-problem={problem || undefined}>
      <td className="dt-cookie-name">
        <span className="dt-cookie-name-text">{row.name}</span>
        <CookieChips
          row={row}
          problem={problem}
          thirdParty={thirdParty}
          hostPrefix={hostPrefix}
          securePrefix={securePrefix}
          expired={expired}
        />
      </td>
      <td className="dt-cookie-value" title={valueTitle}>
        {decoded}
      </td>
      {columns.domain && <td>{row.domain ?? ''}</td>}
      {columns.path && <td>{row.path ?? ''}</td>}
      {columns.expires && (
        <td className="dt-col-muted" title={formatAbsoluteExpiry(row.expirationDate, row.session)}>
          {expiresCell}
        </td>
      )}
      {columns.size && <td className="dt-col-right">{row.size}</td>}
      {columns.httpOnly && <td className="dt-col-center">{row.httpOnly ? '✓' : ''}</td>}
      {columns.secure && <td className="dt-col-center">{row.secure ? '✓' : ''}</td>}
      {columns.sameSite && <td>{fmtSameSite(typeof row.sameSite === 'string' ? row.sameSite : undefined)}</td>}
      {columns.partition && <td title={row.partitionKey}>{row.partitionKey ? '✓' : ''}</td>}
      {columns.priority && <td>{row.priority ?? ''}</td>}
      <td className="dt-cookie-actions">
        <button
          type="button"
          className="dt-btn-link dt-cookie-action"
          title={row.direction === 'response' ? 'Create a rule to override this Set-Cookie' : 'Create a rule to override this Cookie value'}
          onClick={onMakeRule}
        >
          Override
        </button>
        <button
          type="button"
          className="dt-btn-link dt-cookie-action dt-cookie-action--danger"
          title={row.direction === 'response' ? 'Strip this Set-Cookie from the response' : 'Strip this cookie from the request'}
          onClick={onStripCookie}
        >
          Strip
        </button>
      </td>
    </tr>
  );
}
