/**
 * HeadersView — the Headers section of the inspector. Organizes
 * General + Response + Request headers, runs the row filter, surfaces
 * actionable insights, exposes inline value-introspection chips, and
 * doubles as the entry point for creating rules from this request
 * (the section is intentionally rule-creation-shaped, not just an
 * inspection list).
 *
 * Everything heavy is in `panel/data/`:
 *   - header-attribution     (row → server/rule/system origin)
 *   - header-category        (name → bucket)
 *   - header-filter          (search grammar)
 *   - header-insights        (actionable callouts)
 *   - header-value-introspection (Set-Cookie / Cache-Control / …)
 *   - header-footprint       (top-of-section rule-impact summary)
 */

import { Popover } from 'antd';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { getHeaderInfoContentForRow } from '@openheaders/ui/shared/info-popover/data/http-headers';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { HeaderModification, HeaderOperation, Rule } from '@openheaders/core/types';
import { validateHeaderName } from '@openheaders/core/utils';
import { useCallback, useMemo, useState } from 'react';
import {
  type AnnotatedHeader,
  findCurrentMod,
  isAttributionEdited,
} from '../../data/header-attribution';
import {
  categorizeHeader,
  HEADER_CATEGORY_LABEL,
  HEADER_CATEGORY_ORDER,
  type HeaderCategory,
} from '../../data/header-category';
import {
  type HeaderFilterToken,
  type HeaderRowMeta,
  matchesHeaderQuery,
  parseHeaderQuery,
} from '../../data/header-filter';
import { computeHeaderFootprint, formatHeaderFootprint } from '../../data/header-footprint';
import { formatHeaderName, type HeaderNameCase } from '../../data/header-name-case';
import { computeHeaderInsights, type HeaderInsight, type HeaderInsightAction } from '../../data/header-insights';
import {
  parseAuthorization,
  parseCacheControl,
  parseContentType,
  parseHsts,
  parseSetCookie,
} from '../../data/header-value-introspection';
import { formatHttpVersion } from '../../data/http-version';
import { computeRuleApplicability, type RuleApplicability } from '../../data/rule-applicability';
import { formatHeadersBlock, formatCurl, formatFetch } from '../../data/request-formatters';
import type { InspectorRequest } from '../../data/types';
import type { RulesByUid } from '../../data/use-rules-lookup';
import { ResolvedHeaderValue } from '../ResolvedHeaderValue';
import { useRulePopover } from '../RulePopoverHost';

/** Layout mode for the header lists — `grouped` keeps the existing
 *  per-category collapsible sections; `flat` renders a single list in
 *  the chosen sort order (matches Chrome's behavior). */
export type HeaderLayoutMode = 'grouped' | 'flat';

/** Sort applied to header rows. `original` preserves the order the
 *  server sent + rule-added rows appended (HAR order). `az` sorts by
 *  name. `rule-first` floats rule-modified rows to the top, preserving
 *  HAR order within each bucket. Stable in all modes. */
export type HeaderSortMode = 'original' | 'az' | 'rule-first';

// Headers commonly carried on every fetch — folded by the hide-noise toggle.
const NOISE_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'connection',
  'upgrade-insecure-requests',
]);
const NOISE_PREFIXES = ['sec-fetch-', 'sec-ch-ua'];

function isNoiseHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (NOISE_HEADERS.has(lower)) return true;
  return NOISE_PREFIXES.some((p) => lower.startsWith(p));
}

function originOf(attribution: AnnotatedHeader['attribution']): HeaderRowMeta['origin'] {
  if (attribution.kind === 'server') return 'server';
  if (attribution.kind === 'system') return 'system';
  return 'rule';
}

export interface HeadersViewProps {
  request: InspectorRequest;
  requestHeaders: readonly AnnotatedHeader[];
  responseHeaders: readonly AnnotatedHeader[];
  rulesByUid: RulesByUid;
  /** Resolves the collection that owns a rule, for `{{collection.X}}` scopes. */
  collectionIdFor: (h: AnnotatedHeader) => string | undefined;
  /** Open the Create Rule editor pre-filled with this header. */
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
  /** Open the Create Rule editor pre-filled with a URL/block/delay action
   *  for this request. The view never builds the draft itself — that
   *  lives in `rule-draft-bridge.ts` — but it does need a callback per
   *  CTA so the parent can surface errors uniformly. */
  onCreateRedirect: () => void;
  onCreateReplaceHost: () => void;
  onCreateReplaceUrlPart: () => void;
  onCreateDelay: () => void;
  onCreateCancel: () => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
}

