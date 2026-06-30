/**
 * Shared rule type menu definitions — used by Sidebar, TabBar, EmptyState,
 * CollectionOverview, FolderOverview, and popup RulesTable.
 *
 * Extension-supported types are clickable. Desktop-only types are shown
 * disabled with a tooltip explaining why.
 */

import {
  ClockCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  KeyOutlined,
  LinkOutlined,
  NotificationOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ExtensionRuleType } from '@openheaders/core/types';
import type React from 'react';
import { createElement } from 'react';
import { TEMPLATES_BY_TYPE } from './rule-templates';

export interface RuleTypeMenuItem {
  key: ExtensionRuleType;
  icon: React.ReactNode;
  label: string;
  description: string;
  desktopOnly: boolean;
}

/** All rule types with their menu metadata. Array order is the
 *  definitive display order across every create/picker menu (and the
 *  popup palette groups). */
export const ALL_RULE_TYPES: RuleTypeMenuItem[] = [
  {
    key: 'header',
    icon: <SwapOutlined />,
    label: 'Modify Headers',
    description: 'Add, override, or remove HTTP headers',
    desktopOnly: false,
  },
  {
    key: 'request-body',
    icon: <FileTextOutlined />,
    label: 'Modify API Request Body',
    description: 'Override or transform API request body (fetch/XHR only)',
    desktopOnly: false,
  },
  {
    key: 'response',
    icon: <DatabaseOutlined />,
    label: 'Modify API Response',
    description: 'Mock or modify API response status, body, and headers (fetch/XHR only)',
    desktopOnly: false,
  },
  {
    key: 'query-param',
    icon: <LinkOutlined />,
    label: 'Modify Query Params',
    description: 'Add, override, or remove URL parameters',
    desktopOnly: false,
  },
  {
    key: 'inject',
    icon: <CodeOutlined />,
    label: 'Inject Scripts/CSS',
    description: 'Inject JavaScript or CSS into pages',
    desktopOnly: false,
  },
  {
    key: 'ws',
    icon: <ThunderboltOutlined />,
    label: 'Modify WebSocket Messages',
    description: 'Replace, inject, or drop WebSocket frames (page sockets only)',
    desktopOnly: false,
  },
  {
    key: 'sse',
    icon: <NotificationOutlined />,
    label: 'Modify Server-Sent Events',
    description: 'Replace, inject, or drop SSE events (page streams only)',
    desktopOnly: false,
  },
  {
    key: 'block',
    icon: <StopOutlined />,
    label: 'Block Requests',
    description: 'Prevent requests from completing',
    desktopOnly: false,
  },
  {
    key: 'redirect',
    icon: <SendOutlined />,
    label: 'Redirect Requests',
    description: 'Redirect to a different URL',
    desktopOnly: false,
  },
  {
    key: 'delay',
    icon: <ClockCircleOutlined />,
    label: 'Delay Requests',
    description: 'Add latency to network requests (fetch/XHR only)',
    desktopOnly: false,
  },
  {
    key: 'auth',
    icon: <KeyOutlined />,
    label: 'Answer Auth Challenge',
    description: 'Provide credentials for an HTTP/proxy auth challenge (requires Debug mode)',
    desktopOnly: false,
  },
];

/** Short, behavior-colored codes shown in the rule-type picker menus in
 *  place of a line icon — lighter to scan than 11 glyphs. Color tokens
 *  live in rules.less (`--rule-<type>-color`, light + dark). The
 *  stateful sidebar/tab rule icons stay on `buildRuleIcon` (they carry
 *  active/paused/draft color + direction arrows, which a code can't). */
const RULE_TYPE_CODES: Record<ExtensionRuleType, string> = {
  header: 'HEAD',
  block: 'BLOCK',
  redirect: 'REDIR',
  'query-param': 'QUERY',
  inject: 'JS/CSS',
  'request-body': 'REQ',
  delay: 'DELAY',
  response: 'RES',
  ws: 'WS',
  sse: 'SSE',
  auth: 'AUTH',
};

/** Render a rule-type code badge — a neutral gradient fill (no hue) so
 *  it never reads as a status/scope color. Fixed-width slot keeps menu
 *  labels aligned across codes of different length. */
export function ruleTypeBadge(type: ExtensionRuleType): React.ReactNode {
  return createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        width: 48,
        flexShrink: 0,
        backgroundImage: 'linear-gradient(180deg, var(--rule-code-from), var(--rule-code-to))',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.03em',
        lineHeight: 1,
      },
    },
    RULE_TYPE_CODES[type],
  );
}

/**
 * Build Ant Design menu items for rule creation menus (no templates).
 */
export function buildRuleTypeMenuItems(onClick: (type: string) => void) {
  return ALL_RULE_TYPES.map((t) => ({
    key: t.key,
    icon: ruleTypeBadge(t.key),
    label: t.label,
    onClick: () => onClick(t.key),
  }));
}

/**
 * Build cascading menu: each rule type expands into Blank + its templates.
 *
 *   Modify Headers  →  Blank
 *                      🔓 CORS Bypass
 *                      🕵️ Custom User-Agent
 *                      ...
 *   Block Requests  →  Blank
 *                      🛡️ Block Trackers
 *                      ...
 */
export function buildRuleTypeMenuItemsWithTemplates(
  onClickType: (type: string) => void,
  onClickTemplate: (type: string, templateKey: string) => void,
) {
  return ALL_RULE_TYPES.map((t) => {
    const templates = TEMPLATES_BY_TYPE[t.key] ?? [];

    if (templates.length === 0) {
      // No templates — direct click
      return {
        key: t.key,
        icon: ruleTypeBadge(t.key),
        label: t.label,
        onClick: () => onClickType(t.key),
      };
    }

    // Has templates — cascading submenu
    return {
      key: t.key,
      icon: ruleTypeBadge(t.key),
      label: t.label,
      children: [
        {
          key: `${t.key}-blank`,
          label: 'Blank Rule',
          onClick: () => onClickType(t.key),
        },
        { type: 'divider' as const, key: `${t.key}-div` },
        ...templates.map((tpl) => ({
          key: `${t.key}-${tpl.key}`,
          label: `${tpl.icon} ${tpl.name}`,
          onClick: () => onClickTemplate(t.key, tpl.key),
        })),
      ],
    };
  });
}

/**
 * Build menu items for the Sidebar create menu. Mirrors
 * {@link buildRuleTypeMenuItems}; kept as a separate export so the
 * Sidebar's `menus.ts` can cast the result to its `ItemType[]` shape.
 */
export function buildRuleTypeMenuItemsCE(onClick: (type: string) => void) {
  return ALL_RULE_TYPES.map((t) => ({
    key: t.key,
    icon: ruleTypeBadge(t.key),
    label: t.label,
    onClick: () => onClick(t.key),
  }));
}
