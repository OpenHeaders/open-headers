/**
 * Shared rule icon rendering — used by sidebar rows, tabs, overviews,
 * the command palette and the popup rule table.
 *
 * Renders the rule-type code (HEAD, REQ, RES, …) in place of a line
 * glyph, colored by state so a row/tab reads its status at a glance:
 *   - Yellow (warning): paused (overrides active state)
 *   - Gray: draft / incomplete / disabled
 *   - Blue (#1677ff): active (enabled + complete)
 *
 * Direction arrow (trails the code, so every row's left edge is the
 * code's first letter):
 *   - ↑ request (header request, body)
 *   - ↓ response (header response, mock/API response)
 *
 * The create/picker menus use the same codes but with a neutral
 * (hue-less) gradient — see `ruleTypeBadge` in rule-type-menu.tsx.
 */

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ExtensionRuleType, Rule } from '@openheaders/core/types';
import { getActionDetail } from '@openheaders/core/utils';
import { createElement } from 'react';
import { RULE_TYPE_CODES } from './rule-codes';

const GRAY = 'var(--ant-color-text-tertiary, #999)';
const BLUE = '#1677ff';
const YELLOW = 'var(--ant-color-warning, #faad14)';

interface RuleIconOptions {
  ruleType: string;
  /** Full rule object — used for action details (direction). */
  rule?: Rule;
  /** Whether the rule is active (enabled + complete). */
  isActive: boolean;
  /**
   * Whether the rule is paused via an ancestor collection/folder. Takes
   * precedence over `isActive` — paused codes render in the warning
   * (yellow) color regardless of enabled/complete state.
   */
  paused?: boolean;
  /** Base size in px (drives code font size + slot widths). Default 12. */
  size?: number;
  /** Explicit direction override — use when rule object is not available (e.g. popup). */
  direction?: 'request' | 'response';
  /** Skip the fixed-width arrow slot when no direction is resolved. Lists
   *  keep the slot so rules align vertically; inline surfaces (tooltips,
   *  breadcrumbs) want the empty slot gone so the code hugs neighboring
   *  text. Default false — current list behavior preserved. */
  compactArrow?: boolean;
}

/**
 * Width (px) of the leading code (+ trailing arrow) area, so rule names
 * in a list all start at the same x. Sized to the longest code
 * ("JS/CSS", 6 chars) plus a small gap — NOT "6 chars + an arrow column":
 * the longest code is arrow-less (inject has no direction), and every
 * shorter code plus its trailing arrow (e.g. "HEAD↑") is still narrower
 * than it, so reserving a separate arrow column only pads short codes
 * with dead space.
 */
function ruleIconLeadWidth(size = 12): number {
  const codeFontSize = Math.max(9, Math.round(size * 0.82));
  return Math.round(codeFontSize * 0.62 * 6) + 3;
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
  const color = paused ? YELLOW : isActive ? BLUE : GRAY;

  const code = RULE_TYPE_CODES[ruleType as ExtensionRuleType] ?? ruleType.toUpperCase();
  const codeFontSize = Math.max(9, Math.round(size * 0.82));
  const arrowSize = Math.round(size * 0.75);

  const codeEl = createElement(
    'span',
    {
      style: {
        color,
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: codeFontSize,
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      },
    },
    code,
  );

  // Direction arrow trails the code so every row's left edge is the
  // code's first letter (a uniform column), never an arrow.
  const arrowEl = dir
    ? createElement(dir === 'response' ? ArrowDownOutlined : ArrowUpOutlined, {
        style: { fontSize: arrowSize, color, marginInlineStart: 2, flexShrink: 0 },
      })
    : null;

  // Lead slot: code then (optional) arrow. Fixed width in list mode so
  // the rule name after always starts at the same x — even for rows with
  // no arrow, the reserved width keeps the column aligned. Compact
  // surfaces (tabs, tooltips) hug the content instead.
  return createElement(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        ...(compactArrow ? {} : { width: ruleIconLeadWidth(size) }),
      },
    },
    codeEl,
    arrowEl,
  );
}
