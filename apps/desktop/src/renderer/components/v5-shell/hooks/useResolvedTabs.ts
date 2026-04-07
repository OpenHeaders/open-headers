/**
 * useResolvedTabs — derives live tab labels, icons, and tooltips from entity data.
 *
 * Tabs store only { id, type, entityId } as stable identifiers.
 * This hook enriches them with display properties (label, icon, tooltip)
 * by looking up the current source/rule/environment data on every render.
 *
 * This is the single source of truth for how a tab displays across:
 *   - TabBar (tab labels + icons + tooltips)
 *   - BreadcrumbBar (item name in the path)
 *   - Sidebar (already reads from entities directly)
 *
 * Architecture:
 *   Main process owns sources/rules/environments → broadcasts to renderer via IPC →
 *   renderer hooks (useSources, useHeaderRules, useEnvironments) hold live data →
 *   this hook maps entityId → live display properties.
 *   No copies, no stale labels.
 */

import type { Collection, Environment, Folder, HeaderRule, Source } from '@openheaders/core';
import { useMemo } from 'react';
import type { Tab } from './useTabs';

export interface ResolvedTab extends Tab {
  /** Display label derived from current entity data */
  resolvedLabel: string;
  /** Display icon derived from current entity data */
  resolvedIcon: string;
  /** Tooltip text for hover */
  resolvedTooltip: string;
}

export function useResolvedTabs(
  tabs: Tab[],
  sources: Source[],
  rules: HeaderRule[],
  environments: Environment[],
  collections?: Collection[],
  folders?: Folder[],
): ResolvedTab[] {
  return useMemo(() => {
    const sourceMap = new Map(sources.map((s) => [s.sourceId, s]));
    const ruleMap = new Map(rules.map((r) => [r.id, r]));
    const envMap = new Map(environments.map((e) => [e.id, e]));
    const collectionMap = new Map((collections ?? []).map((c) => [c.id, c]));
    const folderMap = new Map((folders ?? []).map((f) => [f.id, f]));

    return tabs.map((tab): ResolvedTab => {
      if ((tab.type === 'request' || tab.type === 'collection') && tab.entityId) {
        const source = sourceMap.get(tab.entityId);
        const name = source?.sourceName || source?.sourcePath || 'Untitled request';
        const url = source?.sourcePath || '';
        // If name and URL match (or URL is empty), show just the name; otherwise name + URL on two lines
        const tooltip = !url || name === url ? name : `${name}\n${url}`;
        return {
          ...tab,
          resolvedLabel: name,
          resolvedIcon: source?.sourceMethod || tab.icon || 'GET',
          resolvedTooltip: tooltip,
        };
      }

      if (tab.type === 'rule' && tab.entityId) {
        const rule = ruleMap.get(tab.entityId);
        return {
          ...tab,
          resolvedLabel: rule?.name || rule?.headerName || 'Untitled rule',
          resolvedIcon: 'rule',
          resolvedTooltip: rule?.headerName || 'Untitled rule',
        };
      }

      if (tab.type === 'environment' && tab.entityId) {
        const env = envMap.get(tab.entityId);
        const name = env?.name ?? tab.label;
        return {
          ...tab,
          resolvedLabel: env ? name : `${name} (deleted)`,
          resolvedIcon: 'environment',
          resolvedTooltip: name,
        };
      }

      if (tab.type === 'collection-overview' && tab.entityId) {
        const col = collectionMap.get(tab.entityId);
        return {
          ...tab,
          resolvedLabel: col?.name || tab.label,
          resolvedIcon: 'collection',
          resolvedTooltip: col?.name || tab.label,
        };
      }

      if (tab.type === 'folder-overview' && tab.entityId) {
        const folder = folderMap.get(tab.entityId);
        return {
          ...tab,
          resolvedLabel: folder?.name || tab.label,
          resolvedIcon: 'folder',
          resolvedTooltip: folder?.name || tab.label,
        };
      }

      // Overview, settings, globals, etc.
      return {
        ...tab,
        resolvedLabel: tab.label,
        resolvedIcon: tab.icon || '',
        resolvedTooltip: tab.label,
      };
    });
  }, [tabs, sources, rules, environments, collections, folders]);
}
