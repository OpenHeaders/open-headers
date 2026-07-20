/**
 * NetworkCaptureView — the DevTools Network traffic list, lifted as a
 * self-contained view bound to an EXPLICIT lifecycle partition instead
 * of the inspected browser tab.
 *
 * The browser DevTools panel (`App.tsx`) composes the same `TrafficList`
 * + `InspectorDetailContent` against the inspected tab's lifecycle feed,
 * threaded through its tool-window dock, console/storage siblings, and
 * multi-tab document system. This view keeps the network list and
 * drives it off one `tabId` — the daemon proxy capture source passes
 * `PROXY_LIFECYCLE_TAB_ID`, so the desktop workbench renders proxy
 * captures with the exact same columns, waterfall, and filter toolbar
 * the browser panel shows. Row inspection routes OUTWARD through
 * `onInspectRequest` — the workbench opens the request in a main editor
 * tab ({@link NetworkCaptureRequestDetail}) instead of an inner split,
 * which the tool-window height can't afford.
 *
 * The page-stream / fire / resource-timing feeds have no daemon source
 * for this partition, so their shared empty snapshots are fed to
 * `usePanelData` — pages markers and fire dots simply never appear.
 */

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { InspectorDetailContent } from './InspectorDetailContent';
import { RulePopoverProvider } from './RulePopoverHost';
import { TrafficList } from './TrafficList';
import type { ColumnKey } from './traffic/columns';
import { DEFAULT_VISIBLE_COLUMNS } from './traffic/columns';
import { matchesPanelFilters } from './traffic/row-filter';
import { type DetailSection } from '../data/inspector-tab';
import type { FilterConfig } from '../data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from '../data/filter-engine';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import { useRulesLookup } from '../data/rule-create/use-rules-lookup';
import { useLifecycleClient } from '../data/stores/use-lifecycle-client';
import { EMPTY_FIRE_SNAPSHOT } from '../data/stores/fire-client-store';
import { EMPTY_PAGE_SNAPSHOT } from '../data/stores/page-client-store';
import { EMPTY_RESOURCE_TIMING_SNAPSHOT } from '../data/stores/resource-timing-client-store';
import { usePanelData } from '../data/use-panel-data';

export interface NetworkCaptureViewProps {
  /** Lifecycle partition to watch — a reserved synthetic tab id, or a
   *  real browser tab id when `portName` addresses a remote engine. */
  readonly tabId: number;
  /** Optional port-name override — the Live Network view passes the
   *  qualified `oh-lifecycle:<tabId>@<nodeId>` shape so the daemon's
   *  relay routes the watch to the owning extension peer. */
  readonly portName?: (tabId: number) => string;
  /** Row inspection gesture — the host decides where the detail opens
   *  (the workbench mints a `proxy-request-inspect` editor tab). */
  readonly onInspectRequest: (row: InspectorRowWithFires) => void;
  /** Empty-log hero for the list — the default TrafficList copy assumes an
   *  inspected browser tab ("reload the page"), which no capture surface has. */
  readonly emptyHero?: ReactNode;
}

const NOOP = (): void => {};

/**
 * The shared per-partition data pipeline: one lifecycle lifeline client
 * plus the panel projection over it. Both the capture list and the
 * editor-tab detail mount their own instance — the engine replays the
 * partition snapshot on every subscribe, so each consumer is complete
 * and self-sufficient (the detail tab keeps working with the Proxy tool
 * window closed).
 */
function useNetworkCaptureData(tabId: number, portName?: (tabId: number) => string) {
  const lifecycleClient = useLifecycleClient({ tabId, ...(portName !== undefined ? { portName } : {}) });
  const data = usePanelData({
    lifecycle: lifecycleClient.snapshot,
    page: EMPTY_PAGE_SNAPSHOT,
    fire: EMPTY_FIRE_SNAPSHOT,
    opts: useMemo(() => ({ consolidateRetries: false }), []),
    resourceTiming: EMPTY_RESOURCE_TIMING_SNAPSHOT,
  });
  return { lifecycleClient, data };
}