export function HeadersView({
  request,
  requestHeaders,
  responseHeaders,
  rulesByUid,
  collectionIdFor,
  onCreateHeaderRule,
  onCreateRedirect,
  onCreateReplaceHost,
  onCreateReplaceUrlPart,
  onCreateDelay,
  onCreateCancel,
  searchHighlight,
  searchSection,
  searchLineNumber,
}: HeadersViewProps) {
  // Filter text stays per-tab — it's request-specific scratch state.
  const [filter, setFilter] = useState('');
  // Everything below is panel-wide and persisted via the shared
  // settings store so the user sets defaults once and they carry across
  // requests, tabs, and panel reopens.
  const [ruleOnly, setRuleOnly] = useSetting('devpanelHeaders.ruleOnly');
  const [securityOnly, setSecurityOnly] = useSetting('devpanelHeaders.securityOnly');
  const [overridableOnly, setOverridableOnly] = useSetting('devpanelHeaders.overridableOnly');
  const [hideNoise, setHideNoise] = useSetting('devpanelHeaders.hideNoise');
  const [layout, setLayout] = useSetting('devpanelHeaders.layout');
  const [sortMode, setSortMode] = useSetting('devpanelHeaders.sortMode');
  const [nameCase, setNameCase] = useSetting('devpanelHeaders.nameCase');
  const [showInsights, setShowInsights] = useSetting('devpanelHeaders.showInsights');
  const toggleRuleOnly = useCallback(() => setRuleOnly(!ruleOnly), [ruleOnly, setRuleOnly]);
  const toggleSecurityOnly = useCallback(() => setSecurityOnly(!securityOnly), [securityOnly, setSecurityOnly]);
  const toggleOverridableOnly = useCallback(
    () => setOverridableOnly(!overridableOnly),
    [overridableOnly, setOverridableOnly],
  );
  const toggleHideNoise = useCallback(() => setHideNoise(!hideNoise), [hideNoise, setHideNoise]);
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);

  const compiledQuery = useMemo<readonly HeaderFilterToken[]>(() => {
    const parts: string[] = [];
    if (filter.trim()) parts.push(filter.trim());
    if (ruleOnly) parts.push('is:rule');
    if (securityOnly) parts.push('is:security');
    if (overridableOnly) parts.push('is:overridable');
    return parseHeaderQuery(parts.join(' '));
  }, [filter, ruleOnly, securityOnly, overridableOnly]);

  // Drift detection (rule-edit only — value/var drift is computed in the
  // row so we can read the resolver there). Powers `is:drifted` filter
  // and footprint counts.
  const driftedRows = useMemo<ReadonlySet<AnnotatedHeader>>(() => {
    const out = new Set<AnnotatedHeader>();
    const consider = (rows: readonly AnnotatedHeader[]): void => {
      for (const row of rows) {
        const a = row.attribution;
        if (a.kind === 'server' || a.kind === 'system') continue;
        const liveRule = rulesByUid.get(a.ctx.ruleUid) ?? null;
        if (isAttributionEdited(liveRule, a.ctx)) out.add(row);
      }
    };
    consider(requestHeaders);
    consider(responseHeaders);
    return out;
  }, [requestHeaders, responseHeaders, rulesByUid]);

  const insights = useMemo<readonly HeaderInsight[]>(
    () =>
      computeHeaderInsights({
        url: request.url,
        mimeType: request.mimeType ?? null,
        statusCode: request.statusCode ?? null,
        requestHeaders: request.harEntry.request?.headers ?? [],
        responseHeaders: request.harEntry.response?.headers ?? [],
      }),
    [request.url, request.mimeType, request.statusCode, request.harEntry],
  );

  const footprint = useMemo(
    () =>
      computeHeaderFootprint({
        requestRows: requestHeaders,
        responseRows: responseHeaders,
        driftedRows,
      }),
    [requestHeaders, responseHeaders, driftedRows],
  );
  const footprintText = formatHeaderFootprint(footprint);

  const handleInsightAction = (action: HeaderInsightAction): void => {
    if (action.kind === 'add-header' || action.kind === 'override-header') {
      onCreateHeaderRule(action.direction, action.headerName, action.value ?? '');
    }
  };

  const statusOk = request.statusCode != null && request.statusCode < 400;
  const httpVersion = request.harEntry.response?.httpVersion ?? request.harEntry.request?.httpVersion;
  const referrerPolicy = responseHeaders.find((h) => h.name.toLowerCase() === 'referrer-policy')?.value;
  const contentEncoding = responseHeaders.find((h) => h.name.toLowerCase() === 'content-encoding')?.value;
  const bytesIn = request.harEntry.response?.bodySize;
  const decodedSize = request.harEntry.response?.content?.size;
  const remoteAddr = request.harEntry.serverIPAddress;

  return (
    <div className="dt-headers-pane">
      {/* Rule-creation CTA row — Headers tab is the primary surface for
        * "I see something I want to change → make a rule for it". */}
      <div className="dt-cta-row dt-header-cta-row">
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateRedirect} title="Redirect this URL elsewhere">
          Redirect URL
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateReplaceHost} title="Redirect, keeping path and query but swapping the host">
          Replace host
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateReplaceUrlPart} title="Redirect with the URL pre-filled — edit any segment">
          Replace URL part
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateDelay} title="Delay this request">
          Delay request
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateCancel} title="Block / cancel this request">
          Cancel request
        </button>
      </div>

      {footprintText && (
        <div className="dt-header-footprint" title={footprint.ruleNames.join(', ')}>
          <span className="dt-header-footprint-dot" aria-hidden="true" />
          <span className="dt-header-footprint-text">{footprintText}</span>
        </div>
      )}

      {showInsights && insights.length > 0 && (
        <div className="dt-header-insights">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} onAction={handleInsightAction} />
          ))}
        </div>
      )}

      {/* Filter toolbar — input + a single "More filters ▾" popover.
        * Mirrors the pattern in `PanelToolbar` so the panel feels
        * coherent across surfaces; everything beyond the input lives
        * behind the dropdown so the search field has room to breathe
        * on narrow DevTools docks. */}
      <div className="dt-header-filter">
        <input
          type="search"
          placeholder="Filter — text, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-header-filter-input"
          aria-label="Filter headers"
        />
        <HeaderMoreFiltersMenu
          ruleOnly={ruleOnly}
          securityOnly={securityOnly}
          overridableOnly={overridableOnly}
          hideNoise={hideNoise}
          onToggleRuleOnly={toggleRuleOnly}
          onToggleSecurityOnly={toggleSecurityOnly}
          onToggleOverridableOnly={toggleOverridableOnly}
          onToggleHideNoise={toggleHideNoise}
        />
        <HeaderViewMenu
          layout={layout}
          sortMode={sortMode}
          nameCase={nameCase}
          showInsights={showInsights}
          onLayoutChange={setLayout}
          onSortChange={setSortMode}
          onNameCaseChange={setNameCase}
          onToggleShowInsights={toggleShowInsights}
        />
      </div>

      <details className="dt-section" open>
        <summary>General</summary>
        <GeneralRow label="Request URL" infoKey="request-url">
          <span className="dt-kv-val" style={{ wordBreak: 'break-all' }}>{request.url}</span>
        </GeneralRow>
        <GeneralRow label="Request Method" infoKey="request-method">
          <span className="dt-kv-val">{request.method}</span>
        </GeneralRow>
        {request.statusCode != null && (
          <GeneralRow label="Status Code" infoKey="status-code">
            <span className={`dt-kv-val ${statusOk ? 'dt-kv-val--status-ok' : 'dt-kv-val--status-err'}`}>
              {request.statusCode} {request.statusText ?? ''}
            </span>
          </GeneralRow>
        )}
        {remoteAddr && (
          <GeneralRow label="Remote Address" infoKey="remote-address">
            <span className="dt-kv-val">{remoteAddr}</span>
          </GeneralRow>
        )}
        {httpVersion && (
          <GeneralRow label="HTTP Version" infoKey="http-version">
            <span className="dt-kv-val" title={`ALPN: ${httpVersion}`}>{formatHttpVersion(httpVersion)}</span>
          </GeneralRow>
        )}
        {contentEncoding && (
          <GeneralRow label="Compression" infoKey="compression">
            <span className="dt-kv-val">{contentEncoding}</span>
          </GeneralRow>
        )}
        {bytesIn != null && bytesIn > 0 && (
          <GeneralRow label="Transferred" infoKey="transferred">
            <span className="dt-kv-val">
              {formatBytes(bytesIn)}
              {decodedSize != null && decodedSize > 0 && decodedSize !== bytesIn ? ` (decoded ${formatBytes(decodedSize)})` : ''}
            </span>
          </GeneralRow>
        )}
        {referrerPolicy && (
          <GeneralRow label="Referrer Policy" infoKey="referrer-policy">
            <span className="dt-kv-val">{referrerPolicy}</span>
          </GeneralRow>
        )}
      </details>

      <HeaderSection
        label="Response Headers"
        direction="response"
        rows={responseHeaders}
        request={request}
        rulesByUid={rulesByUid}
        collectionIdFor={collectionIdFor}
        compiledQuery={compiledQuery}
        hideNoise={hideNoise}
        layout={layout}
        sortMode={sortMode}
        nameCase={nameCase}
        driftedRows={driftedRows}
        onCreateHeaderRule={onCreateHeaderRule}
        searchHighlight={searchHighlight}
        searchSection={searchSection}
        searchLineNumber={searchLineNumber}
      />

      <HeaderSection
        label="Request Headers"
        direction="request"
        rows={requestHeaders}
        request={request}
        rulesByUid={rulesByUid}
        collectionIdFor={collectionIdFor}
        compiledQuery={compiledQuery}
        hideNoise={hideNoise}
        layout={layout}
        sortMode={sortMode}
        nameCase={nameCase}
        driftedRows={driftedRows}
        onCreateHeaderRule={onCreateHeaderRule}
        searchHighlight={searchHighlight}
        searchSection={searchSection}
        searchLineNumber={searchLineNumber}
      />
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Insight card ───────────────────────────────────────────────

