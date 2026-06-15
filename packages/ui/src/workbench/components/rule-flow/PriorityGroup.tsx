/**
 * PriorityGroup — container for rules in a Chrome execution priority tier.
 *
 * Shows tier label, color accent, and contains sortable FlowRuleCards.
 * Rules within a tier can be reordered with dnd-kit.
 */

import { PlusOutlined } from '@ant-design/icons';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Rule, RuleType } from '@openheaders/core/types';
import { Button, Dropdown, theme } from 'antd';
import type React from 'react';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';
import FlowRuleCard, { type RuleStatusOverlay } from './FlowRuleCard';

/** Chrome DNR execution priority tiers — ordered by engine processing order. */
export interface PriorityTier {
  key: string;
  label: string;
  description: string;
  color: string;
  ruleTypes: RuleType[];
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
    label: 'Redirect',
    description: 'Redirect requests to a different URL',
    color: '#faad14',
    ruleTypes: ['redirect'],
  },
  {
    key: 'query-param',
    label: 'Query Params',
    description: 'Add, override, or remove URL parameters',
    color: '#fa8c16',
    ruleTypes: ['query-param'],
  },
  {
    key: 'header',
    label: 'Modify Headers',
    description: 'Header modifications — stackable, applied last in DNR',
    color: '#722ed1',
    ruleTypes: ['header'],
  },
  {
    key: 'inject',
    label: 'Inject Script/CSS',
    description: 'Inject JavaScript or CSS into pages',
    color: '#13c2c2',
    ruleTypes: ['inject'],
  },
  {
    key: 'request-body',
    label: 'API Request Body',
    description: 'Modify fetch/XHR request bodies',
    color: '#2f54eb',
    ruleTypes: ['request-body'],
  },
  {
    key: 'response',
    label: 'Modify Response',
    description: 'Mock or modify fetch/XHR response status, body, and headers',
    color: '#1890ff',
    ruleTypes: ['response'],
  },
  {
    key: 'delay',
    label: 'Delay',
    description: 'Add latency to fetch/XHR requests',
    color: '#eb2f96',
    ruleTypes: ['delay'],
  },
];

interface PriorityGroupProps {
  tier: PriorityTier;
  rules: Rule[];
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }) => void;
  collectionId?: string;
  folderPath?: string;
  compact?: boolean;
  /**
   * Per-rule status overlay for the test-results flow. When set, every card
   * in this group renders with its outcome color, and the "Add Rule" button
   * is hidden because adding rules from a finished test result is nonsense.
   */
  statusOverlays?: Map<string, RuleStatusOverlay>;
  /** Currently-selected rule uid in test-results mode (highlights the card). */
  selectedRuleUid?: string | null;
  /** Whole-card click handler for read-only mode (opens the side-panel detail). */
  onCardClick?: (uid: string) => void;
  /** Hide editing affordances on the cards (toggle, delete, drag handle). */
  readOnly?: boolean;
}

const PriorityGroup: React.FC<PriorityGroupProps> = ({
  tier,
  rules,
  onSelectRule,
  onCreateRule,
  collectionId,
  folderPath,
  compact,
  statusOverlays,
  selectedRuleUid,
  onCardClick,
  readOnly,
}) => {
  const { token } = theme.useToken();

  // Only show "Add Rule" button types relevant to this tier
  const addMenuItems = buildRuleTypeMenuItems((type) => {
    if (collectionId) {
      onCreateRule(type, { collectionId, folderPath });
    } else {
      onCreateRule(type);
    }
  }).filter((item) => tier.ruleTypes.includes(item.key as RuleType));

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
                onCardClick={onCardClick}
                tierColor={tier.color}
                compact={compact}
                statusOverlay={statusOverlays?.get(rule.uid)}
                testSelected={selectedRuleUid === rule.uid}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Add rule button — hidden in test-results (read-only) mode. */}
      {!readOnly && !compact && collectionId && addMenuItems.length > 0 && (
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
