/**
 * Shared rule icon rendering — used by both Sidebar and TabBar.
 *
 * Produces the same icon for a given rule state:
 *   - Type-specific icon (Swap for header, Stop for block, etc.)
 *   - Color based on active/inactive state
 *   - Operation-specific color for headers (override=blue, add=green, remove=red)
 *   - Direction arrow for header rules (↑ request, ↓ response)
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CodeOutlined,
  FileTextOutlined,
  LinkOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { getActionDetail } from '@openheaders/core/utils';
import { createElement } from 'react';

const RULE_TYPE_ICON: Record<string, typeof StopOutlined> = {
  header: SwapOutlined,
  block: StopOutlined,
  redirect: SendOutlined,
  'query-param': LinkOutlined,
  inject: CodeOutlined,
  delay: ThunderboltOutlined,
  body: FileTextOutlined,
  mock: ThunderboltOutlined,
};

const HEADER_OP_COLOR: Record<string, string> = {
  override: '#1677ff',
  add: '#52c41a',
  remove: '#ff4d4f',
};

const ACTIVE_COLOR: Record<string, string> = {
  header: '#1677ff',
  block: '#ff4d4f',
  redirect: '#faad14',
  'query-param': '#722ed1',
  delay: '#fa8c16',
  body: '#1677ff',
  mock: '#fa8c16',
};

const GRAY = 'var(--ant-color-text-tertiary, #999)';

interface RuleIconOptions {
  ruleType: string;
  /** Full rule object — used for action details (direction, operation). */
  rule?: V5.Rule;
  /** Whether the rule is active (enabled + complete). */
  isActive: boolean;
  /** Icon size in px. Default 12. */
  size?: number;
}

/**
 * Build a rich icon element for a rule — same rendering in sidebar and tabs.
 */
export function buildRuleIcon({ ruleType, rule, isActive, size = 12 }: RuleIconOptions): React.ReactNode {
  const detail = rule ? getActionDetail(rule) : undefined;
  const Icon = RULE_TYPE_ICON[ruleType] ?? SwapOutlined;

  let iconColor = GRAY;
  if (isActive) {
    if (ruleType === 'header' && detail?.operation) {
      iconColor = HEADER_OP_COLOR[detail.operation] ?? '#1677ff';
    } else if (ruleType === 'inject') {
      iconColor = detail?.operation === 'css' ? '#eb2f96' : '#fa8c16';
    } else {
      iconColor = ACTIVE_COLOR[ruleType] ?? '#1677ff';
    }
  }

  const dirArrow =
    detail?.direction
      ? createElement(detail.direction === 'response' ? ArrowDownOutlined : ArrowUpOutlined, {
          style: { fontSize: Math.round(size * 0.75), color: 'var(--ant-color-text-secondary, #595959)', marginRight: 1 },
        })
      : null;

  return createElement(
    'span',
    { style: { display: 'inline-flex', alignItems: 'center', gap: 1 } },
    dirArrow,
    createElement(Icon, { style: { fontSize: size, color: iconColor } }),
  );
}
