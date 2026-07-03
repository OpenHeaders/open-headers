/**
 * One cookies section (Request / Response). Filters, sorts, optionally
 * groups by role, and renders the table.
 *
 * Column layout is fixed (7 slots: Name · Value · Scope · Expires ·
 * Size · Sec · Actions) — the per-column visibility toggles that the
 * Chrome tab carries don't apply here because Security collapses three
 * columns into one glyph cell.
 */

import { useMemo, useRef, type RefObject } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { isJarEditableRow } from '../../../data/cookies/cookie-edit';
import type { JarCookieEdit } from '../../../data/cookies/cookie-jar-cache';
import type { CookieRow as CookieRowModel } from '../../../data/cookies/cookie-model';
import type { CookieFilterToken, CookieRowMeta } from '../../../data/cookies/cookie-filter';
import { matchesCookieQuery } from '../../../data/cookies/cookie-filter';
import { classifyCookie, roleSectionLabel, roleSortOrder, type CookieRole } from '../../../data/cookies/cookie-role';
import { introspectWithAuthScheme } from '../../../data/auth-scheme';
import type { ValueIntrospection } from '../../../data/value-introspect';
import type { DevpanelCookiesSortSetting } from '../../../../workbench/settings/schema/devpanel-cookies';
import { CookieColumnInfo } from './CookieColumnInfo';
import { CookieRow } from './CookieRow';

const COLUMN_SPAN = 7;

const STATUS_RAIL_INFO: InfoPopoverContent = {
  title: 'Status',
  kicker: 'OpenHeaders',
  summary: 'A square marks cookies that are not in their raw browser state.',
  sections: [
    {
      heading: 'Square colors',
      items: [
        { label: 'blue', desc: 'A rule that fired on this request modifies this direction’s Cookie / Set-Cookie header.' },
        { label: 'grey', desc: 'Added or edited from this panel during this session.' },
      ],
    },
  ],
};

