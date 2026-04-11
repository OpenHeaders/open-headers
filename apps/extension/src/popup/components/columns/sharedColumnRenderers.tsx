import { CheckOutlined, CopyTwoTone } from '@ant-design/icons';
import type { ActionDetail } from '@openheaders/core/utils';
import { Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { buildRuleIcon } from '../../../rules/components/shared/rule-icon';

const { Text } = Typography;

export interface TagDescriptor {
  label: string;
  color?: string;
  tooltip?: string;
  variant?: 'outlined' | 'filled';
}

export function renderDomainTags(domains: string[], showAllDomains = true): React.ReactNode {
  if (!domains || domains.length === 0) {
    return showAllDomains ? (
      <Tag variant="outlined" color="default">
        All domains
      </Tag>
    ) : null;
  }
  const first = domains[0].length > 14 ? `${domains[0].substring(0, 14)}...` : domains[0];
  const overflowCount = domains.length - 1;
  const tooltip = (
    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {domains.map((d, i) => (
        <div key={i}>
          <span style={{ opacity: 0.6 }}>{i + 1}. </span>
          {d}
        </div>
      ))}
    </div>
  );
  return (
    <Tooltip title={tooltip} styles={{ root: { maxWidth: 500 } }}>
      <Space size={2}>
        <Tag variant="outlined" style={{ fontSize: '12px', cursor: 'default', margin: 0 }}>
          {first}
        </Tag>
        {overflowCount > 0 && (
          <Tag variant="outlined" style={{ fontSize: '12px', cursor: 'default', margin: 0 }}>
            +{overflowCount}
          </Tag>
        )}
      </Space>
    </Tooltip>
  );
}

export function renderValueWithCopy({
  fullValue,
  displayValue,
  rowKey,
  copiedRowId,
  setCopiedRowId,
  opacity = 1,
}: {
  fullValue: string;
  displayValue: string;
  rowKey: string | number;
  copiedRowId: string | number | null;
  setCopiedRowId: (id: string | number | null) => void;
  opacity?: number;
}): React.ReactNode {
  return (
    <div
      className="value-cell"
      style={{ display: 'flex', alignItems: 'center', gap: 4, opacity, whiteSpace: 'nowrap' }}
    >
      <Text style={{ fontSize: '13px', flex: 1, minWidth: 0 }}>{displayValue}</Text>
      {fullValue &&
        (copiedRowId === rowKey ? (
          <CheckOutlined
            className="value-copy-icon"
            style={{ fontSize: '12px', color: '#52c41a', flexShrink: 0, opacity: 1 }}
          />
        ) : (
          <CopyTwoTone
            className="value-copy-icon"
            style={{ fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard.writeText(fullValue);
              setCopiedRowId(rowKey);
              setTimeout(() => setCopiedRowId(null), 1000);
            }}
          />
        ))}
    </div>
  );
}

export function renderTagOverflow(allTags: TagDescriptor[], maxVisible: number): React.ReactNode {
  const tagStyle = { margin: 0, fontSize: '11px' };
  const visible = allTags.slice(0, maxVisible);
  const overflowCount = allTags.length - maxVisible;

  return (
    <Space size={2}>
      {visible.map((t, i) =>
        t.tooltip ? (
          <Tooltip key={i} title={t.tooltip}>
            <Tag color={t.color} variant={t.variant ?? 'outlined'} style={{ ...tagStyle, cursor: 'help' }}>
              {t.label}
            </Tag>
          </Tooltip>
        ) : (
          <Tag key={i} color={t.color} variant={t.variant ?? 'outlined'} style={tagStyle}>
            {t.label}
          </Tag>
        ),
      )}
      {overflowCount > 0 && (
        <Tooltip
          title={
            <div style={{ fontSize: 12 }}>
              {allTags.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: i < allTags.length - 1 ? 4 : 0,
                  }}
                >
                  <Tag
                    color={t.color}
                    variant={t.variant ?? 'outlined'}
                    style={{ margin: 0, fontSize: '11px', flexShrink: 0 }}
                  >
                    {t.label}
                  </Tag>
                  {t.tooltip && <span style={{ opacity: 0.6, fontSize: '11px' }}>{t.tooltip}</span>}
                </div>
              ))}
            </div>
          }
          styles={{ root: { maxWidth: 400 } }}
        >
          <Tag variant="outlined" style={{ ...tagStyle, cursor: 'help' }}>
            +{overflowCount}
          </Tag>
        </Tooltip>
      )}
    </Space>
  );
}

export type { ActionDetail } from '@openheaders/core/utils';

// ── Conditions summary ──────────────────────────────────────────

const CONDITION_TYPE_SHORT: Record<string, string> = {
  'url-filter': 'URL',
  'url-regex': 'Regex',
  'request-domains': '',
  'exclude-request-domains': 'Excl',
  'initiator-domains': 'From',
  'exclude-initiator-domains': 'Excl From',
  'request-methods': 'Method',
  'exclude-request-methods': 'Excl Method',
  'resource-types': 'Type',
  'exclude-resource-types': 'Excl Type',
  'domain-type': 'Domain',
  'request-header': 'Req Hdr',
  'exclude-request-header': 'Excl Req Hdr',
  'response-header': 'Resp Hdr',
  'exclude-response-header': 'Excl Resp Hdr',
};

