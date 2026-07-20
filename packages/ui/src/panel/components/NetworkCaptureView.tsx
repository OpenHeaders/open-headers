/**
 * NetworkCaptureView — the DevTools Network split (list + detail),
 * lifted as a self-contained view bound to an EXPLICIT lifecycle
 * partition instead of the inspected browser tab.
 *
 * The browser DevTools panel (`App.tsx`) composes the same `TrafficList`
 * + `InspectorDetailContent` against the inspected tab's lifecycle feed,
 * threaded through its tool-window dock, console/storage siblings, and
 * multi-tab document system. This view keeps only the network half and
 * drives it off one `tabId` — the daemon proxy capture source passes
 * `PROXY_LIFECYCLE_TAB_ID`, so the desktop workbench renders proxy
 * captures with the exact same columns, waterfall, filter toolbar, and
 * Headers/Payload/Response/Timing detail tabs the browser panel shows.
 *
 * The page-stream / fire / resource-timing feeds have no daemon source
 * for this partition, so their shared empty snapshots are fed to
 * `usePanelData` — pages markers and fire dots simply never appear.
 */

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Allotment } from 'allotment';
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
  /** Lifecycle partition to watch — a reserved synthetic tab id. */
  readonly tabId: number;
  /** Empty-log hero for the list — the default TrafficList copy assumes an
   *  inspected browser tab ("reload the page"), which no capture surface has. */
  readonly emptyHero?: ReactNode;
}

const NOOP = (): void => {};

/** Inner view — assumes the popover host wraps it. */
function NetworkCaptureBody({ tabId, emptyHero }: NetworkCaptureViewProps) {
  const t = useT();
  const lifecycleClient = useLifecycleClient({ tabId });
  const rulesByUid = useRulesLookup();
  const [liveRulesMode] = useSetting('rulesEngine.liveRulesMode');

  const data = usePanelData({
    lifecycle: lifecycleClient.snapshot,
    page: EMPTY_PAGE_SNAPSHOT,
    fire: EMPTY_FIRE_SNAPSHOT,
    opts: useMemo(() => ({ consolidateRetries: false }), []),
    resourceTiming: EMPTY_RESOURCE_TIMING_SNAPSHOT,
  });

  // Local filter + view state — the proxy view owns its own, no shared
  // dock toolbar to sync with.
  const [filter, setFilter] = useState<ReadonlySet<string>>(() => new Set());
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [urlFilter, setUrlFilter] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<ColumnKey>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DetailSection>('headers');

  const filterTokens = useMemo(() => parseFilter(urlFilter, filterConfig), [urlFilter, filterConfig]);
  const filterError = useMemo(() => hasFilterError(filterTokens), [filterTokens]);
  const filteredRows = useMemo(
    () => data.rows.filter((r) => matchesPanelFilters(r.lifecycle, { filter, filterTokens, filterConfig }, r.fires)),
    [data.rows, filter, filterTokens, filterConfig],
  );

  const handleSelect = useCallback((requestId: string) => setSelectedId(requestId), []);
  const getRowByUrl = useCallback(
    (url: string): InspectorRowWithFires | null => data.lookupByUrl.get(url) ?? null,
    [data.lookupByUrl],
  );

  const selectedRow = selectedId ? (data.lookupByRequestId.get(selectedId) ?? null) : null;

  const list = (
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

  const detail = selectedRow ? (
    <InspectorDetailContent
      row={selectedRow}
      rulesByUid={rulesByUid}
      pages={data.pages}
      getInitiatorChildren={data.getInitiatorChildren}
      getConnectionReuse={data.getConnectionReuse}
      getRepeatStats={data.getRepeatStats}
      baselineMs={data.baselineMs}
      pageOrigin={filterConfig.pageOrigin}
      getRowByUrl={getRowByUrl}
      cacheBypassEnabled={false}
      liveRulesMode={liveRulesMode}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      source={lifecycleClient.source}
      requestResponseBody={lifecycleClient.requestResponseBody}
      onShowMatchedRules={NOOP}
    />
  ) : (
    <div className="dt-editor-empty">{t('panel.inspector.detailEmpty.noSelection')}</div>
  );

  return (
    <Allotment vertical proportionalLayout separator>
      <Allotment.Pane minSize={120}>{list}</Allotment.Pane>
      <Allotment.Pane minSize={120} preferredSize="45%">
        {detail}
      </Allotment.Pane>
    </Allotment>
  );
}

export function NetworkCaptureView({ tabId, emptyHero }: NetworkCaptureViewProps) {
  // Host popover for rule chips in the detail's Headers tab — the panel
  // App provides the same wrapper; kept local so this view drops into
  // any surface without the full panel provider stack.
  return (
    <RulePopoverProvider>
      <NetworkCaptureBody tabId={tabId} emptyHero={emptyHero} />
    </RulePopoverProvider>
  );
}
