/**
 * FlowRuleCard — a single rule card in the flow pipeline.
 *
 * Collapsed: type icon, name, enabled toggle, conditions summary, action summary.
 * Expanded: inline condition/action editing (future phase).
 * Draggable via dnd-kit for reordering within priority tiers.
 */

import { DeleteOutlined, EditOutlined, HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { getActionDetail, isRuleComplete } from '@openheaders/core/utils';
import { Button, Popconfirm, Space, Switch, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { buildRuleIcon } from '../shared/rule-icon';

const CONDITION_TYPE_LABELS: Record<string, string> = {
  'url-filter': 'URL',
  'url-regex': 'Regex',
  'request-domains': 'Domains',
  'exclude-request-domains': '!Domains',
  'initiator-domains': 'Initiator',
  'exclude-initiator-domains': '!Initiator',
  'request-methods': 'Methods',
  'exclude-request-methods': '!Methods',
  'resource-types': 'Types',
  'exclude-resource-types': '!Types',
  'domain-type': 'Party',
  'request-header': 'Req Header',
  'exclude-request-header': '!Req Header',
  'response-header': 'Res Header',
  'exclude-response-header': '!Res Header',
};

interface FlowRuleCardProps {
  rule: V5.Rule;
  onSelectRule: (uid: string) => void;
  tierColor: string;
}

const FlowRuleCard: React.FC<FlowRuleCardProps> = ({ rule, onSelectRule, tierColor }) => {
  const { token } = theme.useToken();
  const { updateLocalRule, deleteLocalRule } = useRules();
  const complete = isRuleComplete(rule);
  const isActive = rule.enabled && complete;
  const isLocal = rule.uid.startsWith('local-');
  const detail = useMemo(() => getActionDetail(rule), [rule]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.uid,
    disabled: !isLocal,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggle = (checked: boolean) => {
    if (isLocal) void updateLocalRule(rule.uid, { enabled: checked });
  };

  const handleDelete = () => {
    if (isLocal) void deleteLocalRule(rule.uid);
  };

  return (
    <div ref={setNodeRef} style={style} className="flow-rule-card" data-active={isActive}>
      {/* Drag handle */}
      <div
        className="flow-rule-card-handle"
        style={{ color: isLocal ? token.colorTextQuaternary : 'transparent', cursor: isLocal ? 'grab' : 'default' }}
        {...attributes}
        {...listeners}
      >
        <HolderOutlined style={{ fontSize: 10 }} />
      </div>

      {/* Icon */}
      <div className="flow-rule-card-icon">{buildRuleIcon({ ruleType: rule.type, rule, isActive, size: 14 })}</div>

      {/* Content */}
      <div className="flow-rule-card-content">
        <div className="flow-rule-card-header">
          <span className="flow-rule-card-name" style={{ color: isActive ? token.colorText : token.colorTextTertiary }}>
            {rule.name}
          </span>
          <Space size={4}>
            {!complete && (
              <Tag color="default" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                Draft
              </Tag>
            )}
            {!isLocal && (
              <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                App
              </Tag>
            )}
          </Space>
        </div>

        {/* Conditions */}
        <div className="flow-rule-card-conditions">
          {rule.conditions.length === 0 ? (
            <span style={{ fontSize: 10, color: token.colorTextQuaternary, fontStyle: 'italic' }}>All requests</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
              {rule.conditions.map((c, i) => {
                const label = CONDITION_TYPE_LABELS[c.type] ?? c.type;
                const val = c.values.length > 0 ? c.values[0] : '';
                const short = val.length > 24 ? `${val.slice(0, 22)}...` : val;
                return (
                  <Tooltip key={`${c.type}-${i}`} title={`${label}: ${c.values.join(', ')}`}>
                    <span className="flow-condition-chip" style={{ borderColor: `${tierColor}30` }}>
                      <span style={{ color: tierColor, fontWeight: 600 }}>{label}</span>
                      {short && <span style={{ color: token.colorTextSecondary }}>{short}</span>}
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>

        {/* Action summary */}
        <div style={{ fontSize: 10, color: token.colorTextTertiary, marginTop: 2 }}>{detail.tooltip}</div>
      </div>

      {/* Actions */}
      <div className="flow-rule-card-actions">
        <Tooltip title={rule.enabled ? 'Disable' : 'Enable'}>
          <Switch size="small" checked={rule.enabled} onChange={handleToggle} disabled={!isLocal} />
        </Tooltip>
        <Tooltip title="Open in editor">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ fontSize: 12 }} />}
            onClick={() => onSelectRule(rule.uid)}
          />
        </Tooltip>
        {isLocal && (
          <Popconfirm
            title="Delete this rule?"
            onConfirm={handleDelete}
            okText="Delete"
            cancelText="Cancel"
            placement="left"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />} />
          </Popconfirm>
        )}
      </div>
    </div>
  );
};

export default FlowRuleCard;
