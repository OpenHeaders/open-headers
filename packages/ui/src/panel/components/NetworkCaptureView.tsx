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
 * Both the list and the editor-tab detail are READERS of their
 * partition's shared view ({@link useCapturePartition}): one lifeline,
 * one store and one projection per partition in the window, however
 * many surfaces show it. The page-stream / fire / resource-timing feeds
 * have no daemon source for these partitions — pages markers and fire
 * dots simply never appear.
 */

import { Alert, Button } from 'antd';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { WireJoinSeam } from '../data/capture-partition-registry';
import { useCapturePartition } from '../data/use-capture-partition';
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
import type { UsePanelDataResult } from '../data/use-panel-data';

export type { WireJoinSeam } from '../data/capture-partition-registry';

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
  /** Externally-driven row highlight — the active editor tab's request,
   *  so the list shows which row a focused inspect tab belongs to.
   *  Selection only: never routes outward (DevTools posture — the list
   *  follows focus, it doesn't navigate). `null` keeps the last pick. */
  readonly highlightRequestId?: string | null;
  /** Toolbar minus — the host decides what hiding means. Omitted, the
   *  minus is inert. */
  readonly onHide?: () => void;
  /** Stacked-plane posture (Traffic Monitor): an always-visible leading
   *  caret collapses the plane to its strip row; the host CSS drops the
   *  − cluster. */
  readonly collapseToggle?: () => void;
  /** Wire-join seam (Phase 6) — see {@link WireJoinSeam}. Omitted on
   *  hosts without the wire capture (the in-browser panel). */
  readonly wireJoin?: WireJoinSeam;
  /** Jump from a wire row's `wire-seen` annotation to its tab source
   *  (Wire source view only). */
  readonly onWireSeenJump?: (wireRequestId: string) => void;
  /** Override the `watch-refused` banner copy — the default speaks the
   *  live consent gate's language, which is a lie on surfaces whose
   *  refusal means something else (an archived-session view's
   *  `replay-unavailable`). */
  readonly watchRefusedCopy?: { readonly title: string; readonly body: string };
}

const NOOP = (): void => {};
const NO_ROWS: UsePanelDataResult['rows'] = [];
const NO_PAGES: UsePanelDataResult['pages'] = [];

/** The capture list — filter toolbar + columns, selection routes outward. */
export function NetworkCaptureView({
  tabId,
  portName,
  onInspectRequest,
  emptyHero,
  highlightRequestId,
  onHide,
  collapseToggle,
  wireJoin,
  onWireSeenJump,
  watchRefusedCopy,
}: NetworkCaptureViewProps) {
  const t = useT();
  // `null` until the partition's owner has a view: an empty list.
  const capture = useCapturePartition({ tabId, portName, wireJoin });
  const rows = capture?.data.rows ?? NO_ROWS;
  const lookupByRequestId = capture?.data.lookupByRequestId;

  // Local filter + view state — the proxy view owns its own, no shared
  // dock toolbar to sync with.
  const [filter, setFilter] = useState<ReadonlySet<string>>(() => new Set());
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [urlFilter, setUrlFilter] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<ColumnKey>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));
  const [selectedId, setSelectedId] = useState<string | null>(highlightRequestId ?? null);

  // Follow the focused editor tab's request without routing outward; a
  // null highlight (a non-inspect tab focused) keeps the last pick.
  useEffect(() => {
    if (highlightRequestId != null) setSelectedId(highlightRequestId);
  }, [highlightRequestId]);

  const filterTokens = useMemo(() => parseFilter(urlFilter, filterConfig), [urlFilter, filterConfig]);
  const filterError = useMemo(() => hasFilterError(filterTokens), [filterTokens]);
  const filteredRows = useMemo(
    () => rows.filter((r) => matchesPanelFilters(r.lifecycle, { filter, filterTokens, filterConfig }, r.fires)),
    [rows, filter, filterTokens, filterConfig],
  );

  const handleSelect = useCallback(
    (requestId: string) => {
      setSelectedId(requestId);
      const row = lookupByRequestId?.get(requestId);
      if (row) onInspectRequest(row);
    },
    [lookupByRequestId, onInspectRequest],
  );

  // A watch held for its history's size is the one refusal the viewer
  // ends itself: a cleared log leaves the remote engine nothing to replay.
  const heldForSize = capture?.watchRefusedReason === 'history-too-large';

  return (
    <div className="dt-capture-surface">
      {capture !== null && capture.watchRefusedReason !== null && (
        <Alert
          type="info"
          showIcon
          banner
          title={
            heldForSize
              ? t('panel.capture.historyTooLarge.title')
              : (watchRefusedCopy?.title ?? t('panel.capture.watchRefused.title'))
          }
          description={
            heldForSize
              ? t('panel.capture.historyTooLarge.body')
              : (watchRefusedCopy?.body ?? t('panel.capture.watchRefused.body'))
          }
          action={
            heldForSize ? (
              <Button size="small" onClick={capture.clearSession} data-testid="capture-history-clear">
                {t('panel.capture.historyTooLarge.clear')}
              </Button>
            ) : undefined
          }
          data-testid="capture-watch-refused"
        />
      )}
      <TrafficList
        rows={rows}
      filteredRows={filteredRows}
      pages={capture?.data.pages ?? NO_PAGES}
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
      onHide={onHide ?? NOOP}
      {...(collapseToggle !== undefined ? { collapseToggle } : {})}
      onAnnotationJump={handleSelect}
      filterHiddenHint={null}
      onFilterHintClear={NOOP}
      onFilterHintDismiss={NOOP}
      emptyHero={emptyHero}
      {...(capture?.joinedIds !== undefined ? { wireJoinedIds: capture.joinedIds } : {})}
      {...(capture?.seenLabels !== undefined ? { wireSeenLabels: capture.seenLabels } : {})}
      {...(onWireSeenJump !== undefined ? { onWireSeenJump } : {})}
      />
    </div>
  );
}

