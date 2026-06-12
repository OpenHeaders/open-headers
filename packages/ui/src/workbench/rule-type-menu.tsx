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

/** All rule types with their menu metadata. */
export const ALL_RULE_TYPES: RuleTypeMenuItem[] = [
  {
    key: 'header',
    icon: <SwapOutlined />,
    label: 'Modify Headers',
    description: 'Add, override, or remove HTTP headers',
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
    key: 'body',
    icon: <FileTextOutlined />,
    label: 'Modify API Request Body',
    description: 'Override or transform API request body (fetch/XHR only)',
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
    key: 'mock',
    icon: <DatabaseOutlined />,
    label: 'Modify API Response',
    description: 'Override API response status code and body (fetch/XHR only)',
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
];

/**
 * Build Ant Design menu items for rule creation menus (no templates).
 */
export function buildRuleTypeMenuItems(onClick: (type: string) => void) {
  return ALL_RULE_TYPES.map((t) => ({
    key: t.key,
    icon: t.icon,
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
        icon: t.icon,
        label: t.label,
        onClick: () => onClickType(t.key),
      };
    }

    // Has templates — cascading submenu
    return {
      key: t.key,
      icon: t.icon,
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
 * Build menu items using createElement (for Sidebar which avoids JSX in callbacks).
 */
export function buildRuleTypeMenuItemsCE(onClick: (type: string) => void) {
  return ALL_RULE_TYPES.map((t) => ({
    key: t.key,
    icon: createElement((t.icon as React.ReactElement).type as React.ComponentType<Record<string, unknown>>),
    label: t.label,
    onClick: () => onClick(t.key),
  }));
}
