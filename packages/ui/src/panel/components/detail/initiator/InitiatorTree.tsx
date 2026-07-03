import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/dom/useMeasuredStickyOffset';
import { useStickyAncestors } from '@openheaders/ui/shared/hooks/dom/useStickyAncestors';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeCascadeInsights } from '../../../data/cascade/cascade-insights';
import { computeCascadeSummary } from '../../../data/cascade/cascade-summary';
import { parseCascadeQuery } from '../../../data/cascade/cascade-filter';
import type { InspectorRowWithFires } from '../../../data/inspector-row-projection';
import ResourceIcon from '../../traffic/ResourceIcon';
import { HighlightedText } from '../HighlightedText';
import { CascadeSummaryHeader } from './CascadeSummaryHeader';
import { InitiatorMoreFiltersMenu, InitiatorViewMenu } from './InitiatorMenus';
import { InsightCallout } from './InsightCallout';
import { RowChips } from './RowChips';
import { buildTree, flattenTree, type FlatRow } from './tree-model';
import { shortUrl } from './utils';

export function InitiatorTreeView({
  row,
  getChildren,
  pageOrigin,
  onOpenRequest,
}: {
  row: InspectorRowWithFires;
  getChildren: (url: string) => readonly InspectorRowWithFires[];
  pageOrigin: string | null;
  onOpenRequest?: (requestId: string) => void;
}) {
  const [filter, setFilter] = useState('');
  // Filter text stays per-tab (request-specific); the toggles + sort
  // + show-insights persist panel-wide via the shared settings store.
  const [failuresOnly, setFailuresOnly] = useSetting('devpanelInitiator.failuresOnly');
  const [thirdPartyOnly, setThirdPartyOnly] = useSetting('devpanelInitiator.thirdPartyOnly');
  const [sortMode, setSortMode] = useSetting('devpanelInitiator.sortMode');
  const [showInsights, setShowInsights] = useSetting('devpanelInitiator.showInsights');
  const toggleFailuresOnly = useCallback(() => setFailuresOnly(!failuresOnly), [failuresOnly, setFailuresOnly]);
  const toggleThirdPartyOnly = useCallback(
    () => setThirdPartyOnly(!thirdPartyOnly),
    [thirdPartyOnly, setThirdPartyOnly],
  );
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);
  const [expanded, setExpanded] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [focusedKey, setFocusedKey] = useState<string>(row.lifecycle.requestId);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const lastFocusedRef = useRef<string>(focusedKey);

  // Adapter — cascade-summary works on the pure lifecycle layer; we
  // project the row-shaped children resolver down to lifecycles so the
  // summary helper doesn't need to know about the fires layer.
  const getChildLifecycles = useCallback(
    (url: string): readonly RequestLifecycle[] => getChildren(url).map((r) => r.lifecycle),
    [getChildren],
  );

  const summary = useMemo(
    () => computeCascadeSummary(row.lifecycle, getChildLifecycles, pageOrigin),
    [row.lifecycle, getChildLifecycles, pageOrigin],
  );
  const insights = useMemo(() => computeCascadeInsights(summary), [summary]);

  // Build the effective query — free-text + toggles compile to one token list.
  const compiledQuery = useMemo(() => {
    const parts: string[] = [];
    if (filter.trim()) parts.push(filter.trim());
    if (failuresOnly) parts.push('is:failed');
    if (thirdPartyOnly) parts.push('is:third-party');
    return parseCascadeQuery(parts.join(' '));
  }, [filter, failuresOnly, thirdPartyOnly]);

  const tree = useMemo(
    () => buildTree(row, getChildren, pageOrigin, compiledQuery, sortMode, summary.subtreeStats),
    [row, getChildren, pageOrigin, compiledQuery, sortMode, summary.subtreeStats],
  );
  const filtering = compiledQuery.length > 0;
  const rows = useMemo(
    () => flattenTree(tree, expanded, filtering, pageOrigin, summary.subtreeStats),
    [tree, expanded, filtering, pageOrigin, summary.subtreeStats],
  );

  // Sticky-ancestor stack: as the user scrolls, the chain of ancestors
  // for the row currently at the top of the viewport renders as a stack
  // at the top of the tree (VS Code-style "sticky scroll"). Empty when
  // the root row is still visible — nothing above to stick.
  const paneRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const stickyStackRef = useRef<HTMLDivElement | null>(null);

  useMeasuredCssHeights(paneRef, [
    { ref: summaryRef, cssVar: '--oh-init-summary-h' },
    { ref: toolbarRef, cssVar: '--oh-init-toolbar-h' },
    { ref: stickyStackRef, cssVar: '--oh-init-stack-h' },
  ]);
  const rowsByKey = useMemo(() => {
    const m = new Map<string, FlatRow>();
    for (const r of rows) m.set(r.key, r);
    return m;
  }, [rows]);

  const stickyAncestorKeys = useStickyAncestors<FlatRow>({
    items: rows,
    keyOf: (r) => r.key,
    parentKeyOf: (r) => r.parentKey,
    getRowElement: useCallback((key: string) => rowRefs.current.get(key), []),
    resolveScrollContainer: useCallback(
      () => (paneRef.current?.closest('.dt-tab-body') as HTMLElement | null) ?? null,
      [],
    ),
    chromeHeightPx: useCallback(
      () => (summaryRef.current?.offsetHeight ?? 24) + (toolbarRef.current?.offsetHeight ?? 30),
      [],
    ),
  });

  useEffect(() => {
    if (rows.length === 0) return;
    if (!rows.some((r) => r.key === focusedKey)) setFocusedKey(rows[0].key);
  }, [rows, focusedKey]);

  useEffect(() => {
    if (lastFocusedRef.current === focusedKey) return;
    lastFocusedRef.current = focusedKey;
    const el = rowRefs.current.get(focusedKey);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusedKey]);

  const setExpandedFor = useCallback((key: string, val: boolean) => {
    setExpanded((prev) => {
      const next = new Map(prev);
      next.set(key, val);
      return next;
    });
  }, []);

  const focusedIdx = rows.findIndex((r) => r.key === focusedKey);
  const focusedRow = focusedIdx >= 0 ? rows[focusedIdx] : null;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!focusedRow) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIdx < rows.length - 1) setFocusedKey(rows[focusedIdx + 1].key);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (focusedIdx > 0) setFocusedKey(rows[focusedIdx - 1].key);
          break;
        case 'ArrowRight':
          if (focusedRow.hasChildren && !focusedRow.expanded) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, true);
          }
          break;
        case 'ArrowLeft':
          if (focusedRow.hasChildren && focusedRow.expanded) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, false);
          } else if (focusedRow.parentKey) {
            e.preventDefault();
            setFocusedKey(focusedRow.parentKey);
          }
          break;
        case 'Home':
          e.preventDefault();
          if (rows.length) setFocusedKey(rows[0].key);
          break;
        case 'End':
          e.preventDefault();
          if (rows.length) setFocusedKey(rows[rows.length - 1].key);
          break;
        case 'Enter':
          if (onOpenRequest && !focusedRow.isAnchor) {
            e.preventDefault();
            onOpenRequest(focusedRow.row.lifecycle.requestId);
          } else if (focusedRow.hasChildren) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, !focusedRow.expanded);
          }
          break;
        case ' ':
          if (focusedRow.hasChildren) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, !focusedRow.expanded);
          }
          break;
      }
    },
    [focusedIdx, focusedRow, rows, setExpandedFor, onOpenRequest],
  );

  return (
    <div className="dt-initiator-pane" ref={paneRef}>
      <div className="dt-initiator-chain-filter" ref={toolbarRef}>
        <input
          type="search"
          placeholder="Filter — text, is:failed, is:third-party, type:js, status:404, size:>50kb"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-initiator-chain-filter-input"
          aria-label="Filter initiator chain"
        />
        {filtering && (
          <span className="dt-initiator-chain-filter-count">
            {rows.filter((r) => r.matches).length} match{rows.filter((r) => r.matches).length === 1 ? '' : 'es'}
          </span>
        )}
        <InitiatorMoreFiltersMenu
          failuresOnly={failuresOnly}
          thirdPartyOnly={thirdPartyOnly}
          onToggleFailuresOnly={toggleFailuresOnly}
          onToggleThirdPartyOnly={toggleThirdPartyOnly}
        />
        <InitiatorViewMenu
          sortMode={sortMode}
          showInsights={showInsights}
          onSortChange={setSortMode}
          onToggleShowInsights={toggleShowInsights}
        />
      </div>
      <details className="dt-section" open>
        <summary ref={summaryRef}>Request initiator chain</summary>
        <CascadeSummaryHeader summary={summary} />
        {showInsights && insights.map((ins, i) => <InsightCallout key={`${ins.kind}-${i}`} insight={ins} />)}
        {/* biome-ignore lint/a11y/useSemanticElements: tree role is intentional */}
        <div role="tree" aria-label="Request initiator chain" className="dt-initiator-chain" onKeyDown={onKeyDown}>
          {stickyAncestorKeys.length > 0 && (
            <div ref={stickyStackRef} className="dt-initiator-sticky-stack" aria-hidden="true">
              {stickyAncestorKeys.map((key, indexInStack) => {
                const ancestor = rowsByKey.get(key);
                if (!ancestor) return null;
                return (
                  <button
                    key={`sticky-${key}`}
                    type="button"
                    className="dt-initiator-sticky-row"
                    style={{ paddingLeft: 4 + ancestor.depth * 16 }}
                    title={ancestor.url}
                    onClick={() => {
                      const targetEl = rowRefs.current.get(key);
                      const scroll = targetEl?.closest('.dt-tab-body') as HTMLElement | null;
                      if (!targetEl || !scroll) return;
                      const stackEl = stickyStackRef.current;
                      const currentStackLen = stickyAncestorKeys.length;
                      const stickyRowH = stackEl && currentStackLen > 0 ? stackEl.offsetHeight / currentStackLen : 22;
                      const summaryH = summaryRef.current?.offsetHeight ?? 24;
                      const toolbarH = toolbarRef.current?.offsetHeight ?? 30;
                      const postClickStackH = indexInStack * stickyRowH;
                      const offset = summaryH + toolbarH + postClickStackH + 1;
                      const targetTop = targetEl.getBoundingClientRect().top;
                      const scrollTop = scroll.getBoundingClientRect().top;
                      scroll.scrollBy({ top: targetTop - scrollTop - offset, behavior: 'smooth' });
                      setFocusedKey(key);
                    }}
                  >
                    <span className="dt-initiator-chain-toggle" aria-hidden="true">
                      {ancestor.expanded ? '▼' : '▶'}
                    </span>
                    {!ancestor.isAnchor && ancestor.row.lifecycle.resourceType && (
                      <span className="dt-initiator-row-icon" aria-hidden="true">
                        <ResourceIcon type={ancestor.row.lifecycle.resourceType} />
                      </span>
                    )}
                    <span className="dt-initiator-chain-url" title={ancestor.url}>
                      {shortUrl(ancestor.url)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {rows.map((flat) => {
            const isFocused = flat.key === focusedKey;
            const urlClass = [
              'dt-initiator-chain-url',
              flat.isAnchor ? 'dt-initiator-chain-url--anchor' : null,
              flat.meta.isFailed ? 'dt-initiator-chain-url--failed' : null,
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={flat.key}
                ref={(el) => {
                  if (el) rowRefs.current.set(flat.key, el);
                  else rowRefs.current.delete(flat.key);
                }}
                role="treeitem"
                tabIndex={isFocused ? 0 : -1}
                aria-level={flat.depth + 1}
                aria-expanded={flat.hasChildren ? flat.expanded : undefined}
                aria-selected={isFocused}
                className={`dt-initiator-chain-row${isFocused ? ' dt-initiator-chain-row--focused' : ''}`}
                style={{ paddingLeft: 4 + flat.depth * 16 }}
                onClick={() => {
                  setFocusedKey(flat.key);
                  if (onOpenRequest && !flat.isAnchor) onOpenRequest(flat.row.lifecycle.requestId);
                }}
                onFocus={() => setFocusedKey(flat.key)}
              >
                {flat.hasChildren ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="dt-initiator-chain-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFor(flat.key, !flat.expanded);
                    }}
                    aria-label={flat.expanded ? 'Collapse' : 'Expand'}
                  >
                    {flat.expanded ? '▼' : '▶'}
                  </button>
                ) : (
                  <span className="dt-initiator-chain-toggle dt-initiator-chain-toggle--leaf" aria-hidden="true" />
                )}
                {!flat.isAnchor && flat.row.lifecycle.resourceType && (
                  <span className="dt-initiator-row-icon" aria-hidden="true">
                    <ResourceIcon type={flat.row.lifecycle.resourceType} />
                  </span>
                )}
                <span className={urlClass} title={flat.url}>
                  <HighlightedText text={shortUrl(flat.url)} query={filter.trim() ? filter.trim() : undefined} />
                </span>
                <RowChips meta={flat.meta} subtree={flat.subtree} />
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
