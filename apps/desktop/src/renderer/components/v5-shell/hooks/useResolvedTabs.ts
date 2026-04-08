/**
 * useResolvedTabs — derives live tab labels, icons, and tooltips from entity data.
 *
 * Tabs store only { id, type, entityId } as stable identifiers.
 * This hook enriches them with display properties (label, icon, tooltip)
 * by looking up the current request/rule/environment data on every render.
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import type { Tab } from './useTabs';

export interface ResolvedTab extends Tab {
  resolvedLabel: string;
  resolvedIcon: string;
  resolvedTooltip: string;
}

export function useResolvedTabs(
  tabs: Tab[],
  requests: V5.RequestNode[],
  rules: V5.Rule[],
  environments: V5.Environment[],
  collections?: V5.Collection[],
): ResolvedTab[] {
  return useMemo(() => {
    const requestMap = new Map(requests.map((r) => [r.uid, r]));
    const ruleMap = new Map(rules.map((r) => [r.uid, r]));
    const envMap = new Map(environments.map((e) => [e.name, e]));
    const collectionMap = new Map((collections ?? []).map((c) => [c.uid, c]));

    return tabs.map((tab): ResolvedTab => {
      if ((tab.type === 'request' || tab.type === 'collection') && tab.entityId) {
        const request = requestMap.get(tab.entityId);
        const name = request?.name || 'Untitled request';
        return {
          ...tab,
          resolvedLabel: name,
          resolvedIcon: request?.method || tab.icon || 'GET',
          resolvedTooltip: name,
        };
      }

      if (tab.type === 'rule' && tab.entityId) {
        const rule = ruleMap.get(tab.entityId);
        return {
          ...tab,
          resolvedLabel: rule?.name || 'Untitled rule',
          resolvedIcon: 'rule',
          resolvedTooltip: rule?.name || 'Untitled rule',
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

      if (tab.type === 'collection-variables' && tab.entityId) {
        const col = collectionMap.get(tab.entityId);
        const name = col ? `${col.name} — Variables` : tab.label;
        return {
          ...tab,
          resolvedLabel: name,
          resolvedIcon: 'collection-variables',
          resolvedTooltip: name,
        };
      }

      // Overview, settings, globals, folder-overview, etc.
      return {
        ...tab,
        resolvedLabel: tab.label,
        resolvedIcon: tab.icon || '',
        resolvedTooltip: tab.label,
      };
    });
  }, [tabs, requests, rules, environments, collections]);
}
