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
  SendOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type React from 'react';
import { createElement } from 'react';

export interface RuleTypeMenuItem {
  key: string;
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
    label: 'Modify Request Body',
    description: 'Modify request/response body content (fetch/XHR only)',
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
];

/**
 * Build Ant Design menu items for rule creation menus.
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