function InsightCard({
  insight,
  onAction,
}: {
  insight: HeaderInsight;
  onAction: (action: HeaderInsightAction) => void;
}) {
  return (
    <div className="dt-header-insight" data-severity={insight.severity}>
      <span className="dt-header-insight-icon" aria-hidden="true">
        {insight.severity === 'err' ? '⚠' : insight.severity === 'warn' ? '⚠' : 'ℹ'}
      </span>
      <div className="dt-header-insight-body">
        <div className="dt-header-insight-title">{insight.title}</div>
        {insight.detail && <div className="dt-header-insight-detail">{insight.detail}</div>}
      </div>
      {insight.action && (
        <button
          type="button"
          className="dt-btn dt-btn-primary dt-header-insight-action"
          onClick={() => onAction(insight.action!)}
        >
          {insight.action.label}
        </button>
      )}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────

interface HeaderSectionProps {
  label: 'Response Headers' | 'Request Headers';
  direction: 'request' | 'response';
  rows: readonly AnnotatedHeader[];
  request: InspectorRequest;
  rulesByUid: RulesByUid;
  collectionIdFor: (h: AnnotatedHeader) => string | undefined;
  compiledQuery: readonly HeaderFilterToken[];
  hideNoise: boolean;
  layout: HeaderLayoutMode;
  sortMode: HeaderSortMode;
  nameCase: HeaderNameCase;
  driftedRows: ReadonlySet<AnnotatedHeader>;
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
}

/** A header row paired with its meta and its position in the original
 *  (un-filtered, un-sorted) annotated array. `originalIndex` is what
 *  the search engine indexes against — the first `harHeaders.length`
 *  rows match the raw HAR order 1:1 (see `attributeHeaders`); rule-
 *  added rows past that range have no search correspondence, so a
 *  search match on them simply never highlights (correct behavior). */
type RowItem = { row: AnnotatedHeader; meta: HeaderRowMeta; originalIndex: number };

function sortRows(items: readonly RowItem[], mode: HeaderSortMode): RowItem[] {
  // Array.prototype.sort is stable in modern engines, so returning 0
  // from the comparator preserves the original (HAR) order within
  // equal buckets — exactly what `original` and the rule-first
  // tie-breaker need.
  if (mode === 'original') return items.slice();
  if (mode === 'az') {
    return items.slice().sort((a, b) => a.row.name.toLowerCase().localeCompare(b.row.name.toLowerCase()));
  }
  // rule-first: rule + system origins float to the top
  return items.slice().sort((a, b) => {
    const ar = a.meta.origin === 'server' ? 1 : 0;
    const br = b.meta.origin === 'server' ? 1 : 0;
    return ar - br;
  });
}

function HeaderSection({
  label,
  direction,
  rows,
  request,
  rulesByUid,
  collectionIdFor,
  compiledQuery,
  hideNoise,
  layout,
  sortMode,
  nameCase,
  driftedRows,
  onCreateHeaderRule,
  searchHighlight,
  searchSection,
  searchLineNumber,
}: HeaderSectionProps) {
  const [rawView, setRawView] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  // Build per-row meta once for filter + categorization. `originalIndex`
  // is captured BEFORE any filter/sort so the search-highlight machinery
  // can still locate the right row after the user reorders / hides.
  const rowMetas = useMemo<RowItem[]>(
    () =>
      rows.map((row, originalIndex) => {
        const meta: HeaderRowMeta = {
          name: row.name,
          value: row.value,
          direction,
          origin: originOf(row.attribution),
          category: categorizeHeader(row.name),
          protectedHeader: !validateHeaderName(row.name, direction === 'response').valid,
          drifted: driftedRows.has(row),
        };
        return { row, meta, originalIndex };
      }),
    [rows, direction, driftedRows],
  );

  // Two-stage filter so we know exactly what `hide noise` is hiding
  // (the popover under the hint lists the actual names — no guessing).
  const filteredByQuery = useMemo(
    () => rowMetas.filter(({ meta }) => compiledQuery.length === 0 || matchesHeaderQuery(meta, compiledQuery)),
    [rowMetas, compiledQuery],
  );
  const hiddenNoiseItems = useMemo<RowItem[]>(
    () =>
      hideNoise ? filteredByQuery.filter(({ row, meta }) => meta.origin === 'server' && isNoiseHeader(row.name)) : [],
    [filteredByQuery, hideNoise],
  );
  const filtered = useMemo(
    () =>
      hideNoise
        ? filteredByQuery.filter(({ row, meta }) => !(meta.origin === 'server' && isNoiseHeader(row.name)))
        : filteredByQuery,
    [filteredByQuery, hideNoise],
  );

  // Sort the visible items per the chosen mode.
  const sortedItems = useMemo(() => sortRows(filtered, sortMode), [filtered, sortMode]);

  // Group by category for the grouped layout. Items within a group
  // keep the sort order applied above.
  const grouped = useMemo(() => {
    const byCat = new Map<HeaderCategory, RowItem[]>();
    for (const item of sortedItems) {
      const bucket = byCat.get(item.meta.category);
      if (bucket) bucket.push(item);
      else byCat.set(item.meta.category, [item]);
    }
    return HEADER_CATEGORY_ORDER.flatMap((cat) => {
      const items = byCat.get(cat);
      if (!items || items.length === 0) return [];
      return [{ cat, items }];
    });
  }, [sortedItems]);

  const hiddenByFilter = rows.length - filtered.length;

  const handleCopy = async (mode: 'all' | 'filtered' | 'curl' | 'fetch'): Promise<void> => {
    let text = '';
    if (mode === 'curl') text = formatCurl(request);
    else if (mode === 'fetch') text = formatFetch(request);
    else if (mode === 'all') text = formatHeadersBlock(rows);
    else text = formatHeadersBlock(filtered.map((f) => f.row));
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Browsers reject clipboard writes outside a user-gesture if the
      // panel is detached. Silently swallow — the menu still closes.
    }
    setCopyOpen(false);
  };

  return (
    <details className="dt-section" open>
      <summary>
        {label}
        <span className="dt-header-section-count" aria-label="visible header count">
          {filtered.length}
          {hiddenByFilter > 0 ? ` / ${rows.length}` : ''}
        </span>
        <button
          type="button"
          className="dt-btn-primary dt-btn dt-header-section-add"
          onClick={(e) => {
            e.preventDefault();
            onCreateHeaderRule(direction, '', '');
          }}
        >
          + Add Header
        </button>
        <button
          type="button"
          className="dt-btn dt-header-section-raw"
          data-active={rawView}
          aria-pressed={rawView}
          onClick={(e) => {
            e.preventDefault();
            setRawView((v) => !v);
          }}
          title="Show as plain text (Name: Value)"
        >
          Raw
        </button>
        <div className="dt-header-section-copy">
          <button
            type="button"
            className="dt-btn"
            onClick={(e) => {
              e.preventDefault();
              setCopyOpen((v) => !v);
            }}
          >
            Copy ▾
          </button>
          {copyOpen && (
            <div className="dt-header-copy-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => handleCopy('all')}>Copy all</button>
              <button type="button" role="menuitem" onClick={() => handleCopy('filtered')} disabled={filtered.length === rows.length}>
                Copy filtered
              </button>
              {direction === 'request' && (
                <>
                  <button type="button" role="menuitem" onClick={() => handleCopy('curl')}>Copy as cURL</button>
                  <button type="button" role="menuitem" onClick={() => handleCopy('fetch')}>Copy as fetch</button>
                </>
              )}
            </div>
          )}
        </div>
      </summary>

      {rows.length === 0 ? (
        <div className="dt-kv dt-col-muted">None captured.</div>
      ) : rawView ? (
        <pre className="dt-header-raw">
          {formatHeadersBlock(sortedItems.map((f) => ({ name: formatHeaderName(f.row.name, nameCase), value: f.row.value })))}
        </pre>
      ) : (
        <>
          {sortedItems.length === 0 ? (
            <div className="dt-kv dt-col-muted">No headers match the filter.</div>
          ) : layout === 'flat' ? (
            <div className="dt-header-category">
              {sortedItems.map(({ row, meta, originalIndex }) => (
                <AttributedHeaderRow
                  key={`${direction}-flat-${originalIndex}-${row.name}`}
                  row={row}
                  meta={meta}
                  index={originalIndex}
                  sectionLabel={label}
                  searchSection={searchSection}
                  searchLineNumber={searchLineNumber}
                  searchHighlight={searchHighlight}
                  ruleCollectionId={collectionIdFor(row)}
                  requestUrl={request.url}
                  rulesByUid={rulesByUid}
                  nameCase={nameCase}
                  onNameClick={(name, value) => onCreateHeaderRule(direction, name, value)}
                />
              ))}
            </div>
          ) : (
            grouped.map(({ cat, items }) => (
              <div className="dt-header-category" key={`${direction}-${cat}`}>
                <div className="dt-header-category-summary">
                  <span className="dt-header-category-label">{HEADER_CATEGORY_LABEL[cat]}</span>
                  <span className="dt-header-category-count">{items.length}</span>
                </div>
                {items.map(({ row, meta, originalIndex }) => (
                  <AttributedHeaderRow
                    key={`${direction}-${cat}-${originalIndex}-${row.name}`}
                    row={row}
                    meta={meta}
                    index={originalIndex}
                    sectionLabel={label}
                    searchSection={searchSection}
                    searchLineNumber={searchLineNumber}
                    searchHighlight={searchHighlight}
                    ruleCollectionId={collectionIdFor(row)}
                    requestUrl={request.url}
                    rulesByUid={rulesByUid}
                    nameCase={nameCase}
                    onNameClick={(name, value) => onCreateHeaderRule(direction, name, value)}
                  />
                ))}
              </div>
            ))
          )}
          {hiddenNoiseItems.length > 0 && <HiddenNoiseHint items={hiddenNoiseItems} />}
        </>
      )}
    </details>
  );
}

/**
 * `More filters ▾` dropdown — checkbox-only toggles that narrow the
 * visible header set. Layout / sort live in the sibling `View ▾`
 * popover so this menu stays focused on "what do I want to hide?".
 */
function HeaderMoreFiltersMenu({
  ruleOnly,
  securityOnly,
  overridableOnly,
  hideNoise,
  onToggleRuleOnly,
  onToggleSecurityOnly,
  onToggleOverridableOnly,
  onToggleHideNoise,
}: {
  ruleOnly: boolean;
  securityOnly: boolean;
  overridableOnly: boolean;
  hideNoise: boolean;
  onToggleRuleOnly: () => void;
  onToggleSecurityOnly: () => void;
  onToggleOverridableOnly: () => void;
  onToggleHideNoise: () => void;
}) {
  const activeCount = [ruleOnly, securityOnly, overridableOnly, hideNoise].reduce((n, v) => n + (v ? 1 : 0), 0);
  const active = activeCount > 0;
  const content = (
    <div className="dt-morefilters-menu">
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={ruleOnly} onChange={onToggleRuleOnly} />
        Rule-modified only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={securityOnly} onChange={onToggleSecurityOnly} />
        Security headers only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={overridableOnly} onChange={onToggleOverridableOnly} />
        Overridable only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={hideNoise} onChange={onToggleHideNoise} />
        Hide noise (Accept-*, Sec-Fetch-*, User-Agent, …)
      </label>
    </div>
  );
  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false} overlayClassName="dt-morefilters-popover">
      <button type="button" className={`dt-toolbar-dropdown${active ? ' dt-toolbar-dropdown--active' : ''}`}>
        More filters
        {activeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}

/**
 * `View ▾` dropdown — layout + sort options. Kept separate from More
 * filters so changing how the list is presented doesn't read as a
 * filtering action. The badge counts non-default values, so the user
 * always knows the list shape isn't its default.
 */
function HeaderViewMenu({
  layout,
  sortMode,
  nameCase,
  showInsights,
  onLayoutChange,
  onSortChange,
  onNameCaseChange,
  onToggleShowInsights,
}: {
  layout: HeaderLayoutMode;
  sortMode: HeaderSortMode;
  nameCase: HeaderNameCase;
  showInsights: boolean;
  onLayoutChange: (mode: HeaderLayoutMode) => void;
  onSortChange: (mode: HeaderSortMode) => void;
  onNameCaseChange: (mode: HeaderNameCase) => void;
  onToggleShowInsights: () => void;
}) {
  const activeCount =
    (layout !== 'grouped' ? 1 : 0) +
    (sortMode !== 'original' ? 1 : 0) +
    (nameCase !== 'train' ? 1 : 0) +
    (!showInsights ? 1 : 0);
  const active = activeCount > 0;
  const content = (
    <div className="dt-morefilters-menu">
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Layout</span>
        <select value={layout} onChange={(e) => onLayoutChange(e.target.value as HeaderLayoutMode)}>
          <option value="grouped">Grouped</option>
          <option value="flat">Flat</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Sort</span>
        <select value={sortMode} onChange={(e) => onSortChange(e.target.value as HeaderSortMode)}>
          <option value="original">Original</option>
          <option value="az">A → Z</option>
          <option value="rule-first">Rule-modified first</option>
        </select>
      </label>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Name case</span>
        <select value={nameCase} onChange={(e) => onNameCaseChange(e.target.value as HeaderNameCase)}>
          <option value="train">Train-Case</option>
          <option value="original">Original (raw)</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        Show suggestions
      </label>
    </div>
  );
  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false} overlayClassName="dt-morefilters-popover">
      <button type="button" className={`dt-toolbar-dropdown${active ? ' dt-toolbar-dropdown--active' : ''}`}>
        View
        {activeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}

/** Hint below a header section showing how many noise rows the
 *  `Hide noise` toggle is currently hiding. Hover opens a popover
 *  listing the actual names so the user never has to guess. */
function HiddenNoiseHint({ items }: { items: readonly RowItem[] }) {
  return (
    <Popover
      trigger="hover"
      mouseEnterDelay={0.05}
      content={
        <div className="dt-header-noise-list">
          {items.map(({ row }) => (
            <code key={row.name} className="dt-header-noise-name">
              {row.name}
            </code>
          ))}
        </div>
      }
    >
      <div className="dt-header-noise-hint dt-col-muted">
        {items.length} noise header{items.length === 1 ? '' : 's'} hidden — hover for names
      </div>
    </Popover>
  );
}

// ── Row ────────────────────────────────────────────────────────

interface AttributedHeaderRowProps {
  row: AnnotatedHeader;
  meta: HeaderRowMeta;
  index: number;
  sectionLabel: 'Request Headers' | 'Response Headers';
  searchSection?: string;
  searchLineNumber?: number;
  searchHighlight?: string;
  ruleCollectionId?: string;
  requestUrl: string;
  rulesByUid: RulesByUid;
  nameCase: HeaderNameCase;
  onNameClick: (name: string, value: string) => void;
}

function isHighlightedHeader(
  index: number,
  section: string,
  searchSection: string | undefined,
  searchLineNumber: number | undefined,
  highlight: string | undefined,
  headerText: string,
): boolean {
  if (!highlight || !searchSection || searchLineNumber == null) return false;
  if (searchSection !== section) return false;
  if (index + 1 !== searchLineNumber) return false;
  return headerText.toLowerCase().includes(highlight.toLowerCase());
}

function AttributedHeaderRow({
  row,
  meta,
  index,
  sectionLabel,
  searchSection,
  searchLineNumber,
  searchHighlight,
  ruleCollectionId,
  requestUrl,
  rulesByUid,
  nameCase,
  onNameClick,
}: AttributedHeaderRowProps) {
  const rulePopover = useRulePopover();
  const { name, value, attribution } = row;
  const displayName = formatHeaderName(name, nameCase);
  const kind = attribution.kind;

  const direction: 'request' | 'response' = sectionLabel === 'Response Headers' ? 'response' : 'request';
  const isProtected = meta.protectedHeader;

  const classes = [
    'dt-kv',
    isHighlightedHeader(index, sectionLabel, searchSection, searchLineNumber, searchHighlight, `${name}: ${value}`)
      ? 'dt-kv--highlighted'
      : '',
    kind === 'server' ? '' : `dt-kv--oh-${kind}`,
  ]
    .filter(Boolean)
    .join(' ');

  const ruleCtx = kind === 'added' || kind === 'modified' || kind === 'removed' ? attribution.ctx : null;
  const liveRule: Rule | null = ruleCtx ? (rulesByUid.get(ruleCtx.ruleUid) ?? null) : null;
  const currentMod: HeaderModification | null = ruleCtx ? findCurrentMod(liveRule, ruleCtx) : null;
  const ruleEdited = ruleCtx ? isAttributionEdited(liveRule, ruleCtx) : false;
  const ruleForHover: Rule | null = liveRule;
  const operationForHover: HeaderOperation | undefined =
    kind === 'added' || kind === 'modified' ? attribution.operation : kind === 'removed' ? 'remove' : undefined;

  const resolver = useVariableResolver();
  const currentResolvedValue = useMemo(() => {
    if (!currentMod) return null;
    if (currentMod.operation === 'remove') return null;
    const tpl = currentMod.value;
    if (typeof tpl !== 'string') return null;
    return resolver.resolveTemplate(tpl, ruleCollectionId ? { collectionId: ruleCollectionId } : undefined).result;
  }, [resolver, currentMod, ruleCollectionId]);
  const currentResolvedName = useMemo(() => {
    if (!currentMod) return null;
    return resolver.resolveTemplate(
      currentMod.headerName,
      ruleCollectionId ? { collectionId: ruleCollectionId } : undefined,
    ).result;
  }, [resolver, currentMod, ruleCollectionId]);
  const applicability = useMemo<RuleApplicability | null>(() => {
    if (!ruleCtx) return null;
    return computeRuleApplicability({
      liveRule,
      ctx: ruleCtx,
      url: requestUrl,
      resolver,
      collectionId: ruleCollectionId,
    });
  }, [liveRule, ruleCtx, requestUrl, resolver, ruleCollectionId]);
  const snapshotResolutionReliable =
    ruleCtx?.snapshotMod.valueTemplate === undefined ||
    !ruleCtx.snapshotMod.valueTemplate.includes('{{') ||
    ruleCtx.snapshotMod.valueTemplate !== ruleCtx.snapshotMod.valueResolved;
  const valueDrifted =
    !!ruleCtx &&
    !ruleEdited &&
    snapshotResolutionReliable &&
    currentResolvedValue != null &&
    ruleCtx.snapshotMod.valueResolved != null &&
    ruleCtx.snapshotMod.valueResolved !== currentResolvedValue;
  const snapshotNameReliable = !ruleCtx?.snapshotMod.headerName.includes('{{');
  const nameDrifted =
    !!ruleCtx &&
    !ruleEdited &&
    snapshotNameReliable &&
    currentResolvedName != null &&
    currentResolvedName !== ruleCtx.snapshotMod.headerName;
  const editedSinceFire = (ruleEdited ?? false) || valueDrifted || nameDrifted;

  const handleRowMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ruleCtx) return;
    rulePopover.open({
      anchorEl: e.currentTarget,
      attribution,
      rule: ruleForHover,
      target: operationForHover ? { direction, headerName: name, operation: operationForHover } : undefined,
      currentResolvedValue,
      currentResolvedName,
      applicability,
    });
  };
  const handleRowMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ruleCtx) return;
    rulePopover.scheduleClose(e.relatedTarget);
  };

  const showResolvedValue = kind === 'added' || kind === 'modified' || kind === 'system';

  const serverTitle = kind === 'server' ? 'Create a rule to override this header' : undefined;
  const systemTitle = kind === 'system' ? `Injected by ${attribution.label} (Open Headers system feature)` : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only popover trigger; primary affordance is the rule's full editor reachable via the popover.
    // biome-ignore lint/a11y/useKeyWithMouseEvents: hover-anchored popover; keyboard users use "Open in workspace" inside the popover.
    <div
      className={classes}
      style={{ fontFamily: 'monospace' }}
      onMouseOver={ruleCtx ? handleRowMouseOver : undefined}
      onMouseOut={ruleCtx ? handleRowMouseOut : undefined}
    >
      <HeaderInfoTrigger name={name} direction={meta.direction} category={meta.category} />
      {isProtected ? (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayName}</span>
      ) : (
        <button
          type="button"
          className="dt-btn-link"
          style={{ fontFamily: 'monospace', fontWeight: 600 }}
          onClick={() => onNameClick(name, value)}
          title={serverTitle ?? systemTitle}
        >
          {displayName}
        </button>
      )}
      <span className="dt-kv-oh-value">
        : {showResolvedValue ? <ResolvedHeaderValue value={value} collectionId={ruleCollectionId} /> : value}
      </span>
      <ValueChips name={name} value={value} />
      {editedSinceFire && <EditedSinceFireChip kind={ruleEdited ? 'rule' : 'value'} />}
    </div>
  );
}

