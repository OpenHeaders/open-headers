import type { MessageKey } from '@openheaders/i18n';
import type { Extractor } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, InputNumber, Select } from 'antd';
import type React from 'react';

// Extractor kind ids stay raw (resolver-vocab precedent); the picker
// labels around them are keyed and resolve at render.
const KIND_OPTIONS: {
  labelKey: MessageKey;
  options: { value: Extractor['kind']; labelKey: MessageKey }[];
}[] = [
  {
    labelKey: 'workbench.editors.live.extractor.groupBody',
    options: [
      { value: 'whole-body', labelKey: 'workbench.editors.live.extractor.wholeBody' },
      { value: 'json-path', labelKey: 'workbench.editors.live.extractor.jsonPath' },
      { value: 'body-regex', labelKey: 'workbench.editors.live.extractor.regex' },
    ],
  },
  {
    labelKey: 'workbench.editors.live.extractor.groupResponse',
    options: [
      { value: 'header', labelKey: 'workbench.editors.live.extractor.header' },
      { value: 'status-code', labelKey: 'workbench.editors.live.extractor.statusCode' },
    ],
  },
];

export function defaultExtractorFor(kind: Extractor['kind']): Extractor {
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
  value: Extractor;
  onChange: (next: Extractor) => void;
  compact?: boolean;
}

const ExtractorEditor: React.FC<Props> = ({ value, onChange, compact }) => {
  const t = useT();
  const size = compact ? 'small' : 'middle';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Select
        size={size}
        style={{ width: 220, flexShrink: 0 }}
        value={value.kind}
        options={KIND_OPTIONS.map((group) => ({
          label: t(group.labelKey),
          options: group.options.map((o) => ({ value: o.value, label: t(o.labelKey) })),
        }))}
        onChange={(kind) => onChange(defaultExtractorFor(kind as Extractor['kind']))}
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
