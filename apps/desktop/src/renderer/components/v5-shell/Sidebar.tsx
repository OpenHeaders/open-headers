/**
 * Sidebar — unified items panel with collapsible sections.
 *
 * Shows Collections, Rules, and Environments in one scrollable view.
 * Switches content based on the active ActivityBar panel.
 */

import {
  ApiOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  FileOutlined,
  GlobalOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Badge, Typography, theme } from 'antd';
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

interface SidebarProps {
  activePanel: ActivityPanel;
  onOpenTab?: (tab: OpenTabRequest) => void;
}

function SidebarSection({ title, count, onAdd }: { title: string; count?: number; onAdd?: () => void }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-sidebar-section" style={{ color: token.colorTextSecondary }}>
      <span className="v5-sidebar-section-title">
        {title}
        {count !== undefined && count > 0 && <Badge count={count} size="small" style={{ marginLeft: 6 }} />}
      </span>
      {onAdd && <PlusOutlined className="v5-sidebar-add" style={{ color: token.colorTextSecondary }} onClick={onAdd} />}
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

function ItemsPanel({ onOpenTab }: { onOpenTab?: (tab: OpenTabRequest) => void }) {
  const { token } = theme.useToken();
  const { sources } = useSources();
  const { rules } = useHeaderRules();
  const { environments, activeEnvironment } = useEnvironments();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  // Group sources by tag to form "collections"
  const collections = useMemo(() => {
    const grouped = new Map<string, typeof sources>();
    for (const source of sources) {
      const tag = source.sourceTag || 'Ungrouped';
      const existing = grouped.get(tag) ?? [];
      existing.push(source);
      grouped.set(tag, existing);
    }
    return grouped;
  }, [sources]);

  const toggleCollection = (tag: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const envNames = Object.keys(environments);

  return (
    <>
      <SidebarSection title="COLLECTIONS" count={collections.size} onAdd={() => {}} />
      {collections.size > 0 ? (
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
                {isExpanded ? (
                  <CaretDownOutlined style={{ color: token.colorTextTertiary, fontSize: 10 }} />
                ) : (
                  <CaretRightOutlined style={{ color: token.colorTextTertiary, fontSize: 10 }} />
                )}
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
                    <span className="v5-sidebar-item-label">
                      {source.sourceName || source.sourcePath || 'Untitled'}
                    </span>
                  </div>
                ))}
            </div>
          );
        })
      ) : (
        <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
          No collections yet. Create one to organize your API requests.
        </div>
      )}

      <SidebarSection title="RULES" count={rules.length} onAdd={() => {}} />
      {rules.length > 0 ? (
        rules.map((rule) => (
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
          <ThunderboltOutlined /> Rules will appear here.
        </div>
      )}

      <SidebarSection title="ENVIRONMENTS" count={envNames.length} onAdd={() => {}} />
      {envNames.length > 0 ? (
        envNames.map((name) => (
          <div
            key={name}
            className="v5-sidebar-item"
            style={{ color: token.colorText }}
            role="button"
            tabIndex={0}
            onClick={() =>
              onOpenTab?.({
                id: `env-${name}`,
                type: 'environment',
                label: name,
                icon: 'environment',
                entityId: name,
              })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                onOpenTab?.({
                  id: `env-${name}`,
                  type: 'environment',
                  label: name,
                  icon: 'environment',
                  entityId: name,
                });
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
          No environments configured.
        </div>
      )}
    </>
  );
}

function RecordingsPanel() {
  const { token } = theme.useToken();
  return (
    <>
      <SidebarSection title="RECORDINGS" onAdd={() => {}} />
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No recordings yet.
      </div>
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

export function Sidebar({ activePanel, onOpenTab }: SidebarProps) {
  const { token } = theme.useToken();

  return (
    <div className="v5-sidebar" style={{ background: token.colorBgContainer }}>
      <div className="v5-sidebar-content">
        {activePanel === 'items' && <ItemsPanel onOpenTab={onOpenTab} />}
        {activePanel === 'recordings' && <RecordingsPanel />}
        {activePanel === 'history' && <PlaceholderPanel title="History" />}
        {activePanel === 'files' && <PlaceholderPanel title="Local Files" />}
      </div>

      <div
        className="v5-sidebar-footer"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer' }}>
          Globals
        </Text>
        <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer' }}>
          Vault
        </Text>
        <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer' }}>
          Tools ▾
        </Text>
      </div>
    </div>
  );
}
