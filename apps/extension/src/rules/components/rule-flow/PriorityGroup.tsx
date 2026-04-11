/**
 * PriorityGroup — container for rules in a Chrome execution priority tier.
 *
 * Shows tier label, color accent, and contains sortable FlowRuleCards.
 * Rules within a tier can be reordered with dnd-kit.
 */

import { PlusOutlined } from '@ant-design/icons';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { V5 } from '@openheaders/core/types';
import { Button, Dropdown, theme } from 'antd';
import type React from 'react';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';
import FlowRuleCard from './FlowRuleCard';

/** Chrome DNR execution priority tiers — ordered by engine processing order. */
export interface PriorityTier {
  key: string;
  label: string;
  description: string;
  color: string;
  ruleTypes: V5.RuleType[];
}

export const PRIORITY_TIERS: PriorityTier[] = [
  {
    key: 'block',
    label: 'Block',
    description: 'Stops requests entirely — highest DNR priority',
    color: '#ff4d4f',
    ruleTypes: ['block'],
  },
  {
    key: 'redirect',
    label: 'Redirect & Transform',
    description: 'Redirects and URL transforms',
    color: '#faad14',
    ruleTypes: ['redirect', 'query-param'],
  },
  {
    key: 'headers',
    label: 'Modify Headers',
    description: 'Header modifications — stackable, applied last in DNR',
    color: '#722ed1',
    ruleTypes: ['header'],
  },
  {
    key: 'script',
    label: 'Script-Based',
    description: 'Content script injection — runs outside DNR pipeline',
    color: '#1890ff',
    ruleTypes: ['inject', 'delay', 'body', 'mock'],
  },
];

interface PriorityGroupProps {
  tier: PriorityTier;
  rules: V5.Rule[];
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }) => void;
  collectionId?: string;
  folderPath?: string;
  compact?: boolean;
}

const PriorityGroup: React.FC<PriorityGroupProps> = ({
  tier,
  rules,
  onSelectRule,
  onCreateRule,
  collectionId,
  folderPath,
  compact,
}) => {
  const { token } = theme.useToken();

  // Only show "Add Rule" button types relevant to this tier
  const addMenuItems = buildRuleTypeMenuItems((type) => {
    if (collectionId) {
      onCreateRule(type, { collectionId, folderPath });
    } else {
      onCreateRule(type);
    }
  }).filter((item) => tier.ruleTypes.includes(item.key as V5.RuleType));

  return (
    <div className="flow-priority-group">
      {/* Tier header */}
      <div className="flow-priority-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="flow-priority-dot" style={{ background: tier.color }} />
          <span className="flow-priority-label" style={{ color: tier.color }}>
            {tier.label}
          </span>
          {!compact && <span style={{ fontSize: 10, color: token.colorTextQuaternary }}>{tier.description}</span>}
        </div>
        <span style={{ fontSize: 10, color: token.colorTextQuaternary }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rules */}
      <SortableContext items={rules.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
        <div className="flow-priority-rules">
          {rules.length === 0 ? (
            <div
              className="flow-priority-empty"
              style={{ borderColor: `${tier.color}20`, color: token.colorTextQuaternary }}
            >
              No {tier.label.toLowerCase()} rules
            </div>
          ) : (
            rules.map((rule) => (
              <FlowRuleCard
                key={rule.uid}
                rule={rule}
                onSelectRule={onSelectRule}
                tierColor={tier.color}
                compact={compact}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Add rule button */}
      {!compact && collectionId && addMenuItems.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <Dropdown menu={{ items: addMenuItems }} trigger={['click']} placement="bottom">
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              style={{ fontSize: 11, color: token.colorTextTertiary }}
            >
              Add {tier.label} Rule
            </Button>
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default PriorityGroup;
