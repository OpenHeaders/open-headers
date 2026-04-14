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

/** Shadow reason — keep in lock-step with ShadowKind in shadow-arbitration.ts. */
export type RuleShadowKind =
  | 'block-terminal'
  | 'redirect-retarget'
  | 'query-param-retarget'
  | 'mock-intercept'
  | 'header-stacking-ambiguous'
  | 'delay-page-intercept';

export interface RuleShadowAttribution {
  uid: string;
  name: string;
  kind: RuleShadowKind;
}

/** Status overlay used by the test-results flow to color cards by execution outcome. */
export interface RuleStatusOverlay {
  /**
   * - `executed`: at least one fire was recorded for this rule and at least
   *   one of those fires was NOT marked as shadowed by the arbitrator.
   * - `shadowed`: every recorded fire was marked as shadowed by another
   *   rule in the matching set, OR (for no-fire rules) the session's
   *   static arbitration pass over the observed-URL set determined that
   *   a sibling rule would have shadowed this rule on at least one URL.
   *   The attribution's `kind` classifies the reason — block cancellation,
   *   redirect retargeting, mock interception, header stacking, or
   *   delay-page navigation. See `shadow-arbitration.ts` for the taxonomy.
   * - `no-fire`: in scope but no request matched it and no sibling rule
   *   predicted a shadow — the rule is genuinely just not relevant to
   *   the target URL.
   * - `skipped`: in scope but disabled / incomplete / under a paused
   *   group at session start, so the test never tried to run it.
   */
  status: 'executed' | 'shadowed' | 'no-fire' | 'skipped';
  fireCount: number;
  /** Populated when status === 'shadowed'. */
  shadowedBy?: RuleShadowAttribution;
  /** Optional human-readable reason — e.g. "Disabled" / "Paused (parent folder)". */
  reason?: string;
}

/** Short label + tooltip helper for each shadow reason. Lock-step with TestResultsView copy. */
const SHADOW_TAG_LABEL: Record<RuleShadowKind, string> = {
  'block-terminal': 'Blocked',
  'redirect-retarget': 'Redirected',
  'query-param-retarget': 'URL rewritten',
  'mock-intercept': 'Mocked',
  'header-stacking-ambiguous': 'Ambiguous',
  'delay-page-intercept': 'Delayed',
};

const SHADOW_TAG_TOOLTIP: Record<RuleShadowKind, (name: string) => string> = {
  'block-terminal': (name) => `Would have fired but ${name} blocked the request first.`,
  'redirect-retarget': (name) => `Would have been effective but ${name} redirected the request to another URL.`,
  'query-param-retarget': (name) => `Would have been effective but ${name} rewrote the query string.`,
  'mock-intercept': (name) => `This rule's response-side effect is moot — ${name} fabricated the response.`,
  'header-stacking-ambiguous': (name) => `Ordering with ${name} on the same header is non-deterministic in Chrome.`,
  'delay-page-intercept': (name) => `${name} redirected the navigation to the extension delay page.`,
};

interface FlowRuleCardProps {
  rule: V5.Rule;
  /** Always opens the rule in the editor — used by the explicit edit button. */
  onSelectRule: (uid: string) => void;
  /**
   * Optional click handler for the whole card. Only fires in read-only
   * (test-results) mode. When set, clicking anywhere on the card except
   * the explicit edit button calls this — typically to open a side-panel
   * detail view, distinct from "open the editor."
   */
  onCardClick?: (uid: string) => void;
  tierColor: string;
  compact?: boolean;
  /**
   * When set, the card is rendered as a read-only test-result tile —
   * drag handle, enable switch, and delete affordances are hidden, the
   * status overlay drives border/background color, and a status tag
   * appears next to the rule name.
   */
  statusOverlay?: RuleStatusOverlay;
  /** True when this card is the currently-selected one in a parent test-results view. */
  testSelected?: boolean;
  /** Hide editing affordances (drag, switch, delete). Test-result mode passes true. */
  readOnly?: boolean;
}

