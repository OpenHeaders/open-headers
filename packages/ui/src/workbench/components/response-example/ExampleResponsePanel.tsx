/**
 * ExampleResponsePanel — the response half of the example editor's
 * split. Mirrors the live ResponsePanel's shell (one tab-bar row: Body ·
 * Headers tabs left, meta + layout toggle right) with the meta made
 * editable: status code, status text, and final URL are inputs; size ·
 * duration stay read-only facts (size recomputes from the edited body
 * at save; duration is the captured measurement).
 */

import type { CapturedResponse } from '@openheaders/core/types';
import { Input, InputNumber, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { SplitLayoutToggle } from '@openheaders/ui/shared/split-layout';
import KeyValueTable from '../request-editor/KeyValueTable';
import { detectBodyLanguage, formatBytes } from '../request-editor/response/response-format';
import type { RequestEditorLayout } from '../request-editor/useRequestEditorLayout';
import CodeEditor from '../shared/CodeEditor';
import type { ExampleResponseDraft } from './example-draft';

const { Text } = Typography;

const monoFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

interface ExampleResponsePanelProps {
  value: ExampleResponseDraft;
  onChange: (next: ExampleResponseDraft) => void;
  /** Captured meta shown read-only beside the editable status fields. */
  meta: Pick<CapturedResponse, 'bodyBytes' | 'durationMs'>;
  capturedAt: string;
  layout: RequestEditorLayout;
  onLayoutChange: (next: RequestEditorLayout) => void;
}

const ExampleResponsePanel: React.FC<ExampleResponsePanelProps> = ({
  value,
  onChange,
  meta,
  capturedAt,
  layout,
  onLayoutChange,
}) => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const patch = (p: Partial<ExampleResponseDraft>) => onChange({ ...value, ...p });

  const statusColor =
    value.status >= 500
      ? token.colorError
      : value.status >= 400
        ? token.colorWarning
        : value.status >= 200 && value.status < 300
          ? token.colorSuccess
          : token.colorTextSecondary;

  const headerRows = value.headers.filter((r) => r.key.trim()).map((r) => ({ key: r.key, value: r.value }));
  const capturedAtDate = new Date(capturedAt);

  return (
    <div
      className="rules-thin-scrollbar"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: token.colorBgContainer,
      }}
    >
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'body' | 'headers')}
        className="rules-response-tabs"
        style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarExtraContent={{
          right: (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
              <InputNumber
                size="small"
                min={0}
                max={999}
                value={value.status}
                onChange={(status) => patch({ status: status ?? 0 })}
                style={{ width: 72, color: statusColor }}
                aria-label="Status code"
              />
              <Input
                size="small"
                value={value.statusText}
                placeholder="Status text"
                onChange={(e) => patch({ statusText: e.target.value })}
                style={{ width: 110 }}
              />
              <Input
                size="small"
                value={value.url}
                placeholder="Final URL"
                onChange={(e) => patch({ url: e.target.value })}
                style={{ ...monoFont, width: 200 }}
              />
              <Tooltip
                title={`Captured ${Number.isNaN(capturedAtDate.getTime()) ? capturedAt : capturedAtDate.toLocaleString()}`}
                placement="bottom"
              >
                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', cursor: 'help' }}>
                  {formatBytes(meta.bodyBytes)} · {meta.durationMs} ms
                </Text>
              </Tooltip>
              <SplitLayoutToggle layout={layout} onChange={onLayoutChange} />
            </div>
          ),
        }}
        items={[
          {
            key: 'body',
            label: 'Body',
            children: (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
                <div style={{ flex: 1, minHeight: 0, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4 }}>
                  <CodeEditor
                    value={value.body}
                    language={detectBodyLanguage(headerRows)}
                    onChange={(body) => patch({ body })}
                    fill
                    variableAutoComplete={false}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'headers',
            label: `Headers (${headerRows.length})`,
            children: (
              <div className="rules-thin-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 0' }}>
                <KeyValueTable
                  rows={value.headers}
                  onChange={(headers) => patch({ headers })}
                  hideEnabled
                  keyPlaceholder="Header"
                  valuePlaceholder="Value"
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default ExampleResponsePanel;
