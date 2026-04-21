/**
 * ExtractorEditor — small inline editor for a single `V5.Extractor`.
 *
 * Used inside the `LiveWorkflowEditor`'s captures sub-editor and in the
 * LV editor's "Single request" shortcut. Renders the kind-specific
 * fields (json-path path, header name, regex pattern + optional group).
 */

import type { V5 } from '@openheaders/core/types';
import { Input, InputNumber, Select, Space, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const KIND_OPTIONS: { value: V5.Extractor['kind']; label: string }[] = [
  { value: 'json-path', label: 'JSON path' },
  { value: 'header', label: 'Response header' },
  { value: 'body-regex', label: 'Body regex' },
  { value: 'whole-body', label: 'Whole body' },
  { value: 'status-code', label: 'Status code' },
];

export function defaultExtractorFor(kind: V5.Extractor['kind']): V5.Extractor {
  switch (kind) {
    case 'json-path':
      return { kind: 'json-path', path: '$.' };
    case 'header':
      return { kind: 'header', name: '' };
    case 'body-regex':
      return { kind: 'body-regex', pattern: '' };
    case 'whole-body':
      return { kind: 'whole-body' };
    case 'status-code':
      return { kind: 'status-code' };
  }
}

interface Props {
  value: V5.Extractor;
  onChange: (next: V5.Extractor) => void;
  compact?: boolean;
}

const ExtractorEditor: React.FC<Props> = ({ value, onChange, compact }) => {
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space wrap size={6} style={{ width: '100%' }}>
        <Select
          size={compact ? 'small' : 'middle'}
          style={{ width: 160 }}
          value={value.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => onChange(defaultExtractorFor(kind as V5.Extractor['kind']))}
        />
        {value.kind === 'json-path' && (
          <Input
            size={compact ? 'small' : 'middle'}
            style={{ width: 260 }}
            placeholder="$.access_token"
            value={value.path}
            onChange={(e) => onChange({ kind: 'json-path', path: e.target.value })}
          />
        )}
        {value.kind === 'header' && (
          <Input
            size={compact ? 'small' : 'middle'}
            style={{ width: 260 }}
            placeholder="X-Auth-Token"
            value={value.name}
            onChange={(e) => onChange({ kind: 'header', name: e.target.value })}
          />
        )}
        {value.kind === 'body-regex' && (
          <>
            <Input
              size={compact ? 'small' : 'middle'}
              style={{ width: 260 }}
              placeholder={'"token":"([^"]+)"'}
              value={value.pattern}
              onChange={(e) =>
                onChange({
                  kind: 'body-regex',
                  pattern: e.target.value,
                  group: value.group,
                })
              }
            />
            <InputNumber
              size={compact ? 'small' : 'middle'}
              style={{ width: 90 }}
              min={0}
              placeholder="group"
              value={value.group}
              onChange={(group) =>
                onChange({
                  kind: 'body-regex',
                  pattern: value.pattern,
                  group: typeof group === 'number' ? group : undefined,
                })
              }
            />
          </>
        )}
      </Space>
      {(value.kind === 'whole-body' || value.kind === 'status-code') && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {value.kind === 'whole-body'
            ? 'Captures the full response body verbatim. Errors if the body is binary.'
            : 'Captures the HTTP status code as a decimal string (e.g. "200").'}
        </Text>
      )}
    </Space>
  );
};

export default ExtractorEditor;
