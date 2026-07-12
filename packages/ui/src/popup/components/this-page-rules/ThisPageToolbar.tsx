import {
  CheckOutlined,
  CopyTwoTone,
  FilterOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import type { RequestRecord } from '@openheaders/core/types';
import { type PauseMarkers, resolvePauseState } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { VERDICT_TOOLTIP } from '@openheaders/ui/shared/verdict';
import type { WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import type { TrackedResourceType } from '@openheaders/ui/workbench/settings/schema/rules-engine';
import { Badge, Button, Dropdown, Input, Space, Tooltip, Typography } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import type { SorterResult } from 'antd/es/table/interface';
import type React from 'react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { ALL_RESOURCE_TYPES, RESOURCE_TYPE_LABEL, resourceTypeTooltip } from './format';
import { buildSortOrderMenuItems } from './sort-order-menu';
import type { ActiveRule, CurrentTabInfo, SortMode, TableRecord } from './types';

const { Text } = Typography;

interface ThisPageToolbarProps {
  currentTab: CurrentTabInfo;
  activeCount: number;
  activeRules: ActiveRule[];
  pauseMarkers: PauseMarkers;
  verdictCounts: { firing: number; silent: number; page: number; related: number };
  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  sortMode: SortMode;
  sortedInfo: SorterResult<TableRecord>;
  onSortModeChange: (mode: SortMode) => void;
  token: GlobalToken;
  visibleResourceTypes: readonly TrackedResourceType[];
  visibleTypeSet: Set<string>;
  setVisibleResourceTypes: (value: readonly TrackedResourceType[]) => void;
  toggleResourceType: (type: TrackedResourceType) => void;
  openRulesIntent: (intent: WorkspaceIntent) => void;
  copiedRowId: string | number | null;
  setCopiedRowId: Dispatch<SetStateAction<string | number | null>>;
  recordsByRuleId: Map<string, RequestRecord[]>;
  recordsFor: (id: string | undefined) => RequestRecord[];
  sortedFilteredRules: ActiveRule[];
  uniqueRequestCount: number;
}

/**
 * The This Page view's header toolbar: domain title, live status / verdict
 * summary, search, the sort-order and resource-type dropdowns, and the
 * request-count + copy-as-TSV block. Pure presentation —
 * every input arrives as a prop so the parent stays the single owner of tab
 * telemetry, filter settings, and copy state.
 */
const ThisPageToolbar: React.FC<ThisPageToolbarProps> = ({
  currentTab,
  activeCount,
  activeRules,
  pauseMarkers,
  verdictCounts,
  searchText,
  setSearchText,
  sortMode,
  sortedInfo,
  onSortModeChange,
  token,
  visibleResourceTypes,
  visibleTypeSet,
  setVisibleResourceTypes,
  toggleResourceType,
  openRulesIntent,
  copiedRowId,
  setCopiedRowId,
  recordsByRuleId,
  recordsFor,
  sortedFilteredRules,
  uniqueRequestCount,
}) => {
  const t = useT();
  // Suppress the sort button's tooltip while its menu is open so the
  // two popups never overlap on the same trigger.
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  return (
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
              {t('popup.rules.activeSummary', { active: activeCount, total: activeRules.length })}
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
                      {t('popup.thisPage.rulesPausedByCollection', { count: pausedCount })}
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
                      <Text style={{ fontSize: '11px', color: '#1677ff' }}>
                        {t('popup.thisPage.firing', { count: verdictCounts.firing })}
                      </Text>
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
                          {t('popup.thisPage.silentCached', { count: verdictCounts.silent })}
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
                          {t('popup.thisPage.related', { count: verdictCounts.related })}
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
                {t('popup.thisPage.liveMonitoring')}
              </Text>
            </Space>
            <Input.Search
              className="oh-search oh-toolbar-secondary"
              placeholder={t('popup.table.searchPlaceholder')}
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
                items: buildSortOrderMenuItems({ sortMode, sortedInfo, onSortModeChange, t }),
              }}
              placement="bottomRight"
              trigger={['click']}
              onOpenChange={setSortMenuOpen}
            >
              <Tooltip title={t('popup.table.sortOrder')} open={sortMenuOpen ? false : undefined}>
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
                      {t('popup.thisPage.visibleResourceTypes')}
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
                            title={resourceTypeTooltip(type, t)}
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
                    <span style={{ fontSize: 12 }}>{t('popup.thisPage.showAll')}</span>
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
                    ? t('popup.thisPage.filterResourceTypesCount', {
                        shown: visibleResourceTypes.length,
                        total: ALL_RESOURCE_TYPES.length,
                      })
                    : t('popup.thisPage.filterResourceTypes')
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
              justifyContent: 'flex-end',
              gap: 6,
              marginTop: 2,
            }}
          >
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
                      return t('popup.thisPage.requestCount', { count: totalCount });
                    }
                    if (silentCount === totalCount) {
                      return t('popup.thisPage.requestCountAllSilent', { count: totalCount });
                    }
                    return t('popup.thisPage.requestCountSomeSilent', { count: totalCount, silent: silentCount });
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
                    t('popup.thisPage.rulesOfTotal', { matched: sortedFilteredRules.length, total: activeRules.length }),
                  );
                  if (filteredRequests.size > 0) {
                    parts.push(
                      t('popup.thisPage.requestsOfTotal', { matched: filteredRequests.size, total: uniqueRequestCount }),
                    );
                  }
                  return t('popup.thisPage.matchedJoin', { parts: parts.join(', ') });
                })()}
              </Text>
              {copiedRowId === '__stats__' ? (
                <CheckOutlined style={{ fontSize: '11px', color: '#52c41a', cursor: 'default' }} />
              ) : (
                <Tooltip title={t('popup.thisPage.copyTsv')}>
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
  );
};

export default ThisPageToolbar;
