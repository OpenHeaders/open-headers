/**
 * useCommandPaletteData — builds the CommandPalette's navigable groups
 * (rule collections, system templates, user template collections) and
 * flat sections (create commands, layout/panel commands). Extracted
 * from App.tsx so the palette wiring doesn't drag ~150 LOC through the
 * workspace component.
 */

import { CodeSandboxOutlined, FolderOutlined, SettingOutlined } from '@ant-design/icons';
import { ApiRequestsIcon } from '@openheaders/ui/shared/icons';
import type { CollectionTree, Environment, Rule, Template, TreeNode } from '@openheaders/core/types';
import { useMemo } from 'react';
import type { CommandPaletteGroup, CommandPaletteItem, CommandPaletteSection } from '../components/shell/CommandPalette';
import { buildRuleIcon } from '../components/shared/rule-icon';
import { scopeBadge } from '../components/shared/scope-colors';
import { renderTwoToneIcon } from '../components/shared/TwoToneIconPicker';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import { allCategories, allDefs, resolveDescription, resolveLabel } from '../settings';
import { getRuleTypeLabel } from './useTabOpeners';

interface UseCommandPaletteDataOptions {
  rules: Rule[];
  templates: Template[];
  localCollectionTrees: CollectionTree[];
  templateCollectionTrees: CollectionTree[];
  requestCollectionTrees: CollectionTree[];
  /** Effective paused uids — drives the yellow icon on rule items in the palette. */
  pausedUids: ReadonlySet<string>;
  environments: Environment[];
  openEditTab: (uid: string) => void;
  openCreateTab: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  openTemplateEditTab: (uid: string) => void;
  openRequestEditTab: (uid: string, name: string, method?: string) => void;
  openEnvironmentEdit: (uid: string, name: string) => void;
  openWorkspaceVariables: () => void;
  openVault: () => void;
  openScriptPackages: () => void;
  openLiveVariables: () => void;
  onOpenCreateMenu: () => void;
  onTogglePanel: (panel: 'sidebar' | 'bottomPanel' | 'inspector') => void;
  onToggleActivityFeed: () => void;
  onShowShortcuts: () => void;
  onOpenSettings: (target?: { settingKey?: string; categoryId?: string }) => void;
}

export interface CommandPaletteData {
  groups: CommandPaletteGroup[];
  sections: CommandPaletteSection[];
}

