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
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { createElement } from 'react';
import { RULE_TYPE_CODES } from './components/shared/rule-codes';
import { TEMPLATES_BY_TYPE } from './rule-templates';

export interface RuleTypeMenuItem {
  key: ExtensionRuleType;
  icon: React.ReactNode;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  desktopOnly: boolean;
}

/** All rule types with their menu metadata. Array order is the
 *  definitive display order across every create/picker menu (and the
 *  popup palette groups). */
export const ALL_RULE_TYPES: RuleTypeMenuItem[] = [
  {
    key: 'header',
    icon: <SwapOutlined />,
    labelKey: 'shared.ruleTypes.header.label',
    descriptionKey: 'shared.ruleTypes.header.description',
    desktopOnly: false,
  },
  {
    key: 'request-body',
    icon: <FileTextOutlined />,
    labelKey: 'shared.ruleTypes.requestBody.label',
    descriptionKey: 'shared.ruleTypes.requestBody.description',
    desktopOnly: false,
  },
  {
    key: 'response',
    icon: <DatabaseOutlined />,
    labelKey: 'shared.ruleTypes.response.label',
    descriptionKey: 'shared.ruleTypes.response.description',
    desktopOnly: false,
  },
  {
    key: 'query-param',
    icon: <LinkOutlined />,
    labelKey: 'shared.ruleTypes.queryParam.label',
    descriptionKey: 'shared.ruleTypes.queryParam.description',
    desktopOnly: false,
  },
  {
    key: 'inject',
    icon: <CodeOutlined />,
    labelKey: 'shared.ruleTypes.inject.label',
    descriptionKey: 'shared.ruleTypes.inject.description',
    desktopOnly: false,
  },
  {
    key: 'ws',
    icon: <ThunderboltOutlined />,
    labelKey: 'shared.ruleTypes.ws.label',
    descriptionKey: 'shared.ruleTypes.ws.description',
    desktopOnly: false,
  },
  {
    key: 'sse',
    icon: <NotificationOutlined />,
    labelKey: 'shared.ruleTypes.sse.label',
    descriptionKey: 'shared.ruleTypes.sse.description',
    desktopOnly: false,
  },
  {
    key: 'block',
    icon: <StopOutlined />,
    labelKey: 'shared.ruleTypes.block.label',
    descriptionKey: 'shared.ruleTypes.block.description',
    desktopOnly: false,
  },
  {
    key: 'redirect',
    icon: <SendOutlined />,
    labelKey: 'shared.ruleTypes.redirect.label',
    descriptionKey: 'shared.ruleTypes.redirect.description',
    desktopOnly: false,
  },
  {
    key: 'delay',
    icon: <ClockCircleOutlined />,
    labelKey: 'shared.ruleTypes.delay.label',
    descriptionKey: 'shared.ruleTypes.delay.description',
    desktopOnly: false,
  },
  {
    key: 'auth',
    icon: <KeyOutlined />,
    labelKey: 'shared.ruleTypes.auth.label',
    descriptionKey: 'shared.ruleTypes.auth.description',
    desktopOnly: false,
  },
];

/** Render a fixed-width monospace code badge — a neutral gradient fill
 *  (no hue) so it never reads as a status/scope color. The fixed slot
 *  keeps menu labels aligned across codes of different length. */
function codeBadge(code: string): React.ReactNode {
  return createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        width: 48,
        flexShrink: 0,
        backgroundImage: 'linear-gradient(180deg, var(--rule-code-from, #6b7689), var(--rule-code-to, #3d4456))',
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
    code,
  );
}

/** Render a rule-type code badge (see {@link codeBadge}). */
export function ruleTypeBadge(type: ExtensionRuleType): React.ReactNode {
  return codeBadge(RULE_TYPE_CODES[type]);
}

/**
 * Build Ant Design menu items for rule creation menus (no templates).
 */
export function buildRuleTypeMenuItems(onClick: (type: string) => void, t: Translate) {
  return ALL_RULE_TYPES.map((rt) => ({
    key: rt.key,
    icon: ruleTypeBadge(rt.key),
    label: t(rt.labelKey),
    onClick: () => onClick(rt.key),
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
  t: Translate,
) {
  return ALL_RULE_TYPES.map((rt) => {
    const templates = TEMPLATES_BY_TYPE[rt.key] ?? [];

    if (templates.length === 0) {
      // No templates — direct click
      return {
        key: rt.key,
        icon: ruleTypeBadge(rt.key),
        label: t(rt.labelKey),
        onClick: () => onClickType(rt.key),
      };
    }

    // Has templates — cascading submenu
    return {
      key: rt.key,
      icon: ruleTypeBadge(rt.key),
      label: t(rt.labelKey),
      children: [
        {
          key: `${rt.key}-blank`,
          label: t('shared.ruleTemplates.blankRule'),
          onClick: () => onClickType(rt.key),
        },
        { type: 'divider' as const, key: `${rt.key}-div` },
        ...templates.map((tpl) => ({
          key: `${rt.key}-${tpl.key}`,
          label: `${tpl.icon} ${t(tpl.nameKey)}`,
          onClick: () => onClickTemplate(rt.key, tpl.key),
        })),
      ],
    };
  });
}

/** Badge for template-related rows ("Browse all templates…") — same
 *  fixed-width code-badge treatment as the rule-type rows above it. */
export function templatesBadge(): React.ReactNode {
  return codeBadge('TEMPL');
}

/**
 * Build menu items for the Sidebar create menu. Mirrors
 * {@link buildRuleTypeMenuItems}; kept as a separate export so the
 * Sidebar's `menus.ts` can cast the result to its `ItemType[]` shape.
 */
export function buildRuleTypeMenuItemsCE(onClick: (type: string) => void, t: Translate) {
  return ALL_RULE_TYPES.map((rt) => ({
    key: rt.key,
    icon: ruleTypeBadge(rt.key),
    label: t(rt.labelKey),
    onClick: () => onClick(rt.key),
  }));
}