interface Props {
  label: string;
  direction: 'request' | 'response';
  rows: readonly CookieRowModel[];
  problemNames: ReadonlySet<string>;
  droppedNames: ReadonlySet<string>;
  pageOrigin: string | null;
  compiledQuery: readonly CookieFilterToken[];
  sortMode: DevpanelCookiesSortSetting;
  expiresFormat: 'relative' | 'absolute';
  decodeValues: boolean;
  showChips: boolean;
  groupByRole: boolean;
  now: number;
  summaryRef?: RefObject<HTMLElement | null>;
  /** Row Override button — anchorEl is the clicked button, for the
   *  in-panel create popover. */
  onMakeRule: (row: CookieRowModel, anchorEl: HTMLElement) => void;
  /** Whether a host has wired a jar-write path — gates Edit / Delete. */
  writable: boolean;
  /** A rule that fired on this request modifies this direction's cookie
   *  header — drives the blue status square on every row. */
  ruleTouched: boolean;
  /** Persists an add/edit; resolves `true` on success. */
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (row: CookieRowModel) => void;
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
    ruleModified: false,
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

interface PreparedRow {
  row: CookieRowModel;
  role: CookieRole;
  vendor: string | undefined;
  meta: CookieRowMeta;
  introspection: ValueIntrospection;
}

export function CookieSection({
  label,
  direction,
  rows,
  problemNames,
  droppedNames,
  pageOrigin,
  compiledQuery,
  sortMode,
  expiresFormat,
  decodeValues,
  showChips,
  groupByRole,
  now,
  summaryRef,
  onMakeRule,
  writable,
  ruleTouched,
  onApplyEdit,
  onDelete,
}: Props) {
  // Measure the actual rendered thead height so the sticky role
  // heading's `top: …` lands flush against the column-header row,
  // not 0.5-1px above or below it (the gap the hardcoded 20px
  // fallback used to leave when fonts / borders rendered at
  // fractional heights). Published to the section's own root so the
  // var inherits to descendants — siblings get their own value.
  const sectionRef = useRef<HTMLDetailsElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  useMeasuredCssHeights(sectionRef as RefObject<HTMLElement | null>, [
    { ref: theadRef as RefObject<HTMLElement | null>, cssVar: '--oh-cookies-thead-h' },
  ]);

  const prepared = useMemo<readonly PreparedRow[]>(() => {
    return rows.map((row) => {
      const meta = metaFor(row, problemNames, pageOrigin, now);
      const classification = classifyCookie({
        name: row.name,
        value: row.value,
        httpOnly: row.httpOnly,
        session: row.session,
        thirdParty: meta.thirdParty,
      });
      const introspection = introspectWithAuthScheme(row.value);
      return { row, role: classification.role, vendor: classification.vendor, meta, introspection };
    });
  }, [rows, problemNames, pageOrigin, now]);

  const filtered = useMemo(() => {
    if (compiledQuery.length === 0) return prepared;
    return prepared.filter((p) => matchesCookieQuery(p.meta, compiledQuery));
  }, [prepared, compiledQuery]);

  const sorted = useMemo<readonly PreparedRow[]>(() => {
    const sortedRows = sortRows(filtered.map((p) => p.row), sortMode);
    // Re-attach metadata via name lookup (sortRows returns CookieRow[]).
    const byId = new Map(filtered.map((p) => [p.row.id, p]));
    return sortedRows.map((r) => byId.get(r.id)).filter((p): p is PreparedRow => !!p);
  }, [filtered, sortMode]);

  if (sorted.length === 0) return null;

  const visibleCount = sorted.length;
  const totalCount = rows.length;
  const totalBytes = sorted.reduce((n, p) => n + p.row.size, 0);

  const renderRow = (p: PreparedRow): React.ReactNode => (
    <CookieRow
      key={p.row.id}
      row={p.row}
      role={p.role}
      vendor={p.vendor}
      problem={p.meta.problem}
      thirdParty={p.meta.thirdParty}
      prefixHint={p.meta.hostPrefix ? 'host' : p.meta.securePrefix ? 'secure' : null}
      dropped={droppedNames.has(p.row.name) && p.row.attribution === 'response-set'}
      expiresFormat={expiresFormat}
      decodeValues={decodeValues}
      showChips={showChips}
      suppressRoleChip={groupByRole}
      introspection={p.introspection}
      now={now}
      columnSpan={COLUMN_SPAN}
      onMakeRule={(anchorEl) => onMakeRule(p.row, anchorEl)}
      ruleTouched={ruleTouched}
      canEdit={writable && isJarEditableRow(p.row)}
      onApplyEdit={onApplyEdit}
      onDelete={() => onDelete(p.row)}
    />
  );

  let bodyRows: React.ReactNode;
  if (groupByRole) {
    const groups = new Map<CookieRole, PreparedRow[]>();
    for (const p of sorted) {
      const arr = groups.get(p.role) ?? [];
      arr.push(p);
      groups.set(p.role, arr);
    }
    const orderedRoles = [...groups.keys()].sort((a, b) => roleSortOrder(a) - roleSortOrder(b));
    bodyRows = orderedRoles.map((role) => (
      <tbody key={role} className={`dt-cookie-role-group dt-cookie-role-group--${role}`}>
        <tr className="dt-cookie-role-heading">
          <td colSpan={COLUMN_SPAN}>
            {roleSectionLabel(role)} <span className="dt-cookie-role-count">{groups.get(role)?.length ?? 0}</span>
          </td>
        </tr>
        {groups.get(role)?.map(renderRow)}
      </tbody>
    ));
  } else {
    bodyRows = <tbody>{sorted.map(renderRow)}</tbody>;
  }

  return (
    <details className="dt-section dt-cookie-section" open data-direction={direction} ref={sectionRef}>
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
          <colgroup>
            <col className="dt-cookie-col--status" />
            <col className="dt-cookie-col--name" />
            <col className="dt-cookie-col--value" />
            <col className="dt-cookie-col--scope" />
            <col className="dt-cookie-col--expires" />
            <col className="dt-cookie-col--size" />
            <col className="dt-cookie-col--sec" />
          </colgroup>
          <thead ref={theadRef}>
            <tr>
              <th className="dt-cookie-status-head-cell">
                <InfoPopover content={STATUS_RAIL_INFO} trigger="hover" placement="bottomLeft">
                  <span className="dt-cookie-status-head">
                    <span className="dt-cookie-status-head-dot" />
                  </span>
                </InfoPopover>
              </th>
              <th>
                <span className="dt-cookie-col-head">
                  Name
                  <CookieColumnInfo infoKey="name" />
                </span>
              </th>
              <th>
                <span className="dt-cookie-col-head">
                  Value
                  <CookieColumnInfo infoKey="value" />
                </span>
              </th>
              <th>
                <span className="dt-cookie-col-head">
                  Scope
                  <CookieColumnInfo infoKey="scope" />
                </span>
              </th>
              <th>
                <span className="dt-cookie-col-head">
                  Expires
                  <CookieColumnInfo infoKey="expires" />
                </span>
              </th>
              <th className="dt-col-right">
                <span className="dt-cookie-col-head dt-cookie-col-head--right">
                  Size
                  <CookieColumnInfo infoKey="size" />
                </span>
              </th>
              <th className="dt-col-center">
                <span className="dt-cookie-col-head dt-cookie-col-head--center">
                  Sec
                  <CookieColumnInfo infoKey="sec" />
                </span>
              </th>
            </tr>
          </thead>
          {bodyRows}
        </table>
      </div>
    </details>
  );
}
