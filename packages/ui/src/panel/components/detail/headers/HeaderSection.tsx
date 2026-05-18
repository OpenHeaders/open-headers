import { validateHeaderName } from '@openheaders/core/utils';
import { useMemo, useState } from 'react';
import {
  type AnnotatedHeader,
} from '../../../data/header-attribution';
import {
  categorizeHeader,
  HEADER_CATEGORY_LABEL,
  HEADER_CATEGORY_ORDER,
  type HeaderCategory,
} from '../../../data/header-category';
import { type HeaderFilterToken, type HeaderRowMeta, matchesHeaderQuery } from '../../../data/header-filter';
import { type HeaderNameCase, formatHeaderName } from '../../../data/header-name-case';
import { formatHeadersBlock, formatCurl, formatFetch } from '../../../data/request-formatters';
import type { InspectorRequest } from '../../../data/types';
import type { RulesByUid } from '../../../data/use-rules-lookup';
import { AttributedHeaderRow } from './HeaderRow';
import { HiddenNoiseHint, type RowItem } from './HiddenNoiseHint';
import type { HeaderLayoutMode, HeaderSortMode, SectionLabel } from './types';
import { isNoiseHeader, originOf } from './utils';

interface HeaderSectionProps {
  label: SectionLabel;
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
  showChips: boolean;
  driftedRows: ReadonlySet<AnnotatedHeader>;
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
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
  request,
  rulesByUid,
  collectionIdFor,
  compiledQuery,
  hideNoise,
  layout,
  sortMode,
  nameCase,
  showChips,
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
              <button type="button" role="menuitem" onClick={() => handleCopy('all')}>
                Copy all
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleCopy('filtered')}
                disabled={filtered.length === rows.length}
              >
                Copy filtered
              </button>
              {direction === 'request' && (
                <>
                  <button type="button" role="menuitem" onClick={() => handleCopy('curl')}>
                    Copy as cURL
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleCopy('fetch')}>
                    Copy as fetch
                  </button>
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
                  showChips={showChips}
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
                    showChips={showChips}
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
