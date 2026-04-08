/**
 * useEntityCreation — callbacks for creating and opening persisted entities.
 *
 * Extracted from V5Shell to reduce component size. Handles:
 *   - Opening singleton tabs (overview, settings, workspace variables)
 *   - Creating new environments (with collection context)
 *   - Create-and-activate environment (for env selector dropdown)
 *   - Opening the active environment tab
 *
 * Direct creation (createNewRequest/createNewRule) creates empty entities directly
 * in a collection when called with a collectionId. Draft-based creation (useDraftSave)
 * is the alternative path for entities without a pre-selected collection.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import type { Tab } from './useTabs';

interface UseEntityCreationOptions {
  requests: V5.RequestNode[];
  rules: V5.Rule[];
  environments: V5.Environment[];
  collections: V5.Collection[];
  activeEnvironment: string | null;
  addRequest: (collectionUid: string, request: Omit<V5.Request, 'uid' | 'path'>) => Promise<V5.Request | null>;
  addRule: (collectionUid: string, rule: Omit<V5.Rule, 'uid' | 'path'>) => Promise<V5.Rule | null>;
  createEnvironment: (opts: { name: string }) => Promise<V5.Environment | null>;
  switchEnvironment: (name: string | null) => Promise<boolean> | Promise<void>;
  openTab: (tab: Omit<Tab, 'pinned' | 'unsaved'>) => void;
  setPendingRenameTabId: (tabId: string | null) => void;
}

export function useEntityCreation({
  requests,
  rules,
  environments,
  collections,
  activeEnvironment,
  addRequest,
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
      if (!options?.collectionId) return;
      const existingNames = new Set(rules.map((r) => r.name));
      let name = 'New Rule';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Rule (${counter})`;
        counter++;
      }
      const rule = await addRule(options.collectionId, {
        type: 'header',
        name,
        enabled: true,
        tags: [],
        domains: [],
        action: { operation: 'add', headerName: '', isResponse: false },
        staticValue: '',
      } as Omit<V5.HeaderRule, 'uid' | 'path'>);
      if (rule) {
        const tabId = `rule-${rule.uid}`;
        openTab({ id: tabId, type: 'rule', label: rule.name, icon: 'rule', entityId: rule.uid });
        setPendingRenameTabId(tabId);
      }
    },
    [rules, addRule, openTab, setPendingRenameTabId],
  );

  const createNewRequest = useCallback(
    async (options?: { collectionId?: string; folderId?: string }) => {
      if (!options?.collectionId) return;
      const existingNames = new Set(requests.map((r) => r.name));
      let name = 'New Request';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Request (${counter})`;
        counter++;
      }
      const request = await addRequest(options.collectionId, {
        name,
        method: 'GET',
        url: '',
        headers: [],
        params: [],
        auth: { type: 'none' },
        body: { type: 'none' },
      });
      if (request) {
        const tabId = `request-${request.uid}`;
        openTab({ id: tabId, type: 'request', label: request.name, icon: request.method, entityId: request.uid });
        setPendingRenameTabId(tabId);
      }
    },
    [requests, addRequest, openTab, setPendingRenameTabId],
  );

  const createNewEnvironment = useCallback(
    async (_options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = new Set(environments.map((e) => e.name));
      let name = 'New Environment';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Environment (${counter})`;
        counter++;
      }
      const env = await createEnvironment({ name });
      if (env) {
        const tabId = `env-${env.name}`;
        openTab({ id: tabId, type: 'environment', label: name, icon: 'environment', entityId: env.name });
        setPendingRenameTabId(tabId);
      }
    },
    [environments, createEnvironment, openTab, setPendingRenameTabId],
  );

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
      const tabId = `env-${env.name}`;
      openTab({ id: tabId, type: 'environment', label: env.name, icon: 'environment', entityId: env.name });
      setPendingRenameTabId(tabId);
      void switchEnvironment(env.name);
    }
  }, [environments, createEnvironment, openTab, switchEnvironment, setPendingRenameTabId]);

  const openCollectionVariables = useCallback(
    (collectionId: string) => {
      const col = collections.find((c) => c.uid === collectionId);
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
    const env = activeEnvironment ? environments.find((e) => e.name === activeEnvironment) : environments[0];
    if (env) {
      openTab({
        id: `env-${env.name}`,
        type: 'environment',
        label: env.name,
        icon: 'environment',
        entityId: env.name,
      });
    } else {
      void createNewEnvironment();
    }
  }, [environments, activeEnvironment, openTab, createNewEnvironment]);

  return {
    openOverview,
    openSettings,
    openWorkspaceVariables,
    openCollectionVariables,
    createNewRequest,
    createNewRule,
    createNewEnvironment,
    createAndActivateEnvironment,
    openActiveEnvironment,
  };
}
