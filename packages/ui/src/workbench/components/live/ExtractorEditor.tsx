import type { MessageKey } from '@openheaders/i18n';
import type { Extractor } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, InputNumber, Select } from 'antd';
import type React from 'react';

/**
 * What an extractor reads: a call's response, or a session's message. A
 * message has a payload and named fields (its topic, its QoS, …) and no
 * status, so its picker words them so and offers no status code.
 */
export type ExtractorSubjectKind = 'response' | 'message';

interface KindGroup {
  labelKey: MessageKey;
  options: { value: Extractor['kind']; labelKey: MessageKey }[];
}

// Extractor kind ids stay raw (resolver-vocab precedent); the picker
// labels around them are keyed and resolve at render.
const KIND_OPTIONS: Record<ExtractorSubjectKind, KindGroup[]> = {
  response: [
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
  ],
  message: [
    {
      labelKey: 'workbench.editors.live.extractor.groupPayload',
      options: [
        { value: 'whole-body', labelKey: 'workbench.editors.live.extractor.wholePayload' },
        { value: 'json-path', labelKey: 'workbench.editors.live.extractor.jsonPath' },
        { value: 'body-regex', labelKey: 'workbench.editors.live.extractor.regex' },
      ],
    },
    {
      labelKey: 'workbench.editors.live.extractor.groupMessage',
      options: [{ value: 'header', labelKey: 'workbench.editors.live.extractor.field' }],
    },
  ],
};

// Field-name examples shown in the name placeholder — raw by design.
const NAME_EXAMPLE: Record<ExtractorSubjectKind, string> = { response: 'X-Auth-Token', message: 'topic' };

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
  /** What is read. Absent = a call's response. */
  subject?: ExtractorSubjectKind;
}

const ExtractorEditor: React.FC<Props> = ({ value, onChange, compact, subject = 'response' }) => {
  const t = useT();
  const size = compact ? 'small' : 'middle';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Select
        size={size}
        style={{ width: 220, flexShrink: 0 }}
        value={value.kind}
        options={KIND_OPTIONS[subject].map((group) => ({
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
          placeholder={NAME_EXAMPLE[subject]}
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
            placeholder={t('workbench.editors.live.extractor.groupPlaceholder')}
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
