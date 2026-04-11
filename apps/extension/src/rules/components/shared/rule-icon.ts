/**
 * Shared rule icon rendering — used by both Sidebar and TabBar.
 *
 * Uniform color scheme:
 *   - Gray: draft / incomplete / inactive / paused
 *   - Blue (#1677ff): active (enabled + complete)
 *
 * Direction arrows:
 *   - ↑ request (header request, body)
 *   - ↓ response (header response, mock/API response)
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
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
  delay: ClockCircleOutlined,
  body: FileSearchOutlined,
  mock: FileDoneOutlined,
};

const GRAY = 'var(--ant-color-text-tertiary, #999)';
const BLUE = '#1677ff';

interface RuleIconOptions {
  ruleType: string;
  /** Full rule object — used for action details (direction). */
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
  const iconColor = isActive ? BLUE : GRAY;

  const dirArrow =
    detail?.direction
      ? createElement(detail.direction === 'response' ? ArrowDownOutlined : ArrowUpOutlined, {
          style: { fontSize: Math.round(size * 0.75), color: isActive ? BLUE : GRAY, marginRight: 1 },
        })
      : null;

  return createElement(
    'span',
    { style: { display: 'inline-flex', alignItems: 'center', gap: 1 } },
    dirArrow,
    createElement(Icon, { style: { fontSize: size, color: iconColor } }),
  );
}
