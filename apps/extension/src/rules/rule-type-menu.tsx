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
    description: 'Modify request/response body content',
    desktopOnly: true,
  },
  {
    key: 'delay',
    icon: <ClockCircleOutlined />,
    label: 'Delay Requests',
    description: 'Add latency to network requests',
    desktopOnly: true,
  },
  {
    key: 'mock',
    icon: <DatabaseOutlined />,
    label: 'Mock Response',
    description: 'Return a custom response without hitting the server',
    desktopOnly: true,
  },
];

/** Only extension-supported types (for creation flows). */
export const EXTENSION_RULE_TYPES = ALL_RULE_TYPES.filter((t) => !t.desktopOnly);

/** Only desktop-only types (shown disabled). */
export const DESKTOP_ONLY_RULE_TYPES = ALL_RULE_TYPES.filter((t) => t.desktopOnly);

const DESKTOP_ONLY_TOOLTIP = 'Available in desktop app — requires HTTP proxy';

/**
 * Build Ant Design menu items for rule creation menus.
 * Extension types call onClick, desktop-only types are disabled with tooltip.
 */
export function buildRuleTypeMenuItems(onClick: (type: string) => void) {
  return [
    ...EXTENSION_RULE_TYPES.map((t) => ({
      key: t.key,
      icon: t.icon,
      label: t.label,
      onClick: () => onClick(t.key),
    })),
    { type: 'divider' as const, key: 'div-desktop' },
    ...DESKTOP_ONLY_RULE_TYPES.map((t) => ({
      key: t.key,
      icon: t.icon,
      label: t.label,
      disabled: true,
      title: DESKTOP_ONLY_TOOLTIP,
    })),
  ];
}

/**
 * Build menu items using createElement (for Sidebar which avoids JSX in callbacks).
 */
export function buildRuleTypeMenuItemsCE(onClick: (type: string) => void) {
  return [
    ...EXTENSION_RULE_TYPES.map((t) => ({
      key: t.key,
      icon: createElement((t.icon as React.ReactElement).type as React.ComponentType<Record<string, unknown>>),
      label: t.label,
      onClick: () => onClick(t.key),
    })),
    { type: 'divider' as const, key: 'div-desktop' },
    ...DESKTOP_ONLY_RULE_TYPES.map((t) => ({
      key: t.key,
      icon: createElement((t.icon as React.ReactElement).type as React.ComponentType<Record<string, unknown>>),
      label: t.label,
      disabled: true,
      title: DESKTOP_ONLY_TOOLTIP,
    })),
  ];
}
