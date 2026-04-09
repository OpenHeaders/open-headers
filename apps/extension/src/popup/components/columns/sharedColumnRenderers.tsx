import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  CodeOutlined,
  CopyTwoTone,
  LinkOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ActionDetail } from '@openheaders/core/utils';
import { Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';

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

// ── Rule type icon with operation color ─────────────────────────

const HEADER_OP_COLOR: Record<string, string> = {
  override: '#1677ff', // blue
  add: '#52c41a', // green
  remove: '#ff4d4f', // red
};

function getRuleTypeIcon(ruleType: string, operation?: string): React.ReactNode {
  const style = { fontSize: 13 };
  switch (ruleType) {
    case 'header':
      return <SwapOutlined style={{ ...style, color: HEADER_OP_COLOR[operation ?? ''] ?? '#1677ff' }} />;
    case 'block':
      return <StopOutlined style={{ ...style, color: '#ff4d4f' }} />;
    case 'redirect':
      return <SendOutlined style={{ ...style, color: '#faad14' }} />;
    case 'query-param':
      return <LinkOutlined style={{ ...style, color: '#722ed1' }} />;
    case 'inject':
      return <CodeOutlined style={{ ...style, color: operation === 'css' ? '#eb2f96' : '#fa8c16' }} />;
    default:
      return null;
  }
}

// ── Render action details ────────────────────────────────────────

/** Render structured action details: direction + icon + label tag + value. */
export function renderActionDetails(detail: ActionDetail, opacity = 1, maxValueLen = 16): React.ReactNode {
  const displayValue = truncateValue(detail.value, maxValueLen);

  const tooltipContent = (
    <div style={{ fontSize: 12 }}>
      <div>{detail.tooltip}</div>
      {detail.label && (
        <div style={{ marginTop: 2, fontFamily: 'monospace' }}>
          {detail.label}
          {detail.value ? `: ${detail.value}` : ''}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent} styles={{ root: { maxWidth: 400 } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', opacity }}>
        {/* Direction arrow (header only) */}
        {detail.direction && (
          <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0, color: 'var(--ant-color-text-quaternary)' }}>
            {detail.direction === 'response' ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
          </span>
        )}

        {/* Rule type icon, colored by operation */}
        <span style={{ flexShrink: 0, lineHeight: 1 }}>{getRuleTypeIcon(detail.ruleType, detail.operation)}</span>

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
