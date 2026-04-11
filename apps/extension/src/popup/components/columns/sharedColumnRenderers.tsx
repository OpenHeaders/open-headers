import { CheckOutlined, CopyTwoTone } from '@ant-design/icons';
import type { ActionDetail } from '@openheaders/core/utils';
import { Space, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import { buildRuleIcon } from '../../../rules/components/shared/rule-icon';

const { Text } = Typography;

export interface TagDescriptor {
  label: string;
  color?: string;
  tooltip?: string;
  variant?: 'outlined' | 'filled';
}

// ── Tooltip grid ────────────────────────────────────────────────
// CSS grid with `auto 1fr` columns: the key column auto-sizes to the widest
// tag across all rows, so value descriptions always start at the same x.

interface TooltipRow {
  key: string;
  /** Single string renders inline; string[] renders as a numbered list. */
  value: string | string[];
  color?: string;
}

function renderTooltipGrid(rows: TooltipRow[]): React.ReactNode {
  const tagStyle = { margin: 0, fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' as const, textAlign: 'center' as const };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '4px 6px',
        alignItems: 'start',
        fontSize: 12,
      }}
    >
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          <Tag variant="outlined" color={row.color} style={tagStyle}>
            {row.key}
          </Tag>
          {Array.isArray(row.value) ? (
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {row.value.map((v, j) => (
                <div key={j}>
                  <span style={{ opacity: 0.4 }}>{j + 1}. </span>
                  <span style={{ opacity: 0.7 }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ opacity: 0.7, wordBreak: 'break-all' }}>{row.value}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
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

export function renderTagOverflow(
  allTags: TagDescriptor[],
  maxVisible: number,
  maxTagWidth?: number,
  suppressOverflowTooltip = false,
): React.ReactNode {
  const tagStyle = { margin: 0, fontSize: '11px' };
  const truncStyle = maxTagWidth
    ? { ...tagStyle, maxWidth: maxTagWidth, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }
    : tagStyle;
  const visible = allTags.slice(0, maxVisible);
  const overflowCount = allTags.length - maxVisible;

  const overflowTag = overflowCount > 0 ? (
    <Tag variant="outlined" style={{ ...tagStyle, flexShrink: 0 }}>
      +{overflowCount}
    </Tag>
  ) : null;

  return (
    <Space size={2} style={{ flexWrap: 'nowrap' }}>
      {visible.map((t, i) =>
        t.tooltip ? (
          <Tooltip key={i} title={t.tooltip}>
            <Tag color={t.color} variant={t.variant ?? 'outlined'} style={{ ...truncStyle, cursor: 'help' }}>
              {t.label}
            </Tag>
          </Tooltip>
        ) : (
          <Tag key={i} color={t.color} variant={t.variant ?? 'outlined'} style={truncStyle}>
            {t.label}
          </Tag>
        ),
      )}
      {overflowTag && (suppressOverflowTooltip
        ? overflowTag
        : (
          <Tooltip
            title={renderTooltipGrid(
              allTags
                .filter((t) => t.label || t.tooltip)
                .map((t) => ({ key: t.label, value: t.tooltip ?? '', color: t.color })),
            )}
            styles={{ root: { maxWidth: 400 } }}
          >
            {overflowTag}
          </Tooltip>
        )
      )}
    </Space>
  );
}

export type { ActionDetail } from '@openheaders/core/utils';

// ── Conditions summary ──────────────────────────────────────────

/** Short labels for inline tags (cell display). */
const CONDITION_TYPE_SHORT: Record<string, string> = {
  'url-filter': 'URL',
  'url-regex': 'Regex',
  'request-domains': 'Domain',
  'exclude-request-domains': 'Excl Domain',
  'initiator-domains': 'From',
  'exclude-initiator-domains': 'Excl From',
  'request-methods': 'Method',
  'exclude-request-methods': 'Excl Method',
  'resource-types': 'Resource',
  'exclude-resource-types': 'Excl Resource',
  'domain-type': 'Domain Type',
  'request-header': 'Req Hdr',
  'exclude-request-header': 'Excl Req Hdr',
  'response-header': 'Resp Hdr',
  'exclude-response-header': 'Excl Resp Hdr',
};

/** Full labels for tooltip tags. */
const CONDITION_TYPE_LABEL: Record<string, string> = {
  'url-filter': 'URL Pattern',
  'url-regex': 'URL Regex',
  'request-domains': 'Domains',
  'exclude-request-domains': 'Excl Domains',
  'initiator-domains': 'Initiator',
  'exclude-initiator-domains': 'Excl Initiator',
  'request-methods': 'Methods',
  'exclude-request-methods': 'Excl Methods',
  'resource-types': 'Resources',
  'exclude-resource-types': 'Excl Resources',
  'domain-type': 'Domain Type',
  'request-header': 'Req Header',
  'exclude-request-header': 'Excl Req Header',
  'response-header': 'Resp Header',
  'exclude-response-header': 'Excl Resp Header',
};

/**
 * Priority order for conditions — higher priority conditions show first in the cell.
 * request-domains is most common and most useful at a glance.
 */
const CONDITION_PRIORITY: Record<string, number> = {
  'request-domains': 0,
  'url-filter': 1,
  'url-regex': 2,
  'initiator-domains': 3,
  'resource-types': 4,
  'request-methods': 5,
  'domain-type': 6,
  'exclude-request-domains': 7,
  'exclude-initiator-domains': 8,
  'exclude-resource-types': 9,
  'exclude-request-methods': 10,
  'request-header': 11,
  'exclude-request-header': 12,
  'response-header': 13,
  'exclude-response-header': 14,
};

/** Strip protocol and trailing wildcard from URL patterns for compact display. */
function cleanUrlPattern(pattern: string): string {
  return pattern.replace(/^\*:\/\//, '').replace(/\/\*$/, '');
}

/** Build a compact inline label for a condition. */
function conditionToLabel(cond: { type: string; values: string[] }): string {
  if (cond.values.length === 0) return CONDITION_TYPE_SHORT[cond.type] ?? cond.type;

  const firstVal = cond.values[0];

  // Domains and URL patterns: show the meaningful part directly (no prefix)
  if (cond.type === 'request-domains' || cond.type === 'exclude-request-domains') {
    return firstVal;
  }
  if (cond.type === 'url-filter' || cond.type === 'url-regex') {
    return cleanUrlPattern(firstVal);
  }

  // Other conditions: prefix + short value
  const prefix = CONDITION_TYPE_SHORT[cond.type] ?? cond.type;
  const short = firstVal.length > 10 ? `${firstVal.substring(0, 8)}…` : firstVal;
  return `${prefix}: ${short}`;
}

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

  // Sort conditions by priority for display
  const sorted = [...conditions].sort(
    (a, b) => (CONDITION_PRIORITY[a.type] ?? 99) - (CONDITION_PRIORITY[b.type] ?? 99),
  );

  // Build tag descriptors — one per condition, no per-tag tooltips (single shared tooltip)
  const allTags: TagDescriptor[] = sorted.map((cond) => ({
    label: conditionToLabel(cond),
    color: cond.type.startsWith('exclude-') ? 'warning' : undefined,
  }));

  if (allTags.length === 0) {
    return showAllDomains ? (
      <Tag variant="outlined" color="default">
        All domains
      </Tag>
    ) : null;
  }

  // Merge conditions of the same type so the tooltip shows one tag per type
  const merged = new Map<string, string[]>();
  const mergedOrder: string[] = [];
  for (const c of sorted) {
    const key = (CONDITION_TYPE_LABEL[c.type] ?? c.type) + (c.headerName ? ` [${c.headerName}]` : '');
    if (!merged.has(key)) {
      merged.set(key, []);
      mergedOrder.push(key);
    }
    merged.get(key)!.push(...c.values);
  }

  // Single tooltip: condition type tag → numbered list of values (if multiple)
  const tooltip = renderTooltipGrid(
    mergedOrder.map((key) => {
      const values = merged.get(key)!;
      return { key, value: values };
    }),
  );

  return (
    <Tooltip title={tooltip} styles={{ root: { maxWidth: 500 } }}>
      <div style={{ overflow: 'hidden', display: 'flex' }}>
        {renderTagOverflow(allTags, 1, 72, true)}
      </div>
    </Tooltip>
  );
}

// ── Render action details ────────────────────────────────────────

/** Render structured action details: shared icon (with direction + placeholder) + label tag + value. */
export function renderActionDetails(detail: ActionDetail, opacity = 1, maxValueLen = 16, isActive = true): React.ReactNode {
  const displayValue = truncateValue(detail.value, maxValueLen);

  const opLabel = detail.operation ? detail.operation.charAt(0).toUpperCase() + detail.operation.slice(1) : '';
  const typeLabel = [detail.direction === 'response' ? '↓' : detail.direction === 'request' ? '↑' : '', opLabel]
    .filter(Boolean)
    .join(' ') || detail.ruleType.charAt(0).toUpperCase() + detail.ruleType.slice(1);

  // Rule-type-specific tag names for label and value rows
  const labelKey: Record<string, string> = {
    header: 'Name',
    redirect: 'URL',
    'query-param': 'Count',
    inject: 'Type',
    delay: 'Duration',
    body: 'Format',
    mock: 'Status',
  };
  const valueKey: Record<string, string> = {
    header: 'Value',
    redirect: 'URL',
    inject: 'Position',
    body: 'Body',
    mock: 'Content-Type',
  };

  const rows: Array<{ key: string; value: string | string[] }> = [
    { key: typeLabel, value: detail.tooltip },
  ];
  if (detail.items) {
    rows.push({ key: detail.ruleType === 'header' ? 'Headers' : 'Params', value: detail.items });
  } else {
    if (detail.label) rows.push({ key: labelKey[detail.ruleType] ?? 'Label', value: detail.label });
    if (detail.value) rows.push({ key: valueKey[detail.ruleType] ?? 'Value', value: detail.value });
  }

  const tooltipContent = renderTooltipGrid(rows);

  return (
    <Tooltip title={tooltipContent} styles={{ root: { maxWidth: 400 } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', opacity, height: '100%' }}>
        {/* Shared rule icon — same as sidebar/tabs (includes direction arrow + placeholder) */}
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {buildRuleIcon({
            ruleType: detail.ruleType,
            isActive,
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
              lineHeight: '18px',
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
