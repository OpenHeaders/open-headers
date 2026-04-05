/**
 * SourceEditor — Postman-style request editor rendered in an editor tab.
 *
 * Layout:
 *   [Method ▾] [URL input ............................] [Send]
 *   [Params] [Headers] [Body] [Settings]
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Key-value table or body editor                       │
 *   └──────────────────────────────────────────────────────┘
 *   Response
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Response body / status / headers                     │
 *   └──────────────────────────────────────────────────────┘
 */

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { Source, SourceHeader, SourceQueryParam } from '@openheaders/core';
import { Button, Checkbox, Input, InputNumber, Select, Space, Switch, Tabs, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEnvironments, useSources } from '@/renderer/hooks/useCentralizedWorkspace';
import { TemplateInput } from './TemplateInput';

const { Text } = Typography;
const { TextArea } = Input;

interface SourceEditorProps {
  sourceId: string;
}

const METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

// ── Key-value row for params/headers ──────────────────────────────

interface KVRow {
  key: string;
  value: string;
  enabled: boolean;
}

function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  envVars,
  activeEnvironment,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  envVars?: Record<string, { value: string; isSecret: boolean }>;
  activeEnvironment?: string;
}) {
  const { token } = theme.useToken();

  const updateRow = (index: number, field: keyof KVRow, value: string | boolean) => {
    const updated = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onChange(updated);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, { key: '', value: '', enabled: true }]);
  };

  // Always show an empty row at the bottom for quick entry
  const displayRows =
    rows.length === 0 || rows[rows.length - 1].key !== '' ? [...rows, { key: '', value: '', enabled: true }] : rows;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 1fr auto',
          gap: 0,
          fontSize: 11,
          fontWeight: 600,
          color: token.colorTextSecondary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '6px 0',
        }}
      >
        <span />
        <span style={{ padding: '0 8px' }}>Key</span>
        <span style={{ padding: '0 8px' }}>Value</span>
        <span style={{ width: 28 }} />
      </div>

      {/* Rows */}
      {displayRows.map((row, index) => {
        const isPlaceholderRow = index === displayRows.length - 1 && index >= rows.length;
        return (
          <div
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 1fr auto',
              gap: 0,
              alignItems: 'center',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              opacity: !row.enabled && !isPlaceholderRow ? 0.4 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {!isPlaceholderRow && (
                <Checkbox
                  checked={row.enabled}
                  onChange={(e) => updateRow(index, 'enabled', e.target.checked)}
                  style={{ transform: 'scale(0.85)' }}
                />
              )}
            </div>
            <Input
              variant="borderless"
              size="small"
              value={row.key}
              placeholder={keyPlaceholder}
              onChange={(e) => {
                if (isPlaceholderRow) {
                  // User typed in the placeholder row — materialize it
                  onChange([...rows, { key: e.target.value, value: '', enabled: true }]);
                } else {
                  updateRow(index, 'key', e.target.value);
                }
              }}
              style={{ fontSize: 12, borderRadius: 0 }}
            />
            <TemplateInput
              value={row.value}
              placeholder={valuePlaceholder}
              onChange={(val) => {
                if (isPlaceholderRow) {
                  onChange([...rows, { key: '', value: val, enabled: true }]);
                } else {
                  updateRow(index, 'value', val);
                }
              }}
              envVars={envVars}
              activeEnvironment={activeEnvironment}
              borderless
              fontSize={12}
              mono
              style={{ borderRadius: 0 }}
            />
            <div style={{ width: 28, display: 'flex', justifyContent: 'center' }}>
              {!isPlaceholderRow && (
                <MinusCircleOutlined
                  style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }}
                  onClick={() => removeRow(index)}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Add button (only if last real row has content) */}
      {rows.length > 0 && rows[rows.length - 1].key === '' && (
        <div style={{ padding: '4px 8px' }}>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={addRow}
            style={{ fontSize: 11, padding: 0 }}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Response pane ─────────────────────────────────────────────────

function ResponsePane({ source }: { source: Source }) {
  const { token } = theme.useToken();
  const content = source.sourceContent;
  const originalResponse = source.originalResponse;
  const responseHeaders = source.responseHeaders;
  const isRefreshing = source.refreshStatus?.isRefreshing;
  const lastRefresh = source.refreshStatus?.lastRefresh;
  const hasError = source.refreshStatus?.error;

  // Try to detect and pretty-print JSON
  const formatContent = (raw: string | null | undefined): string => {
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  };

  const [responseTab, setResponseTab] = useState<string>('body');

  return (
    <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: token.colorBgElevated,
        }}
      >
        <Space size={12}>
          <Text strong style={{ fontSize: 12 }}>
            Response
          </Text>
          {source.activationState === 'active' && (
            <Text style={{ fontSize: 11, color: token.colorSuccess }}>
              <CheckCircleOutlined /> Active
            </Text>
          )}
          {source.activationState === 'error' && (
            <Text style={{ fontSize: 11, color: token.colorError }}>
              <CloseCircleOutlined /> {hasError || 'Error'}
            </Text>
          )}
          {isRefreshing && (
            <Text style={{ fontSize: 11, color: token.colorPrimary }}>
              <ClockCircleOutlined /> Fetching...
            </Text>
          )}
        </Space>
        {lastRefresh && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            {new Date(lastRefresh).toLocaleString()}
          </Text>
        )}
      </div>

      <Tabs
        size="small"
        activeKey={responseTab}
        onChange={setResponseTab}
        style={{ padding: '0 12px' }}
        items={[
          { key: 'body', label: 'Body' },
          { key: 'raw', label: 'Raw' },
          ...(responseHeaders ? [{ key: 'headers', label: `Headers (${Object.keys(responseHeaders).length})` }] : []),
        ]}
      />

      <div
        style={{
          padding: '8px 12px',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 11,
          lineHeight: 1.6,
          overflow: 'auto',
          maxHeight: 300,
          minHeight: 80,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: content || originalResponse ? token.colorText : token.colorTextTertiary,
          background: token.colorBgContainer,
        }}
      >
        {responseTab === 'body' && (formatContent(content) || '(no response yet — click Send)')}
        {responseTab === 'raw' && (originalResponse || content || '(no response yet)')}
        {responseTab === 'headers' &&
          responseHeaders &&
          Object.entries(responseHeaders).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: token.colorPrimary }}>{k}</span>: {v}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export function SourceEditor({ sourceId }: SourceEditorProps) {
  const { token } = theme.useToken();
  const { sources, updateSource, removeSource, refreshSource } = useSources();
  const { environments, activeEnvironment } = useEnvironments();
  const source = sources.find((s) => s.sourceId === sourceId);
  const activeEnvVars = environments[activeEnvironment] || {};

  // Local form state
  const [sourcePath, setSourcePath] = useState('');
  const [sourceMethod, setSourceMethod] = useState('GET');
  const [activeTab, setActiveTab] = useState('params');

  // Params & headers as KVRow arrays (with enabled flag for checkboxes)
  const [params, setParams] = useState<KVRow[]>([]);
  const [headers, setHeaders] = useState<KVRow[]>([]);
  const [body, setBody] = useState('');
  const [contentType, setContentType] = useState('application/json');

  // Settings
  const [sourceName, setSourceName] = useState('');
  const [sourceTag, setSourceTag] = useState('');
  const [jsonFilterEnabled, setJsonFilterEnabled] = useState(false);
  const [jsonFilterPath, setJsonFilterPath] = useState('');
  const [refreshEnabled, setRefreshEnabled] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);

  const initializedId = useRef<string | null>(null);

  // Initialize from source
  useEffect(() => {
    if (source && initializedId.current !== source.sourceId) {
      initializedId.current = source.sourceId;
      setSourcePath(source.sourcePath || '');
      setSourceMethod(source.sourceMethod || 'GET');
      setSourceName(source.sourceName || '');
      setSourceTag(source.sourceTag || '');
      setBody(source.requestOptions?.body || '');
      setContentType(source.requestOptions?.contentType || 'application/json');
      setJsonFilterEnabled(source.jsonFilter?.enabled ?? false);
      setJsonFilterPath(source.jsonFilter?.path ?? '');
      setRefreshEnabled(source.refreshOptions?.enabled ?? false);
      setRefreshInterval(source.refreshOptions?.interval ?? 5);

      // Convert headers/params to KVRow format
      setParams(
        (source.requestOptions?.queryParams || []).map((p: SourceQueryParam) => ({
          key: p.key,
          value: p.value,
          enabled: true,
        })),
      );
      setHeaders(
        (source.requestOptions?.headers || []).map((h: SourceHeader) => ({
          key: h.key,
          value: h.value,
          enabled: true,
        })),
      );
    }
  }, [source]);

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleUpdate = useCallback(
    (updates: Partial<Source>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateSource(sourceId, updates);
      }, 800);
    },
    [sourceId, updateSource],
  );

  // Convert KVRows back to source format (only enabled rows with keys)
  const kvToHeaders = (rows: KVRow[]): SourceHeader[] =>
    rows.filter((r) => r.key && r.enabled).map((r) => ({ key: r.key, value: r.value }));

  const kvToParams = (rows: KVRow[]): SourceQueryParam[] =>
    rows.filter((r) => r.key && r.enabled).map((r) => ({ key: r.key, value: r.value }));

  // Field handlers
  const handleUrlChange = (val: string) => {
    setSourcePath(val);
    scheduleUpdate({ sourcePath: val });
  };

  const handleMethodChange = (val: string) => {
    setSourceMethod(val);
    scheduleUpdate({ sourceMethod: val as Source['sourceMethod'] });
  };

  const handleParamsChange = (rows: KVRow[]) => {
    setParams(rows);
    scheduleUpdate({
      requestOptions: { queryParams: kvToParams(rows), headers: kvToHeaders(headers), body, contentType },
    });
  };

  const handleHeadersChange = (rows: KVRow[]) => {
    setHeaders(rows);
    scheduleUpdate({
      requestOptions: { headers: kvToHeaders(rows), queryParams: kvToParams(params), body, contentType },
    });
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    scheduleUpdate({
      requestOptions: { body: val, headers: kvToHeaders(headers), queryParams: kvToParams(params), contentType },
    });
  };

  const handleContentTypeChange = (val: string) => {
    setContentType(val);
    scheduleUpdate({
      requestOptions: { contentType: val, body, headers: kvToHeaders(headers), queryParams: kvToParams(params) },
    });
  };

  const handleSend = () => {
    // Save current state first, then refresh
    void updateSource(sourceId, {
      sourcePath,
      sourceMethod: sourceMethod as Source['sourceMethod'],
      requestOptions: {
        headers: kvToHeaders(headers),
        queryParams: kvToParams(params),
        body,
        contentType,
      },
    }).then(() => {
      void refreshSource(sourceId);
    });
  };

  if (!source) {
    return (
      <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
        <Text type="secondary">Source not found. It may have been deleted.</Text>
      </div>
    );
  }

  const methodColor = METHOD_COLORS[sourceMethod] || '#999';
  const isHttp = source.sourceType === 'http';

  // Params count for tab badge
  const activeParamsCount = params.filter((p) => p.key && p.enabled).length;
  const activeHeadersCount = headers.filter((h) => h.key && h.enabled).length;

  const requestTabs = [
    {
      key: 'params',
      label: (
        <span>
          Params{' '}
          {activeParamsCount > 0 && (
            <span style={{ fontSize: 10, color: token.colorPrimary }}>({activeParamsCount})</span>
          )}
        </span>
      ),
    },
    {
      key: 'headers',
      label: (
        <span>
          Headers{' '}
          {activeHeadersCount > 0 && (
            <span style={{ fontSize: 10, color: token.colorPrimary }}>({activeHeadersCount})</span>
          )}
        </span>
      ),
    },
    {
      key: 'body',
      label: <span>Body {body ? <span style={{ fontSize: 8, color: token.colorSuccess }}>●</span> : null}</span>,
    },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div
      className="v5-editor-content"
      style={{ background: token.colorBgContainer, display: 'flex', flexDirection: 'column' }}
    >
      {/* ── URL Bar ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <Select
          value={sourceMethod}
          onChange={handleMethodChange}
          options={METHOD_OPTIONS}
          style={{ width: 100 }}
          size="middle"
          variant="borderless"
          popupMatchSelectWidth={false}
          labelRender={({ label }) => (
            <span style={{ fontWeight: 700, fontSize: 13, color: methodColor }}>{label}</span>
          )}
        />
        <TemplateInput
          value={sourcePath}
          onChange={handleUrlChange}
          placeholder="Enter request URL"
          envVars={activeEnvVars}
          activeEnvironment={activeEnvironment}
          borderless
          fontSize={13}
          mono
          onPressEnter={handleSend}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={source.refreshStatus?.isRefreshing}
          style={{ borderRadius: 6 }}
        >
          Send
        </Button>
        <Tooltip title="Delete source">
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => void removeSource(sourceId)}
            style={{ marginLeft: 8 }}
          />
        </Tooltip>
      </div>

      {/* ── Request Tabs ─────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Tabs
          size="small"
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={requestTabs}
        />

        <div style={{ padding: '0 16px 16px' }}>
          {/* Params tab */}
          {activeTab === 'params' && (
            <KeyValueTable
              rows={params}
              onChange={handleParamsChange}
              keyPlaceholder="Parameter name"
              valuePlaceholder="Value"
              envVars={activeEnvVars}
              activeEnvironment={activeEnvironment}
            />
          )}

          {/* Headers tab */}
          {activeTab === 'headers' && (
            <KeyValueTable
              rows={headers}
              onChange={handleHeadersChange}
              keyPlaceholder="Header name"
              valuePlaceholder="Value"
              envVars={activeEnvVars}
              activeEnvironment={activeEnvironment}
            />
          )}

          {/* Body tab */}
          {activeTab === 'body' && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <Select
                  size="small"
                  value={contentType}
                  onChange={handleContentTypeChange}
                  style={{ width: 200 }}
                  options={[
                    { value: 'application/json', label: 'JSON' },
                    { value: 'application/x-www-form-urlencoded', label: 'Form URL Encoded' },
                    { value: 'text/plain', label: 'Plain Text' },
                    { value: 'application/xml', label: 'XML' },
                  ]}
                />
              </div>
              <TextArea
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder={contentType === 'application/json' ? '{\n  "key": "value"\n}' : 'key1=value1&key2=value2'}
                autoSize={{ minRows: 6, maxRows: 16 }}
                style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 12,
                }}
              />
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: 500 }}>
              <div className="v5-editor-field" style={{ marginBottom: 10 }}>
                <Text className="v5-editor-label" style={{ width: 100 }}>
                  Name
                </Text>
                <Input
                  size="small"
                  value={sourceName}
                  onChange={(e) => {
                    setSourceName(e.target.value);
                    scheduleUpdate({ sourceName: e.target.value });
                  }}
                  placeholder="Display name"
                  style={{ maxWidth: 280 }}
                />
              </div>

              <div className="v5-editor-field" style={{ marginBottom: 10 }}>
                <Text className="v5-editor-label" style={{ width: 100 }}>
                  Tag
                </Text>
                <Input
                  size="small"
                  value={sourceTag}
                  onChange={(e) => {
                    setSourceTag(e.target.value);
                    scheduleUpdate({ sourceTag: e.target.value });
                  }}
                  placeholder="Collection tag"
                  style={{ maxWidth: 200 }}
                />
              </div>

              <div className="v5-editor-field" style={{ marginBottom: 10 }}>
                <Text className="v5-editor-label" style={{ width: 100 }}>
                  JSON filter
                </Text>
                <Space size={8}>
                  <Switch
                    size="small"
                    checked={jsonFilterEnabled}
                    onChange={(v) => {
                      setJsonFilterEnabled(v);
                      scheduleUpdate({ jsonFilter: { enabled: v, path: jsonFilterPath } });
                    }}
                  />
                  {jsonFilterEnabled && (
                    <Input
                      size="small"
                      value={jsonFilterPath}
                      onChange={(e) => {
                        setJsonFilterPath(e.target.value);
                        scheduleUpdate({ jsonFilter: { enabled: true, path: e.target.value } });
                      }}
                      placeholder="e.g. data.access_token"
                      style={{ width: 200 }}
                    />
                  )}
                </Space>
              </div>

              <div className="v5-editor-field" style={{ marginBottom: 10 }}>
                <Text className="v5-editor-label" style={{ width: 100 }}>
                  Auto-refresh
                </Text>
                <Space size={8}>
                  <Switch
                    size="small"
                    checked={refreshEnabled}
                    onChange={(v) => {
                      setRefreshEnabled(v);
                      scheduleUpdate({
                        refreshOptions: { enabled: v, type: 'custom', interval: refreshInterval },
                      });
                    }}
                  />
                  {refreshEnabled && (
                    <>
                      <InputNumber
                        size="small"
                        min={1}
                        max={10080}
                        value={refreshInterval}
                        onChange={(v) => {
                          const mins = v ?? 5;
                          setRefreshInterval(mins);
                          scheduleUpdate({ refreshOptions: { enabled: true, type: 'custom', interval: mins } });
                        }}
                        style={{ width: 70 }}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        min
                      </Text>
                    </>
                  )}
                </Space>
              </div>
            </div>
          )}
        </div>

        {/* ── Response ────────────────────────────────────── */}
        {isHttp && <ResponsePane source={source} />}
      </div>
    </div>
  );
}
