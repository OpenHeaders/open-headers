/**
 * ExtractorEditor — inline editor for a single `V5.Extractor`.
 *
 * Used inside `WorkflowStepEditor`'s captures sub-editor. Renders the
 * kind selector + kind-specific fields (json-path path, header name,
 * regex pattern + optional group) as a single horizontal flex row. The
 * whole-body / status-code kinds render the selector alone (no extra
 * field needed); every kind's user-facing label explicitly names the
 * response source (`Response body — JSON path`, `Response status code`,
 * etc.) so no trailing help text is required.
 *
 * The capture row in `WorkflowStepEditor` owns the outer layout (name
 * input + extractor + delete button, all on one row), so this component
 * intentionally does NOT wrap its output in a vertical stack — it
 * returns a flex row that composes cleanly alongside siblings.
 */

import type { V5 } from '@openheaders/core/types';
import { Input, InputNumber, Select } from 'antd';
import type React from 'react';

const KIND_OPTIONS: { value: V5.Extractor['kind']; label: string }[] = [
  { value: 'json-path', label: 'Response body — JSON path' },
  { value: 'header', label: 'Response header' },
  { value: 'body-regex', label: 'Response body — regex' },
  { value: 'whole-body', label: 'Whole response body' },
  { value: 'status-code', label: 'Response status code' },
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
