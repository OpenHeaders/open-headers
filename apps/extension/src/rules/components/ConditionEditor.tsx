/**
 * ConditionEditor — condition rows that map 1:1 to Chrome DNR fields.
 *
 * Each condition type IS a Chrome DNR field. No operator abstraction.
 * What the user configures is exactly what Chrome executes.
 *
 * Categories:
 *   URL Matching: url-filter, url-regex (pick one per rule)
 *   Domain Filtering: request-domains, exclude-request-domains, initiator-domains, exclude-initiator-domains
 *   Request Filtering: request-methods, exclude-request-methods, resource-types, exclude-resource-types, domain-type
 *   Header Matching: request-header, exclude-request-header, response-header, exclude-response-header
 */

import { CloseOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Select, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useInspectorNav } from '../hooks/useInspectorNav';
import { getDocId } from './InspectorDocs';
import { TemplateInput } from './template-input';

// ── Condition type definitions ───────────────────────────────────

interface ConditionTypeDef {
  value: V5.ConditionType;
  label: string;
  group: string;
  inputType: 'text' | 'multi-select-methods' | 'multi-select-resources' | 'single-select-domain-type' | 'header';
  placeholder?: string;
}

const CONDITION_TYPES: ConditionTypeDef[] = [
  // URL Matching
  {
    value: 'url-filter',
    label: 'URL Pattern',
    group: 'URL Matching',
    inputType: 'text',
    placeholder: '*://api.openheaders.io/*',
  },
  {
    value: 'url-regex',
    label: 'URL Regex',
    group: 'URL Matching',
    inputType: 'text',
    placeholder: '^https://.*\\.openheaders\\.io/api/.*',
  },
  // Domain Filtering
  {
    value: 'request-domains',
    label: 'Request Domains',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'openheaders.io, api.openheaders.io',
  },
  {
    value: 'exclude-request-domains',
    label: 'Exclude Domains',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'staging.openheaders.io',
  },
  {
    value: 'initiator-domains',
    label: 'Initiator Domains',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'portal.openheaders.io',
  },
  {
    value: 'exclude-initiator-domains',
    label: 'Excl. Initiator',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'external.com',
  },
  // Request Filtering
  { value: 'request-methods', label: 'Methods', group: 'Request Filtering', inputType: 'multi-select-methods' },
  {
    value: 'exclude-request-methods',
    label: 'Excl. Methods',
    group: 'Request Filtering',
    inputType: 'multi-select-methods',
  },
  { value: 'resource-types', label: 'Resource Types', group: 'Request Filtering', inputType: 'multi-select-resources' },
  {
    value: 'exclude-resource-types',
    label: 'Excl. Resources',
    group: 'Request Filtering',
    inputType: 'multi-select-resources',
  },
  { value: 'domain-type', label: 'Domain Type', group: 'Request Filtering', inputType: 'single-select-domain-type' },
  // Header Matching (Chrome 128+)
  {
    value: 'request-header',
    label: 'Request Header',
    group: 'Header Matching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
  {
    value: 'exclude-request-header',
    label: 'Excl. Req Header',
    group: 'Header Matching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
  {
    value: 'response-header',
    label: 'Response Header',
    group: 'Header Matching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
  {
    value: 'exclude-response-header',
    label: 'Excl. Resp Header',
    group: 'Header Matching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const RESOURCE_TYPES = ['page', 'xhr', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'];
const DOMAIN_TYPES = [
  { value: 'firstParty', label: 'First-party' },
  { value: 'thirdParty', label: 'Third-party' },
];

// Build grouped options for the type selector
const TYPE_OPTIONS = (() => {
  const groups = new Map<string, ConditionTypeDef[]>();
  for (const t of CONDITION_TYPES) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group)!.push(t);
  }
  return [...groups.entries()].map(([group, items]) => ({
    label: group,
    options: items.map((t) => ({ value: t.value, label: t.label })),
  }));
})();

function getTypeDef(type: V5.ConditionType): ConditionTypeDef | undefined {
  return CONDITION_TYPES.find((t) => t.value === type);
}

// ── Props ────────────────────────────────────────────────────────

interface ConditionEditorProps {
  value?: V5.RuleCondition[];
  onChange?: (conditions: V5.RuleCondition[]) => void;
}

// ── Component ────────────────────────────────────────────────────

const ConditionEditor: React.FC<ConditionEditorProps> = ({ value = [], onChange }) => {
  const { token } = theme.useToken();
  const { openDocs } = useInspectorNav();

  const updateCondition = useCallback(
    (index: number, updates: Partial<V5.RuleCondition>) => {
      const next = value.map((c, i) => (i === index ? { ...c, ...updates } : c));
      onChange?.(next);
    },
    [value, onChange],
  );

  const removeCondition = useCallback(
    (index: number) => {
      onChange?.(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const addCondition = useCallback(() => {
    const newCondition: V5.RuleCondition = { type: 'request-domains', values: [] };
    onChange?.([...value, newCondition]);
  }, [value, onChange]);

  const handleTypeChange = useCallback(
    (index: number, type: V5.ConditionType) => {
      const def = getTypeDef(type);
      const updates: Partial<V5.RuleCondition> = { type, values: [] };
      if (def?.inputType !== 'header') {
        updates.headerName = undefined;
      } else if (!value[index].headerName) {
        updates.headerName = '';
      }
      updateCondition(index, updates);
    },
    [value, updateCondition],
  );

  const handleValuesText = useCallback(
    (index: number, text: string) => {
      const values = text
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
      updateCondition(index, { values: values.length > 0 ? values : [text] });
    },
    [updateCondition],
  );

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        background: token.colorBgContainer,
      }}
    >
      {value.length === 0 && (
        <div style={{ padding: '12px 16px', color: token.colorTextTertiary, fontSize: 12, textAlign: 'center' }}>
          No conditions — rule will not match any requests
        </div>
      )}

      {value.map((condition, index) => {
        const def = getTypeDef(condition.type);
        const isExclude = condition.type.startsWith('exclude-');

        return (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '8px 10px',
              flexWrap: 'wrap',
              borderBottom: index < value.length - 1 ? `1px solid ${token.colorBorderSecondary}` : undefined,
            }}
          >
            {/* AND badge */}
            {index > 0 && (
              <Tag
                color="blue"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1,
                  lineHeight: '18px',
                  margin: '3px 0 0 0',
                  padding: '0 4px',
                  flexShrink: 0,
                }}
              >
                AND
              </Tag>
            )}

            {/* Exclude indicator */}
            {isExclude && (
              <Tag
                color="warning"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: '18px',
                  margin: '3px 0 0 0',
                  padding: '0 4px',
                  flexShrink: 0,
                }}
              >
                NOT
              </Tag>
            )}

            {/* Type selector + docs link */}
            <Select
              size="small"
              value={condition.type}
              onChange={(type) => handleTypeChange(index, type)}
              style={{ width: 160, flexShrink: 0 }}
              popupMatchSelectWidth={200}
              options={TYPE_OPTIONS}
            />
            <InfoCircleOutlined
              style={{ fontSize: 10, color: token.colorTextQuaternary, cursor: 'pointer', flexShrink: 0 }}
              onClick={() => openDocs(getDocId(condition.type, 'condition'))}
            />

            {/* Header name (before value for header types) */}
            {def?.inputType === 'header' && (
              <TemplateInput
                size="small"
                placeholder="Header name equals..."
                value={condition.headerName ?? ''}
                onChange={(next) => updateCondition(index, { headerName: next })}
                style={{ width: 180, flexShrink: 0 }}
              />
            )}

            {/* Value input — varies by type */}
            {def?.inputType === 'multi-select-methods' ? (
              <Select
                size="small"
                mode="multiple"
                value={condition.values}
                onChange={(vals) => updateCondition(index, { values: vals })}
                style={{ flex: 1, minWidth: 140 }}
                options={HTTP_METHODS.map((v) => ({ value: v, label: v }))}
                placeholder="Select methods"
                maxTagCount="responsive"
              />
            ) : def?.inputType === 'multi-select-resources' ? (
              <Select
                size="small"
                mode="multiple"
                value={condition.values}
                onChange={(vals) => updateCondition(index, { values: vals })}
                style={{ flex: 1, minWidth: 140 }}
                options={RESOURCE_TYPES.map((v) => ({ value: v, label: v }))}
                placeholder="Select types"
                maxTagCount="responsive"
              />
            ) : def?.inputType === 'single-select-domain-type' ? (
              <Select
                size="small"
                value={condition.values[0]}
                onChange={(val) => updateCondition(index, { values: [val] })}
                style={{ width: 140, flexShrink: 0 }}
                options={DOMAIN_TYPES}
                placeholder="Select type"
              />
            ) : (
              <TemplateInput
                size="small"
                placeholder={def?.placeholder ?? 'value'}
                value={condition.values.join(', ')}
                onChange={(next) => handleValuesText(index, next)}
                style={{ flex: 1, minWidth: 140 }}
              />
            )}

            {/* Delete */}
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ fontSize: 10 }} />}
              onClick={() => removeCondition(index)}
              style={{ color: token.colorTextTertiary, flexShrink: 0, marginTop: 2 }}
            />
          </div>
        );
      })}

      {/* Add condition */}
      <div
        style={{
          padding: '6px 10px',
          borderTop: value.length > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}
      >
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCondition} style={{ fontSize: 12 }}>
          Add condition
        </Button>
      </div>
    </div>
  );
};

export default ConditionEditor;
