/**
 * SourceEditor — inline editor for a Source, rendered in an editor tab.
 *
 * Mirrors the v4 EditSourceModal fields but in a full-page layout.
 * Supports HTTP, file, and env source types. Auto-saves on change.
 */

import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  FileOutlined,
  FilterOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { Source } from '@openheaders/core';
import { Button, Input, InputNumber, Radio, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSources } from '@/renderer/hooks/useCentralizedWorkspace';

const { Text, Title } = Typography;

interface SourceEditorProps {
  sourceId: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

function SourceTypeBadge({ type }: { type: string }) {
  const labels: Record<string, { icon: React.ReactNode; label: string }> = {
    http: { icon: <GlobalOutlined />, label: 'HTTP' },
    file: { icon: <FileOutlined />, label: 'File' },
    env: { icon: <SettingOutlined />, label: 'Env Variable' },
    manual: { icon: <SettingOutlined />, label: 'Manual' },
  };
  const info = labels[type] || labels.manual;
  return (
    <Tag style={{ fontSize: 10 }}>
      {info.icon} {info.label}
    </Tag>
  );
}

function StatusIndicator({ source }: { source: Source }) {
  const { token } = theme.useToken();
  const state = source.activationState || 'inactive';
  const configs: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    active: { color: token.colorSuccess, icon: <CheckCircleOutlined />, label: 'Active' },
    inactive: { color: token.colorTextTertiary, icon: <ClockCircleOutlined />, label: 'Inactive' },
    error: { color: token.colorError, icon: <CloseCircleOutlined />, label: 'Error' },
    waiting_for_deps: { color: token.colorWarning, icon: <ClockCircleOutlined />, label: 'Waiting for deps' },
  };
  const config = configs[state] || configs.inactive;
  return (
    <Tag color={state === 'error' ? 'red' : state === 'active' ? 'green' : 'default'} style={{ fontSize: 10 }}>
      {config.icon} {config.label}
    </Tag>
  );
}

