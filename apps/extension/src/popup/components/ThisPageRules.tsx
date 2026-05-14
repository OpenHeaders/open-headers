import {
  ApartmentOutlined,
  CheckOutlined,
  CopyTwoTone,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { resolvePauseState } from '@openheaders/core/utils';
import { scheduleFrame } from '@openheaders/ui/shared/frame-scheduler';
import { useRowActionRegistration } from '@openheaders/ui/shared/hooks/useRowActionRegistration';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useTablePagination } from '@openheaders/ui/shared/hooks/useTablePagination';
import { useSurface } from '@openheaders/ui/shared/surface';
import { compareBySortMode, type PageInfo, type RowActions } from '@openheaders/ui/shared/table-shared';
import {
  type RuleVerdict,
  VERDICT_COLOR,
  VERDICT_LABEL,
  VERDICT_RANK,
  VERDICT_TOOLTIP,
} from '@openheaders/ui/shared/verdict';
import { openWorkspace, type WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import { useSetting, useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import type { TrackedResourceType } from '@openheaders/ui/workbench/settings/schema/rules-engine';
import { call, subscribe } from '@utils/bridge';
import {
  App,
  Badge,
  Button,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SilentMatchRecord } from '@/types/browser';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';
import {
  renderActionDetails,
  renderTagOverflow,
  type TagDescriptor,
  truncateValue,
} from './columns/sharedColumnRenderers';
import DeleteConfirmOverlay from './DeleteConfirmOverlay';

declare const browser: typeof chrome | undefined;

const { Text } = Typography;

/**
 * Hook helper — binds `openWorkspace` to the caller's surface so every
 * call site is a one-line `openRulesIntent({ kind: '…', … })`.
 */
function useOpenRulesIntent(): (intent: WorkspaceIntent) => void {
  const surface = useSurface();
  return useCallback(
    (intent: WorkspaceIntent) => {
      void openWorkspace(intent, surface.mode);
    },
    [surface.mode],
  );
}

const RULE_TYPE_LABEL: Record<string, string> = {
  header: 'Header',
  block: 'Block',
  redirect: 'Redirect',
  'query-param': 'Query Param',
  inject: 'Inject',
  body: 'API Request',
  delay: 'Delay',
  mock: 'API Response',
};

const RULE_TYPE_DESCRIPTION: Record<string, string> = {
  header: 'Modify HTTP headers',
  block: 'Block requests',
  redirect: 'Redirect requests',
  'query-param': 'Modify query parameters',
  inject: 'Inject scripts or CSS',
  body: 'Modify API request body (fetch/XHR)',
  delay: 'Delay response',
  mock: 'Override API response (fetch/XHR)',
};

import type { RequestRecord, TabTelemetrySnapshot as TelemetrySnapshot } from '@openheaders/core/types';

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  counters: {},
  fires: [],
  byRule: {},
  uniqueRequestCount: 0,
};

interface MatchedRequestRow extends RequestRecord {
  key: string;
  /** True when the matched URL is the current tab URL (main-frame). */
  isTabUrl: boolean;
}

/** Human-readable labels for resource types shown in the Match column. */
const RESOURCE_TYPE_LABEL: Record<string, string> = {
  main_frame: 'Page',
  sub_frame: 'Frame',
  xmlhttprequest: 'Fetch/XHR',
  script: 'Script',
  stylesheet: 'CSS',
  image: 'Image',
  font: 'Font',
  media: 'Media',
  websocket: 'WebSocket',
  ping: 'Ping',
  other: 'Other',
};

const RESOURCE_TYPE_TOOLTIP: Record<string, string> = {
  main_frame: 'Matches the page URL directly',
  sub_frame: 'Applied to an iframe loaded by this page',
  xmlhttprequest: 'Applied to fetch() and XMLHttpRequest calls',
  script: 'Applied to script resources',
  stylesheet: 'Applied to stylesheets',
  image: 'Applied to images',
  font: 'Applied to font files',
  media: 'Applied to audio/video resources',
  websocket: 'Applied to WebSocket connections',
  ping: 'Applied to ping/beacon requests',
  other: 'Applied to other resources',
};

/**
 * Render order for the inline resource-type filter row at the top of
 * the This Page view. Kept in sync with the `rulesEngine.visibleResourceTypes`
 * schema's enum order so the Settings multi-select and the popup row
 * always show types in the same sequence.
 */
const ALL_RESOURCE_TYPES: readonly TrackedResourceType[] = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'ping',
  'other',
];

function formatTimestampShort(timestamp: number): React.ReactNode {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {h}:{m}:{s}
      <span style={{ fontSize: '9px', opacity: 0.6 }}>.{ms}</span>
    </>
  );
}

function formatTimestampFull(timestamp: number): React.ReactNode {
  const d = new Date(timestamp);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {day} {month} {year} {h}:{m}:{s}
      <span style={{ fontSize: '9px', opacity: 0.6 }}>.{ms}</span>
    </>
  );
}

interface ActiveRule {
  id: string;
  name: string;
  ruleType: string;
  summary: string;
  actionLabel?: string;
  actionOperation?: string;
  actionTooltip?: string;
  actionDirection?: string;
  actionValue?: string;
  actionItems?: string[];
  isEnabled?: boolean;
  domains?: string[];
  path?: string;
  /**
   * Verdict rendered by the verdict engine for this rule on the
   * current tab. See `@openheaders/ui/shared/verdict` for the canonical taxonomy and
   * rank / label / tooltip metadata.
   */
  verdict?: RuleVerdict;
  /** Short human-readable reason text supplied by the engine. */
  verdictReason?: string;
  /**
   * Cached / SW-shortcut subresource URLs that match the rule's
   * pattern but didn't fire webRequest. Merged into the per-rule
   * sub-table as synthetic records with `evidence: 'silent'`.
   */
  silentRecords?: SilentMatchRecord[];
}

interface CurrentTabInfo {
  id: number;
  url: string;
  domain: string;
  title: string;
}

interface TableRecord extends ActiveRule {
  key: string | number;
  statusRank: number;
  /**
   * Primary sort key — lower = stronger signal. Clusters the table
   * into visual sections (firing → silent → page → related → idle)
   * regardless of the secondary sort mode. See `VERDICT_RANK` in
   * `@openheaders/ui/shared/verdict` for the canonical ordering.
   */
  verdictRank: number;
  /** Total fire events for this rule on the current page (from counters). */
  fireCount: number;
  /** Unique-URL records for this rule, newest first. */
  records: RequestRecord[];
  /** Highest evidence tier present across `records`, or 'none' if empty. */
  dominantEvidence: RequestRecord['evidence'] | 'none';
  /**
   * First shadower seen across this rule's records, or undefined if none are
   * shadowed. Only rendered when the experimental shadow-detection setting
   * is enabled; always computed so tooltips can reference it when flagged on.
   */
  dominantShadow?: { uid: string; name: string };
  /** Number of shadowed records (out of `records.length`). */
  shadowedCount: number;
}

/**
 * Renders a URL with the portion matching the pattern highlighted.
 * Strips wildcards from the pattern to find the core string in the URL.
 */
function renderHighlightedUrl(url: string, pattern: string): React.ReactNode {
  // Strip wildcard prefixes to get the matchable core: "*.example.com" → "example.com"
  const core = pattern.replace(/^\*\.?/, '').toLowerCase();
  if (!core || core === '*') {
    return <span style={{ wordBreak: 'break-all' }}>{url}</span>;
  }

  const lowerUrl = url.toLowerCase();
  const matchIndex = lowerUrl.indexOf(core);
  if (matchIndex === -1) {
    return <span style={{ wordBreak: 'break-all' }}>{url}</span>;
  }

  const before = url.substring(0, matchIndex);
  const matched = url.substring(matchIndex, matchIndex + core.length);
  const after = url.substring(matchIndex + core.length);

  return (
    <span style={{ wordBreak: 'break-all' }}>
      <span style={{ opacity: 0.6 }}>{before}</span>
      <span style={{ color: '#69b1ff', fontWeight: 600 }}>{matched}</span>
      <span style={{ opacity: 0.6 }}>{after}</span>
    </span>
  );
}

