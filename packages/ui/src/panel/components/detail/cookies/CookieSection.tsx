/**
 * One cookies section (Request / Response). Filters, sorts, and renders
 * the table — mirrors `HeaderSection`'s shape so the two tabs feel
 * identical from the keyboard.
 */

import { useMemo, type RefObject } from 'react';
import type { CookieRow as CookieRowModel } from '../../../data/cookie-model';
import type { CookieFilterToken, CookieRowMeta } from '../../../data/cookie-filter';
import { matchesCookieQuery } from '../../../data/cookie-filter';
import type { DevpanelCookiesSortSetting } from '../../../../workbench/settings/schema/devpanel-cookies';
import { CookieRow, type CookieRowColumns } from './CookieRow';

interface Props {
  label: string;
  direction: 'request' | 'response';
  rows: readonly CookieRowModel[];
  columns: CookieRowColumns;
  problemNames: ReadonlySet<string>;
  pageOrigin: string | null;
  compiledQuery: readonly CookieFilterToken[];
  sortMode: DevpanelCookiesSortSetting;
  expiresFormat: 'relative' | 'absolute';
  decodeValues: boolean;
  now: number;
  summaryRef?: RefObject<HTMLElement | null>;
  onMakeRule: (row: CookieRowModel) => void;
  onStripCookie: (row: CookieRowModel) => void;
}

function isHostPrefix(name: string): boolean {
  return name.startsWith('__Host-');
}
function isSecurePrefix(name: string): boolean {
  return name.startsWith('__Secure-');
}

function isCrossSite(cookieDomain: string | undefined, pageOrigin: string | null): boolean {
  if (!cookieDomain || !pageOrigin) return false;
  try {
    const top = new URL(pageOrigin).hostname.replace(/^www\./, '');
    const dom = cookieDomain.replace(/^\./, '').replace(/^www\./, '');
    if (!top || !dom) return false;
    return dom !== top && !top.endsWith(`.${dom}`) && !dom.endsWith(`.${top}`);
  } catch {
    return false;
  }
}

function metaFor(row: CookieRowModel, problemNames: ReadonlySet<string>, pageOrigin: string | null, now: number): CookieRowMeta {
  const expired = row.expirationDate != null && row.expirationDate * 1000 < now;
  return {
    name: row.name,
    value: row.value,
    domain: row.domain ?? '',
    path: row.path ?? '',
    secure: !!row.secure,
    httpOnly: !!row.httpOnly,
    session: !!row.session,
    expired,
    sameSite: row.sameSite ? String(row.sameSite) : '',
    partitioned: !!row.partitionKey,
    hostPrefix: isHostPrefix(row.name),
    securePrefix: isSecurePrefix(row.name),
    thirdParty: isCrossSite(row.domain, pageOrigin),
    isSet: row.attribution === 'response-set',
    isSent: row.attribution !== 'filtered-out' && row.direction === 'request',
    isFilteredOut: row.attribution === 'filtered-out',
    problem: problemNames.has(row.name),
    ruleModified: false, // Wired by the section when rule attribution data is plumbed.
  };
}

function sortRows(rows: readonly CookieRowModel[], mode: DevpanelCookiesSortSetting): readonly CookieRowModel[] {
  if (mode === 'original') return rows;
  const copy = [...rows];
  if (mode === 'az') copy.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'size') copy.sort((a, b) => b.size - a.size);
  else if (mode === 'expires') {
    copy.sort((a, b) => {
      const ae = a.expirationDate ?? Number.POSITIVE_INFINITY;
      const be = b.expirationDate ?? Number.POSITIVE_INFINITY;
      return ae - be;
    });
  }
  return copy;
}

export function CookieSection({
  label,
  direction,
  rows,
  columns,
  problemNames,
  pageOrigin,
  compiledQuery,
  sortMode,
  expiresFormat,
  decodeValues,
  now,
  summaryRef,
  onMakeRule,
  onStripCookie,
}: Props) {
  const filtered = useMemo(() => {
    if (compiledQuery.length === 0) return rows;
    return rows.filter((r) => matchesCookieQuery(metaFor(r, problemNames, pageOrigin, now), compiledQuery));
  }, [rows, compiledQuery, problemNames, pageOrigin, now]);

  const sorted = useMemo(() => sortRows(filtered, sortMode), [filtered, sortMode]);

  if (sorted.length === 0) return null;

  const visibleCount = sorted.length;
  const totalCount = rows.length;
  const totalBytes = sorted.reduce((n, r) => n + r.size, 0);

  return (
    <details className="dt-section dt-cookie-section" open data-direction={direction}>
      <summary ref={summaryRef ?? undefined}>
        <span className="dt-cookie-section-title">{label}</span>
        <span className="dt-cookie-section-count">
          {visibleCount === totalCount ? visibleCount : `${visibleCount} of ${totalCount}`}
          {' · '}
          {totalBytes} B
        </span>
      </summary>
      <div className="dt-cookie-table-wrap">
        <table className="dt-cookie-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              {columns.domain && <th>Domain</th>}
              {columns.path && <th>Path</th>}
              {columns.expires && <th>Expires</th>}
              {columns.size && <th className="dt-col-right">Size</th>}
              {columns.httpOnly && <th className="dt-col-center">HttpOnly</th>}
              {columns.secure && <th className="dt-col-center">Secure</th>}
              {columns.sameSite && <th>SameSite</th>}
              {columns.partition && <th>Partition Key</th>}
              {columns.priority && <th>Priority</th>}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const m = metaFor(row, problemNames, pageOrigin, now);
              return (
                <CookieRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  problem={m.problem}
                  thirdParty={m.thirdParty}
                  hostPrefix={m.hostPrefix}
                  securePrefix={m.securePrefix}
                  expired={m.expired}
                  expiresFormat={expiresFormat}
                  decodeValues={decodeValues}
                  now={now}
                  onMakeRule={() => onMakeRule(row)}
                  onStripCookie={() => onStripCookie(row)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