type GeneralInfoKey =
  | 'request-url'
  | 'request-method'
  | 'status-code'
  | 'remote-address'
  | 'http-version'
  | 'compression'
  | 'transferred'
  | 'referrer-policy';

const GENERAL_INFO: Record<GeneralInfoKey, import('@openheaders/ui/shared/info-popover').InfoPopoverContent> = {
  'request-url': {
    title: 'Request URL',
    kicker: 'General',
    summary: 'The full URL the browser issued the request against — scheme, host, path, and query string.',
  },
  'request-method': {
    title: 'Request Method',
    kicker: 'General',
    summary: 'The HTTP method used (`GET`, `POST`, `PUT`, `DELETE`, …).',
  },
  'status-code': {
    title: 'Status Code',
    kicker: 'General',
    summary: 'The numeric response code returned by the server.',
    sections: [
      {
        heading: 'Ranges',
        items: [
          { label: '1xx', desc: 'Informational (rare — `100 Continue`, `103 Early Hints`).' },
          { label: '2xx', desc: 'Success.' },
          { label: '3xx', desc: 'Redirection (look at the `Location` header).' },
          { label: '4xx', desc: 'Client error — request was malformed or unauthorized.' },
          { label: '5xx', desc: 'Server error — the server failed to fulfill a valid request.' },
        ],
      },
    ],
  },
  'remote-address': {
    title: 'Remote Address',
    kicker: 'General',
    summary: 'The IP address and port the request was actually sent to.',
    description: 'Different from the URL host when DNS resolves to multiple IPs, a CDN routes via anycast, or a local proxy intercepts the connection.',
  },
  'http-version': {
    title: 'HTTP Version',
    kicker: 'General',
    summary: 'The HTTP protocol version the connection negotiated.',
    description: 'Picked at TLS time via ALPN. The actual on-the-wire value (e.g. `h2`, `h3`) is shown in the tooltip when it differs from the friendly label.',
    sections: [
      {
        heading: 'Common values',
        items: [
          { label: 'HTTP/1.1', desc: 'Text-based, one request per connection by default.' },
          { label: 'HTTP/2', desc: 'Binary, multiplexed over a single TCP connection.' },
          { label: 'HTTP/3', desc: 'Built on QUIC over UDP — faster handshakes, better loss recovery.' },
        ],
      },
    ],
  },
  compression: {
    title: 'Compression',
    kicker: 'General',
    summary: 'The encoding the server applied to the response body — the browser decodes before exposing it to JavaScript.',
    sections: [
      {
        heading: 'Common values',
        items: [
          { label: 'gzip', desc: 'Universally supported, modest compression ratio.' },
          { label: 'br', desc: 'Brotli — better ratio than gzip, supported by all modern browsers.' },
          { label: 'zstd', desc: 'Newer high-ratio compression; growing browser support.' },
          { label: 'deflate', desc: 'Legacy, rarely used today.' },
        ],
      },
    ],
  },
  transferred: {
    title: 'Transferred',
    kicker: 'General',
    summary: 'Bytes that actually crossed the wire, including compression overhead.',
    description: 'The decoded size shown in parentheses is what JavaScript sees after the browser decompresses the body. A big gap between the two is the compression win.',
  },
  'referrer-policy': {
    title: 'Referrer Policy',
    kicker: 'General',
    summary: 'How much of the URL the browser sends in `Referer` on outgoing navigations and requests from this page.',
    description: 'Set via the `Referrer-Policy` response header, the `<meta name="referrer">` tag, or per-request via the `referrerpolicy` attribute.',
  },
};