interface ThisPageRulesProps {
  isActive?: boolean;
  focusedRowIndex?: number;
  pendingDeleteIndex?: number;
  onPageInfoChange?: (info: PageInfo) => void;
  onRowActionsChange?: (actions: RowActions) => void;
}

const ThisPageRules: React.FC<ThisPageRulesProps> = ({
  isActive = true,
  focusedRowIndex = -1,
  pendingDeleteIndex = -1,
  onPageInfoChange,
  onRowActionsChange,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { pauseMarkers, activeWorkspaceId } = useRules();
  const ruleMutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'popup' });
  const openRulesIntent = useOpenRulesIntent();
  const {
    expandedRowKey,
    nestedFocusIndex,
    setNestedRowCount,
    toggleExpandedRow,
    setFocusedRowIndex,
    setNestedFocusIndex,
  } = useKeyboardNav();
  const nestedTableRef = useRef<{
    nativeElement: HTMLDivElement;
    scrollTo: (config: { index?: number; key?: React.Key; top?: number }) => void;
  } | null>(null);
  const [currentTab, setCurrentTab] = useState<CurrentTabInfo | null>(null);
  const [activeRules, setActiveRules] = useState<ActiveRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedRowId, setCopiedRowId] = useState<string | number | null>(null);
  /**
   * Full telemetry snapshot for the active tab, polled every 500ms from the
   * background tab-telemetry service. Single source of truth for per-rule
   * fire counts, unique URL records, and the page-wide unique request total.
   * The popup joins this with the applicable-rules list at render time.
   */
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(EMPTY_SNAPSHOT);
  /**
   * Experimental shadow-detection setting — when true, rules whose records
   * have a `shadowedBy` attribution render with an amber warning tag and
   * the nested table's Evidence column calls out the shadower by name. The
   * data is always computed in the background; this flag just lights up
   * the UI for users who opt in. Off by default until we gather enough
   * real-world signal to default on.
   */
  const shadowDetection = useSettingValue('rulesEngine.showShadowWarnings');

  /**
   * Which resource types the user currently wants to see in this view.
   * Backed by the same `rulesEngine.visibleResourceTypes` setting as the
   * Settings page multi-select — the inline chip row below writes to it
   * and stays in perfect sync with the Settings UI. Collection in the
   * background is universal; this is pure display filtering.
   */
  const [visibleResourceTypes, setVisibleResourceTypes] = useSetting('rulesEngine.visibleResourceTypes');
  const visibleTypeSet = new Set<string>(visibleResourceTypes);
  const toggleResourceType = useCallback(
    (type: TrackedResourceType) => {
      const next = visibleTypeSet.has(type)
        ? (visibleResourceTypes.filter((t) => t !== type) as readonly TrackedResourceType[])
        : ([...visibleResourceTypes, type] as readonly TrackedResourceType[]);
      // Guard: never let the user empty the filter entirely — an empty
      // set would render nothing and there's no discoverable way back
      // short of opening the Settings page. One type must remain on.
      if (next.length === 0) return;
      setVisibleResourceTypes(next);
    },
    [visibleResourceTypes, visibleTypeSet, setVisibleResourceTypes],
  );

  const expandCountRef = useRef(0);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<'status' | 'priority' | 'manual'>('status');
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [sortedInfo, setSortedInfo] = useState<SorterResult<TableRecord>>({});

  useEffect(() => {
    const fetchActiveRules = async () => {
      try {
        const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          const tab = tabs[0];
          // `tab.url` may be missing (loading), empty (untyped new tab),
          // or non-WHATWG-parseable on some Chrome internal pages. The
          // popup never noticed because it closes on blur; the sidepanel
          // stays open across navigations and would log a TypeError every
          // time. Downstream code already handles missing/internal URLs
          // (see the chrome:/about: regex below), so leave `domain` empty
          // when the URL won't parse.
          let domain = '';
          if (tab.url) {
            try {
              domain = new URL(tab.url).hostname;
            } catch {
              /* internal scheme or unparseable — render with empty domain */
            }
          }
          const response = await call('getActiveRulesForTab', { tabId: tab.id, tabUrl: tab.url }).catch(() => ({
            activeRules: [] as ActiveRule[],
          }));
          setCurrentTab({ id: tab.id!, url: tab.url ?? '', domain, title: tab.title || '' });
          setActiveRules(response.activeRules || []);
        }
      } catch (error) {
        console.error(new Date().toISOString(), 'ERROR', '[ThisPageRules]', 'Error getting active rules:', error);
        setActiveRules([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchActiveRules();

    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.status === 'complete' && tab.active) void fetchActiveRules();
    };
    browserAPI.tabs.onUpdated.addListener(handleTabUpdate);
    browserAPI.tabs.onActivated.addListener(fetchActiveRules);
    const handleStorageChange = () => {
      void fetchActiveRules();
    };
    browserAPI.storage.onChanged.addListener(handleStorageChange);

    // Listen for tracked URL changes pushed from the background
    // when the request monitor intercepts new requests.
    const unsubscribeTracked = subscribe('trackedUrlsUpdated', () => {
      void fetchActiveRules();
    });

    return () => {
      browserAPI.tabs.onUpdated.removeListener(handleTabUpdate);
      browserAPI.tabs.onActivated.removeListener(fetchActiveRules);
      browserAPI.storage.onChanged.removeListener(handleStorageChange);
      unsubscribeTracked();
    };
  }, []);

  /**
   * Live tab-telemetry: polls `getTabTelemetry` every 500ms while this
   * component is mounted. The background auto-tracks the active tab in
   * every window (see tab-listeners.initializeActiveTabTracking), so the
   * popup is a pure reader — no tracking activation needed. This matters
   * because Chrome popups close on blur, making any popup-scoped tracking
   * window useless: fires happen during page load, *before* the popup opens.
   */
  useEffect(() => {
    if (!currentTab?.id) return;
    const tabId = currentTab.id;

    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      call('getTabTelemetry', { tabId })
        .then((snap) => {
          if (cancelled) return;
          setSnapshot({
            counters: snap?.counters ?? {},
            fires: snap?.fires ?? [],
            byRule: snap?.byRule ?? {},
            uniqueRequestCount: snap?.uniqueRequestCount ?? 0,
          });
        })
        .catch(() => {
          /* SW momentarily unavailable — next tick will retry */
        });
    };
    poll();
    const interval = setInterval(poll, 500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentTab?.id]);

  // Scroll virtual nested table to focused row (also resets on expand)
  // biome-ignore lint/correctness/useExhaustiveDependencies: expandedRowKey intentionally resets scroll on re-expand
  useEffect(() => {
    if (nestedFocusIndex < 0) return;
    // Wait a frame for the new nested table to mount when switching rules
    const cancel = scheduleFrame(() => {
      if (nestedTableRef.current) {
        nestedTableRef.current.scrollTo({ index: nestedFocusIndex });
      }
    });
    return cancel;
  }, [nestedFocusIndex, expandedRowKey]);

  const dataSourceRef = useRef<TableRecord[]>([]);

  // Look up per-rule telemetry from the snapshot. Records are stored LRU
  // (oldest first) by the backend; we reverse per-rule here so the popup
  // and the nested table both render newest-first without repeating the
  // reversal at every render site.
  //
  // Render-time filter: drop records whose resource type isn't in the
  // `visibleResourceTypes` allowlist. The background records everything
  // so flipping a type back on reveals the hidden fires instantly, with
  // no page reload. Fires that arrive while a type is hidden are still
  // collected — they become visible the moment the type is re-enabled.
  //
  // Silent records (subresources that matched but were cache-served, so
  // no action ran) live on `ActiveRule.silentRecords` — NOT in the
  // telemetry snapshot. Merge them here with `evidence: 'silent'` so
  // the per-rule sub-table surfaces "the rule would have fired on
  // these resources" alongside the rule's real fires, and
  // `fireCountFor` includes them in the header "X requests" total.
  const recordsByRuleId = new Map<string, RequestRecord[]>();
  for (const [uid, recs] of Object.entries(snapshot.byRule)) {
    const filtered = recs.filter((r) => visibleTypeSet.has(r.resourceType || 'other'));
    recordsByRuleId.set(uid, filtered.reverse());
  }
  for (const rule of activeRules) {
    const silents = rule.silentRecords;
    if (!silents || silents.length === 0) continue;
    const silentRecords: RequestRecord[] = silents
      .filter((s) => visibleTypeSet.has(s.resourceType || 'other'))
      .map((s) => ({
        ruleUid: rule.id,
        url: s.url,
        pattern: s.pattern,
        resourceType: s.resourceType,
        t: s.t,
        evidence: 'silent' as const,
      }));
    if (silentRecords.length === 0) continue;
    const existing = recordsByRuleId.get(rule.id) ?? [];
    // Merge newest-first. Telemetry records arrive already reversed
    // (newest-first) from the reduction above; silent records go
    // last so real fires render on top.
    recordsByRuleId.set(rule.id, [...existing, ...silentRecords.reverse()]);
  }
  const recordsFor = (id: string | undefined): RequestRecord[] => (id ? (recordsByRuleId.get(id) ?? []) : []);
  const fireCountFor = (id: string | undefined): number => (id ? (recordsByRuleId.get(id)?.length ?? 0) : 0);

  // Page-wide unique-URL count — the "N requests" figure in the header.
  // Computed from the merged fire+silent records so cached-subresource
  // matches are reflected (telemetry's own uniqueRequestCount only
  // covers webRequest fires, which is why cache-heavy pages used to
  // show "0 requests" despite having silent matches).
  const uniqueRequestCount = (() => {
    const unique = new Set<string>();
    for (const recs of recordsByRuleId.values()) {
      for (const r of recs) unique.add(r.url);
    }
    return unique.size;
  })();

  // Highest evidence tier present in a record list, or 'none' when empty.
  const dominantEvidenceOf = (records: RequestRecord[]): RequestRecord['evidence'] | 'none' => {
    let best: RequestRecord['evidence'] | 'none' = 'none';
    const rank: Record<RequestRecord['evidence'] | 'none', number> = {
      confirmed: 3,
      matched: 2,
      'matched-fallback': 1,
      silent: 0,
      none: 0,
    };
    for (const r of records) {
      if (rank[r.evidence] > rank[best]) best = r.evidence;
    }
    return best;
  };

  // Track how each rule matches the search: by rule properties, by URL, or both
  const urlMatchCountMap = new Map<string, number>();
  const filteredRules = searchText
    ? activeRules.filter((r) => {
        const q = searchText.toLowerCase();
        const matchesByRule = r.name.toLowerCase().includes(q) || (r.summary || '').toLowerCase().includes(q);
        const records = recordsFor(r.id);
        const matchingUrlCount = records.filter((m) => m.url.toLowerCase().includes(q)).length;
        if (matchingUrlCount > 0 && r.id) urlMatchCountMap.set(r.id, matchingUrlCount);
        return matchesByRule || matchingUrlCount > 0;
      })
    : activeRules;

  // Sort: rules with URL matches first (most relevant), then by name
  const sortedFilteredRules = searchText
    ? [...filteredRules].sort((a, b) => {
        const aUrlMatches = urlMatchCountMap.get(a.id || '') || 0;
        const bUrlMatches = urlMatchCountMap.get(b.id || '') || 0;
        if (aUrlMatches > 0 && bUrlMatches === 0) return -1;
        if (aUrlMatches === 0 && bUrlMatches > 0) return 1;
        return 0;
      })
    : filteredRules;

  const dataSource: TableRecord[] = sortedFilteredRules
    .map((rule, index) => {
      const isEnabled = rule.isEnabled !== false;
      const groupPaused = resolvePauseState(rule.path ?? '', pauseMarkers);
      const statusRank = isEnabled && !groupPaused ? 0 : isEnabled && groupPaused ? 1 : 2;
      const records = recordsFor(rule.id);
      let dominantShadow: { uid: string; name: string } | undefined;
      let shadowedCount = 0;
      for (const r of records) {
        if (r.shadowedBy) {
          shadowedCount += 1;
          if (!dominantShadow) dominantShadow = r.shadowedBy;
        }
      }
      // If we have a telemetry counter for this rule, the ground-truth
      // verdict is `firing` — override whatever the background reported.
      // This bridges the tiny window between a webRequest fire landing
      // in telemetry and the popup's next getActiveRulesForTab call;
      // without it the row would briefly flicker as `page` while the
      // fire was already counted. `recordsByRuleId` includes merged
      // silent records, so we check the raw telemetry `byRule` map
      // instead — only real fires (not silent observations) should
      // promote the verdict to `firing`.
      const telemetryFireCount = snapshot.byRule[rule.id]?.length ?? 0;
      const effectiveVerdict: RuleVerdict = telemetryFireCount > 0 ? 'firing' : (rule.verdict ?? 'page');
      return {
        ...rule,
        verdict: effectiveVerdict,
        key: (rule.id || index) as string | number,
        statusRank,
        verdictRank: VERDICT_RANK[effectiveVerdict],
        fireCount: fireCountFor(rule.id),
        records,
        dominantEvidence: dominantEvidenceOf(records),
        dominantShadow,
        shadowedCount,
      };
    })
    .sort((a, b) => compareBySortMode(a, b, sortMode));

  // Keep ref in sync for keyboard callbacks
  dataSourceRef.current = dataSource;

  const { paginationConfig } = useTablePagination({
    dataSource,
    onPageInfoChange,
  });

  // Register row actions for keyboard navigation
  const handleToggleRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      const isEnabled = record.isEnabled !== false;
      setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled: !isEnabled } : r)));
      void ruleMutator.toggleRule(record.id, !isEnabled).then((resp) => {
        if (resp.ok) {
          // Nudge the SW to revalidate tracked requests + rebuild DNR
          void call('rulesUpdated').catch(() => undefined);
        } else {
          setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled } : r)));
        }
      });
    },
    [ruleMutator],
  );

  const handleEditRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      openRulesIntent({ kind: 'edit-rule', uid: record.id });
    },
    [openRulesIntent],
  );

  const handleCopyRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record?.summary) return;
    void navigator.clipboard.writeText(record.summary);
    setCopiedRowId(record.key);
    setTimeout(() => setCopiedRowId(null), 1000);
  }, []);

  const handleDeleteRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      setActiveRules((prev) => prev.filter((r) => r.id !== record.id));
      void ruleMutator.deleteRule(record.id).then((resp) => {
        if (resp.ok) {
          void message.success('Rule deleted');
        } else {
          void message.error('Failed to delete rule');
        }
      });
    },
    [message, ruleMutator],
  );

  useRowActionRegistration(onRowActionsChange, {
    onToggleRow: handleToggleRow,
    onEditRow: handleEditRow,
    onCopyRow: handleCopyRow,
    onDeleteRow: handleDeleteRow,
  });

  const handleTableChange = (
    _pagination: unknown,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TableRecord> | SorterResult<TableRecord>[],
  ) => {
    setFilteredInfo(filters);
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortedInfo(singleSorter);
    if (singleSorter.order) setSortMode('manual');
  };

  const handleSortModeChange = (mode: 'status' | 'priority' | 'manual') => {
    setSortMode(mode);
    setSortedInfo({});
  };

  const columns: ColumnsType<TableRecord> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 170,
      fixed: 'left',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortOrder: sortedInfo.columnKey === 'name' ? sortedInfo.order : null,
      filters: [...new Set(dataSource.map((item) => item.name))].map((name) => ({ text: name, value: name })),
      filteredValue: filteredInfo.name || null,
      filterSearch: true,
      onFilter: (value, record) => record.name === value,
      render: (text: string, record: TableRecord) => {
        const displayName = truncateValue(text, 20);
        const count = record.fireCount;
        const isEnabled = record.isEnabled !== false;
        const groupPaused = resolvePauseState(record.path ?? '', pauseMarkers);
        const outOfPlay = !isEnabled || groupPaused;
        const shadowed = shadowDetection && record.shadowedCount > 0;

        // Tag states:
        //   disabled/paused       → gray "–"       rule is not in play
        //   count === 0           → gray "0"       no activity yet
        //   shadow flag on + hit  → amber "⚠ N"   higher-priority rule wins
        //   otherwise             → blue filled N  rule has fired on this page
        //
        // The evidence tier (confirmed vs matched vs matched-fallback) is
        // intentionally not encoded as a separate glyph here — most users
        // don't want to reason about Chrome's DNR vs in-page injection.
        // The distinction lives in the tooltip and in the Evidence column
        // of the expand panel.
        const countTooltip = (() => {
          if (outOfPlay) {
            return !isEnabled ? 'Rule is disabled' : 'Rule is paused by its collection or folder';
          }
          if (count === 0) {
            // Zero only happens for `page` / `related` verdicts — `firing`
            // and `silent` always have records. Explain precisely why
            // there's nothing to show so users aren't told "reload the
            // page" when the page isn't the problem.
            const verdict = record.verdict ?? 'page';
            if (verdict === 'related') {
              return 'Rule targets a related domain — no requests to that domain have been observed yet. It will fire if the page makes one.';
            }
            return 'Pattern matches this page but no matching requests have been observed yet. Interact with the page or reload to trigger them.';
          }
          if (shadowed && record.dominantShadow) {
            const allShadowed = record.shadowedCount === record.records.length;
            const prefix = allShadowed
              ? `All ${record.shadowedCount} matched request${record.shadowedCount !== 1 ? 's' : ''}`
              : `${record.shadowedCount} of ${record.records.length} matched requests`;
            return `${prefix} are terminated by "${record.dominantShadow.name}" (higher-priority block rule) — so this rule has no visible effect on them. Experimental: shadow detection may over- or under-report. Disable in settings to hide.`;
          }
          switch (record.dominantEvidence) {
            case 'confirmed':
              return `Script confirmed ${count} fire${count !== 1 ? 's' : ''} on this page (ground truth from in-page injection).`;
            case 'matched-fallback':
              return `Matched ${count} request${count !== 1 ? 's' : ''} via URL, but the in-page script reporter didn't confirm. Common causes: a strict Content-Security-Policy blocking the injection, or the resource type (stylesheet, image, manifest link) bypassing fetch/XHR interception.`;
            case 'silent':
              return `Pattern matched ${count} cached subresource${count !== 1 ? 's' : ''} — the action couldn't run because the response bypassed the network. Reload bypassing cache to force a fresh request.`;
            default:
              return `Matched ${count} request${count !== 1 ? 's' : ''} on this page. Chrome's declarativeNetRequest doesn't report which rule wins when several match — we observe URL matches, not arbitration outcomes.`;
          }
        })();
        // When the rule has only silent matches (cached subresources),
        // render the count in gold instead of blue to keep the "no
        // action ran" semantic visible at a glance. The verdict chip
        // beside it already says "SILENT," but the count color
        // reinforces it without requiring the user to read the chip.
        const silentOnly = record.dominantEvidence === 'silent';
        const tagLabel = outOfPlay ? '–' : shadowed ? `⚠ ${count}` : String(count);
        const tagColor = outOfPlay
          ? 'default'
          : shadowed
            ? 'warning'
            : count > 0
              ? silentOnly
                ? 'gold'
                : 'blue'
              : 'default';
        const tagVariant = !outOfPlay && count > 0 ? 'filled' : 'outlined';
        // Verdict chip — rendered only when the rule is not firing and
        // not out-of-play. "Firing" is already conveyed by the blue
        // count tag below; layering a second "Firing" chip would be noise.
        const verdict = record.verdict ?? 'page';
        const showVerdictChip = !outOfPlay && verdict !== 'firing';
        const verdictTooltip = record.verdictReason || VERDICT_TOOLTIP[verdict];
        return (
          <Space size={4} align="center">
            <Tooltip title={text.length > 20 ? text : undefined}>
              <Text strong style={{ fontSize: '13px' }}>
                {displayName}
              </Text>
            </Tooltip>
            <Tooltip title={countTooltip}>
              <Tag
                variant={tagVariant}
                color={tagColor}
                style={{
                  margin: 0,
                  fontSize: 10,
                  padding: '0 6px',
                  lineHeight: '16px',
                  minWidth: 20,
                  textAlign: 'center',
                  opacity: outOfPlay || count === 0 ? 0.5 : 1,
                }}
              >
                {tagLabel}
              </Tag>
            </Tooltip>
            {showVerdictChip && (
              <Tooltip title={verdictTooltip}>
                <Tag
                  color={VERDICT_COLOR[verdict]}
                  style={{
                    margin: 0,
                    fontSize: 9,
                    padding: '0 5px',
                    lineHeight: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  {VERDICT_LABEL[verdict]}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Details',
      key: 'details',
      width: 240,
      render: (_: unknown, record: TableRecord) =>
        renderActionDetails(
          {
            ruleType: record.ruleType,
            direction: record.actionDirection as 'request' | 'response' | undefined,
            operation: record.actionOperation,
            label: record.actionLabel || '',
            value: record.actionValue || '',
            tooltip: record.actionTooltip || record.summary,
            items: record.actionItems,
          },
          1,
          24,
          record.isEnabled !== false,
        ),
    },
    {
      title: 'Match',
      key: 'match',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        // Sort by rule type label — the Match column's dominant tag. Two rules
        // of the same type with different resource-type histories end up
        // adjacent, which matches how users scan for "all my header rules".
        const labelA = RULE_TYPE_LABEL[a.ruleType] ?? a.ruleType;
        const labelB = RULE_TYPE_LABEL[b.ruleType] ?? b.ruleType;
        return labelA.localeCompare(labelB);
      },
      sortOrder: sortedInfo.columnKey === 'match' ? sortedInfo.order : null,
      filters: [
        ...new Set([
          'Paused',
          ...Object.values(RESOURCE_TYPE_LABEL),
          ...dataSource.map((item) => RULE_TYPE_LABEL[item.ruleType] ?? item.ruleType),
        ]),
      ].map((label) => ({ text: label, value: label })),
      filteredValue: filteredInfo.match || null,
      filterSearch: true,
      onFilter: (value, record) => {
        const resourceLabels = [
          ...new Set(record.records.map((m) => RESOURCE_TYPE_LABEL[m.resourceType || 'other'] ?? 'Other')),
        ];
        const labels = [
          ...resourceLabels,
          ...(resolvePauseState(record.path ?? '', pauseMarkers) ? ['Paused'] : []),
          RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
        ];
        return labels.includes(value as string);
      },
      render: (_: unknown, record: TableRecord) => {
        const allTags: TagDescriptor[] = [];
        if (resolvePauseState(record.path ?? '', pauseMarkers)) {
          allTags.push({
            label: 'Paused',
            color: 'default',
            tooltip: 'Collection or folder is paused — rule not applied',
          });
        }
        // Derive unique resource type tags from telemetry records.
        const seenTypes = new Set<string>();
        for (const m of record.records) {
          seenTypes.add(m.resourceType || 'other');
        }
        const typeOrder = [
          'main_frame',
          'sub_frame',
          'xmlhttprequest',
          'script',
          'stylesheet',
          'image',
          'font',
          'media',
          'websocket',
          'ping',
          'other',
        ];
        for (const rt of typeOrder) {
          if (seenTypes.has(rt)) {
            allTags.push({
              label: RESOURCE_TYPE_LABEL[rt] ?? rt,
              tooltip: RESOURCE_TYPE_TOOLTIP[rt] ?? rt,
            });
          }
        }
        allTags.push({
          label: RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
          tooltip: RULE_TYPE_DESCRIPTION[record.ruleType] ?? record.ruleType,
        });
        const resourceLabelValues = new Set(Object.values(RESOURCE_TYPE_LABEL));
        const hasStatusTag = allTags[0]?.label === 'Paused' || resourceLabelValues.has(allTags[0]?.label);
        return renderTagOverflow(allTags, hasStatusTag ? 1 : 2);
      },
    },
    {
      title: '',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 50,
      align: 'center',
      fixed: 'right',
      sorter: (a, b) => Number(b.isEnabled !== false) - Number(a.isEnabled !== false),
      sortOrder: sortedInfo.columnKey === 'isEnabled' ? sortedInfo.order : null,
      render: (enabled: unknown, record: TableRecord) => {
        const isEnabled = enabled !== false;
        return (
          <Switch
            checked={isEnabled}
            onChange={() => {
              setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled: !isEnabled } : r)));
              void ruleMutator.toggleRule(record.id, !isEnabled).then((resp) => {
                if (resp.ok) {
                  void call('rulesUpdated').catch(() => undefined);
                } else {
                  setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled } : r)));
                  void message.error('Failed to toggle rule');
                }
              });
            }}
            size="small"
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: TableRecord) => {
        return (
          <Space size={2}>
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => openRulesIntent({ kind: 'edit-rule', uid: record.id })}
            />
            <Popconfirm
              title="Delete rule"
              description={`Delete "${record.name}"?`}
              onConfirm={() => {
                setActiveRules((prev) => prev.filter((r) => r.id !== record.id));
                void ruleMutator.deleteRule(record.id).then((resp) => {
                  if (resp.ok) {
                    void message.success('Rule deleted');
                  } else {
                    void message.error('Failed to delete rule');
                  }
                });
              }}
              okText="Delete"
              okType="danger"
              cancelText="Cancel"
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (loading)
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: '16px' }}>
          Loading current tab information...
        </Text>
      </div>
    );
  if (!currentTab)
    return (
      <Empty
        image={<ExclamationCircleOutlined style={{ fontSize: 32, color: 'var(--text-tertiary)' }} />}
        description="Unable to get current tab information"
        style={{ padding: '40px 0' }}
      />
    );
  const isSystemPage =
    !currentTab.domain ||
    /^(chrome|chrome-extension|edge|moz-extension|about|opera|vivaldi|brave):/.test(currentTab.url);

  const activeCount = activeRules.filter(
    (r) => r.isEnabled !== false && !resolvePauseState(r.path ?? '', pauseMarkers),
  ).length;

  // Per-verdict counts for the header summary. `firing` is the ground
  // truth count (telemetry has a counter). `silent` and `page` come
  // from the background; `related` collapses into the "also on this
  // domain" hint.
  const verdictCounts = dataSource.reduce(
    (acc, rec) => {
      if (rec.isEnabled === false || resolvePauseState(rec.path ?? '', pauseMarkers)) return acc;
      const state = rec.verdict ?? 'page';
      if (state === 'firing') acc.firing++;
      else if (state === 'silent') acc.silent++;
      else if (state === 'page') acc.page++;
      else if (state === 'related') acc.related++;
      return acc;
    },
    { firing: 0, silent: 0, page: 0, related: 0 },
  );

  return (
    <div className="header-rules-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="header-rules-title">
          <div>
            <Tooltip
              title={currentTab.domain.length > 30 ? currentTab.domain : undefined}
              styles={{ root: { maxWidth: 500 } }}
            >
              <Text style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentTab.domain.length > 30
                  ? `${currentTab.domain.substring(0, 20)}...${currentTab.domain.substring(currentTab.domain.length - 7)}`
                  : currentTab.domain}
              </Text>
            </Tooltip>
            <Space className="oh-toolbar-status" size={4} style={{ display: 'flex', flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {activeCount} of {activeRules.length} active
              </Text>
              <span className="oh-status-detail" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                {(() => {
                  const pausedCount = activeRules.filter((r) => resolvePauseState(r.path ?? '', pauseMarkers)).length;
                  return pausedCount > 0 ? (
                    <>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        ·
                      </Text>
                      <Text type="warning" style={{ fontSize: '11px' }}>
                        {pausedCount} rule{pausedCount !== 1 ? 's' : ''} paused by collection
                      </Text>
                    </>
                  ) : null;
                })()}
                {(verdictCounts.firing > 0 || verdictCounts.silent > 0 || verdictCounts.related > 0) && (
                  <>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ·
                    </Text>
                    {verdictCounts.firing > 0 && (
                      <Tooltip title={VERDICT_TOOLTIP.firing}>
                        <Text style={{ fontSize: '11px', color: '#1677ff' }}>{verdictCounts.firing} firing</Text>
                      </Tooltip>
                    )}
                    {verdictCounts.silent > 0 && (
                      <>
                        {verdictCounts.firing > 0 && (
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            ·
                          </Text>
                        )}
                        <Tooltip title={VERDICT_TOOLTIP.silent}>
                          <Text style={{ fontSize: '11px', color: '#d48806' }}>
                            {verdictCounts.silent} silent (cached)
                          </Text>
                        </Tooltip>
                      </>
                    )}
                    {verdictCounts.related > 0 && (
                      <>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          ·
                        </Text>
                        <Tooltip title={VERDICT_TOOLTIP.related}>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {verdictCounts.related} related
                          </Text>
                        </Tooltip>
                      </>
                    )}
                  </>
                )}
              </span>
            </Space>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
              <Space className="oh-toolbar-secondary" size={6} align="center">
                <Badge status="processing" />
                <Text className="oh-monitoring-text" type="secondary" style={{ fontSize: '11px' }}>
                  Live — monitoring requests
                </Text>
              </Space>
              <Input.Search
                className="oh-search oh-toolbar-secondary"
                placeholder="Search anything..."
                allowClear
                size="small"
                style={{ width: 260 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchText) {
                    e.stopPropagation();
                    setSearchText('');
                  }
                }}
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'label',
                      label: (
                        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
                          SORT ORDER
                        </Text>
                      ),
                      disabled: true,
                    },
                    {
                      key: 'status',
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minWidth: 220,
                          }}
                        >
                          <div>
                            <div>By status</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Active → Paused → Disabled · priority within each
                            </Text>
                          </div>
                          {sortMode === 'status' && !sortedInfo.order && <CheckOutlined style={{ color: '#1677ff' }} />}
                        </div>
                      ),
                      onClick: () => handleSortModeChange('status'),
                    },
                    {
                      key: 'priority',
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minWidth: 220,
                          }}
                        >
                          <div>
                            <div>By priority</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Block → Redirect → Query → Header → Inject · A-Z within each
                            </Text>
                          </div>
                          {sortMode === 'priority' && !sortedInfo.order && (
                            <CheckOutlined style={{ color: '#1677ff' }} />
                          )}
                        </div>
                      ),
                      onClick: () => handleSortModeChange('priority'),
                    },
                    {
                      key: 'manual',
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minWidth: 220,
                          }}
                        >
                          <div>
                            <div>Workspace order</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              Matches the workspace sidebar tree order
                            </Text>
                          </div>
                          {sortMode === 'manual' && !sortedInfo.order && <CheckOutlined style={{ color: '#1677ff' }} />}
                        </div>
                      ),
                      onClick: () => handleSortModeChange('manual'),
                    },
                    ...(sortedInfo.order
                      ? [
                          { type: 'divider' as const, key: 'div' },
                          {
                            key: 'column-sort',
                            label: (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  minWidth: 220,
                                }}
                              >
                                <div>
                                  <div>By column</div>
                                  <Text type="secondary" style={{ fontSize: '11px' }}>
                                    Sorted by {String(sortedInfo.columnKey)} — click an option above to reset
                                  </Text>
                                </div>
                                <CheckOutlined style={{ color: '#1677ff' }} />
                              </div>
                            ),
                            disabled: true,
                          },
                        ]
                      : []),
                  ],
                }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Tooltip title="Sort order">
                  <Button className="oh-toolbar-secondary" type="text" size="small" icon={<SortAscendingOutlined />} />
                </Tooltip>
              </Dropdown>
              <Dropdown
                placement="bottomRight"
                trigger={['click']}
                dropdownRender={() => (
                  <div
                    className="ant-dropdown-menu"
                    style={{
                      padding: '4px 0',
                      minWidth: 240,
                      boxShadow: token.boxShadowSecondary,
                      borderRadius: token.borderRadiusLG,
                      background: token.colorBgElevated,
                    }}
                  >
                    <div style={{ padding: '5px 12px' }}>
                      <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
                        VISIBLE RESOURCE TYPES
                      </Text>
                    </div>
                    <div
                      style={{
                        maxHeight: 160,
                        overflowY: 'auto',
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      {ALL_RESOURCE_TYPES.map((type) => {
                        const checked = visibleTypeSet.has(type);
                        return (
                          <button
                            type="button"
                            key={type}
                            onClick={() => toggleResourceType(type)}
                            className="ant-dropdown-menu-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              padding: '5px 12px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: token.colorText,
                            }}
                          >
                            <Tooltip
                              title={RESOURCE_TYPE_TOOLTIP[type] ?? type}
                              placement="left"
                              styles={{ root: { maxWidth: 280 } }}
                            >
                              <span style={{ fontSize: 12 }}>{RESOURCE_TYPE_LABEL[type] ?? type}</span>
                            </Tooltip>
                            {checked && <CheckOutlined style={{ color: '#1677ff', fontSize: 12 }} />}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setVisibleResourceTypes(ALL_RESOURCE_TYPES)}
                      className="ant-dropdown-menu-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '5px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: token.colorText,
                      }}
                    >
                      <span style={{ fontSize: 12 }}>Show all</span>
                      {visibleResourceTypes.length === ALL_RESOURCE_TYPES.length && (
                        <CheckOutlined style={{ color: '#1677ff', fontSize: 12 }} />
                      )}
                    </button>
                  </div>
                )}
              >
                <Tooltip
                  title={
                    visibleResourceTypes.length < ALL_RESOURCE_TYPES.length
                      ? `Filter resource types (${visibleResourceTypes.length} of ${ALL_RESOURCE_TYPES.length} shown)`
                      : 'Filter resource types'
                  }
                >
                  <Badge
                    className="oh-toolbar-secondary"
                    dot={visibleResourceTypes.length < ALL_RESOURCE_TYPES.length}
                    color="blue"
                    offset={[-2, 2]}
                  >
                    <Button type="text" size="small" icon={<FilterOutlined />} />
                  </Badge>
                </Tooltip>
              </Dropdown>
            </div>
            <div
              className="value-cell oh-toolbar-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                marginTop: 2,
              }}
            >
              <Button
                type="dashed"
                size="small"
                icon={<ApartmentOutlined />}
                onClick={() => {
                  if (currentTab?.url) {
                    openRulesIntent({ kind: 'open-rule-flow', scope: 'this-page', url: currentTab.url });
                  }
                }}
                style={{ fontSize: 11 }}
              >
                View Execution Flow
              </Button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {(() => {
                    if (!searchText) {
                      // Break down the unified total into firing + silent
                      // when any silent matches exist, so users on cached
                      // pages can tell at a glance how much of the count
                      // is cache-served vs. live. Pure-firing pages keep
                      // the compact "N requests" label.
                      const silentUrls = new Set<string>();
                      const allUrls = new Set<string>();
                      for (const recs of recordsByRuleId.values()) {
                        for (const r of recs) {
                          allUrls.add(r.url);
                          if (r.evidence === 'silent') silentUrls.add(r.url);
                        }
                      }
                      const totalCount = allUrls.size;
                      const silentCount = silentUrls.size;
                      if (silentCount === 0) {
                        return `${totalCount} request${totalCount !== 1 ? 's' : ''}`;
                      }
                      if (silentCount === totalCount) {
                        return `${totalCount} silent request${totalCount !== 1 ? 's' : ''} (cached)`;
                      }
                      return `${totalCount} request${totalCount !== 1 ? 's' : ''} (${silentCount} silent)`;
                    }
                    const q = searchText.toLowerCase();
                    const filteredRequests = new Set<string>();
                    for (const r of sortedFilteredRules) {
                      for (const m of recordsFor(r.id)) {
                        if (m.url.toLowerCase().includes(q)) filteredRequests.add(`${m.url}\0${m.t}`);
                      }
                    }
                    const parts: string[] = [];
                    parts.push(
                      `${sortedFilteredRules.length} of ${activeRules.length} rule${activeRules.length !== 1 ? 's' : ''}`,
                    );
                    if (filteredRequests.size > 0) {
                      parts.push(
                        `${filteredRequests.size} of ${uniqueRequestCount} request${uniqueRequestCount !== 1 ? 's' : ''}`,
                      );
                    }
                    return `${parts.join(', ')} matched`;
                  })()}
                </Text>
                {copiedRowId === '__stats__' ? (
                  <CheckOutlined style={{ fontSize: '11px', color: '#52c41a', cursor: 'default' }} />
                ) : (
                  <Tooltip title="Copy requests as TSV">
                    <CopyTwoTone
                      className="value-copy-icon"
                      style={{ fontSize: '11px', cursor: 'pointer' }}
                      onClick={() => {
                        const seen = new Set<string>();
                        const rows: string[] = [];
                        const q = searchText.toLowerCase();
                        const fmt = (ts: number) => {
                          const d = new Date(ts);
                          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
                        };
                        for (const r of sortedFilteredRules) {
                          for (const m of recordsFor(r.id)) {
                            if (q && !m.url.toLowerCase().includes(q)) continue;
                            const key = `${m.url}\0${m.t}`;
                            if (seen.has(key)) continue;
                            seen.add(key);
                            const rt = m.resourceType || 'other';
                            rows.push(`${fmt(m.t)}\t${m.url}\t${RESOURCE_TYPE_LABEL[rt] ?? rt}\t${m.pattern}`);
                          }
                        }
                        rows.sort((a, b) => b.localeCompare(a));
                        void navigator.clipboard.writeText(`Time\tRequest URL\tType\tPattern\n${rows.join('\n')}`);
                        setCopiedRowId('__stats__');
                        setTimeout(() => setCopiedRowId(null), 1000);
                      }}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '8px' }}>
        <Table
          dataSource={dataSource}
          columns={columns}
          onChange={handleTableChange}
          pagination={paginationConfig}
          size="small"
          scroll={{ x: 630, y: 290 }}
          onRow={(_record: TableRecord, index) => ({
            onClick: () => {
              if (index !== undefined) {
                setFocusedRowIndex(index);
                (document.activeElement as HTMLElement)?.blur();
              }
            },
          })}
          rowClassName={(record: TableRecord, index: number) => {
            const classes: string[] = [];
            if (resolvePauseState(record.path ?? '', pauseMarkers)) classes.push('row-group-paused');
            else if (record.isEnabled === false) classes.push('row-disabled');
            if (index === focusedRowIndex) classes.push('keyboard-focused-row');
            if (index === pendingDeleteIndex) classes.push('keyboard-pending-delete-row');
            return classes.join(' ');
          }}
          expandable={{
            columnTitle: (
              <Tooltip
                styles={{ root: { maxWidth: 500 } }}
                title={
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '4px 6px',
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <Tag
                      variant="outlined"
                      style={{ margin: 0, fontSize: 10, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      {uniqueRequestCount}
                    </Tag>
                    <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>
                      Click badge on each row to see matched requests
                    </span>
                    <Tag
                      variant="outlined"
                      style={{ margin: 0, fontSize: 10, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      i
                    </Tag>
                    <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Click icon below to see documentation</span>
                  </div>
                }
              >
                <InfoCircleOutlined
                  style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                  onClick={() => openRulesIntent({ kind: 'open-docs', section: 'request-tracking' })}
                />
              </Tooltip>
            ),
            columnWidth: 40,
            expandRowByClick: false,
            expandedRowKeys: isActive && expandedRowKey !== null ? [expandedRowKey] : [],
            expandIcon: ({ record, onExpand }) => {
              const totalRequests = record.records.length;
              const searchUrlMatches = searchText && record.id ? urlMatchCountMap.get(record.id) || 0 : 0;
              const badgeCount = searchText ? searchUrlMatches : totalRequests;
              const bgColor = searchUrlMatches > 0 ? '#1677ff' : '#8c8c8c';
              // Distinguish firing from silent in the expand-badge tooltip
              // so a user scanning a cached-heavy page sees "5 requests
              // (all silent — cached)" rather than an identical tooltip to
              // a 5-fire rule. Pure-silent counts use "silent", mixed
              // counts list both, and pure-fire counts read plain.
              const silentCount = record.records.filter((r) => r.evidence === 'silent').length;
              const firingCount = totalRequests - silentCount;
              const describeRequests = (n: number): string => `${n} matched request${n !== 1 ? 's' : ''}`;
              const expandHint = 'click to expand';
              const badgeTooltip =
                searchUrlMatches > 0
                  ? `${searchUrlMatches} of ${totalRequests} request${totalRequests !== 1 ? 's' : ''} match "${searchText}" — ${expandHint}`
                  : badgeCount === 0
                    ? 'No matched requests yet — click to expand'
                    : silentCount === totalRequests
                      ? `${describeRequests(totalRequests)}, all cache-served (silent) — ${expandHint}`
                      : silentCount > 0
                        ? `${describeRequests(firingCount)} fired + ${silentCount} silent (cached) — ${expandHint}`
                        : `${describeRequests(totalRequests)} — ${expandHint}`;
              return (
                <Tooltip title={badgeTooltip}>
                  <span
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 20,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 5,
                      backgroundColor: badgeCount > 0 ? bgColor : '#d9d9d9',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => onExpand(record, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        onExpand(record, e as unknown as React.MouseEvent<HTMLElement>);
                    }}
                  >
                    {badgeCount}
                  </span>
                </Tooltip>
              );
            },
            onExpand: (_expanded: boolean, record: TableRecord) => {
              expandCountRef.current += 1;
              const fullIndex = dataSource.findIndex((r) => r.key === record.key);
              const pageStart = (paginationConfig.current - 1) * paginationConfig.pageSize;
              const pageRelativeIndex = fullIndex - pageStart;
              toggleExpandedRow(record.key, pageRelativeIndex >= 0 ? pageRelativeIndex : undefined);
              (document.activeElement as HTMLElement)?.blur();
            },
            expandedRowRender: (record: TableRecord) => {
              // Only render content for the active expanded row — destroys stale virtual tables
              if (record.key !== expandedRowKey) return null;
              // `record.records` is already newest-first (reversed in dataSource build).
              const allMatches = record.records;
              // If this rule has URL matches for the search, filter to those URLs.
              // If the rule matched only by properties (name/value/domain/tag), show all URLs.
              const hasUrlMatches = searchText && record.id ? urlMatchCountMap.has(record.id) : false;
              const matches = hasUrlMatches
                ? allMatches.filter((m) => m.url.toLowerCase().includes(searchText.toLowerCase()))
                : allMatches;

              // Report nested row count to keyboard nav when this is the keyboard-expanded row
              if (record.key === expandedRowKey) {
                queueMicrotask(() => setNestedRowCount(matches.length));
              }

              if (matches.length === 0) {
                // Empty-state copy tailored to WHY the record list is
                // empty. Two paths land here:
                //   (a) searchText narrowed to zero matches — tell the
                //       user to clear / widen the search
                //   (b) the rule has no fires and no silent matches — in
                //       which case the verdict tells us what would help
                const emptyHint = searchText
                  ? `No matched requests contain "${searchText}". Clear or widen the search to see all matches.`
                  : record.verdict === 'related'
                    ? 'Rule targets a related domain — matches will appear if the page makes requests to that domain.'
                    : record.verdict === 'page'
                      ? 'Pattern matches this page. Matches will appear as the page issues requests that fit the pattern — interact with the page or reload to trigger them.'
                      : 'No matched requests yet — reload the page to capture.';
                return (
                  <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                    {emptyHint}
                  </Text>
                );
              }

              const matchedData: MatchedRequestRow[] = matches.map((m, i) => ({
                ...m,
                key: `${record.id}-match-${i}`,
                isTabUrl: m.url === currentTab?.url,
              }));

              const matchedColumns: ColumnsType<MatchedRequestRow> = [
                {
                  title: 'Time',
                  dataIndex: 't',
                  key: 'timestamp',
                  width: 100,
                  align: 'center',
                  sorter: (a, b) => a.t - b.t,
                  defaultSortOrder: 'descend',
                  render: (ts: number) => (
                    <Tooltip title={formatTimestampFull(ts)}>
                      <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'default' }}>
                        {formatTimestampShort(ts)}
                      </Text>
                    </Tooltip>
                  ),
                },
                {
                  title: 'Request URL',
                  dataIndex: 'url',
                  key: 'url',
                  width: 380,
                  sorter: (a, b) => a.url.localeCompare(b.url),
                  render: (url: string, matchRecord: MatchedRequestRow) => {
                    const display =
                      url.length > 50 ? `${url.substring(0, 30)}...${url.substring(url.length - 15)}` : url;
                    return (
                      <div
                        className="value-cell"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                        }}
                      >
                        <Tooltip
                          title={
                            <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                              <div
                                style={{
                                  marginBottom: 6,
                                  maxHeight: 80,
                                  overflowY: 'auto',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {renderHighlightedUrl(matchRecord.url, matchRecord.pattern)}
                              </div>
                              <div
                                style={{
                                  borderTop: '1px solid rgba(255,255,255,0.15)',
                                  paddingTop: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span style={{ opacity: 0.5, fontSize: 11 }}>matched by</span>
                                <span style={{ color: '#69b1ff', fontSize: 11 }}>{matchRecord.pattern}</span>
                              </div>
                            </div>
                          }
                          styles={{ root: { maxWidth: 400 } }}
                        >
                          <Text
                            style={{
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              cursor: 'default',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {display}
                          </Text>
                        </Tooltip>
                        <span style={{ flex: 1 }} />
                        {copiedRowId === matchRecord.key ? (
                          <CheckOutlined
                            className="value-copy-icon"
                            style={{ fontSize: '11px', color: '#52c41a', flexShrink: 0, opacity: 1 }}
                          />
                        ) : (
                          <CopyTwoTone
                            className="value-copy-icon"
                            style={{ fontSize: '11px', cursor: 'pointer', flexShrink: 0, opacity: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(url);
                              setCopiedRowId(matchRecord.key);
                              setTimeout(() => setCopiedRowId(null), 1000);
                            }}
                          />
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Type',
                  key: 'type',
                  width: 80,
                  align: 'center',
                  sorter: (a, b) =>
                    (RESOURCE_TYPE_LABEL[a.resourceType || 'other'] ?? 'Other').localeCompare(
                      RESOURCE_TYPE_LABEL[b.resourceType || 'other'] ?? 'Other',
                    ),
                  render: (_: unknown, matchRecord: MatchedRequestRow) => {
                    const rt = matchRecord.resourceType || (matchRecord.isTabUrl ? 'main_frame' : 'other');
                    const label = RESOURCE_TYPE_LABEL[rt] ?? rt;
                    const tooltip = RESOURCE_TYPE_TOOLTIP[rt] ?? rt;
                    return (
                      <Tooltip title={tooltip}>
                        <Tag variant="outlined" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                          {label}
                        </Tag>
                      </Tooltip>
                    );
                  },
                },
                {
                  title: 'Delivery',
                  key: 'delivery',
                  width: 90,
                  align: 'center',
                  sorter: (a, b) => (a.deliveryMode ?? '').localeCompare(b.deliveryMode ?? ''),
                  render: (_: unknown, matchRecord: MatchedRequestRow) => {
                    switch (matchRecord.deliveryMode) {
                      case 'network':
                        return (
                          <Tooltip title="Request went to the network this session; response was not served from cache.">
                            <Tag color="green" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                              ● live
                            </Tag>
                          </Tooltip>
                        );
                      case 'cached':
                        return (
                          <Tooltip title="Response was served from Chrome's HTTP cache. Your rule applied when this response was originally fetched or on the revalidation round-trip.">
                            <Tag style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>● cached</Tag>
                          </Tooltip>
                        );
                      case 'service-worker':
                        return (
                          <Tooltip title="A service worker intercepted the request. Whether your rule applied depends on what the service worker did next.">
                            <Tag color="blue" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                              ● sw
                            </Tag>
                          </Tooltip>
                        );
                      default:
                        // Scriptable fire or in-flight — no webRequest completion
                        // yet, so delivery mode is unknown. Stay quiet rather
                        // than show a misleading tag.
                        return null;
                    }
                  },
                },
                {
                  title: 'Evidence',
                  key: 'evidence',
                  width: 110,
                  align: 'center',
                  sorter: (a, b) => a.evidence.localeCompare(b.evidence),
                  render: (_: unknown, matchRecord: MatchedRequestRow) => {
                    // Shadowed rows take precedence visually — that's the
                    // reason the user cares about the row at all when the
                    // experimental setting is on.
                    if (shadowDetection && matchRecord.shadowedBy) {
                      return (
                        <Tooltip
                          title={`This request was terminated by "${matchRecord.shadowedBy.name}" (block rule, higher priority). This rule never ran on it.`}
                        >
                          <Tag color="warning" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                            ⚠ shadowed
                          </Tag>
                        </Tooltip>
                      );
                    }
                    switch (matchRecord.evidence) {
                      case 'confirmed':
                        return (
                          <Tooltip title="Script confirmed this fire from the in-page injection — ground truth that the rule ran.">
                            <Tag color="success" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                              ✓ confirmed
                            </Tag>
                          </Tooltip>
                        );
                      case 'matched-fallback':
                        return (
                          <Tooltip title="Matched via URL, but the in-page script reporter didn't confirm. Common causes: a strict Content-Security-Policy blocking the MAIN-world injection, or a resource type (stylesheet, image, manifest link) that bypasses fetch/XHR interception.">
                            <Tag color="gold" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                              ~ fallback
                            </Tag>
                          </Tooltip>
                        );
                      case 'silent':
                        return (
                          <Tooltip title="Pattern matched this subresource but the response was served from cache / a service worker / bfcache, so the rule's action could not run. Reload bypassing cache to force a fresh request.">
                            <Tag color="gold" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                              ⊘ silent
                            </Tag>
                          </Tooltip>
                        );
                      default:
                        return (
                          <Tooltip title="URL matched this rule's conditions. Chrome's declarativeNetRequest doesn't report which rule wins arbitration — we observe URL matches, not execution.">
                            <Tag color="blue" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                              ~ matched
                            </Tag>
                          </Tooltip>
                        );
                    }
                  },
                },
                {
                  title: 'Pattern',
                  dataIndex: 'pattern',
                  key: 'pattern',
                  width: 140,
                  sorter: (a, b) => a.pattern.localeCompare(b.pattern),
                  render: (pattern: string) => (
                    <Tooltip title={pattern}>
                      <Tag variant="outlined" style={{ margin: 0, fontSize: '11px' }}>
                        {pattern.length > 18
                          ? `${pattern.substring(0, 10)}...${pattern.substring(pattern.length - 5)}`
                          : pattern}
                      </Tag>
                    </Tooltip>
                  ),
                },
              ];

              const formatTimestamp = (ts: number) => {
                const d = new Date(ts);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const ss = String(d.getSeconds()).padStart(2, '0');
                const ms = String(d.getMilliseconds()).padStart(3, '0');
                return `${hh}:${mm}:${ss}.${ms}`;
              };

              const copyAllRequests = () => {
                const header = 'Time\tRequest URL\tType\tPattern';
                const rows = matchedData.map((m) => {
                  const rt = m.resourceType || (m.isTabUrl ? 'main_frame' : 'other');
                  return `${formatTimestamp(m.t)}\t${m.url}\t${RESOURCE_TYPE_LABEL[rt] ?? rt}\t${m.pattern}`;
                });
                void navigator.clipboard.writeText(`${header}\n${rows.join('\n')}`);
                setCopiedRowId('__all_requests__');
                setTimeout(() => setCopiedRowId(null), 1000);
              };

              return (
                <div>
                  <div
                    className="value-cell"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                  >
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {hasUrlMatches
                        ? `${matches.length} of ${allMatches.length} request${allMatches.length !== 1 ? 's' : ''} matching "${searchText}"`
                        : `${matches.length} request${matches.length !== 1 ? 's' : ''} matched`}
                    </Text>
                    <Badge status="processing" />
                    {copiedRowId === '__all_requests__' ? (
                      <CheckOutlined style={{ fontSize: '11px', color: '#52c41a', cursor: 'default' }} />
                    ) : (
                      <Tooltip title="Copy requests as TSV">
                        <CopyTwoTone
                          className="value-copy-icon"
                          style={{ fontSize: '11px', cursor: 'pointer' }}
                          onClick={copyAllRequests}
                        />
                      </Tooltip>
                    )}
                  </div>
                  <Table<MatchedRequestRow>
                    key={`${record.key}-${expandCountRef.current}`}
                    ref={nestedTableRef}
                    columns={matchedColumns}
                    dataSource={matchedData}
                    pagination={false}
                    size="small"
                    virtual
                    scroll={matches.length > 3 ? { y: 120 } : undefined}
                    showHeader={matches.length > 1}
                    rowClassName={(_record, index) => (index === nestedFocusIndex ? 'keyboard-focused-nested-row' : '')}
                    onRow={(_record, index) => ({
                      onClick: () => {
                        if (index !== undefined) {
                          setNestedFocusIndex(index);
                        }
                      },
                    })}
                  />
                </div>
              );
            },
            rowExpandable: () => true,
          }}
          locale={{
            emptyText: isSystemPage ? (
              <Empty
                image={<ExclamationCircleOutlined style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  <Space orientation="vertical" size={4}>
                    <Text type="secondary">System Page</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Header rules do not apply to browser system pages
                    </Text>
                  </Space>
                }
                style={{ padding: '32px 0' }}
              />
            ) : (
              <Empty
                image={<FileTextOutlined style={{ fontSize: 28, color: 'var(--text-tertiary)' }} />}
                description={
                  <Space orientation="vertical" size={4}>
                    <Text type="secondary">No rules match this page</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      No rules are configured for this domain
                    </Text>
                  </Space>
                }
                style={{ padding: '32px 0' }}
              />
            ),
          }}
          className="header-rules-table"
        />
        <DeleteConfirmOverlay
          pendingDeleteIndex={pendingDeleteIndex}
          itemName={dataSource[pendingDeleteIndex]?.name ?? ''}
        />
      </div>
    </div>
  );
};

export default ThisPageRules;