/** The capture list — filter toolbar + columns, selection routes outward. */
export function NetworkCaptureView({ tabId, portName, onInspectRequest, emptyHero }: NetworkCaptureViewProps) {
  const { data } = useNetworkCaptureData(tabId, portName);

  // Local filter + view state — the proxy view owns its own, no shared
  // dock toolbar to sync with.
  const [filter, setFilter] = useState<ReadonlySet<string>>(() => new Set());
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [urlFilter, setUrlFilter] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<ColumnKey>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterTokens = useMemo(() => parseFilter(urlFilter, filterConfig), [urlFilter, filterConfig]);
  const filterError = useMemo(() => hasFilterError(filterTokens), [filterTokens]);
  const filteredRows = useMemo(
    () => data.rows.filter((r) => matchesPanelFilters(r.lifecycle, { filter, filterTokens, filterConfig }, r.fires)),
    [data.rows, filter, filterTokens, filterConfig],
  );

  const handleSelect = useCallback(
    (requestId: string) => {
      setSelectedId(requestId);
      const row = data.lookupByRequestId.get(requestId);
      if (row) onInspectRequest(row);
    },
    [data.lookupByRequestId, onInspectRequest],
  );

  return (
    <TrafficList
      rows={data.rows}
      filteredRows={filteredRows}
      pages={data.pages}
      cdpEnhanced={false}
      selectedId={selectedId}
      onSelect={handleSelect}
      filter={filter}
      onFilterChange={setFilter}
      filterConfig={filterConfig}
      onFilterConfigChange={setFilterConfig}
      urlFilter={urlFilter}
      onUrlFilterChange={setUrlFilter}
      filterError={filterError}
      onToggleDocs={NOOP}
      docsActive={false}
      showFilter
      recording
      onStartRecording={NOOP}
      onReloadPage={NOOP}
      visibleColumns={visibleColumns}
      onVisibleColumnsChange={setVisibleColumns}
      onCopyAsHar={NOOP}
      onSaveAsHar={NOOP}
      onSaveAllAsHar={NOOP}
      onCopyAllAsHar={NOOP}
      onHide={NOOP}
      onAnnotationJump={handleSelect}
      filterHiddenHint={null}
      onFilterHintClear={NOOP}
      onFilterHintDismiss={NOOP}
      emptyHero={emptyHero}
    />
  );
}

export interface NetworkCaptureRequestDetailProps {
  /** Lifecycle partition the request was captured on. */
  readonly tabId: number;
  /** Optional port-name override — same seam as the list view's. */
  readonly portName?: (tabId: number) => string;
  /** The captured lifecycle to inspect. */
  readonly requestId: string;
}

/** Inner detail — assumes the popover host wraps it. */
function NetworkCaptureRequestDetailBody({ tabId, portName, requestId }: NetworkCaptureRequestDetailProps) {
  const t = useT();
  const { lifecycleClient, data } = useNetworkCaptureData(tabId, portName);
  const rulesByUid = useRulesLookup();
  const [liveRulesMode] = useSetting('rulesEngine.liveRulesMode');
  const [activeSection, setActiveSection] = useState<DetailSection>('headers');

  const getRowByUrl = useCallback(
    (url: string): InspectorRowWithFires | null => data.lookupByUrl.get(url) ?? null,
    [data.lookupByUrl],
  );

  const row = data.lookupByRequestId.get(requestId) ?? null;
  if (!row) {
    return <div className="dt-editor-empty">{t('panel.inspector.detailEmpty.requestGone')}</div>;
  }

  return (
    <InspectorDetailContent
      row={row}
      rulesByUid={rulesByUid}
      pages={data.pages}
      getInitiatorChildren={data.getInitiatorChildren}
      getConnectionReuse={data.getConnectionReuse}
      getRepeatStats={data.getRepeatStats}
      baselineMs={data.baselineMs}
      pageOrigin={DEFAULT_FILTER_CONFIG.pageOrigin}
      getRowByUrl={getRowByUrl}
      cacheBypassEnabled={false}
      liveRulesMode={liveRulesMode}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      source={lifecycleClient.source}
      requestResponseBody={lifecycleClient.requestResponseBody}
      onShowMatchedRules={NOOP}
    />
  );
}

/**
 * NetworkCaptureRequestDetail — one captured request's full detail
 * (Headers/Payload/Response/Timing tabs), self-sufficient for a
 * workbench editor tab: it owns its own lifeline client and popover
 * host, so it renders with or without the Proxy tool window open.
 */
export function NetworkCaptureRequestDetail({ tabId, portName, requestId }: NetworkCaptureRequestDetailProps) {
  return (
    <RulePopoverProvider>
      <NetworkCaptureRequestDetailBody tabId={tabId} portName={portName} requestId={requestId} />
    </RulePopoverProvider>
  );
}
