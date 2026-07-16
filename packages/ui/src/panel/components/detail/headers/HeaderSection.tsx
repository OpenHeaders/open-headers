import { validateHeaderName } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useMemo, useState } from 'react';
import {
  type AnnotatedHeader,
} from '../../../data/headers/header-attribution';
import {
  categorizeHeader,
  HEADER_CATEGORY_LABEL,
  HEADER_CATEGORY_ORDER,
  type HeaderCategory,
} from '@openheaders/ui/shared/info-popover/data/http-headers/header-category';
import { type HeaderFilterToken, type HeaderRowMeta, matchesHeaderQuery } from '../../../data/headers/header-filter';
import { type HeaderNameCase, formatHeaderName } from '../../../data/headers/header-name-case';
import type { InspectorRowWithFires } from '../../../data/inspector-row-projection';
import { formatHeadersBlock, formatCurl, formatFetch } from '../../../data/request-formatters';
import type { RulesByUid } from '../../../data/rule-create/use-rules-lookup';
import { AttributedHeaderRow } from './HeaderRow';
import { HiddenNoiseHint, type RowItem } from './HiddenNoiseHint';
import type { HeaderLayoutMode, HeaderSortMode, SectionLabel } from './types';
import { isNoiseHeader, originOf } from './utils';

interface HeaderSectionProps {
  label: SectionLabel;
  direction: 'request' | 'response';
  rows: readonly AnnotatedHeader[];
  row: InspectorRowWithFires;
  rulesByUid: RulesByUid;
  collectionIdFor: (h: AnnotatedHeader) => string | undefined;
  compiledQuery: readonly HeaderFilterToken[];
  hideNoise: boolean;
  layout: HeaderLayoutMode;
  sortMode: HeaderSortMode;
  nameCase: HeaderNameCase;
  showChips: boolean;
  driftedRows: ReadonlySet<AnnotatedHeader>;
  /** Row Override buttons + "+ Add Header" — opens the in-panel create
   *  popover anchored to the clicked control. */
  onOverrideHeader: (
    direction: 'request' | 'response',
    headerName: string,
    value: string | undefined,
    anchorEl: HTMLElement,
  ) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
  /** Rendered under the section summary, above the rows — e.g. the
   *  provisional-headers warning on the Request Headers section. */
  banner?: React.ReactNode;
  /** Force the provisional treatment (az-sort) on the request section, beyond
   *  the lifecycle's own flag — for a navigation-abandoned row whose net-process
   *  status the browser's renderer-coupled panel never confirmed. */
  provisional?: boolean;
}

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

