/**
 * ConditionEditor — replaces DomainTags with a full conditions UI.
 *
 * Each condition is a row: [Type] [Operator] [Value] [Exclude toggle] [Delete]
 * "+ Add condition" button at the bottom.
 *
 * Supports all V5 ConditionType values with appropriate value inputs:
 * - host/url/path/initiator: text input (comma-separated for multiple)
 * - method: multi-select chips
 * - resource-type: multi-select chips
 * - domain-type: single select
 * - request-header/response-header: headerName input + value input
 */

import { CloseOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Checkbox, Input, Select, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────

const CONDITION_TYPE_OPTIONS: Array<{ value: V5.ConditionType; label: string; description: string }> = [
  { value: 'host', label: 'Host / Domain', description: 'Match request domain' },
  { value: 'url', label: 'URL', description: 'Match full URL' },
  { value: 'path', label: 'Path', description: 'Match URL path' },
  { value: 'method', label: 'HTTP Method', description: 'Match request method' },
  { value: 'resource-type', label: 'Resource Type', description: 'Match resource type' },
  { value: 'domain-type', label: 'Domain Type', description: 'First-party or third-party' },
  { value: 'initiator', label: 'Initiator Domain', description: 'Match page origin' },
  { value: 'request-header', label: 'Request Header', description: 'Match on request header (Chrome 128+)' },
  { value: 'response-header', label: 'Response Header', description: 'Match on response header (Chrome 128+)' },
];

const OPERATOR_OPTIONS: Array<{ value: V5.ConditionOperator; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'matches', label: 'Matches (*)' },
  { value: 'regex', label: 'Regex' },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const RESOURCE_TYPES = ['page', 'xhr', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'];

const DOMAIN_TYPES = [
  { value: 'firstParty', label: 'First-party' },
  { value: 'thirdParty', label: 'Third-party' },
];

/** Condition types that use multi-select chips instead of text input. */
const MULTI_SELECT_TYPES = new Set<V5.ConditionType>(['method', 'resource-type']);

/** Condition types that use a single select dropdown. */
const SINGLE_SELECT_TYPES = new Set<V5.ConditionType>(['domain-type']);

/** Condition types that need a headerName field. */
const HEADER_TYPES = new Set<V5.ConditionType>(['request-header', 'response-header']);

/** Condition types where operator doesn't apply (fixed matching). */
const NO_OPERATOR_TYPES = new Set<V5.ConditionType>(['method', 'resource-type', 'domain-type']);

// ── Placeholder helper ───────────────────────────────────────────

const PLACEHOLDERS: Record<string, Record<string, string>> = {
  host: {
    contains: 'openheaders.io',
    equals: 'api.openheaders.io',
    matches: '*.openheaders.io',
    regex: '^.*\\.openheaders\\.io$',
  },
  url: {
    contains: 'openheaders.io/api',
    equals: 'https://api.openheaders.io/v2/users',
    matches: 'https://api.openheaders.io/*',
    regex: '^https://api\\.openheaders\\.io/v[0-9]+/',
  },
  path: {
    contains: '/api/',
    equals: '/api/v2/users',
    matches: '/api/v2/*',
    regex: '^/api/v[0-9]+/',
  },
  initiator: {
    contains: 'openheaders.io',
    equals: 'portal.openheaders.io',
    matches: '*.openheaders.io',
    regex: '^.*\\.openheaders\\.io$',
  },
};

function getValuePlaceholder(type: V5.ConditionType, operator: V5.ConditionOperator): string {
  if (type === 'request-header' || type === 'response-header') {
    switch (operator) {
      case 'contains':
        return 'Header value contains...';
      case 'equals':
        return 'Header value equals...';
      case 'matches':
        return 'Header value matches...';
      case 'regex':
        return 'Header value regex...';
    }
  }
  return PLACEHOLDERS[type]?.[operator] ?? 'value';
}

// ── Props ────────────────────────────────────────────────────────

interface ConditionEditorProps {
  value?: V5.RuleCondition[];
  onChange?: (conditions: V5.RuleCondition[]) => void;
}

// ── Component ────────────────────────────────────────────────────

const ConditionEditor: React.FC<ConditionEditorProps> = ({ value = [], onChange }) => {
  const { token } = theme.useToken();

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
    const newCondition: V5.RuleCondition = {
      type: 'host',
      operator: 'contains',
      values: [],
    };
    onChange?.([...value, newCondition]);
  }, [value, onChange]);

  const handleTypeChange = useCallback(
    (index: number, type: V5.ConditionType) => {
      const defaults: Partial<V5.RuleCondition> = { type, values: [] };
      if (NO_OPERATOR_TYPES.has(type)) {
        defaults.operator = 'equals';
      }
      if (!HEADER_TYPES.has(type)) {
        defaults.headerName = undefined;
      }
      if (HEADER_TYPES.has(type) && !value[index].headerName) {
        defaults.headerName = '';
      }
      updateCondition(index, defaults);
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
        <div
          style={{
            padding: '12px 16px',
            color: token.colorTextTertiary,
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          No conditions — rule will not match any requests
        </div>
      )}

      {value.map((condition, index) => (
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
          {/* AND badge (after first row) */}
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

          {/* Type selector */}
          <Select
            size="small"
            value={condition.type}
            onChange={(type) => handleTypeChange(index, type)}
            style={{ width: 150, flexShrink: 0 }}
            popupMatchSelectWidth={180}
            options={CONDITION_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />

          {/* Header name BEFORE operator (for header conditions) — reads as "Request Header [Authorization] Contains [Bearer]" */}
          {HEADER_TYPES.has(condition.type) && (
            <Input
              size="small"
              placeholder="Header name equals..."
              value={condition.headerName ?? ''}
              onChange={(e) => updateCondition(index, { headerName: e.target.value })}
              style={{ width: 200, flexShrink: 0 }}
            />
          )}

          {/* Operator (hidden for multi-select/single-select types) */}
          {!NO_OPERATOR_TYPES.has(condition.type) && (
            <Select
              size="small"
              value={condition.operator}
              onChange={(op) => updateCondition(index, { operator: op })}
              style={{ width: 120, flexShrink: 0 }}
              options={OPERATOR_OPTIONS}
            />
          )}

          {/* Value input — varies by type */}
          {MULTI_SELECT_TYPES.has(condition.type) ? (
            <Select
              size="small"
              mode="multiple"
              value={condition.values}
              onChange={(vals) => updateCondition(index, { values: vals })}
              style={{ flex: 1, minWidth: 140 }}
              options={(condition.type === 'method' ? HTTP_METHODS : RESOURCE_TYPES).map((v) => ({
                value: v,
                label: v,
              }))}
              placeholder={condition.type === 'method' ? 'Select methods' : 'Select types'}
              maxTagCount="responsive"
            />
          ) : SINGLE_SELECT_TYPES.has(condition.type) ? (
            <Select
              size="small"
              value={condition.values[0]}
              onChange={(val) => updateCondition(index, { values: [val] })}
              style={{ width: 140, flexShrink: 0 }}
              options={DOMAIN_TYPES}
              placeholder="Select type"
            />
          ) : (
            <Input
              size="small"
              placeholder={getValuePlaceholder(condition.type, condition.operator)}
              value={condition.values.join(', ')}
              onChange={(e) => handleValuesText(index, e.target.value)}
              style={{ flex: 1, minWidth: 140 }}
            />
          )}

          {/* Exclude toggle */}
          <Tooltip title="Negate: does NOT match">
            <Checkbox
              checked={condition.exclude ?? false}
              onChange={(e) => updateCondition(index, { exclude: e.target.checked || undefined })}
              style={{ marginTop: 4 }}
            >
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                {condition.exclude && (
                  <ExclamationCircleOutlined style={{ marginRight: 2, color: token.colorWarning }} />
                )}
                NOT
              </span>
            </Checkbox>
          </Tooltip>

          {/* Delete */}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            onClick={() => removeCondition(index)}
            style={{ color: token.colorTextTertiary, flexShrink: 0, marginTop: 2 }}
          />
        </div>
      ))}

      {/* Add condition button */}
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