function GeneralRow({
  label,
  infoKey,
  children,
}: {
  label: string;
  infoKey: GeneralInfoKey;
  children: React.ReactNode;
}) {
  return (
    <div className="dt-kv">
      <span className="dt-kv-key">
        <InfoTrigger content={GENERAL_INFO[infoKey]} className="dt-header-info-trigger" />
        {label}:
      </span>
      {children}
    </div>
  );
}

/**
 * `(i)` glyph prefixed to a header name. Hidden by default — revealed
 * on row hover via CSS. Click anchors an `<InfoPopover>` with the
 * header's documentation.
 *
 * Always renders — even unknown headers get an honest fallback popover
 * (name + direction + the category the row was bucketed into) so the
 * user gets *something* useful for every row, not just curated ones.
 */
function HeaderInfoTrigger({
  name,
  direction,
  category,
}: {
  name: string;
  direction: 'request' | 'response';
  category: HeaderCategory;
}) {
  const content = getHeaderInfoContentForRow(name, direction, HEADER_CATEGORY_LABEL[category]);
  return <InfoTrigger content={content} className="dt-header-info-trigger" />;
}

function EditedSinceFireChip({ kind }: { kind: 'rule' | 'value' }) {
  const label = kind === 'rule' ? '· rule edited since' : '· variable changed since';
  const title =
    kind === 'rule'
      ? 'Rule has been edited since this request — current rule applies only to future requests'
      : 'A variable referenced by this rule resolves to a different value now — applies only to future requests';
  return (
    <span
      title={title}
      style={{ marginLeft: 8, fontSize: 10, fontStyle: 'italic', opacity: 0.7, userSelect: 'none' }}
    >
      {label}
    </span>
  );
}

