/**
 * Shared rule icon rendering — used by both Sidebar and TabBar.
 *
 * Uniform color scheme:
 *   - Yellow (warning): paused (overrides active state)
 *   - Gray: draft / incomplete / disabled
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
  FileOutlined,
  LinkOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
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
  body: FileOutlined,
  mock: FileOutlined,
};

const GRAY = 'var(--ant-color-text-tertiary, #999)';
const BLUE = '#1677ff';
const YELLOW = 'var(--ant-color-warning, #faad14)';

interface RuleIconOptions {
  ruleType: string;
  /** Full rule object — used for action details (direction). */
  rule?: V5.Rule;
  /** Whether the rule is active (enabled + complete). */
  isActive: boolean;
  /**
   * Whether the rule is paused via an ancestor collection/folder. Takes
   * precedence over `isActive` — paused icons render in the warning
   * (yellow) color regardless of enabled/complete state.
   */
  paused?: boolean;
  /** Icon size in px. Default 12. */
  size?: number;
  /** Explicit direction override — use when rule object is not available (e.g. popup). */
  direction?: 'request' | 'response';
  /** Skip the fixed-width arrow slot when no direction is resolved. Lists
   *  keep the slot so rules align vertically; inline surfaces (tooltips,
   *  breadcrumbs) want the empty slot gone so the icon hugs neighboring
   *  text. Default false — current list behavior preserved. */
  compactArrow?: boolean;
}

/**
 * Build a rich icon element for a rule — same rendering in sidebar, tabs, and popup.
 */
export function buildRuleIcon({
  ruleType,
  rule,
  isActive,
  paused = false,
  size = 12,
  direction,
  compactArrow = false,
}: RuleIconOptions): React.ReactNode {
  const detail = rule ? getActionDetail(rule) : undefined;
  const dir = direction ?? detail?.direction;
  const Icon = RULE_TYPE_ICON[ruleType] ?? SwapOutlined;
  const iconColor = paused ? YELLOW : isActive ? BLUE : GRAY;

  // Fixed-width container for the arrow area — ensures vertical alignment
  // whether an arrow is present or not. Skipped entirely when there's no
  // direction AND the caller opted into compactArrow (e.g. tooltip).
  const arrowSize = Math.round(size * 0.75);
  const arrowWidth = arrowSize + 2;
  const arrowContent = dir
    ? createElement(dir === 'response' ? ArrowDownOutlined : ArrowUpOutlined, {
        style: { fontSize: arrowSize, color: iconColor },
      })
    : null;
  const arrowSlot =
    arrowContent || !compactArrow
      ? createElement(
          'span',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: arrowWidth,
              flexShrink: 0,
            },
          },
          arrowContent,
        )
      : null;

  // Fixed-width container for the icon too — different icons (Send, Stop, Code, etc.)
  // have different intrinsic widths; this ensures the content after always starts at the same x.
  const iconSlot = createElement(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 2,
        flexShrink: 0,
      },
    },
    createElement(Icon, { style: { fontSize: size, color: iconColor } }),
  );

  return createElement(
    'span',
    { style: { display: 'inline-flex', alignItems: 'center', gap: 0 } },
    arrowSlot,
    iconSlot,
  );
}
