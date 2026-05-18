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

import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import type { HeaderModification, HeaderOperation, Rule } from '@openheaders/core/types';
import { validateHeaderName } from '@openheaders/core/utils';
import { useMemo, useState } from 'react';
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
  const [filter, setFilter] = useState('');
  const [ruleOnly, setRuleOnly] = useState(false);
  const [securityOnly, setSecurityOnly] = useState(false);
  const [overridableOnly, setOverridableOnly] = useState(false);
  const [hideNoise, setHideNoise] = useState(false);

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
    <>
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

      {insights.length > 0 && (
        <div className="dt-header-insights">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} onAction={handleInsightAction} />
          ))}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="dt-header-filter">
        <input
          type="search"
          placeholder="Filter — text, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-header-filter-input"
          aria-label="Filter headers"
        />
        <div className="dt-header-quick-toggles" role="group" aria-label="Quick filters">
          <button
            type="button"
            className="dt-header-quick-toggle"
            data-active={ruleOnly}
            aria-pressed={ruleOnly}
            onClick={() => setRuleOnly((v) => !v)}
            title="Show only headers added, modified, or removed by an Open Headers rule"
          >
            Rule-modified
          </button>
          <button
            type="button"
            className="dt-header-quick-toggle"
            data-active={securityOnly}
            aria-pressed={securityOnly}
            onClick={() => setSecurityOnly((v) => !v)}
            title="Show only security-related headers (CSP, HSTS, X-Frame-Options, Sec-Fetch-*, …)"
          >
            Security
          </button>
          <button
            type="button"
            className="dt-header-quick-toggle"
            data-active={overridableOnly}
            aria-pressed={overridableOnly}
            onClick={() => setOverridableOnly((v) => !v)}
            title="Hide protected headers (host, content-length, sec-ch-ua, …) the browser won't let rules override"
          >
            Overridable
          </button>
          <button
            type="button"
            className="dt-header-quick-toggle"
            data-active={hideNoise}
            aria-pressed={hideNoise}
            onClick={() => setHideNoise((v) => !v)}
            title="Fold low-signal headers (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, …)"
          >
            Hide noise
          </button>
        </div>
      </div>

      <details className="dt-section" open>
        <summary>General</summary>
        <div className="dt-kv">
          <span className="dt-kv-key">Request URL:</span>
          <span className="dt-kv-val" style={{ wordBreak: 'break-all' }}>{request.url}</span>
        </div>
        <div className="dt-kv">
          <span className="dt-kv-key">Request Method:</span>
          <span className="dt-kv-val">{request.method}</span>
        </div>
        {request.statusCode != null && (
          <div className="dt-kv">
            <span className="dt-kv-key">Status Code:</span>
            <span className={`dt-kv-val ${statusOk ? 'dt-kv-val--status-ok' : 'dt-kv-val--status-err'}`}>
              {request.statusCode} {request.statusText ?? ''}
            </span>
          </div>
        )}
        {remoteAddr && (
          <div className="dt-kv">
            <span className="dt-kv-key">Remote Address:</span>
            <span className="dt-kv-val">{remoteAddr}</span>
          </div>
        )}
        {httpVersion && (
          <div className="dt-kv">
            <span className="dt-kv-key">HTTP Version:</span>
            <span className="dt-kv-val" title={`ALPN: ${httpVersion}`}>{formatHttpVersion(httpVersion)}</span>
          </div>
        )}
        {contentEncoding && (
          <div className="dt-kv">
            <span className="dt-kv-key">Compression:</span>
            <span className="dt-kv-val">{contentEncoding}</span>
          </div>
        )}
        {bytesIn != null && bytesIn > 0 && (
          <div className="dt-kv">
            <span className="dt-kv-key">Transferred:</span>
            <span className="dt-kv-val">
              {formatBytes(bytesIn)}
              {decodedSize != null && decodedSize > 0 && decodedSize !== bytesIn ? ` (decoded ${formatBytes(decodedSize)})` : ''}
            </span>
          </div>
        )}
        {referrerPolicy && (
          <div className="dt-kv">
            <span className="dt-kv-key">Referrer Policy:</span>
            <span className="dt-kv-val">{referrerPolicy}</span>
          </div>
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
        driftedRows={driftedRows}
        onCreateHeaderRule={onCreateHeaderRule}
        searchHighlight={searchHighlight}
        searchSection={searchSection}
        searchLineNumber={searchLineNumber}
      />
    </>
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
  driftedRows: ReadonlySet<AnnotatedHeader>;
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
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
  driftedRows,
  onCreateHeaderRule,
  searchHighlight,
  searchSection,
  searchLineNumber,
}: HeaderSectionProps) {
  const [rawView, setRawView] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  // Build per-row meta once for filter + categorization.
  const rowMetas = useMemo(
    () =>
      rows.map((row) => {
        const meta: HeaderRowMeta = {
          name: row.name,
          value: row.value,
          direction,
          origin: originOf(row.attribution),
          category: categorizeHeader(row.name),
          protectedHeader: !validateHeaderName(row.name, direction === 'response').valid,
          drifted: driftedRows.has(row),
        };
        return { row, meta };
      }),
    [rows, direction, driftedRows],
  );

  const filtered = useMemo(
    () =>
      rowMetas.filter(({ row, meta }) => {
        if (hideNoise && meta.origin === 'server' && isNoiseHeader(row.name)) return false;
        if (compiledQuery.length === 0) return true;
        return matchesHeaderQuery(meta, compiledQuery);
      }),
    [rowMetas, compiledQuery, hideNoise],
  );

  // Group by category for the categorized view.
  const grouped = useMemo(() => {
    const byCat = new Map<HeaderCategory, { row: AnnotatedHeader; meta: HeaderRowMeta }[]>();
    for (const item of filtered) {
      const bucket = byCat.get(item.meta.category);
      if (bucket) bucket.push(item);
      else byCat.set(item.meta.category, [item]);
    }
    return HEADER_CATEGORY_ORDER.flatMap((cat) => {
      const items = byCat.get(cat);
      if (!items || items.length === 0) return [];
      return [{ cat, items }];
    });
  }, [filtered]);

  const hiddenByFilter = rows.length - filtered.length;
  const hiddenNoiseCount = useMemo(() => {
    if (!hideNoise) return 0;
    return rowMetas.filter(({ row, meta }) => meta.origin === 'server' && isNoiseHeader(row.name)).length;
  }, [rowMetas, hideNoise]);

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
        <pre className="dt-header-raw">{formatHeadersBlock(filtered.map((f) => f.row))}</pre>
      ) : (
        <>
          {grouped.length === 0 ? (
            <div className="dt-kv dt-col-muted">No headers match the filter.</div>
          ) : (
            grouped.map(({ cat, items }) => (
              <div className="dt-header-category" key={`${direction}-${cat}`}>
                <div className="dt-header-category-summary">
                  <span className="dt-header-category-label">{HEADER_CATEGORY_LABEL[cat]}</span>
                  <span className="dt-header-category-count">{items.length}</span>
                </div>
                {items.map(({ row, meta }, i) => (
                  <AttributedHeaderRow
                    key={`${direction}-${cat}-${i}-${row.name}`}
                    row={row}
                    meta={meta}
                    index={i}
                    sectionLabel={label}
                    searchSection={searchSection}
                    searchLineNumber={searchLineNumber}
                    searchHighlight={searchHighlight}
                    ruleCollectionId={collectionIdFor(row)}
                    requestUrl={request.url}
                    rulesByUid={rulesByUid}
                    onNameClick={(name, value) => onCreateHeaderRule(direction, name, value)}
                  />
                ))}
              </div>
            ))
          )}
          {hiddenNoiseCount > 0 && (
            <div className="dt-header-noise-hint dt-col-muted">{hiddenNoiseCount} noise header{hiddenNoiseCount === 1 ? '' : 's'} hidden.</div>
          )}
        </>
      )}
    </details>
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
  onNameClick,
}: AttributedHeaderRowProps) {
  const rulePopover = useRulePopover();
  const { name, value, attribution } = row;
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
      {isProtected ? (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{name}</span>
      ) : (
        <button
          type="button"
          className="dt-btn-link"
          style={{ fontFamily: 'monospace', fontWeight: 600 }}
          onClick={() => onNameClick(name, value)}
          title={serverTitle ?? systemTitle}
        >
          {name}
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

function Chip({ tone, title, children }: { tone?: 'ok' | 'warn' | 'info' | 'muted'; title?: string; children: React.ReactNode }) {
  return (
    <span className="dt-header-chip" data-tone={tone ?? 'info'} title={title}>
      {children}
    </span>
  );
}

function SetCookieChips({ value }: { value: string }) {
  const info = useMemo(() => parseSetCookie(value), [value]);
  if (!info) return null;
  const chips: React.ReactNode[] = [];
  if (info.httpOnly) chips.push(<Chip key="ho" tone="ok" title="Cookie is hidden from JavaScript">HttpOnly</Chip>);
  if (info.secure) chips.push(<Chip key="sec" tone="ok" title="Cookie only sent over HTTPS">Secure</Chip>);
  if (info.partitioned) chips.push(<Chip key="part" tone="ok" title="Cookie partitioned per top-level site (CHIPS)">Partitioned</Chip>);
  if (info.sameSite) chips.push(<Chip key="ss" tone="info" title={`SameSite=${info.sameSite}`}>SameSite={info.sameSite}</Chip>);
  if (info.expiresAtMs != null) {
    const remainingSec = Math.max(0, Math.round((info.expiresAtMs - Date.now()) / 1000));
    chips.push(
      <Chip key="exp" tone={remainingSec < 60 ? 'warn' : 'muted'} title={`Expires at ${new Date(info.expiresAtMs).toISOString()}`}>
        expires {humanSec(remainingSec)}
      </Chip>,
    );
  } else if (info.session) {
    chips.push(<Chip key="sess" tone="muted" title="Session cookie — discarded when the browser quits">session</Chip>);
  }
  for (const missing of info.missingFlags) {
    chips.push(
      <Chip key={`miss-${missing}`} tone="warn" title={`Missing ${missing} flag — best practice would set it`}>
        ⚠ no {missing}
      </Chip>,
    );
  }
  return <span className="dt-header-chips">{chips}</span>;
}

function CacheControlChip({ value }: { value: string }) {
  const info = useMemo(() => parseCacheControl(value), [value]);
  if (!info.summary) return null;
  const tone = info.noStore || info.noCache ? 'warn' : info.immutable ? 'ok' : 'info';
  return <span className="dt-header-chips"><Chip tone={tone}>{info.summary}</Chip></span>;
}

function ContentTypeChip({ value }: { value: string }) {
  const info = useMemo(() => parseContentType(value), [value]);
  if (!info.charset && !info.boundary) return null;
  return (
    <span className="dt-header-chips">
      {info.charset && <Chip tone="muted" title="Character set">{info.charset}</Chip>}
      {info.boundary && <Chip tone="muted" title="Multipart boundary">boundary</Chip>}
    </span>
  );
}

function HstsChip({ value }: { value: string }) {
  const info = useMemo(() => parseHsts(value), [value]);
  if (!info) return null;
  return <span className="dt-header-chips"><Chip tone="ok">{info.summary}</Chip></span>;
}

function AuthorizationChip({ value }: { value: string }) {
  const info = useMemo(() => parseAuthorization(value), [value]);
  if (!info) return null;
  if (!info.isJwt) return <span className="dt-header-chips"><Chip tone="info">{info.scheme}</Chip></span>;
  const alg = typeof info.jwtHeader?.alg === 'string' ? info.jwtHeader.alg : 'unknown';
  const chips: React.ReactNode[] = [<Chip key="jwt" tone="info" title="JSON Web Token">JWT</Chip>, <Chip key="alg" tone="muted" title="JWT alg header">{alg}</Chip>];
  const exp = info.jwtExpSecondsRemaining;
  if (exp != null) {
    if (exp < 0) chips.push(<Chip key="exp" tone="warn" title="JWT has expired">expired</Chip>);
    else chips.push(<Chip key="exp" tone={exp < 300 ? 'warn' : 'muted'} title={`Expires in ${humanSec(exp)}`}>exp {humanSec(exp)}</Chip>);
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
