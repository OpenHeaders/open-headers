/**
 * RequestEditor — V5 HTTP request editor rendered in an editor tab.
 *
 * Replaces the v4 SourceEditor. Displays method, URL, headers, params,
 * body, and auth for a V5.Request. Full request data comes from the
 * CollectionTree (RequestNode only has uid/name/path/method).
 *
 * TODO: Load full V5.Request from main process via IPC when opening a tab.
 * For now, this is a simplified editor that works with RequestNode data + drafts.
 */

import { CaretRightOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Input, Select, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSources } from '@/renderer/hooks/useCentralizedWorkspace';
import { extractSourceVariables, useEditorVariables } from '../contexts/EditorVariablesContext';

const { Text, Title } = Typography;

interface RequestEditorProps {
  sourceId?: string;
  draftData?: Record<string, unknown>;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLabelChange?: (label: string | null) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  responseSideBySide?: boolean;
  onSaveDraft?: (data: Record<string, unknown>) => void;
}

const METHOD_OPTIONS: { value: V5.HttpMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

interface LocalHeader {
  uid: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface LocalParam {
  uid: string;
  key: string;
  value: string;
  enabled: boolean;
}

let _uid = 0;
function genUid(): string {
  return `h${++_uid}`;
}

export function RequestEditor({
  sourceId,
  draftData,
  onDirtyChange,
  onSaveLabelChange,
  saveRef,
  onSaveDraft,
}: RequestEditorProps) {
  const { token } = theme.useToken();
  const { sources } = useSources();

  const isDraft = !!draftData && !sourceId;
  const request = isDraft ? undefined : sources.find((s) => s.uid === sourceId);

  // Local form state
  const [method, setMethod] = useState<V5.HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<LocalHeader[]>([]);
  const [params, setParams] = useState<LocalParam[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const initializedId = useRef<string | null>(null);
  const snapshotRef = useRef('');

  const buildFingerprint = useCallback(() => {
    return JSON.stringify({ method, url, headers, params });
  }, [method, url, headers, params]);

  // Initialize from draft data
  const draftInitialized = useRef(false);
  useEffect(() => {
    if (isDraft && draftData && !draftInitialized.current) {
      draftInitialized.current = true;
      setMethod((draftData.method as V5.HttpMethod) || 'GET');
      setUrl((draftData.url as string) || '');
      setHeaders([{ uid: genUid(), key: '', value: '', enabled: true }]);
      setParams([{ uid: genUid(), key: '', value: '', enabled: true }]);
      snapshotRef.current = JSON.stringify({ method: 'GET', url: '', headers: [], params: [] });
    }
  }, [isDraft, draftData]);

  // Initialize from persisted request (RequestNode only has basic info)
  useEffect(() => {
    if (request && initializedId.current !== request.uid) {
      initializedId.current = request.uid;
      setMethod(request.method || 'GET');
      setUrl(''); // TODO: load full request from main process
      setHeaders([{ uid: genUid(), key: '', value: '', enabled: true }]);
      setParams([{ uid: genUid(), key: '', value: '', enabled: true }]);
      snapshotRef.current = buildFingerprint();
    }
  }, [request, buildFingerprint]);

  // Publish used variables
  const { setUsedVariables, clearVariables } = useEditorVariables();
  useEffect(() => {
    const vars = extractSourceVariables({
      url,
      headers: headers.map((h) => ({ key: h.key, value: h.value })),
      params: params.map((p) => ({ key: p.key, value: p.value })),
      body: '',
    });
    setUsedVariables(vars);
    return () => clearVariables();
  }, [url, headers, setUsedVariables, clearVariables]);

  // Dirty detection
  const currentFingerprint = buildFingerprint();
  const isActuallyDirty = snapshotRef.current !== '' && currentFingerprint !== snapshotRef.current;

  useEffect(() => {
    if (isActuallyDirty !== isDirty) {
      setIsDirty(isActuallyDirty);
    }
  }, [isActuallyDirty, isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSaveLabelChange?.(isDirty ? 'Save' : null);
  }, [isDirty, onSaveLabelChange]);

  // Save handler
  const handleSave = useCallback(() => {
    if (isDraft && onSaveDraft) {
      onSaveDraft({
        name: draftData?.name || 'New Request',
        method,
        url,
      });
      return;
    }
    // TODO: save request via IPC
  }, [isDraft, onSaveDraft, draftData, method, url]);

  useEffect(() => {
    if (saveRef) saveRef.current = handleSave;
  }, [saveRef, handleSave]);

  // Header row management
  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { uid: genUid(), key: '', value: '', enabled: true }]);
  }, []);

  const updateHeader = useCallback((uid: string, field: 'key' | 'value', val: string) => {
    setHeaders((prev) => prev.map((h) => (h.uid === uid ? { ...h, [field]: val } : h)));
  }, []);

  const removeHeader = useCallback((uid: string) => {
    setHeaders((prev) => prev.filter((h) => h.uid !== uid));
  }, []);

  if (!isDraft && !request) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">Request not found.</Text>
      </div>
    );
  }

  const methodColor = METHOD_COLORS[method] || '#999';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* URL bar */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${token.colorBorder}` }}>
        <Select
          value={method}
          onChange={setMethod}
          options={METHOD_OPTIONS}
          size="middle"
          style={{ width: 110 }}
          popupMatchSelectWidth={false}
          labelRender={({ label }) => (
            <span style={{ fontWeight: 700, color: methodColor, fontSize: 12 }}>{label}</span>
          )}
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.openheaders.io/v1/..."
          size="middle"
          style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 13 }}
        />
        <Button type="primary" icon={<CaretRightOutlined />} size="middle">
          Send
        </Button>
      </div>

      {/* Headers section */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12 }}>
            Headers
          </Text>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={addHeader} />
        </div>
        {headers.map((h) => (
          <div key={h.uid} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <Input
              value={h.key}
              onChange={(e) => updateHeader(h.uid, 'key', e.target.value)}
              placeholder="Header name"
              size="small"
              style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 11 }}
            />
            <Input
              value={h.value}
              onChange={(e) => updateHeader(h.uid, 'value', e.target.value)}
              placeholder="Value"
              size="small"
              style={{ flex: 2, fontFamily: "'SF Mono', monospace", fontSize: 11 }}
            />
            <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeHeader(h.uid)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Keep backward-compatible export name for EditorArea
export { RequestEditor as SourceEditor };