export interface NetworkCaptureRequestDetailProps {
  /** Lifecycle partition the request was captured on. */
  readonly tabId: number;
  /** Optional port-name override — same seam as the list view's. */
  readonly portName?: (tabId: number) => string;
  /** The captured lifecycle to inspect. */
  readonly requestId: string;
  /** Wire-join seam — same binding as the list view's. */
  readonly wireJoin?: WireJoinSeam;
}

/** Inner detail — assumes the popover host wraps it. */
function NetworkCaptureRequestDetailBody({ tabId, portName, requestId, wireJoin }: NetworkCaptureRequestDetailProps) {
  const t = useT();
  const capture = useCapturePartition({ tabId, portName, wireJoin });
  const rulesByUid = useRulesLookup();
  const [liveRulesMode] = useSetting('rulesEngine.liveRulesMode');
  const [activeSection, setActiveSection] = useState<DetailSection>('headers');

  const lookupByUrl = capture?.data.lookupByUrl;
  const getRowByUrl = useCallback(
    (url: string): InspectorRowWithFires | null => lookupByUrl?.get(url) ?? null,
    [lookupByUrl],
  );

  // Nothing to say before the partition's owner has a view.
  if (capture === null) return null;
  const { data } = capture;
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
      source={capture.source}
      requestResponseBody={capture.requestResponseBody}
      {...(capture.joinedIds !== undefined ? { wireJoinedIds: capture.joinedIds } : {})}
      {...(capture.seenLabels !== undefined ? { wireSeenLabels: capture.seenLabels } : {})}
      onShowMatchedRules={NOOP}
    />
  );
}

/**
 * NetworkCaptureRequestDetail — one captured request's full detail
 * (Headers/Payload/Response/Timing tabs), self-sufficient for a
 * workbench editor tab: it holds its own seat on the partition and its
 * own popover host, so it renders with or without the tool window that
 * opened it — alone, it is what keeps the partition open.
 */
export function NetworkCaptureRequestDetail({ tabId, portName, requestId, wireJoin }: NetworkCaptureRequestDetailProps) {
  return (
    <div className="dt-capture-surface">
      <RulePopoverProvider>
        <NetworkCaptureRequestDetailBody tabId={tabId} portName={portName} requestId={requestId} wireJoin={wireJoin} />
      </RulePopoverProvider>
    </div>
  );
}
