/**
 * CapturedResponseEditor — the response half of the example editor:
 * status line (code + status text + final URL), headers grid, and the
 * body in an editable Monaco surface (language follows the edited
 * Content-Type header). Size/duration meta renders quietly read-only —
 * `bodyBytes` recomputes from the edited body at save time (see the
 * view's save handler), and `durationMs` stays the captured fact.
 */

import type { CapturedResponse } from '@openheaders/core/types';
import { Input, InputNumber, Typography, theme } from 'antd';
import type React from 'react';
import { detectBodyLanguage, formatBytes } from '../request-editor/response/response-format';
import CodeEditor from '../shared/CodeEditor';
import EditableKVGrid, { SectionLabel } from './EditableKVGrid';

const { Text } = Typography;

const monoFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

interface CapturedResponseEditorProps {
  value: CapturedResponse;
  onChange: (next: CapturedResponse) => void;
}

const CapturedResponseEditor: React.FC<CapturedResponseEditorProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const patch = (p: Partial<CapturedResponse>) => onChange({ ...value, ...p });

  const statusColor =
    value.status >= 500
      ? token.colorError
      : value.status >= 400
        ? token.colorWarning
        : value.status >= 200 && value.status < 300
          ? token.colorSuccess
          : token.colorTextSecondary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <InputNumber
          size="small"
          min={0}
          max={999}
          value={value.status}
          onChange={(status) => patch({ status: status ?? 0 })}
          style={{ width: 76, color: statusColor }}
          aria-label="Status code"
        />
        <Input
          size="small"
          value={value.statusText}
          placeholder="Status text"
          onChange={(e) => patch({ statusText: e.target.value })}
          style={{ width: 140 }}
        />
        <Input
          size="small"
          value={value.url}
          placeholder="Final URL"
          onChange={(e) => patch({ url: e.target.value })}
          style={{ ...monoFont, flex: 1, minWidth: 0 }}
        />
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {formatBytes(value.bodyBytes)} · {value.durationMs} ms
        </Text>
      </div>
      <SectionLabel>Headers ({value.headers.length})</SectionLabel>
      {/* Response headers carry no row identity or enabled flag — the
          grid runs untoggleable with bare `{key, value}` rows. */}
      <EditableKVGrid
        rows={value.headers}
        onChange={(headers) => patch({ headers })}
        makeRow={(key, v) => ({ key, value: v })}
        toggleable={false}
        keyPlaceholder="Header"
      />
      <SectionLabel>Body</SectionLabel>
      <div style={{ flex: 1, minHeight: 120, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4 }}>
        <CodeEditor
          value={value.body}
          language={detectBodyLanguage(value.headers)}
          onChange={(body) => patch({ body })}
          fill
          variableAutoComplete={false}
        />
      </div>
      {value.bodyTruncated && (
        <Text type="warning" style={{ fontSize: 11 }}>
          Captured body was truncated at the wire cap; editing it stores exactly what you leave here.
        </Text>
      )}
    </div>
  );
};

export default CapturedResponseEditor;