export function SourceEditor({ sourceId }: SourceEditorProps) {
  const { token } = theme.useToken();
  const { sources, updateSource, removeSource, refreshSource } = useSources();
  const source = sources.find((s) => s.sourceId === sourceId);

  // Local form state
  const [sourcePath, setSourcePath] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceTag, setSourceTag] = useState('');
  const [sourceMethod, setSourceMethod] = useState('GET');
  const [jsonFilterEnabled, setJsonFilterEnabled] = useState(false);
  const [jsonFilterPath, setJsonFilterPath] = useState('');
  const [refreshEnabled, setRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);

  const initializedId = useRef<string | null>(null);

  useEffect(() => {
    if (source && initializedId.current !== source.sourceId) {
      initializedId.current = source.sourceId;
      setSourcePath(source.sourcePath || '');
      setSourceName(source.sourceName || '');
      setSourceTag(source.sourceTag || '');
      setSourceMethod(source.sourceMethod || 'GET');
      setJsonFilterEnabled(source.jsonFilter?.enabled ?? false);
      setJsonFilterPath(source.jsonFilter?.path ?? '');
      setRefreshEnabled(source.refreshOptions?.enabled ?? false);
      setRefreshInterval((source.refreshOptions?.interval ?? 300000) / 60000);
    }
  }, [source]);

  // Debounced auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUpdate = useCallback(
    (updates: Partial<Source>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateSource(sourceId, updates);
      }, 600);
    },
    [sourceId, updateSource],
  );

  const handlePathChange = (val: string) => {
    setSourcePath(val);
    scheduleUpdate({ sourcePath: val });
  };

  const handleNameChange = (val: string) => {
    setSourceName(val);
    scheduleUpdate({ sourceName: val });
  };

  const handleTagChange = (val: string) => {
    setSourceTag(val);
    scheduleUpdate({ sourceTag: val });
  };

  const handleMethodChange = (val: string) => {
    setSourceMethod(val);
    scheduleUpdate({ sourceMethod: val as Source['sourceMethod'] });
  };

  const handleJsonFilterToggle = (val: boolean) => {
    setJsonFilterEnabled(val);
    scheduleUpdate({ jsonFilter: { enabled: val, path: jsonFilterPath } });
  };

  const handleJsonFilterPathChange = (val: string) => {
    setJsonFilterPath(val);
    scheduleUpdate({ jsonFilter: { enabled: jsonFilterEnabled, path: val } });
  };

  const handleRefreshToggle = (val: boolean) => {
    setRefreshEnabled(val);
    scheduleUpdate({
      refreshOptions: { enabled: val, type: 'custom', interval: refreshInterval * 60000 },
    });
  };

  const handleRefreshIntervalChange = (val: number | null) => {
    const minutes = val ?? 5;
    setRefreshInterval(minutes);
    scheduleUpdate({
      refreshOptions: { enabled: refreshEnabled, type: 'custom', interval: minutes * 60000 },
    });
  };

  if (!source) {
    return (
      <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
        <Text type="secondary">Source not found. It may have been deleted.</Text>
      </div>
    );
  }

  const isHttp = source.sourceType === 'http';
  const methodColor = METHOD_COLORS[sourceMethod] || '#999';

  return (
    <div className="v5-editor-content" style={{ background: token.colorBgContainer, overflow: 'auto' }}>
      <div className="v5-rule-editor">
        {/* Header */}
        <div className="v5-rule-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isHttp ? (
              <span style={{ fontWeight: 700, fontSize: 13, color: methodColor }}>{sourceMethod}</span>
            ) : (
              <ApiOutlined style={{ fontSize: 18, color: token.colorTextTertiary }} />
            )}
            <Title level={4} style={{ margin: 0 }}>
              {source.sourceName || source.sourcePath || 'Untitled Source'}
            </Title>
            <SourceTypeBadge type={source.sourceType} />
            <StatusIndicator source={source} />
          </div>
          <Space>
            {isHttp && (
              <Tooltip title="Refresh now">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => void refreshSource(sourceId)}
                  loading={source.refreshStatus?.isRefreshing}
                />
              </Tooltip>
            )}
            <Tooltip title="Delete source">
              <Button danger type="text" icon={<DeleteOutlined />} onClick={() => void removeSource(sourceId)} />
            </Tooltip>
          </Space>
        </div>

        <div className="v5-rule-editor-body">
          {/* ── Basic Info ────────────────────────────── */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              SOURCE
            </Text>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Name</Text>
              <Input
                size="small"
                value={sourceName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Display name"
                style={{ maxWidth: 300 }}
              />
            </div>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">
                {isHttp ? 'URL' : source.sourceType === 'file' ? 'File path' : 'Variable'}
              </Text>
              <Input
                size="small"
                value={sourcePath}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder={
                  isHttp
                    ? 'https://api.openheaders.io/token'
                    : source.sourceType === 'file'
                      ? '/path/to/file'
                      : 'ENV_VAR_NAME'
                }
                style={{ maxWidth: 480 }}
              />
            </div>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Tag</Text>
              <Input
                size="small"
                value={sourceTag}
                onChange={(e) => handleTagChange(e.target.value)}
                placeholder="Collection tag"
                style={{ maxWidth: 200 }}
              />
            </div>

            {isHttp && (
              <div className="v5-editor-field">
                <Text className="v5-editor-label">Method</Text>
                <Radio.Group value={sourceMethod} onChange={(e) => handleMethodChange(e.target.value)} size="small">
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <Radio.Button key={m} value={m} style={{ fontSize: 11, fontWeight: 600 }}>
                      {m}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </div>
            )}
          </div>

          {/* ── Current Value ─────────────────────────── */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              CURRENT VALUE
            </Text>
            <div
              style={{
                background: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 4,
                padding: '8px 12px',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 11,
                wordBreak: 'break-all',
                maxHeight: 120,
                overflow: 'auto',
                color: source.sourceContent ? token.colorText : token.colorTextTertiary,
              }}
            >
              {source.sourceContent || '(no value yet — refresh to fetch)'}
            </div>
          </div>

          {/* ── JSON Filter (HTTP only) ───────────────── */}
          {isHttp && (
            <div className="v5-editor-section">
              <Text type="secondary" className="v5-editor-section-title">
                <FilterOutlined /> JSON FILTER
              </Text>
              <div className="v5-editor-field">
                <Text className="v5-editor-label">Enabled</Text>
                <Switch size="small" checked={jsonFilterEnabled} onChange={handleJsonFilterToggle} />
              </div>
              {jsonFilterEnabled && (
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Path</Text>
                  <Input
                    size="small"
                    value={jsonFilterPath}
                    onChange={(e) => handleJsonFilterPathChange(e.target.value)}
                    placeholder="e.g. data.access_token"
                    style={{ maxWidth: 300 }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Auto-Refresh (HTTP only) ──────────────── */}
          {isHttp && (
            <div className="v5-editor-section">
              <Text type="secondary" className="v5-editor-section-title">
                <ReloadOutlined /> AUTO-REFRESH
              </Text>
              <div className="v5-editor-field">
                <Text className="v5-editor-label">Enabled</Text>
                <Switch size="small" checked={refreshEnabled} onChange={handleRefreshToggle} />
              </div>
              {refreshEnabled && (
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Interval</Text>
                  <Space size={4}>
                    <InputNumber
                      size="small"
                      min={1}
                      max={10080}
                      value={refreshInterval}
                      onChange={handleRefreshIntervalChange}
                      style={{ width: 80 }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      minutes
                    </Text>
                  </Space>
                </div>
              )}
              {source.refreshStatus?.lastRefresh && (
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Last refresh</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(source.refreshStatus.lastRefresh).toLocaleString()}
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
