/**
 * useEntityCreation — callbacks for creating and opening persisted entities.
 *
 * Extracted from V5Shell to reduce component size. Handles:
 *   - Opening singleton tabs (overview, settings, workspace variables)
 *   - Creating new sources, rules, environments (with collection/folder context)
 *   - Create-and-activate environment (for env selector dropdown)
 *   - Opening the active environment tab
 */

import type { Collection, Environment, HeaderRule, Source } from '@openheaders/core';
import { useCallback } from 'react';
import type { Tab } from './useTabs';

interface UseEntityCreationOptions {
  sources: Source[];
  rules: HeaderRule[];
  environments: Environment[];
  collections: Collection[];
  activeEnvironment: string | null;
  addSource: (source: Source) => Promise<Source | null>;
  addRule: (rule: Partial<HeaderRule>) => Promise<HeaderRule | null>;
  createEnvironment: (opts: { name: string; collectionId?: string; folderId?: string }) => Promise<Environment | null>;
  switchEnvironment: (envId: string) => Promise<boolean> | Promise<void>;
  openTab: (tab: Omit<Tab, 'pinned' | 'unsaved'>) => void;
  setPendingRenameTabId: (tabId: string | null) => void;
}

export function useEntityCreation({
  sources,
  rules,
  environments,
  collections,
  activeEnvironment,
  addSource,
  addRule,
  createEnvironment,
  switchEnvironment,
  openTab,
  setPendingRenameTabId,
}: UseEntityCreationOptions) {
  const openOverview = useCallback(() => {
    openTab({ id: 'overview', type: 'overview', label: 'Overview', icon: 'overview' });
  }, [openTab]);

  const openSettings = useCallback(() => {
    openTab({ id: 'settings', type: 'settings', label: 'Settings', icon: 'settings' });
  }, [openTab]);

  const openWorkspaceVariables = useCallback(() => {
    openTab({ id: 'globals', type: 'globals', label: 'Workspace Variables', icon: 'globals' });
  }, [openTab]);

  const createNewRule = useCallback(
    async (options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = new Set(rules.map((r) => r.name));
      let name = 'New Rule';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Rule (${counter})`;
        counter++;
      }
      const newRule: Partial<HeaderRule> = {
        type: 'header',
        name,
        description: '',
        isEnabled: true,
        domains: [],
        headerName: '',
        headerValue: '',
        tag: '',
        isResponse: false,
        isDynamic: false,
        sourceId: null,
        prefix: '',
        suffix: '',
        hasEnvVars: false,
        envVars: [],
        collectionId: options?.collectionId,
        folderId: options?.folderId,
      };
      const rule = await addRule(newRule);
      if (rule) {
        openTab({ id: `rule-${rule.id}`, type: 'rule', label: name, icon: 'rule', entityId: rule.id });
      }
    },
    [addRule, openTab, rules],
  );

  const createNewSource = useCallback(
    async (options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = new Set(sources.map((s) => s.sourceName));
      let name = 'New Request';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Request (${counter})`;
        counter++;
      }
      const newSource: Source = {
        sourceId: '',
        sourceType: 'http',
        sourcePath: '',
        sourceMethod: 'GET',
        sourceName: name,
        sourceTag: '',
        sourceContent: null,
        requestOptions: { contentType: 'application/json' },
        jsonFilter: { enabled: false },
        refreshOptions: { enabled: false },
        activationState: 'inactive',
        collectionId: options?.collectionId,
        folderId: options?.folderId,
      };
      const source = await addSource(newSource);
      if (source) {
        openTab({
          id: `source-${source.sourceId}`,
          type: 'request',
          label: name,
          icon: 'GET',
          entityId: source.sourceId,
        });
      }
    },
    [addSource, openTab, sources],
  );

  const createNewEnvironment = useCallback(
    async (options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = new Set(environments.map((e) => e.name));
      let name = 'New Environment';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Environment (${counter})`;
        counter++;
      }
      const env = await createEnvironment({ name, collectionId: options?.collectionId, folderId: options?.folderId });
      if (env) {
        const tabId = `env-${env.id}`;
        openTab({ id: tabId, type: 'environment', label: name, icon: 'environment', entityId: env.id });
        setPendingRenameTabId(tabId);
      }
    },
    [environments, createEnvironment, openTab, setPendingRenameTabId],
  );

  // Create + activate — used by the env selector dropdown (not the sidebar create flow)
  const createAndActivateEnvironment = useCallback(async () => {
    const existingNames = new Set(environments.map((e) => e.name));
    let name = 'New Environment';
    let counter = 2;
    while (existingNames.has(name)) {
      name = `New Environment (${counter})`;
      counter++;
    }
    const env = await createEnvironment({ name });
    if (env) {
      const tabId = `env-${env.id}`;
      openTab({ id: tabId, type: 'environment', label: env.name, icon: 'environment', entityId: env.id });
      setPendingRenameTabId(tabId);
      void switchEnvironment(env.id);
    }
  }, [environments, createEnvironment, openTab, switchEnvironment, setPendingRenameTabId]);

  const openCollectionVariables = useCallback(
    (collectionId: string) => {
      const col = collections.find((c) => c.id === collectionId);
      const label = col ? `${col.name} — Variables` : 'Collection Variables';
      openTab({
        id: `col-vars-${collectionId}`,
        type: 'collection-variables',
        label,
        icon: 'collection-variables',
        entityId: collectionId,
      });
    },
    [collections, openTab],
  );

  const openActiveEnvironment = useCallback(() => {
    const env = activeEnvironment ? environments.find((e) => e.id === activeEnvironment) : environments[0];
    if (env) {
      openTab({ id: `env-${env.id}`, type: 'environment', label: env.name, icon: 'environment', entityId: env.id });
    } else {
      void createNewEnvironment();
    }
  }, [environments, activeEnvironment, openTab, createNewEnvironment]);

  return {
    openOverview,
    openSettings,
    openWorkspaceVariables,
    openCollectionVariables,
    createNewSource,
    createNewRule,
    createNewEnvironment,
    createAndActivateEnvironment,
    openActiveEnvironment,
  };
}
