import type { V5 } from '@openheaders/core/types';
import { Input, InputNumber, Select } from 'antd';
import type React from 'react';

const KIND_OPTIONS = [
  {
    label: 'Response body',
    options: [
      { value: 'whole-body' as const, label: 'Whole body' },
      { value: 'json-path' as const, label: 'JSON path' },
      { value: 'body-regex' as const, label: 'Regex' },
    ],
  },
  {
    label: 'Response',
    options: [
      { value: 'header' as const, label: 'Header' },
      { value: 'status-code' as const, label: 'Status code' },
    ],
  },
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
  const size = compact ? 'small' : 'middle';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Select
        size={size}
        style={{ width: 220, flexShrink: 0 }}
        value={value.kind}
        options={KIND_OPTIONS}
        onChange={(kind) => onChange(defaultExtractorFor(kind as V5.Extractor['kind']))}
      />
      {value.kind === 'json-path' && (
        <Input
          size={size}
          style={{ flex: 1, minWidth: 160 }}
          placeholder="$.access_token"
          value={value.path}
          onChange={(e) => onChange({ kind: 'json-path', path: e.target.value })}
        />
      )}
      {value.kind === 'header' && (
        <Input
          size={size}
          style={{ flex: 1, minWidth: 160 }}
          placeholder="X-Auth-Token"
          value={value.name}
          onChange={(e) => onChange({ kind: 'header', name: e.target.value })}
        />
      )}
      {value.kind === 'body-regex' && (
        <>
          <Input
            size={size}
            style={{ flex: 1, minWidth: 160 }}
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
            size={size}
            style={{ width: 90, flexShrink: 0 }}
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
    </div>
  );
};

export default ExtractorEditor;