export function HeaderSection({
  label,
  direction,
  rows,
  row,
  rulesByUid,
  collectionIdFor,
  compiledQuery,
  hideNoise,
  layout,
  sortMode,
  nameCase,
  showChips,
  driftedRows,
  onOverrideHeader,
  searchHighlight,
  searchSection,
  searchLineNumber,
  banner,
  provisional: provisionalOverride,
}: HeaderSectionProps) {
  const t = useT();
  const [rawView, setRawView] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  // `label` stays the raw SectionLabel identifier (the search plane and
  // the rows' highlight join compare against it) — only the display
  // form localizes, mapped here at the render site.
  const displayLabel =
    label === 'Response Headers'
      ? t('panel.inspector.headers.section.responseHeaders')
      : t('panel.inspector.headers.section.requestHeaders');

  // Build per-row meta once for filter + categorization. `originalIndex`
  // is captured BEFORE any filter/sort so the search-highlight machinery
  // can still locate the right row after the user reorders / hides.
  const rowMetas = useMemo<RowItem[]>(
    () =>
      rows.map((header, originalIndex) => {
        const meta: HeaderRowMeta = {
          name: header.name,
          value: header.value,
          direction,
          origin: originOf(header.attribution),
          category: categorizeHeader(header.name),
          protectedHeader: !validateHeaderName(header.name, direction === 'response').valid,
          drifted: driftedRows.has(header),
        };
        return { row: header, meta, originalIndex };
      }),
    [rows, direction, driftedRows],
  );

  const filteredByQuery = useMemo(
    () => rowMetas.filter(({ meta }) => compiledQuery.length === 0 || matchesHeaderQuery(meta, compiledQuery)),
    [rowMetas, compiledQuery],
  );
  const hiddenNoiseItems = useMemo<RowItem[]>(
    () =>
      hideNoise ? filteredByQuery.filter(({ row: header, meta }) => meta.origin === 'server' && isNoiseHeader(header.name)) : [],
    [filteredByQuery, hideNoise],
  );
  const filtered = useMemo(
    () =>
      hideNoise
        ? filteredByQuery.filter(({ row: header, meta }) => !(meta.origin === 'server' && isNoiseHeader(header.name)))
        : filteredByQuery,
    [filteredByQuery, hideNoise],
  );

  // Provisional request headers are the browser's cooked set, captured before
  // the wire exchange — their order is arbitrary, not a real on-the-wire order.
  // Alphabetize them regardless of the user's sort preference (which governs
  // genuinely-ordered real headers), matching the browser's provisional view.
  const provisional =
    direction === 'request' && (provisionalOverride ?? row.lifecycle.requestHeadersProvisional === true);
  const effectiveSort: HeaderSortMode = provisional ? 'az' : sortMode;
  const sortedItems = useMemo(() => sortRows(filtered, effectiveSort), [filtered, effectiveSort]);

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
  const lc = row.lifecycle;

  const handleCopy = async (mode: 'all' | 'filtered' | 'curl' | 'fetch'): Promise<void> => {
    let text = '';
    if (mode === 'curl') text = formatCurl(lc);
    else if (mode === 'fetch') text = formatFetch(lc);
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
        {displayLabel}
        <span className="dt-header-section-count" aria-label={t('panel.inspector.headers.section.countAria')}>
          {filtered.length}
          {hiddenByFilter > 0 ? ` / ${rows.length}` : ''}
        </span>
        <button
          type="button"
          className="dt-btn dt-btn--oh dt-header-section-add"
          onClick={(e) => {
            e.preventDefault();
            onOverrideHeader(direction, '', '', e.currentTarget);
          }}
        >
          + {t('panel.inspector.headers.section.addHeader')}
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
          title={t('panel.inspector.headers.section.rawTitle')}
        >
          {t('panel.inspector.headers.section.raw')}
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
            {t('panel.inspector.headers.section.copy')} ▾
          </button>
          {copyOpen && (
            <div className="dt-header-copy-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => handleCopy('all')}>
                {t('panel.inspector.headers.section.copyAll')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleCopy('filtered')}
                disabled={filtered.length === rows.length}
              >
                {t('panel.inspector.headers.section.copyFiltered')}
              </button>
              {direction === 'request' && (
                <>
                  <button type="button" role="menuitem" onClick={() => handleCopy('curl')}>
                    {t('panel.inspector.headers.section.copyCurl')}
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleCopy('fetch')}>
                    {t('panel.inspector.headers.section.copyFetch')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </summary>

      {banner}

      {rows.length === 0 ? (
        <div className="dt-kv dt-col-muted">{t('panel.inspector.headers.section.noneCaptured')}</div>
      ) : rawView ? (
        <pre className="dt-header-raw">
          {formatHeadersBlock(sortedItems.map((f) => ({ name: formatHeaderName(f.row.name, nameCase), value: f.row.value })))}
        </pre>
      ) : (
        <>
          {sortedItems.length === 0 ? (
            <div className="dt-kv dt-col-muted">{t('panel.inspector.headers.section.noFilterMatch')}</div>
          ) : layout === 'flat' ? (
            <div className="dt-header-category">
              {sortedItems.map(({ row: header, meta, originalIndex }) => (
                <AttributedHeaderRow
                  key={`${direction}-flat-${originalIndex}-${header.name}`}
                  row={header}
                  meta={meta}
                  index={originalIndex}
                  sectionLabel={label}
                  searchSection={searchSection}
                  searchLineNumber={searchLineNumber}
                  searchHighlight={searchHighlight}
                  ruleCollectionId={collectionIdFor(header)}
                  requestUrl={lc.url}
                  rulesByUid={rulesByUid}
                  nameCase={nameCase}
                  showChips={showChips}
                  onOverride={(name, value, anchorEl) => onOverrideHeader(direction, name, value, anchorEl)}
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
                {items.map(({ row: header, meta, originalIndex }) => (
                  <AttributedHeaderRow
                    key={`${direction}-${cat}-${originalIndex}-${header.name}`}
                    row={header}
                    meta={meta}
                    index={originalIndex}
                    sectionLabel={label}
                    searchSection={searchSection}
                    searchLineNumber={searchLineNumber}
                    searchHighlight={searchHighlight}
                    ruleCollectionId={collectionIdFor(header)}
                    requestUrl={lc.url}
                    rulesByUid={rulesByUid}
                    nameCase={nameCase}
                    showChips={showChips}
                    onOverride={(name, value, anchorEl) => onOverrideHeader(direction, name, value, anchorEl)}
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