// ── Value chips ────────────────────────────────────────────────

function ValueChips({ name, value }: { name: string; value: string }) {
  const lower = name.toLowerCase();
  if (lower === 'set-cookie') return <SetCookieChips value={value} />;
  if (lower === 'cache-control') return <CacheControlChip value={value} />;
  if (lower === 'content-type') return <ContentTypeChip value={value} />;
  if (lower === 'strict-transport-security') return <HstsChip value={value} />;
  if (lower === 'authorization') return <AuthorizationChip value={value} />;
  return null;
}

/**
 * Inline value chip. When `info` is supplied, an `<InfoTrigger>` (the
 * same shared `(i)` glyph used by header rows) is rendered *before*
 * the chip — hover-revealed by the row, click opens an `<InfoPopover>`.
 * Without `info`, the chip stays as plain text and uses the native
 * `title` tooltip.
 */
function Chip({
  tone,
  title,
  info,
  children,
}: {
  tone?: 'ok' | 'warn' | 'info' | 'muted';
  title?: string;
  info?: InfoPopoverContent;
  children: React.ReactNode;
}) {
  return (
    <span className="dt-header-chip-wrap">
      {info && <InfoTrigger content={info} className="dt-header-info-trigger" />}
      <span className="dt-header-chip" data-tone={tone ?? 'info'} title={info ? undefined : title}>
        {children}
      </span>
    </span>
  );
}

