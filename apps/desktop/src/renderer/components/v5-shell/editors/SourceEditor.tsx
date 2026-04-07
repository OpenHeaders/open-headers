/**
 * SourceEditor — request editor rendered in an editor tab.
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
  ReloadOutlined,
  SendOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { Source, SourceHeader, SourceQueryParam } from '@openheaders/core';
import { Allotment } from 'allotment';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEnvironments, useSources } from '@/renderer/hooks/useCentralizedWorkspace';
import { extractSourceVariables, useEditorVariables } from '../contexts/EditorVariablesContext';
import { SimpleTabs } from '../SimpleTabs';
import { TemplateInput } from './TemplateInput';

const { Text } = Typography;
const { TextArea } = Input;

interface SourceEditorProps {
  sourceId?: string;
  draftData?: Record<string, unknown>;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLabelChange?: (label: string | null) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  responseSideBySide?: boolean;
  onSaveDraft?: (data: Record<string, unknown>) => void;
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
  totpCode,
  totpReady,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  envVars?: Record<string, { value: string; isSensitive: boolean }>;
  activeEnvironment?: string | null;
  totpCode?: string;
  totpReady?: boolean;
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
              totpCode={totpCode}
              totpReady={totpReady}
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

function ResponsePane({
  source,
  sideBySide,
  responseTab,
  onResponseTabChange,
}: {
  source: Source;
  sideBySide?: boolean;
  responseTab: string;
  onResponseTabChange: (tab: string) => void;
}) {
  const { token } = theme.useToken();
  const content = source.sourceContent;
  const originalResponse = source.originalResponse;
  const responseHeaders = source.responseHeaders;
  const isRefreshing = source.refreshStatus?.isRefreshing;
  const lastRefresh = source.refreshStatus?.lastRefresh;
  const hasError = source.refreshStatus?.error;
  const wasSuccess = source.refreshStatus?.success;

  // Derive HTTP status from response headers (stored by the execution pipeline)
  const statusCode = responseHeaders?.['x-oh-status-code'];
  const statusNum = statusCode ? Number.parseInt(statusCode, 10) : null;

  const statusColor = statusNum ? (statusNum < 300 ? '#49cc90' : statusNum < 400 ? '#fca130' : '#f93e3e') : undefined;

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderTop: sideBySide ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        borderLeft: sideBySide ? `1px solid ${token.colorBorderSecondary}` : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: token.colorBgElevated,
          flexShrink: 0,
        }}
      >
        <Space size={12}>
          <Text strong style={{ fontSize: 12 }}>
            Response
          </Text>
          {isRefreshing && (
            <Text style={{ fontSize: 11, color: token.colorPrimary }}>
              <SyncOutlined spin /> Sending...
            </Text>
          )}
          {!isRefreshing && hasError && (
            <Text style={{ fontSize: 11, color: token.colorError }}>
              <CloseCircleOutlined /> {hasError}
            </Text>
          )}
          {!isRefreshing && wasSuccess && !hasError && (
            <Text style={{ fontSize: 11, color: token.colorSuccess }}>
              <CheckCircleOutlined /> OK
            </Text>
          )}
        </Space>
        {lastRefresh && !isRefreshing && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            {new Date(lastRefresh).toLocaleString()}
          </Text>
        )}
      </div>

      <SimpleTabs
        items={[
          { key: 'body', label: 'Body' },
          { key: 'raw', label: 'Raw' },
          ...(responseHeaders ? [{ key: 'headers', label: `Headers (${Object.keys(responseHeaders).length})` }] : []),
        ]}
        activeKey={responseTab}
        onChange={onResponseTabChange}
        style={{ padding: '0 12px', flexShrink: 0 }}
      />

      <div
        style={{
          padding: '8px 12px',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 11,
          lineHeight: 1.6,
          overflow: 'auto',
          flex: 1,
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

// ── Body tab ─────────────────────────────────────────────────────

function BodyTab({
  body,
  contentType,
  onBodyChange,
  onContentTypeChange,
  envVars,
  activeEnvironment,
  totpCode,
  totpReady,
}: {
  body: string;
  contentType: string;
  onBodyChange: (val: string) => void;
  onContentTypeChange: (val: string) => void;
  envVars: Record<string, { value: string; isSensitive: boolean }>;
  activeEnvironment: string | null;
  totpCode?: string;
  totpReady?: boolean;
}) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Select
          size="small"
          value={contentType}
          onChange={onContentTypeChange}
          style={{ width: 200 }}
          options={[
            { value: 'application/json', label: 'JSON' },
            { value: 'application/x-www-form-urlencoded', label: 'Form URL Encoded' },
            { value: 'text/plain', label: 'Plain Text' },
            { value: 'application/xml', label: 'XML' },
          ]}
        />
      </div>
      <TemplateInput
        value={body}
        onChange={onBodyChange}
        placeholder={contentType === 'application/json' ? '{\n  "key": "value"\n}' : 'key1=value1&key2=value2'}
        envVars={envVars}
        activeEnvironment={activeEnvironment}
        totpCode={totpCode}
        totpReady={totpReady}
        mono
        fontSize={12}
        multiline
        minRows={6}
        style={{ border: '1px solid var(--ant-color-border, #d9d9d9)', borderRadius: 6 }}
      />
    </div>
  );
}

// ── Automation status strip ──────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCountdown(nextRefresh: number | null | undefined): string {
  if (!nextRefresh) return '';
  const seconds = Math.max(0, Math.floor((nextRefresh - Date.now()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function AutomationStrip({
  source,
  storeAsVariable,
  formRefreshEnabled,
  formRefreshInterval,
  onRefresh,
}: {
  source: Source;
  storeAsVariable: string;
  /** Whether auto-refresh is enabled in the unsaved form state. */
  formRefreshEnabled: boolean;
  /** Interval in the unsaved form state. */
  formRefreshInterval: number;
  onRefresh: () => void;
}) {
  const { token } = theme.useToken();
  const rs = source.refreshOptions;
  const status = source.refreshStatus;
  const hasActiveAutoRefresh = rs?.enabled && (rs.interval ?? 0) > 0;
  const hasPendingAutoRefresh = formRefreshEnabled && formRefreshInterval > 0 && !hasActiveAutoRefresh;
  const hasOutput = !!storeAsVariable;

  const isRefreshing = status?.isRefreshing;
  const failureCount = status?.failureCount ?? 0;
  const hasError = status?.error;
  const lastRefresh = status?.lastRefresh ?? rs?.lastRefresh;

  // Force re-render every second for live countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!hasActiveAutoRefresh && !failureCount) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasActiveAutoRefresh, failureCount]);

  // Don't render if no automation is configured (neither active, pending, nor output)
  if (!hasActiveAutoRefresh && !hasPendingAutoRefresh && !hasOutput) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '4px 16px',
        fontSize: 11,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: failureCount > 0 ? token.colorErrorBg : token.colorBgElevated,
        flexShrink: 0,
        minHeight: 28,
      }}
    >
      {/* Pending activation (configured in form but not yet saved) */}
      {hasPendingAutoRefresh && (
        <span style={{ color: '#7c3aed' }}>
          <SyncOutlined style={{ marginRight: 4 }} />
          Every {formRefreshInterval}m — will activate on save
        </span>
      )}

      {/* Active schedule info */}
      {hasActiveAutoRefresh && !failureCount && !isRefreshing && (
        <span style={{ color: token.colorTextSecondary }}>
          <SyncOutlined style={{ marginRight: 4 }} />
          Every {rs!.interval}m
        </span>
      )}

      {/* Refreshing */}
      {isRefreshing && (
        <span style={{ color: token.colorPrimary }}>
          <SyncOutlined spin style={{ marginRight: 4 }} />
          Fetching...
        </span>
      )}

      {/* Failure state */}
      {!isRefreshing && failureCount > 0 && (
        <span style={{ color: token.colorError }}>
          <WarningOutlined style={{ marginRight: 4 }} />
          Failed {failureCount}x{rs?.nextRefresh ? ` \u2014 retry in ${formatCountdown(rs.nextRefresh)}` : ''}
        </span>
      )}

      {/* Error message */}
      {!isRefreshing && hasError && (
        <span
          style={{
            color: token.colorTextTertiary,
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hasError}
        </span>
      )}

      {/* Last refresh */}
      {!isRefreshing && !failureCount && lastRefresh && (
        <span style={{ color: token.colorTextTertiary }}>
          Last: {formatTimeAgo(typeof lastRefresh === 'number' ? lastRefresh : Number(lastRefresh))}
        </span>
      )}

      {/* Next refresh */}
      {!isRefreshing && !failureCount && hasActiveAutoRefresh && rs?.nextRefresh && (
        <span style={{ color: token.colorTextTertiary }}>Next: {formatCountdown(rs.nextRefresh)}</span>
      )}

      {/* Separator + output variable */}
      {hasOutput && (
        <>
          <span style={{ color: token.colorBorderSecondary }}>|</span>
          <span style={{ color: token.colorTextSecondary, fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
            {`→ {{${storeAsVariable}}}`}
            {source.sourceContent ? (
              <span style={{ color: token.colorSuccess, marginLeft: 4 }}>
                <CheckCircleOutlined />
              </span>
            ) : (
              <span style={{ color: token.colorTextTertiary, marginLeft: 4 }}>(empty)</span>
            )}
          </span>
        </>
      )}

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Manual refresh button */}
      <Tooltip title={failureCount > 0 ? 'Force retry' : 'Refresh now'}>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={isRefreshing}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        >
          {failureCount > 0 ? 'Retry' : 'Refresh'}
        </Button>
      </Tooltip>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

// Convert KVRows back to source format (only enabled rows with keys)
const kvToHeaders = (rows: KVRow[]): SourceHeader[] =>
  rows.filter((r) => r.key && r.enabled).map((r) => ({ key: r.key, value: r.value }));

const kvToParams = (rows: KVRow[]): SourceQueryParam[] =>
  rows.filter((r) => r.key && r.enabled).map((r) => ({ key: r.key, value: r.value }));

export function SourceEditor({
  sourceId,
  draftData,
  onDirtyChange,
  onSaveLabelChange,
  saveRef,
  responseSideBySide,
  onSaveDraft,
}: SourceEditorProps) {
  const { token } = theme.useToken();
  const { sources, updateSource, removeSource, refreshSource } = useSources();
  const { environments, activeEnvironment } = useEnvironments();
  const isDraft = !!draftData && !sourceId;
  const source = isDraft ? undefined : sources.find((s) => s.sourceId === sourceId);
  const activeEnv = activeEnvironment ? environments.find((e) => e.id === activeEnvironment) : undefined;
  const activeEnvVars = activeEnv?.variables ?? {};
  const { setUsedVariables, clearVariables } = useEditorVariables();

  // Local form state
  const [sourcePath, setSourcePath] = useState('');
  const [sourceMethod, setSourceMethod] = useState('GET');
  const [activeTab, setActiveTab] = useState('params');
  const [responseTab, setResponseTab] = useState('body');

  // Remember Allotment sizes per orientation so toggling preserves the split position
  const splitSizesRef = useRef<{ v?: number[]; h?: number[] }>({});
  const handleSplitChange = useCallback(
    (sizes: number[]) => {
      splitSizesRef.current[responseSideBySide ? 'h' : 'v'] = sizes;
    },
    [responseSideBySide],
  );

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
  const [storeAsVariable, setStoreAsVariable] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpTimeRemaining, setTotpTimeRemaining] = useState(30);
  const [totpTesting, setTotpTesting] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // TOTP countdown timer — ticks every second when a code is displayed
  useEffect(() => {
    if (!totpCode || totpError) return;
    const id = setInterval(() => {
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
      setTotpTimeRemaining(remaining);
      // Auto-regenerate when timer resets
      if (remaining === 30 && totpSecret) {
        window.electronAPI.httpRequest
          .generateTotpPreview(totpSecret)
          .then(setTotpCode)
          .catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
  }, [totpCode, totpError, totpSecret]);

  const initializedId = useRef<string | null>(null);
  const snapshotRef = useRef('');

  // Build a fingerprint of the current form state for dirty comparison
  const buildFingerprint = useCallback(() => {
    return JSON.stringify({
      sourcePath,
      sourceMethod,
      sourceName,
      sourceTag,
      params: params.filter((r) => r.key),
      headers: headers.filter((r) => r.key),
      body,
      contentType,
      jsonFilterEnabled,
      jsonFilterPath,
      refreshEnabled,
      refreshInterval,
      storeAsVariable,
      totpEnabled,
      totpSecret,
    });
  }, [
    sourcePath,
    sourceMethod,
    sourceName,
    sourceTag,
    params,
    headers,
    body,
    contentType,
    jsonFilterEnabled,
    jsonFilterPath,
    refreshEnabled,
    refreshInterval,
    storeAsVariable,
    totpEnabled,
    totpSecret,
  ]);

  // Initialize from draft data
  const draftInitialized = useRef(false);
  useEffect(() => {
    if (isDraft && draftData && !draftInitialized.current) {
      draftInitialized.current = true;
      const path = (draftData.sourcePath as string) || '';
      const method = (draftData.sourceMethod as string) || 'GET';
      const name = (draftData.sourceName as string) || '';
      setSourcePath(path);
      setSourceMethod(method);
      setSourceName(name);
      snapshotRef.current = JSON.stringify({
        sourcePath: path,
        sourceMethod: method,
        sourceName: name,
        sourceTag: '',
        params: [],
        headers: [],
        body: '',
        contentType: 'application/json',
        jsonFilterEnabled: false,
        jsonFilterPath: '',
        refreshEnabled: false,
        refreshInterval: 5,
        storeAsVariable: '',
        totpEnabled: false,
        totpSecret: '',
      });
    }
  }, [isDraft, draftData]);

  // Initialize from source
  useEffect(() => {
    if (source && initializedId.current !== source.sourceId) {
      initializedId.current = source.sourceId;
      const path = source.sourcePath || '';
      const method = source.sourceMethod || 'GET';
      const name = source.sourceName || '';
      const tag = source.sourceTag || '';
      const b = source.requestOptions?.body || '';
      const ct = source.requestOptions?.contentType || 'application/json';
      const jfe = source.jsonFilter?.enabled ?? false;
      const jfp = source.jsonFilter?.path ?? '';
      const re = source.refreshOptions?.enabled ?? false;
      const ri = source.refreshOptions?.interval ?? 5;
      const sav = source.storeAsVariable || '';
      const te = !!source.requestOptions?.totpSecret;
      const ts = source.requestOptions?.totpSecret || '';
      const p = (source.requestOptions?.queryParams || []).map((q: SourceQueryParam) => ({
        key: q.key,
        value: q.value,
        enabled: true,
      }));
      const h = (source.requestOptions?.headers || []).map((hdr: SourceHeader) => ({
        key: hdr.key,
        value: hdr.value,
        enabled: true,
      }));

      setSourcePath(path);
      setSourceMethod(method);
      setSourceName(name);
      setSourceTag(tag);
      setBody(b);
      setContentType(ct);
      setJsonFilterEnabled(jfe);
      setJsonFilterPath(jfp);
      setRefreshEnabled(re);
      setRefreshInterval(ri);
      setStoreAsVariable(sav);
      setTotpEnabled(te);
      setTotpSecret(ts);
      setParams(p);
      setHeaders(h);

      // Store snapshot for dirty comparison
      snapshotRef.current = JSON.stringify({
        sourcePath: path,
        sourceMethod: method,
        sourceName: name,
        sourceTag: tag,
        params: p.filter((r: KVRow) => r.key),
        headers: h.filter((r: KVRow) => r.key),
        body: b,
        contentType: ct,
        jsonFilterEnabled: jfe,
        jsonFilterPath: jfp,
        refreshEnabled: re,
        refreshInterval: ri,
        storeAsVariable: sav,
        totpEnabled: te,
        totpSecret: ts,
      });
    }
  }, [source]);

  const [isDirty, setIsDirty] = useState(false);

  // Publish used variables to context for the Inspector panel
  useEffect(() => {
    const vars = extractSourceVariables({
      url: sourcePath,
      params: params.filter((r) => r.key).map((r) => ({ key: r.key, value: r.value })),
      headers: headers.filter((r) => r.key).map((r) => ({ key: r.key, value: r.value })),
      body,
    });
    setUsedVariables(vars);
    return () => clearVariables();
  }, [sourcePath, params, headers, body, setUsedVariables, clearVariables]);

  // Smart dirty detection — compare current state against snapshot
  const currentFingerprint = buildFingerprint();
  const isActuallyDirty = snapshotRef.current !== '' && currentFingerprint !== snapshotRef.current;

  useEffect(() => {
    if (isActuallyDirty !== isDirty) {
      setIsDirty(isActuallyDirty);
    }
    // Always report — not just on change — so the parent gets the correct state
    // when this editor becomes active (onDirtyChange transitions from undefined to a function)
    onDirtyChange?.(isActuallyDirty);
  }, [isActuallyDirty, isDirty, onDirtyChange]);

  // Update save button label when auto-refresh is being activated
  useEffect(() => {
    const sourceHasAutoRefresh = source?.refreshOptions?.enabled && (source.refreshOptions.interval ?? 0) > 0;
    const formHasAutoRefresh = refreshEnabled && refreshInterval > 0;
    // Show "Save & Activate" when form enables auto-refresh that isn't currently active
    if (formHasAutoRefresh && !sourceHasAutoRefresh) {
      onSaveLabelChange?.('Save & Activate');
    } else {
      onSaveLabelChange?.(null);
    }
  }, [
    refreshEnabled,
    refreshInterval,
    source?.refreshOptions?.enabled,
    source?.refreshOptions?.interval,
    onSaveLabelChange,
  ]);

  // Clean up save label on unmount
  useEffect(() => {
    return () => onSaveLabelChange?.(null);
  }, [onSaveLabelChange]);

  // Explicit save — persists all local state to main process (or triggers draft save)
  const handleSave = useCallback(() => {
    if (isDraft && onSaveDraft) {
      onSaveDraft({
        sourceName: sourceName || 'New Request',
        sourceMethod,
        sourcePath,
        sourceType: 'http',
        sourceContent: null,
        requestOptions: {
          headers: kvToHeaders(headers),
          queryParams: kvToParams(params),
          body,
          contentType,
          totpSecret: totpEnabled ? totpSecret : undefined,
        },
        jsonFilter: { enabled: jsonFilterEnabled, path: jsonFilterPath },
        refreshOptions: { enabled: refreshEnabled, type: 'custom', interval: refreshInterval },
        storeAsVariable: storeAsVariable || undefined,
      });
      return;
    }
    if (!sourceId) return;
    void updateSource(sourceId, {
      sourcePath,
      sourceName,
      sourceTag,
      sourceMethod: sourceMethod as Source['sourceMethod'],
      requestOptions: {
        headers: kvToHeaders(headers),
        queryParams: kvToParams(params),
        body,
        contentType,
        totpSecret: totpEnabled ? totpSecret : undefined,
      },
      jsonFilter: { enabled: jsonFilterEnabled, path: jsonFilterPath },
      refreshOptions: { enabled: refreshEnabled, type: 'custom', interval: refreshInterval },
      storeAsVariable: storeAsVariable || undefined,
    }).then(() => {
      // Reset snapshot to current state
      snapshotRef.current = currentFingerprint;
      setIsDirty(false);
      onDirtyChange?.(false);
    });
  }, [
    isDraft,
    onSaveDraft,
    sourceId,
    sourcePath,
    sourceName,
    sourceTag,
    sourceMethod,
    headers,
    currentFingerprint,
    params,
    body,
    contentType,
    jsonFilterEnabled,
    jsonFilterPath,
    refreshEnabled,
    refreshInterval,
    storeAsVariable,
    totpEnabled,
    totpSecret,
    updateSource,
    onDirtyChange,
  ]);

  // Expose save function to parent via ref
  useEffect(() => {
    if (saveRef) saveRef.current = handleSave;
  }, [saveRef, handleSave]);

  // Field handlers — update local state only, mark dirty
  const handleUrlChange = (val: string) => {
    setSourcePath(val);
  };
  const handleMethodChange = (val: string) => {
    setSourceMethod(val);
  };
  const handleParamsChange = (rows: KVRow[]) => {
    setParams(rows);
  };
  const handleHeadersChange = (rows: KVRow[]) => {
    setHeaders(rows);
  };
  const handleBodyChange = (val: string) => {
    setBody(val);
  };
  const handleContentTypeChange = (val: string) => {
    setContentType(val);
  };

  const handleSend = () => {
    if (isDraft) {
      // For drafts, we can't persist — but we could still fire the request
      // For now, prompt user to save first
      return;
    }
    // Save ALL fields then execute
    if (!sourceId) return;
    void updateSource(sourceId, {
      sourcePath,
      sourceName,
      sourceTag,
      sourceMethod: sourceMethod as Source['sourceMethod'],
      requestOptions: {
        headers: kvToHeaders(headers),
        queryParams: kvToParams(params),
        body,
        contentType,
        totpSecret: totpEnabled ? totpSecret : undefined,
      },
      jsonFilter: { enabled: jsonFilterEnabled, path: jsonFilterPath },
      refreshOptions: { enabled: refreshEnabled, type: 'custom', interval: refreshInterval },
      storeAsVariable: storeAsVariable || undefined,
    }).then(() => {
      snapshotRef.current = buildFingerprint();
      setIsDirty(false);
      onDirtyChange?.(false);
      void refreshSource(sourceId);
    });
  };

  if (!source && !isDraft) {
    return (
      <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
        <Text type="secondary">Source not found. It may have been deleted.</Text>
      </div>
    );
  }

  const methodColor = METHOD_COLORS[sourceMethod] || '#999';
  const isHttp = isDraft || source?.sourceType === 'http';

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
          totpCode={totpCode}
          totpReady={totpEnabled && !!totpSecret}
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
          loading={source?.refreshStatus?.isRefreshing}
          disabled={isDraft}
          style={{ borderRadius: 6 }}
        >
          Send
        </Button>
        {!isDraft && sourceId && (
          <Tooltip title="Delete source">
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => void removeSource(sourceId)}
              style={{ marginLeft: 8 }}
            />
          </Tooltip>
        )}
      </div>

      {/* ── Automation status strip ────────────────────── */}
      {source && sourceId && (
        <AutomationStrip
          source={source}
          storeAsVariable={storeAsVariable}
          formRefreshEnabled={refreshEnabled}
          formRefreshInterval={refreshInterval}
          onRefresh={() => void refreshSource(sourceId)}
        />
      )}

      {/* ── Request + Response split ────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Allotment
          key={responseSideBySide ? 'h' : 'v'}
          vertical={!responseSideBySide}
          proportionalLayout={false}
          defaultSizes={splitSizesRef.current[responseSideBySide ? 'h' : 'v']}
          onChange={handleSplitChange}
        >
          {/* Request pane */}
          <Allotment.Pane minSize={120}>
            <div style={{ height: '100%', overflow: 'auto' }}>
              <SimpleTabs
                items={requestTabs}
                activeKey={activeTab}
                onChange={setActiveTab}
                style={{ padding: '0 16px' }}
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
                    totpCode={totpCode}
                    totpReady={totpEnabled && !!totpSecret}
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
                    totpCode={totpCode}
                    totpReady={totpEnabled && !!totpSecret}
                  />
                )}

                {/* Body tab */}
                {activeTab === 'body' && (
                  <BodyTab
                    body={body}
                    contentType={contentType}
                    onBodyChange={handleBodyChange}
                    onContentTypeChange={handleContentTypeChange}
                    envVars={activeEnvVars}
                    activeEnvironment={activeEnvironment}
                    totpCode={totpCode}
                    totpReady={totpEnabled && !!totpSecret}
                  />
                )}

                {/* Settings tab */}
                {activeTab === 'settings' && (
                  <div style={{ padding: '4px 0' }}>
                    <Row gutter={12}>
                      <Col span={12}>
                        {/* ── Response Extraction ────────────── */}
                        <Card
                          size="small"
                          title="Response Extraction"
                          extra={<Switch size="small" checked={jsonFilterEnabled} onChange={setJsonFilterEnabled} />}
                          style={{ marginBottom: 12 }}
                        >
                          {jsonFilterEnabled ? (
                            <>
                              <div className="v5-editor-field" style={{ marginBottom: 8 }}>
                                <Text className="v5-editor-label" style={{ width: 80 }}>
                                  JSON path
                                </Text>
                                <Input
                                  size="small"
                                  value={jsonFilterPath}
                                  onChange={(e) => setJsonFilterPath(e.target.value)}
                                  placeholder="e.g. data.access_token"
                                  style={{ flex: 1 }}
                                />
                              </div>
                              <div className="v5-editor-field">
                                <Text className="v5-editor-label" style={{ width: 80 }}>
                                  Store as
                                </Text>
                                <Space size={8}>
                                  <Input
                                    size="small"
                                    value={storeAsVariable}
                                    onChange={(e) =>
                                      setStoreAsVariable(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                                    }
                                    placeholder="e.g. AUTH_TOKEN"
                                    style={{
                                      width: 160,
                                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                                      fontSize: 12,
                                    }}
                                  />
                                  {storeAsVariable && (
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      {`→ {{${storeAsVariable}}}`}
                                    </Text>
                                  )}
                                </Space>
                              </div>
                            </>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Enable to extract a value from the response and optionally store it as a variable.
                            </Text>
                          )}
                        </Card>

                        {/* ── TOTP Authentication ────────────── */}
                        <Card
                          size="small"
                          title="TOTP Authentication"
                          extra={
                            <Switch
                              size="small"
                              checked={totpEnabled}
                              checkedChildren="On"
                              unCheckedChildren="Off"
                              onChange={(v) => {
                                setTotpEnabled(v);
                                if (!v) {
                                  setTotpCode('');
                                  setTotpError(null);
                                }
                              }}
                            />
                          }
                          style={{ marginBottom: 12 }}
                        >
                          {totpEnabled ? (
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space.Compact style={{ width: '100%' }}>
                                <Input.Password
                                  size="small"
                                  value={totpSecret}
                                  onChange={(e) => {
                                    setTotpSecret(e.target.value);
                                    setTotpError(null);
                                  }}
                                  placeholder="Enter TOTP secret key"
                                  style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                                />
                                <Button
                                  size="small"
                                  onClick={async () => {
                                    if (!totpSecret) {
                                      setTotpError('Enter a TOTP secret first');
                                      return;
                                    }
                                    setTotpTesting(true);
                                    setTotpError(null);
                                    try {
                                      const code = await window.electronAPI.httpRequest.generateTotpPreview(totpSecret);
                                      setTotpCode(code);
                                      setTotpTimeRemaining(30 - (Math.floor(Date.now() / 1000) % 30));
                                    } catch (err) {
                                      setTotpError(err instanceof Error ? err.message : String(err));
                                      setTotpCode('');
                                    } finally {
                                      setTotpTesting(false);
                                    }
                                  }}
                                  loading={totpTesting}
                                >
                                  Test
                                </Button>
                              </Space.Compact>
                              {totpError && (
                                <Text type="danger" style={{ fontSize: 11 }}>
                                  {totpError}
                                </Text>
                              )}
                              {totpCode && !totpError && (
                                <Card size="small" style={{ textAlign: 'center' }}>
                                  <Text
                                    strong
                                    copyable
                                    style={{ fontSize: 24, fontFamily: "'SF Mono', monospace", letterSpacing: 6 }}
                                  >
                                    {totpCode}
                                  </Text>
                                  <div style={{ marginTop: 4 }}>
                                    <Text
                                      strong
                                      type={totpTimeRemaining <= 5 ? 'danger' : 'success'}
                                      style={{ fontSize: 13 }}
                                    >
                                      {totpTimeRemaining}s
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                                      remaining
                                    </Text>
                                  </div>
                                  <Progress
                                    percent={(totpTimeRemaining / 30) * 100}
                                    showInfo={false}
                                    status={totpTimeRemaining <= 5 ? 'exception' : 'success'}
                                    size="small"
                                    style={{ marginTop: 4 }}
                                  />
                                </Card>
                              )}
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Use{' '}
                                <Text code style={{ fontSize: 11 }}>
                                  [[TOTP_CODE]]
                                </Text>{' '}
                                placeholder in URL, headers, params, or body
                              </Text>
                            </Space>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Enable to auto-generate TOTP codes from a secret key.
                            </Text>
                          )}
                        </Card>
                      </Col>

                      <Col span={12}>
                        {/* ── General ────────────────────────── */}
                        <Card size="small" title="General" style={{ marginBottom: 12 }}>
                          <div className="v5-editor-field" style={{ marginBottom: 10 }}>
                            <Text className="v5-editor-label" style={{ width: 60 }}>
                              Name
                            </Text>
                            <Input
                              size="small"
                              value={sourceName}
                              onChange={(e) => setSourceName(e.target.value)}
                              placeholder="Display name"
                              style={{ flex: 1 }}
                            />
                          </div>
                          <div className="v5-editor-field">
                            <Text className="v5-editor-label" style={{ width: 60 }}>
                              Tag
                            </Text>
                            <Input
                              size="small"
                              value={sourceTag}
                              onChange={(e) => setSourceTag(e.target.value)}
                              placeholder="Collection tag"
                              style={{ flex: 1 }}
                            />
                          </div>
                        </Card>

                        {/* ── Auto-Refresh ───────────────────── */}
                        <Card
                          size="small"
                          title="Auto-Refresh"
                          extra={<Switch size="small" checked={refreshEnabled} onChange={setRefreshEnabled} />}
                          style={{ marginBottom: 12 }}
                        >
                          {refreshEnabled ? (
                            <div className="v5-editor-field">
                              <Text className="v5-editor-label" style={{ width: 60 }}>
                                Interval
                              </Text>
                              <Space size={8}>
                                <InputNumber
                                  size="small"
                                  min={1}
                                  max={10080}
                                  value={refreshInterval}
                                  onChange={(v) => setRefreshInterval(v ?? 5)}
                                  style={{ width: 80 }}
                                />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  minutes
                                </Text>
                              </Space>
                            </div>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Enable to automatically re-execute this request on a schedule.
                            </Text>
                          )}
                        </Card>
                      </Col>
                    </Row>
                  </div>
                )}
              </div>
            </div>
          </Allotment.Pane>

          {/* Response pane */}
          {isHttp && source && (
            <Allotment.Pane minSize={60}>
              <div style={{ height: '100%', overflow: 'auto' }}>
                <ResponsePane
                  source={source}
                  sideBySide={responseSideBySide}
                  responseTab={responseTab}
                  onResponseTabChange={setResponseTab}
                />
              </div>
            </Allotment.Pane>
          )}
        </Allotment>
      </div>
    </div>
  );
}