/** Render a compact conditions summary for table columns. */
export function renderConditionsSummary(
  conditions: Array<{ type: string; values: string[]; headerName?: string }>,
  showAllDomains = true,
): React.ReactNode {
  if (!conditions || conditions.length === 0) {
    return showAllDomains ? (
      <Tag variant="outlined" color="default">
        No conditions
      </Tag>
    ) : null;
  }

  // Simple case: single host condition — show as domain tags (most common)
  const hostConditions = conditions.filter((c) => c.type === 'request-domains');
  const otherConditions = conditions.filter((c) => c.type !== 'request-domains');

  const elements: React.ReactNode[] = [];

  // Show host domains first (most common)
  if (hostConditions.length > 0) {
    const allDomains = hostConditions.flatMap((c) => c.values);
    elements.push(...renderDomainTagsAsArray(allDomains));
  }

  // Show other conditions as compact tags
  for (let i = 0; i < otherConditions.length; i++) {
    const cond = otherConditions[i];
    const prefix = CONDITION_TYPE_SHORT[cond.type] ?? cond.type;
    const summary = cond.values.length > 0 ? cond.values.slice(0, 2).join(', ') : '';
    const label = prefix ? `${prefix}: ${summary}` : summary;
    elements.push(
      <Tag
        key={`${cond.type}-${i}`}
        variant="outlined"
        color={cond.type.startsWith('exclude-') ? 'warning' : 'default'}
        style={{ fontSize: '11px', cursor: 'default', margin: 0 }}
      >
        {label.length > 20 ? `${label.substring(0, 18)}…` : label}
      </Tag>,
    );
  }

  if (elements.length === 0) {
    return showAllDomains ? (
      <Tag variant="outlined" color="default">
        All domains
      </Tag>
    ) : null;
  }

  const tooltip = (
    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {conditions.map((c, i) => (
        <div key={i} style={{ marginBottom: i < conditions.length - 1 ? 2 : 0 }}>
          <span style={{ opacity: 0.6 }}>
            {CONDITION_TYPE_SHORT[c.type] || c.type}
            {c.headerName ? ` [${c.headerName}]` : ''}:{' '}
          </span>
          {c.values.join(', ')}
        </div>
      ))}
    </div>
  );

  return (
    <Tooltip title={tooltip} styles={{ root: { maxWidth: 500 } }}>
      <Space size={2}>{elements}</Space>
    </Tooltip>
  );
}

/** Internal helper: convert domain strings to Tag elements. */
function renderDomainTagsAsArray(domains: string[]): React.ReactNode[] {
  if (domains.length === 0) return [];
  const first = domains[0].length > 14 ? `${domains[0].substring(0, 14)}…` : domains[0];
  const elements: React.ReactNode[] = [
    <Tag key="d0" variant="outlined" style={{ fontSize: '12px', cursor: 'default', margin: 0 }}>
      {first}
    </Tag>,
  ];
  if (domains.length > 1) {
    elements.push(
      <Tag key="d-overflow" variant="outlined" style={{ fontSize: '12px', cursor: 'default', margin: 0 }}>
        +{domains.length - 1}
      </Tag>,
    );
  }
  return elements;
}

// ── Render action details ────────────────────────────────────────

/** Render structured action details: shared icon (with direction + placeholder) + label tag + value. */
export function renderActionDetails(detail: ActionDetail, opacity = 1, maxValueLen = 16): React.ReactNode {
  const displayValue = truncateValue(detail.value, maxValueLen);

  const opLabel = detail.operation ? detail.operation.charAt(0).toUpperCase() + detail.operation.slice(1) : '';
  const tooltipContent = (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {detail.direction && (
          <Tag variant="outlined" style={{ margin: 0, fontSize: '10px', fontWeight: 600 }}>
            {detail.direction === 'response' ? '↓' : '↑'}
          </Tag>
        )}
        {opLabel && (
          <Tag variant="outlined" style={{ margin: 0, fontSize: '10px', fontWeight: 600 }}>
            {opLabel}
          </Tag>
        )}
        <span style={{ opacity: 0.7 }}>{detail.tooltip}</span>
      </div>
      {detail.label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Tag variant="outlined" style={{ margin: 0, fontSize: '10px', fontWeight: 600 }}>
            Header Name
          </Tag>
          <span style={{ opacity: 0.7, wordBreak: 'break-all' }}>{detail.label}</span>
        </div>
      )}
      {detail.value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Tag variant="outlined" style={{ margin: 0, fontSize: '10px', fontWeight: 600 }}>
            Header Value
          </Tag>
          <span style={{ opacity: 0.7, wordBreak: 'break-all' }}>{detail.value}</span>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent} styles={{ root: { maxWidth: 400 } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', opacity }}>
        {/* Shared rule icon — same as sidebar/tabs (includes direction arrow + placeholder) */}
        <span style={{ flexShrink: 0, lineHeight: 1 }}>
          {buildRuleIcon({
            ruleType: detail.ruleType,
            isActive: true,
            size: 13,
            direction: detail.direction as 'request' | 'response' | undefined,
          })}
        </span>

        {/* Label as tag (header name, param count, JS/CSS) */}
        {detail.label && (
          <Tag
            variant="outlined"
            style={{
              margin: 0,
              fontSize: '11px',
              padding: '0 4px',
              lineHeight: '18px',
              flexShrink: 0,
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {detail.label}
          </Tag>
        )}

        {/* Value as text */}
        {detail.value && (
          <Text
            style={{
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              color: 'var(--ant-color-text-secondary)',
            }}
          >
            {displayValue}
          </Text>
        )}
      </div>
    </Tooltip>
  );
}

export function truncateValue(value: string, maxLen = 16): string {
  if (value.length <= maxLen) return value;
  const suffixLen = Math.max(4, Math.floor(maxLen * 0.25));
  const prefixLen = maxLen - suffixLen - 3;
  return `${value.substring(0, prefixLen)}...${value.substring(value.length - suffixLen)}`;
}