// ── Inline content builders for value chips ─────────────────
// Kept inline because the prose is tightly coupled to the chip's
// rendering and these helpers are short. Each returns an
// `InfoPopoverContent` for the matching chip kind.

function cookieFlagInfo(flag: 'HttpOnly' | 'Secure' | 'Partitioned'): InfoPopoverContent {
  if (flag === 'HttpOnly') {
    return {
      title: 'HttpOnly',
      kicker: 'Set-Cookie flag',
      summary: 'Cookie is hidden from JavaScript (cannot be read via `document.cookie`).',
      description: 'Mitigates XSS — an injected script can no longer exfiltrate the cookie. Doesn’t help with CSRF.',
    };
  }
  if (flag === 'Secure') {
    return {
      title: 'Secure',
      kicker: 'Set-Cookie flag',
      summary: 'Cookie only sent over HTTPS. Never leaks over plain HTTP.',
    };
  }
  return {
    title: 'Partitioned',
    kicker: 'Set-Cookie flag',
    summary: 'CHIPS — cookie is partitioned per top-level site.',
    description:
      'Each top-level site gets its own copy of the cookie, so embedded contexts cannot use cookies to track the user across sites.',
  };
}

function sameSiteInfo(value: 'Strict' | 'Lax' | 'None'): InfoPopoverContent {
  const summaries: Record<'Strict' | 'Lax' | 'None', string> = {
    Strict: 'Cookie only sent on same-site requests. Strongest CSRF protection — even links from another site arrive cookieless.',
    Lax: 'Cookie sent on same-site requests and top-level cross-site navigations (link clicks). Default in modern browsers.',
    None: 'Cookie sent on all cross-site requests. Requires `Secure`. Use intentionally — recipients can correlate the cookie across sites.',
  };
  return {
    title: `SameSite=${value}`,
    kicker: 'Set-Cookie flag',
    summary: summaries[value],
  };
}

function cookieExpiryInfo(expiresAtMs: number, remainingSec: number): InfoPopoverContent {
  return {
    title: 'Cookie expiry',
    kicker: 'Set-Cookie attribute',
    summary:
      remainingSec <= 0
        ? 'Cookie has already expired. The browser will not send it.'
        : `Cookie expires in ${humanSec(remainingSec)} (at ${new Date(expiresAtMs).toISOString()}).`,
    description:
      'Cookies without `Max-Age` or `Expires` are session cookies and disappear when the browser quits. Set one to make the cookie persistent.',
  };
}

const SESSION_COOKIE_INFO: InfoPopoverContent = {
  title: 'Session cookie',
  kicker: 'Set-Cookie attribute',
  summary: 'No `Max-Age` or `Expires` — the browser discards this cookie when it quits.',
  description: 'Add `Max-Age=<seconds>` or `Expires=<date>` to make it persistent across browser sessions.',
};

function missingFlagInfo(flag: 'Secure' | 'HttpOnly' | 'SameSite'): InfoPopoverContent {
  const reasons: Record<'Secure' | 'HttpOnly' | 'SameSite', string> = {
    Secure: 'Without `Secure`, this cookie can leak over plain HTTP. Always set on HTTPS cookies.',
    HttpOnly: 'Without `HttpOnly`, JavaScript can read this cookie via `document.cookie` — an XSS bug exfiltrates it.',
    SameSite:
      'Without an explicit `SameSite`, browsers fall back to `Lax`. Be explicit so the policy is obvious in code review.',
  };
  return {
    title: `Missing ${flag}`,
    kicker: 'Best practice',
    summary: reasons[flag],
    description: 'Most production cookies should carry `Secure`, `HttpOnly`, and an explicit `SameSite`.',
  };
}

function cacheControlInfo(value: string, parsed: ReturnType<typeof parseCacheControl>): InfoPopoverContent {
  const directives: { label: string; desc: string }[] = [];
  if (parsed.noStore) directives.push({ label: 'no-store', desc: 'Do not cache, anywhere.' });
  if (parsed.noCache) directives.push({ label: 'no-cache', desc: 'May cache, but revalidate every time before reuse.' });
  if (parsed.isPublic) directives.push({ label: 'public', desc: 'Any cache may store, including CDNs.' });
  if (parsed.isPrivate) directives.push({ label: 'private', desc: 'Only the user’s browser may store.' });
  if (parsed.immutable) directives.push({ label: 'immutable', desc: 'Promise the body will not change for max-age.' });
  if (parsed.mustRevalidate) directives.push({ label: 'must-revalidate', desc: 'Once stale, revalidate before serving.' });
  if (parsed.maxAgeSec != null) directives.push({ label: `max-age=${parsed.maxAgeSec}`, desc: `Fresh for ${humanSec(parsed.maxAgeSec)}.` });
  if (parsed.sMaxAgeSec != null) directives.push({ label: `s-maxage=${parsed.sMaxAgeSec}`, desc: `Shared-cache freshness: ${humanSec(parsed.sMaxAgeSec)}.` });
  if (parsed.staleWhileRevalidateSec != null) {
    directives.push({
      label: `stale-while-revalidate=${parsed.staleWhileRevalidateSec}`,
      desc: `Allow stale reuse for ${humanSec(parsed.staleWhileRevalidateSec)} while a background revalidation runs.`,
    });
  }
  return {
    title: `Cache-Control: ${parsed.summary}`,
    kicker: 'Cache directive',
    summary: `Raw value: \`${value}\`.`,
    sections: directives.length > 0 ? [{ heading: 'Active directives', items: directives }] : undefined,
  };
}

function charsetInfo(charset: string): InfoPopoverContent {
  return {
    title: `charset=${charset}`,
    kicker: 'Content-Type parameter',
    summary: 'Character encoding the body uses.',
    description: 'For `text/*` types, modern stacks default to `utf-8`. Wrong values cause mojibake.',
  };
}

const BOUNDARY_INFO: InfoPopoverContent = {
  title: 'Multipart boundary',
  kicker: 'Content-Type parameter',
  summary: 'Token that separates parts of a multipart body (file uploads, multipart/form-data).',
  description: 'Generated by the client; must not appear inside any part’s body.',
};