export function useCommandPaletteData(opts: UseCommandPaletteDataOptions): CommandPaletteData {
  const {
    rules,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    pausedUids,
    environments,
    openEditTab,
    openCreateTab,
    openTemplateEditTab,
    openRequestEditTab,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openScriptPackages,
    openLiveVariables,
    onOpenCreateMenu,
    onTogglePanel,
    onToggleActivityFeed,
    onShowShortcuts,
    onOpenSettings,
  } = opts;

  const t = useT();

  const groups = useMemo((): CommandPaletteGroup[] => {
    const result: CommandPaletteGroup[] = [];

    for (const col of localCollectionTrees) {
      const ruleItems: CommandPaletteItem[] = [];
      const walk = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'rule') {
            const rule = rules.find((r) => r.uid === node.uid);
            const paused = pausedUids.has(node.uid);
            ruleItems.push({
              id: `rule-${node.uid}`,
              icon: buildRuleIcon({
                ruleType: node.ruleType,
                rule,
                isActive: node.enabled && !paused,
                paused,
              }),
              label: node.name,
              scope: getRuleTypeLabel(node.ruleType, t),
              onSelect: () => openEditTab(node.uid),
            });
          } else if (node.type === 'folder') {
            walk(node.children);
          }
        }
      };
      walk(col.tree);
      result.push({
        id: `col-${col.uid}`,
        icon: <FolderOutlined style={{ fontSize: 12 }} />,
        label: col.name,
        children: [{ id: `rules-in-${col.uid}`, title: t('workbench.shell.commandPalette.group.rules'), items: ruleItems }],
      });
    }

    const systemSections: CommandPaletteSection[] = [];
    for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
      if (tpls.length === 0) continue;
      systemSections.push({
        id: `sys-tpl-${ruleType}`,
        title: getRuleTypeLabel(ruleType, t),
        items: tpls.map((tpl) => ({
          id: `sys-tpl-${tpl.key}`,
          icon: <span style={{ fontSize: 12 }}>{tpl.icon}</span>,
          label: t(tpl.nameKey),
          scope: t(tpl.descriptionKey),
          onSelect: () => openCreateTab(ruleType, undefined, tpl.key),
        })),
      });
    }
    result.push({
      id: 'sys-templates',
      icon: <FolderOutlined style={{ fontSize: 12 }} />,
      label: t('workbench.shell.commandPalette.group.systemTemplates'),
      children: systemSections,
    });

    for (const col of templateCollectionTrees) {
      const tplItems: CommandPaletteItem[] = [];
      const walkTpl = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'template') {
            tplItems.push({
              id: `tpl-${node.uid}`,
              icon:
                renderTwoToneIcon(node.icon, { fontSize: 12 }) ||
                buildRuleIcon({ ruleType: node.ruleType, isActive: false }),
              label: node.name,
              scope: getRuleTypeLabel(node.ruleType, t),
              onSelect: () => openTemplateEditTab(node.uid),
            });
          } else if (node.type === 'folder') {
            walkTpl(node.children);
          }
        }
      };
      walkTpl(col.tree);
      if (tplItems.length > 0) {
        result.push({
          id: `tpl-col-${col.uid}`,
          icon: <FolderOutlined style={{ fontSize: 12 }} />,
          label: col.name,
          children: [{ id: `tpls-in-${col.uid}`, title: t('workbench.shell.commandPalette.group.templates'), items: tplItems }],
        });
      }
    }

    // Request collections — one group per collection, same shape as
    // the workbench/templates groups so command-palette navigation is
    // uniform.
    for (const col of requestCollectionTrees) {
      const requestItems: CommandPaletteItem[] = [];
      const walkReq = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'request') {
            requestItems.push({
              id: `req-${node.uid}`,
              icon: <ApiRequestsIcon style={{ fontSize: 12 }} />,
              label: node.name,
              scope: node.method,
              onSelect: () => openRequestEditTab(node.uid, node.name, node.method),
            });
          } else if (node.type === 'folder') {
            walkReq(node.children);
          }
        }
      };
      walkReq(col.tree);
      if (requestItems.length > 0) {
        result.push({
          id: `req-col-${col.uid}`,
          icon: <ApiRequestsIcon style={{ fontSize: 12 }} />,
          label: col.name,
          children: [{ id: `reqs-in-${col.uid}`, title: t('workbench.shell.commandPalette.group.requests'), items: requestItems }],
        });
      }
    }

    // Settings group — one drill target with one section per category,
    // each section holding the settings that belong to it. Label items
    // as "Category: Setting Label" so a non-drilled search still finds
    // them by either field.
    const settingsSections: CommandPaletteSection[] = [];
    for (const cat of allCategories()) {
      const catLabel = resolveLabel(cat, t);
      const items: CommandPaletteItem[] = [];
      for (const def of allDefs()) {
        if (def.category !== cat.id) continue;
        items.push({
          id: `setting-${def.key}`,
          icon: <SettingOutlined style={{ fontSize: 12 }} />,
          label: `${catLabel}: ${resolveLabel(def, t)}`,
          scope: resolveDescription(def, t),
          onSelect: () => onOpenSettings({ settingKey: def.key }),
        });
      }
      if (items.length === 0) continue;
      settingsSections.push({ id: `settings-cat-${cat.id}`, title: catLabel, items });
    }
    if (settingsSections.length > 0) {
      result.push({
        id: 'settings',
        icon: <SettingOutlined style={{ fontSize: 12 }} />,
        label: t('workbench.shell.commandPalette.group.settings'),
        children: settingsSections,
      });
    }

    return result;
  }, [
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    rules,
    pausedUids,
    openEditTab,
    openCreateTab,
    openRequestEditTab,
    openTemplateEditTab,
    onOpenSettings,
    t,
  ]);

  const newRuleLabel = useShortcutLabel('new-rule');
  const showShortcutsLabel = useShortcutLabel('show-shortcuts');
  const toggleLeftSidebarLabel = useShortcutLabel('toggle-left-sidebar');
  const toggleBottomPanelLabel = useShortcutLabel('toggle-bottom-panel');
  const toggleRightSidebarLabel = useShortcutLabel('toggle-right-sidebar');
  const toggleActivityFeedLabel = useShortcutLabel('toggle-activity-feed');
  const openSettingsLabel = useShortcutLabel('open-settings');

  const sections = useMemo((): CommandPaletteSection[] => {
    const result: CommandPaletteSection[] = [];
    const ruleTypes = [
      'header',
      'block',
      'redirect',
      'query-param',
      'inject',
      'delay',
      'request-body',
      'response',
      'ws',
      'sse',
    ] as const;
    result.push({
      id: 'create',
      title: t('workbench.shell.commandPalette.section.create'),
      items: [
        {
          id: 'cmd-create-rule',
          label: t('workbench.shell.commandPalette.cmd.createItem'),
          shortcut: newRuleLabel,
          onSelect: onOpenCreateMenu,
        },
        ...ruleTypes.map((type) => ({
          id: `cmd-new-${type}`,
          icon: buildRuleIcon({ ruleType: type, isActive: true }),
          label: t('workbench.shell.commandPalette.cmd.newRuleType', { type: getRuleTypeLabel(type, t) }),
          onSelect: () => openCreateTab(type),
        })),
      ],
    });

    result.push({
      id: 'commands',
      title: t('workbench.shell.commandPalette.section.commands'),
      items: [
        {
          id: 'cmd-toggle-left-sidebar',
          label: t('workbench.shell.commandPalette.cmd.toggleLeftSidebar'),
          shortcut: toggleLeftSidebarLabel,
          onSelect: () => onTogglePanel('sidebar'),
        },
        {
          id: 'cmd-toggle-right-sidebar',
          label: t('workbench.shell.commandPalette.cmd.toggleRightSidebar'),
          shortcut: toggleRightSidebarLabel,
          onSelect: () => onTogglePanel('inspector'),
        },
        {
          id: 'cmd-toggle-bottom-panel',
          label: t('workbench.shell.commandPalette.cmd.toggleBottomPanel'),
          shortcut: toggleBottomPanelLabel,
          onSelect: () => onTogglePanel('bottomPanel'),
        },
        {
          id: 'cmd-toggle-activity-feed',
          label: t('workbench.shell.commandPalette.cmd.toggleActivityFeed'),
          shortcut: toggleActivityFeedLabel,
          onSelect: onToggleActivityFeed,
        },
        {
          id: 'cmd-shortcuts',
          label: t('workbench.shell.commandPalette.cmd.keyboardShortcuts'),
          shortcut: showShortcutsLabel,
          onSelect: onShowShortcuts,
        },
        {
          id: 'cmd-open-settings',
          label: t('workbench.shell.commandPalette.cmd.openSettings'),
          shortcut: openSettingsLabel,
          onSelect: onOpenSettings,
        },
      ],
    });

    const variableItems: CommandPaletteItem[] = [
      {
        id: 'cmd-open-workspace-vars',
        icon: scopeBadge('workspace'),
        label: t('workbench.shell.commandPalette.cmd.openWorkspaceVariables'),
        onSelect: openWorkspaceVariables,
      },
      {
        id: 'cmd-open-vault',
        icon: scopeBadge('vault'),
        label: t('workbench.shell.commandPalette.cmd.openVault'),
        onSelect: openVault,
      },
      {
        id: 'cmd-open-live-vars',
        icon: scopeBadge('live'),
        label: t('workbench.shell.commandPalette.cmd.openLiveVariables'),
        onSelect: openLiveVariables,
      },
      {
        id: 'cmd-open-script-packages',
        icon: <CodeSandboxOutlined />,
        label: t('workbench.shell.commandPalette.cmd.openPackageLibrary'),
        onSelect: openScriptPackages,
      },
      ...environments.map((env) => ({
        id: `cmd-open-env-${env.uid}`,
        icon: scopeBadge('environment'),
        label: t('workbench.shell.commandPalette.cmd.openEnvironment', { name: env.name }),
        onSelect: () => openEnvironmentEdit(env.uid, env.name),
      })),
    ];
    result.push({
      id: 'variables',
      title: t('workbench.shell.commandPalette.section.variables'),
      items: variableItems,
    });

    return result;
  }, [
    t,
    openCreateTab,
    onOpenCreateMenu,
    onTogglePanel,
    onToggleActivityFeed,
    onShowShortcuts,
    onOpenSettings,
    newRuleLabel,
    showShortcutsLabel,
    toggleLeftSidebarLabel,
    toggleBottomPanelLabel,
    toggleRightSidebarLabel,
    toggleActivityFeedLabel,
    openSettingsLabel,
    environments,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openScriptPackages,
    openLiveVariables,
  ]);

  return { groups, sections };
}
