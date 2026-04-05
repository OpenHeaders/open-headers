/**
 * Sidebar — unified items panel with collapsible sections.
 *
 * Shows Collections, Rules, and Environments in one scrollable view.
 * Switches content based on the active ActivityBar panel.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ClockCircleOutlined,
  EllipsisOutlined,
  FileOutlined,
  FolderOutlined,
  GlobalOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Allotment } from 'allotment';
import { Button, Dropdown, Input, Tooltip, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { useEnvironments, useHeaderRules, useSources } from '@/renderer/hooks/useCentralizedWorkspace';
import type { ActivityPanel } from './V5Shell';

const { Text } = Typography;

interface OpenTabRequest {
  id: string;
  type: 'rule' | 'environment' | 'collection';
  label: string;
  icon?: string;
  entityId?: string;
}

const PANELS: Array<{ key: ActivityPanel; icon: React.ReactNode; label: string }> = [
  { key: 'items', icon: <AppstoreOutlined />, label: 'Items' },
  { key: 'recordings', icon: <VideoCameraOutlined />, label: 'Recordings' },
  { key: 'history', icon: <ClockCircleOutlined />, label: 'History' },
  { key: 'files', icon: <FolderOutlined />, label: 'Local Files' },
];

interface SidebarProps {
  activePanel: ActivityPanel;
  onPanelChange: (panel: ActivityPanel) => void;
  onOpenTab?: (tab: OpenTabRequest) => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onNewEnvironment?: () => void;
  expandedSections?: string[];
  onExpandedSectionsChange?: (sections: string[]) => void;
  expandedCollections?: string[];
  onExpandedCollectionsChange?: (collections: string[]) => void;
}

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  const { token } = theme.useToken();
  return (
    <div
      className="v5-sidebar-section"
      style={{ color: token.colorTextSecondary, cursor: 'pointer', flexShrink: 0 }}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onToggle();
      }}
      role="button"
      tabIndex={0}
    >
      <span className="v5-sidebar-section-title">
        <CaretRightOutlined
          style={{
            fontSize: 10,
            marginRight: 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
        {title}
      </span>
    </div>
  );
}

function SourceMethodBadge({ method }: { method?: string }) {
  const colors: Record<string, string> = {
    GET: '#61affe',
    POST: '#49cc90',
    PUT: '#fca130',
    PATCH: '#50e3c2',
    DELETE: '#f93e3e',
  };
  const m = method || 'GET';
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        color: 'white',
        background: colors[m] || '#999',
        padding: '1px 3px',
        borderRadius: 2,
        flexShrink: 0,
      }}
    >
      {m}
    </span>
  );
}

function ItemsPanel({
  onOpenTab,
  onNewRequest,
  onNewRule,
  onNewEnvironment,
  filterText = '',
  expandedSections: expandedSectionsProp,
  onExpandedSectionsChange,
  expandedCollections: expandedCollectionsProp,
  onExpandedCollectionsChange,
}: {
  onOpenTab?: (tab: OpenTabRequest) => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onNewEnvironment?: () => void;
  filterText?: string;
  expandedSections?: string[];
  onExpandedSectionsChange?: (sections: string[]) => void;
  expandedCollections?: string[];
  onExpandedCollectionsChange?: (collections: string[]) => void;
}) {
  const { token } = theme.useToken();
  const { sources } = useSources();
  const { rules } = useHeaderRules();
  const { environments, activeEnvironment } = useEnvironments();

  // Use controlled state from parent if provided, otherwise local
  const expandedSectionsSet = useMemo(
    () => new Set(expandedSectionsProp ?? []),
    [expandedSectionsProp],
  );

  const toggleSection = (section: string) => {
    const next = new Set(expandedSectionsSet);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    onExpandedSectionsChange?.([...next]);
  };

  const filter = filterText.toLowerCase();

  // Group sources by tag to form "collections", filtered
  const collections = useMemo(() => {
    const grouped = new Map<string, typeof sources>();
    for (const source of sources) {
      const label = source.sourceName || source.sourcePath || '';
      if (filter && !label.toLowerCase().includes(filter) && !(source.sourceTag || '').toLowerCase().includes(filter)) {
        continue;
      }
      const tag = source.sourceTag || 'Ungrouped';
      const existing = grouped.get(tag) ?? [];
      existing.push(source);
      grouped.set(tag, existing);
    }
    return grouped;
  }, [sources, filter]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    if (!filter) return rules;
    return rules.filter((r) => (r.name || r.headerName).toLowerCase().includes(filter));
  }, [rules, filter]);

  // Filtered environments
  const filteredEnvNames = useMemo(() => {
    const names = Object.keys(environments);
    if (!filter) return names;
    return names.filter((n) => n.toLowerCase().includes(filter));
  }, [environments, filter]);

  const expandedCollections = useMemo(
    () => new Set(expandedCollectionsProp ?? []),
    [expandedCollectionsProp],
  );

  const toggleCollection = (tag: string) => {
    const next = new Set(expandedCollections);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onExpandedCollectionsChange?.([...next]);
  };

  const collectionsExpanded = expandedSectionsSet.has('collections');
  const rulesExpanded = expandedSectionsSet.has('rules');
  const envsExpanded = expandedSectionsSet.has('environments');

  const collectionsContent =
    collections.size > 0 ? (
      [...collections.entries()].map(([tag, tagSources]) => {
        const isExpanded = expandedCollections.has(tag);
        return (
          <div key={tag}>
            <div
              className="v5-sidebar-item"
              style={{ color: token.colorText }}
              role="button"
              tabIndex={0}
              onClick={() => toggleCollection(tag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toggleCollection(tag);
              }}
            >
              <CaretRightOutlined
                style={{
                  color: token.colorTextTertiary,
                  fontSize: 10,
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
              <ApiOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
              <span className="v5-sidebar-item-label">{tag}</span>
              <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>
                {tagSources.length}
              </Text>
            </div>
            {isExpanded &&
              tagSources.map((source) => (
                <div
                  key={source.sourceId}
                  className="v5-sidebar-item v5-sidebar-item-nested"
                  style={{ color: token.colorText }}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onOpenTab?.({
                      id: `source-${source.sourceId}`,
                      type: 'collection',
                      label: source.sourceName || source.sourcePath || 'Untitled',
                      icon: source.sourceMethod || source.sourceType,
                      entityId: source.sourceId,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      onOpenTab?.({
                        id: `source-${source.sourceId}`,
                        type: 'collection',
                        label: source.sourceName || source.sourcePath || 'Untitled',
                        icon: source.sourceMethod || source.sourceType,
                        entityId: source.sourceId,
                      });
                  }}
                >
                  {source.sourceType === 'http' ? (
                    <SourceMethodBadge method={source.sourceMethod} />
                  ) : (
                    <FileOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />
                  )}
                  <span className="v5-sidebar-item-label">{source.sourceName || source.sourcePath || 'Untitled'}</span>
                </div>
              ))}
          </div>
        );
      })
    ) : (
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No collections yet.
      </div>
    );

  const rulesContent =
    filteredRules.length > 0 ? (
      filteredRules.map((rule) => (
        <div
          key={rule.id}
          className="v5-sidebar-item"
          style={{ color: token.colorText }}
          role="button"
          tabIndex={0}
          onClick={() =>
            onOpenTab?.({
              id: `rule-${rule.id}`,
              type: 'rule',
              label: rule.name || rule.headerName,
              icon: 'rule',
              entityId: rule.id,
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              onOpenTab?.({
                id: `rule-${rule.id}`,
                type: 'rule',
                label: rule.name || rule.headerName,
                icon: 'rule',
                entityId: rule.id,
              });
          }}
        >
          <ThunderboltOutlined
            style={{ color: rule.isEnabled ? token.colorSuccess : token.colorTextTertiary, fontSize: 12 }}
          />
          <span className="v5-sidebar-item-label">{rule.name || rule.headerName}</span>
          {!rule.isEnabled && (
            <Text type="secondary" style={{ fontSize: 9, marginLeft: 'auto' }}>
              off
            </Text>
          )}
        </div>
      ))
    ) : (
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        <ThunderboltOutlined /> No rules.
      </div>
    );

  const envsContent =
    filteredEnvNames.length > 0 ? (
      filteredEnvNames.map((name) => (
        <div
          key={name}
          className="v5-sidebar-item"
          style={{ color: token.colorText }}
          role="button"
          tabIndex={0}
          onClick={() =>
            onOpenTab?.({ id: `env-${name}`, type: 'environment', label: name, icon: 'environment', entityId: name })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              onOpenTab?.({ id: `env-${name}`, type: 'environment', label: name, icon: 'environment', entityId: name });
          }}
        >
          <GlobalOutlined
            style={{ color: name === activeEnvironment ? token.colorPrimary : token.colorTextTertiary, fontSize: 12 }}
          />
          <span className="v5-sidebar-item-label">{name}</span>
          {name === activeEnvironment && (
            <Text type="secondary" style={{ fontSize: 9, marginLeft: 'auto', color: token.colorPrimary }}>
              active
            </Text>
          )}
        </div>
      ))
    ) : (
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No environments.
      </div>
    );

  // Key encodes expand state — forces Allotment to remount with correct sizes
  // when sections toggle. This is necessary because Allotment only reads
  // preferredSize on mount.
  const expandKey = `${collectionsExpanded}-${rulesExpanded}-${envsExpanded}`;

  // Compute initial sizes: collapsed = 28px (header only), expanded = equal share of remaining
  const expandedCount = [collectionsExpanded, rulesExpanded, envsExpanded].filter(Boolean).length;
  const HEADER_HEIGHT = 28;
  const computeSizes = () => {
    // We don't know the container height, but Allotment handles the math.
    // Just set collapsed panes small and expanded panes large.
    const expandedSize = 999; // large number — Allotment normalizes
    return [
      collectionsExpanded ? expandedSize : HEADER_HEIGHT,
      rulesExpanded ? expandedSize : HEADER_HEIGHT,
      envsExpanded ? expandedSize : HEADER_HEIGHT,
    ];
  };

  return (
    <Allotment key={expandKey} vertical proportionalLayout={expandedCount > 1} defaultSizes={computeSizes()}>
      <Allotment.Pane minSize={HEADER_HEIGHT}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <SectionHeader
            title="COLLECTIONS"
            expanded={collectionsExpanded}
            onToggle={() => toggleSection('collections')}
          />
          {collectionsExpanded && <div style={{ flex: 1, overflowY: 'auto' }}>{collectionsContent}</div>}
        </div>
      </Allotment.Pane>

      <Allotment.Pane minSize={HEADER_HEIGHT}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <SectionHeader title="RULES" expanded={rulesExpanded} onToggle={() => toggleSection('rules')} />
          {rulesExpanded && <div style={{ flex: 1, overflowY: 'auto' }}>{rulesContent}</div>}
        </div>
      </Allotment.Pane>

      <Allotment.Pane minSize={HEADER_HEIGHT}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <SectionHeader title="ENVIRONMENTS" expanded={envsExpanded} onToggle={() => toggleSection('environments')} />
          {envsExpanded && <div style={{ flex: 1, overflowY: 'auto' }}>{envsContent}</div>}
        </div>
      </Allotment.Pane>
    </Allotment>
  );
}

function RecordingsPanel() {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <SectionHeader title="RECORDINGS" expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      {expanded && (
        <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
          No recordings yet.
        </div>
      )}
    </>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary, paddingTop: 24 }}>
      {title} — coming soon.
    </div>
  );
}

export function Sidebar({
  activePanel,
  onPanelChange,
  onOpenTab,
  onNewRequest,
  onNewRule,
  onNewEnvironment,
  expandedSections,
  onExpandedSectionsChange,
  expandedCollections,
  onExpandedCollectionsChange,
}: SidebarProps) {
  const { token } = theme.useToken();
  const [filterText, setFilterText] = useState('');

  const createMenuItems = [
    { key: 'request', icon: <ApiOutlined />, label: 'HTTP Request', onClick: onNewRequest },
    { key: 'rule', icon: <ThunderboltOutlined />, label: 'Rule', onClick: onNewRule },
    { key: 'environment', icon: <GlobalOutlined />, label: 'Environment', onClick: onNewEnvironment },
  ];

  return (
    <div className="v5-sidebar" style={{ background: token.colorBgLayout }}>
      {/* Activity icons — centered horizontal strip */}
      <div className="v5-sidebar-activity" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        {PANELS.map((panel) => (
          <Tooltip key={panel.key} title={panel.label} placement="bottom">
            <div
              className={`v5-sidebar-activity-icon ${activePanel === panel.key ? 'active' : ''}`}
              style={
                activePanel === panel.key
                  ? { color: token.colorPrimary, borderBottomColor: token.colorPrimary }
                  : { color: token.colorTextTertiary }
              }
              onClick={() => onPanelChange(panel.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onPanelChange(panel.key);
              }}
              role="tab"
              tabIndex={0}
            >
              {panel.icon}
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Search + New + Menu toolbar */}
      <div className="v5-sidebar-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          size="small"
          placeholder="Filter"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          allowClear
          style={{ flex: 1, fontSize: 11 }}
          variant="borderless"
        />
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <Button type="text" size="small" icon={<PlusOutlined />} style={{ color: token.colorTextSecondary }} />
        </Dropdown>
        <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ color: token.colorTextSecondary }} />
      </div>

      <div className="v5-sidebar-content">
        {activePanel === 'items' && (
          <ItemsPanel
            onOpenTab={onOpenTab}
            onNewRequest={onNewRequest}
            onNewRule={onNewRule}
            onNewEnvironment={onNewEnvironment}
            filterText={filterText}
            expandedSections={expandedSections}
            onExpandedSectionsChange={onExpandedSectionsChange}
            expandedCollections={expandedCollections}
            onExpandedCollectionsChange={onExpandedCollectionsChange}
          />
        )}
        {activePanel === 'recordings' && <RecordingsPanel />}
        {activePanel === 'history' && <PlaceholderPanel title="History" />}
        {activePanel === 'files' && <PlaceholderPanel title="Local Files" />}
      </div>
    </div>
  );
}