function hstsInfo(value: string, parsed: NonNullable<ReturnType<typeof parseHsts>>): InfoPopoverContent {
  return {
    title: 'Strict-Transport-Security',
    kicker: 'Security policy',
    summary: `Browser will use HTTPS for this host for ${humanSec(parsed.maxAgeSec)}.`,
    description: `Raw value: \`${value}\`.`,
    sections: [
      {
        heading: 'Directives',
        items: [
          { label: `max-age=${parsed.maxAgeSec}`, desc: 'Remember HTTPS-only for this long.' },
          ...(parsed.includeSubDomains ? [{ label: 'includeSubDomains', desc: 'Apply to every subdomain.' }] : []),
          ...(parsed.preload ? [{ label: 'preload', desc: 'Eligibility for the browser preload list.' }] : []),
        ],
      },
    ],
  };
}

const JWT_INFO: InfoPopoverContent = {
  title: 'JWT',
  kicker: 'Authorization scheme',
  summary: 'JSON Web Token — a base64-encoded `<header>.<payload>.<signature>` triple.',
  description:
    'The signature proves the token was issued by someone holding the signing key. The header (alg, typ) and payload (claims) are NOT encrypted — they are simply base64-encoded and readable by anyone.',
};

function jwtAlgInfo(alg: string): InfoPopoverContent {
  return {
    title: `JWT alg: ${alg}`,
    kicker: 'JWT header',
    summary: 'Signing algorithm declared in the JWT header.',
    description:
      'Common values: `HS256` (HMAC-SHA256, symmetric), `RS256` (RSA, asymmetric), `ES256` (ECDSA). `none` (no signature) should always be rejected by validators.',
  };
}

function jwtExpInfo(secondsRemaining: number): InfoPopoverContent {
  if (secondsRemaining < 0) {
    return {
      title: 'JWT expired',
      kicker: 'JWT claim',
      summary: `Token expired ${humanSec(-secondsRemaining)} ago. The server should reject it.`,
    };
  }
  return {
    title: `JWT expires in ${humanSec(secondsRemaining)}`,
    kicker: 'JWT claim',
    summary:
      secondsRemaining < 300
        ? 'Token is close to expiry — refresh it or expect a 401 soon.'
        : 'Time until the JWT `exp` claim is reached.',
  };
}

function bearerSchemeInfo(scheme: string): InfoPopoverContent {
  return {
    title: scheme,
    kicker: 'Authorization scheme',
    summary:
      scheme === 'Bearer'
        ? 'Opaque bearer credential (OAuth 2.0 / API token). Treat it like a password — anyone who has it can authenticate as the user.'
        : scheme === 'Basic'
          ? 'HTTP Basic auth — `base64(username:password)`. Only safe over HTTPS.'
          : 'Authentication scheme name. The credential format depends on the scheme.',
  };
}

function SetCookieChips({ value }: { value: string }) {
  const info = useMemo(() => parseSetCookie(value), [value]);
  if (!info) return null;
  const chips: React.ReactNode[] = [];
  if (info.httpOnly) chips.push(<Chip key="ho" tone="ok" info={cookieFlagInfo('HttpOnly')}>HttpOnly</Chip>);
  if (info.secure) chips.push(<Chip key="sec" tone="ok" info={cookieFlagInfo('Secure')}>Secure</Chip>);
  if (info.partitioned) chips.push(<Chip key="part" tone="ok" info={cookieFlagInfo('Partitioned')}>Partitioned</Chip>);
  if (info.sameSite) chips.push(<Chip key="ss" tone="info" info={sameSiteInfo(info.sameSite)}>SameSite={info.sameSite}</Chip>);
  if (info.expiresAtMs != null) {
    const remainingSec = Math.max(0, Math.round((info.expiresAtMs - Date.now()) / 1000));
    chips.push(
      <Chip key="exp" tone={remainingSec < 60 ? 'warn' : 'muted'} info={cookieExpiryInfo(info.expiresAtMs, remainingSec)}>
        expires {humanSec(remainingSec)}
      </Chip>,
    );
  } else if (info.session) {
    chips.push(<Chip key="sess" tone="muted" info={SESSION_COOKIE_INFO}>session</Chip>);
  }
  for (const missing of info.missingFlags) {
    chips.push(
      <Chip key={`miss-${missing}`} tone="warn" info={missingFlagInfo(missing)}>
        ⚠ no {missing}
      </Chip>,
    );
  }
  return <span className="dt-header-chips">{chips}</span>;
}

function CacheControlChip({ value }: { value: string }) {
  const parsed = useMemo(() => parseCacheControl(value), [value]);
  if (!parsed.summary) return null;
  const tone = parsed.noStore || parsed.noCache ? 'warn' : parsed.immutable ? 'ok' : 'info';
  return (
    <span className="dt-header-chips">
      <Chip tone={tone} info={cacheControlInfo(value, parsed)}>
        {parsed.summary}
      </Chip>
    </span>
  );
}

function ContentTypeChip({ value }: { value: string }) {
  const info = useMemo(() => parseContentType(value), [value]);
  if (!info.charset && !info.boundary) return null;
  return (
    <span className="dt-header-chips">
      {info.charset && (
        <Chip tone="muted" info={charsetInfo(info.charset)}>
          {info.charset}
        </Chip>
      )}
      {info.boundary && (
        <Chip tone="muted" info={BOUNDARY_INFO}>
          boundary
        </Chip>
      )}
    </span>
  );
}

function HstsChip({ value }: { value: string }) {
  const parsed = useMemo(() => parseHsts(value), [value]);
  if (!parsed) return null;
  return (
    <span className="dt-header-chips">
      <Chip tone="ok" info={hstsInfo(value, parsed)}>
        {parsed.summary}
      </Chip>
    </span>
  );
}

function AuthorizationChip({ value }: { value: string }) {
  const info = useMemo(() => parseAuthorization(value), [value]);
  if (!info) return null;
  if (!info.isJwt) {
    return (
      <span className="dt-header-chips">
        <Chip tone="info" info={bearerSchemeInfo(info.scheme)}>
          {info.scheme}
        </Chip>
      </span>
    );
  }
  const alg = typeof info.jwtHeader?.alg === 'string' ? info.jwtHeader.alg : 'unknown';
  const chips: React.ReactNode[] = [
    <Chip key="jwt" tone="info" info={JWT_INFO}>
      JWT
    </Chip>,
    <Chip key="alg" tone="muted" info={jwtAlgInfo(alg)}>
      {alg}
    </Chip>,
  ];
  const exp = info.jwtExpSecondsRemaining;
  if (exp != null) {
    if (exp < 0) {
      chips.push(
        <Chip key="exp" tone="warn" info={jwtExpInfo(exp)}>
          expired
        </Chip>,
      );
    } else {
      chips.push(
        <Chip key="exp" tone={exp < 300 ? 'warn' : 'muted'} info={jwtExpInfo(exp)}>
          exp {humanSec(exp)}
        </Chip>,
      );
    }
  }
  return <span className="dt-header-chips">{chips}</span>;
}

function humanSec(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}

export default HeadersView;
