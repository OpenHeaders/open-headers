/**
 * useCommandPaletteData — builds the CommandPalette's navigable groups
 * (rule collections, system templates, user template collections) and
 * flat sections (create commands, layout/panel commands). Extracted
 * from App.tsx so the palette wiring doesn't drag ~150 LOC through the
 * workspace component.
 */

import { FolderOutlined, SettingOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import type { CommandPaletteGroup, CommandPaletteItem, CommandPaletteSection } from '../components/CommandPalette';
import { buildRuleIcon } from '../components/shared/rule-icon';
import { renderTwoToneIcon } from '../components/TwoToneIconPicker';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import { allCategories, allDefs } from '../settings';
import { getRuleTypeLabel } from './useTabOpeners';

interface UseCommandPaletteDataOptions {
  rules: V5.Rule[];
  templates: V5.Template[];
  localCollectionTrees: V5.CollectionTree[];
  templateCollectionTrees: V5.CollectionTree[];
  /** Effective paused uids — drives the yellow icon on rule items in the palette. */
  pausedUids: ReadonlySet<string>;
  openEditTab: (uid: string) => void;
  openCreateTab: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  openTemplateEditTab: (uid: string) => void;
  onOpenCreateMenu: () => void;
  onTogglePanel: (panel: 'sidebar' | 'bottomPanel' | 'inspector') => void;
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
    templates,
    localCollectionTrees,
    templateCollectionTrees,
    pausedUids,
    openEditTab,
    openCreateTab,
    openTemplateEditTab,
    onOpenCreateMenu,
    onTogglePanel,
    onShowShortcuts,
    onOpenSettings,
  } = opts;

  const groups = useMemo((): CommandPaletteGroup[] => {
    const result: CommandPaletteGroup[] = [];

    for (const col of localCollectionTrees) {
      const ruleItems: CommandPaletteItem[] = [];
      const walk = (nodes: V5.TreeNode[]) => {
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
              scope: getRuleTypeLabel(node.ruleType),
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
        children: [{ id: `rules-in-${col.uid}`, title: 'Rules', items: ruleItems }],
      });
    }

    const systemSections: CommandPaletteSection[] = [];
    for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
      if (tpls.length === 0) continue;
      systemSections.push({
        id: `sys-tpl-${ruleType}`,
        title: getRuleTypeLabel(ruleType),
        items: tpls.map((tpl) => ({
          id: `sys-tpl-${tpl.key}`,
          icon: <span style={{ fontSize: 12 }}>{tpl.icon}</span>,
          label: tpl.name,
          scope: tpl.description,
          onSelect: () => openCreateTab(ruleType, undefined, tpl.key),
        })),
      });
    }
    result.push({
      id: 'sys-templates',
      icon: <FolderOutlined style={{ fontSize: 12 }} />,
      label: 'System Templates',
      children: systemSections,
    });

    for (const col of templateCollectionTrees) {
      const tplItems: CommandPaletteItem[] = [];
      const walkTpl = (nodes: V5.TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'template') {
            tplItems.push({
              id: `tpl-${node.uid}`,
              icon:
                renderTwoToneIcon(node.icon, { fontSize: 12 }) ||
                buildRuleIcon({ ruleType: node.ruleType, isActive: false }),
              label: node.name,
              scope: getRuleTypeLabel(node.ruleType),
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
          children: [{ id: `tpls-in-${col.uid}`, title: 'Templates', items: tplItems }],
        });
      }
    }

    // Settings group — one drill target with one section per category,
    // each section holding the settings that belong to it. Label items
    // as "Category: Setting Label" so a non-drilled search still finds
    // them by either field.
    const settingsSections: CommandPaletteSection[] = [];
    for (const cat of allCategories()) {
      const items: CommandPaletteItem[] = [];
      for (const def of allDefs()) {
        if (def.category !== cat.id) continue;
        items.push({
          id: `setting-${def.key}`,
          icon: <SettingOutlined style={{ fontSize: 12 }} />,
          label: `${cat.label}: ${def.label}`,
          scope: def.description,
          onSelect: () => onOpenSettings({ settingKey: def.key }),
        });
      }
      if (items.length === 0) continue;
      settingsSections.push({ id: `settings-cat-${cat.id}`, title: cat.label, items });
    }
    if (settingsSections.length > 0) {
      result.push({
        id: 'settings',
        icon: <SettingOutlined style={{ fontSize: 12 }} />,
        label: 'Settings',
        children: settingsSections,
      });
    }

    return result;
  }, [
    localCollectionTrees,
    templateCollectionTrees,
    rules,
    pausedUids,
    openEditTab,
    openCreateTab,
    openTemplateEditTab,
    onOpenSettings,
  ]);

  const newRuleLabel = useShortcutLabel('new-rule');
  const toggleSidebarLabel = useShortcutLabel('toggle-sidebar');
  const toggleBottomLabel = useShortcutLabel('toggle-bottom');
  const toggleInspectorLabel = useShortcutLabel('toggle-inspector');
  const openSettingsLabel = useShortcutLabel('open-settings');

  const sections = useMemo((): CommandPaletteSection[] => {
    const result: CommandPaletteSection[] = [];
    const ruleTypes = ['header', 'block', 'redirect', 'query-param', 'inject', 'delay', 'body', 'mock'] as const;
    result.push({
      id: 'create',
      title: 'Create',
      items: [
        {
          id: 'cmd-create-rule',
          label: 'Create Rule...',
          shortcut: newRuleLabel,
          onSelect: onOpenCreateMenu,
        },
        ...ruleTypes.map((type) => ({
          id: `cmd-new-${type}`,
          icon: buildRuleIcon({ ruleType: type, isActive: true }),
          label: `New ${getRuleTypeLabel(type)}`,
          onSelect: () => openCreateTab(type),
        })),
      ],
    });

    result.push({
      id: 'commands',
      title: 'Commands',
      items: [
        {
          id: 'cmd-toggle-sidebar',
          label: 'Toggle Sidebar',
          shortcut: toggleSidebarLabel,
          onSelect: () => onTogglePanel('sidebar'),
        },
        {
          id: 'cmd-toggle-bottom',
          label: 'Toggle Bottom Panel',
          shortcut: toggleBottomLabel,
          onSelect: () => onTogglePanel('bottomPanel'),
        },
        {
          id: 'cmd-toggle-inspector',
          label: 'Toggle Inspector',
          shortcut: toggleInspectorLabel,
          onSelect: () => onTogglePanel('inspector'),
        },
        {
          id: 'cmd-shortcuts',
          label: 'Keyboard Shortcuts',
          shortcut: '?',
          onSelect: onShowShortcuts,
        },
        {
          id: 'cmd-open-settings',
          label: 'Open Settings',
          shortcut: openSettingsLabel,
          onSelect: onOpenSettings,
        },
      ],
    });

    return result;
  }, [
    openCreateTab,
    onOpenCreateMenu,
    onTogglePanel,
    onShowShortcuts,
    onOpenSettings,
    newRuleLabel,
    toggleSidebarLabel,
    toggleBottomLabel,
    toggleInspectorLabel,
    openSettingsLabel,
  ]);

  return { groups, sections };
}