const FlowRuleCard: React.FC<FlowRuleCardProps> = ({
  rule,
  onSelectRule,
  onCardClick,
  tierColor,
  compact,
  statusOverlay,
  testSelected,
  readOnly,
}) => {
  const { token } = theme.useToken();
  const { updateLocalRule, deleteLocalRule, pausedUids } = useRules();
  const complete = isRuleComplete(rule);
  const paused = pausedUids.has(rule.uid);
  const isActive = rule.enabled && complete && !paused;
  const isLocal = rule.uid.startsWith('local-');
  const detail = useMemo(() => getActionDetail(rule), [rule]);

  // dnd-kit subscribes regardless so the hooks order stays stable, but in
  // read-only mode (test results) we hide the handle and ignore listeners.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.uid,
    disabled: !isLocal || readOnly === true,
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

  // In test-result mode, clicking the card opens the side-panel detail
  // view (via `onCardClick`); the dedicated edit button still opens the
  // rule in the workspace editor (via `onSelectRule`). We deliberately
  // separate these so the whole-card click is non-destructive.
  const handleCardClick = readOnly && onCardClick ? () => onCardClick(rule.uid) : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flow-rule-card"
      data-active={isActive}
      data-test-status={statusOverlay?.status}
      data-test-selected={testSelected ? 'true' : undefined}
      onClick={handleCardClick}
      role={readOnly ? 'button' : undefined}
      tabIndex={readOnly ? 0 : undefined}
    >
      {/* Drag handle — hidden in read-only mode (test results) */}
      {!readOnly && (
        <div
          className="flow-rule-card-handle"
          style={{ color: isLocal ? token.colorTextQuaternary : 'transparent', cursor: isLocal ? 'grab' : 'default' }}
          {...attributes}
          {...listeners}
        >
          <HolderOutlined style={{ fontSize: 10 }} />
        </div>
      )}

      {/* Icon */}
      <div className="flow-rule-card-icon">
        {buildRuleIcon({ ruleType: rule.type, rule, isActive, paused, size: 14 })}
      </div>

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
            {complete && paused && (
              <Tag color="warning" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                Paused
              </Tag>
            )}
            {!isLocal && (
              <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                App
              </Tag>
            )}
            {statusOverlay && <StatusOverlayTag overlay={statusOverlay} />}
          </Space>
        </div>

        {/* Compact: inline condition count + action summary */}
        {compact ? (
          <span style={{ fontSize: 10, color: token.colorTextTertiary }}>
            {rule.conditions.length > 0
              ? `${rule.conditions.length} condition${rule.conditions.length !== 1 ? 's' : ''}`
              : 'All requests'}
            {' · '}
            {detail.label || detail.tooltip}
          </span>
        ) : (
          <>
            {/* Conditions */}
            <div className="flow-rule-card-conditions">
              {rule.conditions.length === 0 ? (
                <span style={{ fontSize: 10, color: token.colorTextQuaternary, fontStyle: 'italic' }}>
                  All requests
                </span>
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
          </>
        )}
      </div>

      {/* Actions — only the "open in editor" button survives in read-only
          (test-results) mode. Toggle/delete are hidden because mutating
          rules from a finished test result would be a foot-gun. */}
      <div className="flow-rule-card-actions">
        {!readOnly && (
          <Tooltip title={rule.enabled ? 'Disable' : 'Enable'}>
            <Switch size="small" checked={rule.enabled} onChange={handleToggle} disabled={!isLocal} />
          </Tooltip>
        )}
        <Tooltip title="Open in editor">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ fontSize: 12 }} />}
            onClick={(e) => {
              // Read-only mode: stop propagation so the card click handler
              // (which selects the rule for the side panel) doesn't also fire.
              e.stopPropagation();
              onSelectRule(rule.uid);
            }}
          />
        </Tooltip>
        {!readOnly && isLocal && (
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

/**
 * Compact tag rendered next to the rule name when a status overlay is set.
 * Color and label encode the four test outcomes; the tooltip carries the
 * exact reason / shadower / fire count.
 */
const StatusOverlayTag: React.FC<{ overlay: RuleStatusOverlay }> = ({ overlay }) => {
  const { status, fireCount, shadowedBy, reason } = overlay;
  const props: { color: string; label: string; tooltip: string } = (() => {
    switch (status) {
      case 'executed':
        return {
          color: 'success',
          label: fireCount > 1 ? `${fireCount}× executed` : 'Executed',
          tooltip:
            fireCount > 1
              ? `Fired on ${fireCount} requests during the capture window`
              : 'Fired on 1 request during the capture window',
        };
      case 'shadowed': {
        if (!shadowedBy) {
          return {
            color: 'warning',
            label: 'Shadowed',
            tooltip: 'Would have fired but another rule in the same scope superseded its effect',
          };
        }
        return {
          color: 'warning',
          label: SHADOW_TAG_LABEL[shadowedBy.kind],
          tooltip: SHADOW_TAG_TOOLTIP[shadowedBy.kind](shadowedBy.name),
        };
      }
      case 'no-fire':
        return {
          color: 'default',
          label: 'No fire',
          tooltip: 'In scope but no request matched this rule during the capture window',
        };
      case 'skipped':
        return {
          color: 'default',
          label: 'Skipped',
          tooltip: reason ?? 'Disabled, incomplete, or paused before the test started',
        };
    }
  })();

  return (
    <Tooltip title={props.tooltip} placement="top">
      <Tag color={props.color} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
        {props.label}
      </Tag>
    </Tooltip>
  );
};

export default FlowRuleCard;
