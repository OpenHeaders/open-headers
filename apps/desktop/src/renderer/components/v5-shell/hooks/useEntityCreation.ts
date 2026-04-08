/**
 * useEntityCreation — callbacks for creating and opening persisted entities.
 *
 * Extracted from V5Shell to reduce component size. Handles:
 *   - Opening singleton tabs (overview, settings, workspace variables)
 *   - Creating new environments (with collection context)
 *   - Create-and-activate environment (for env selector dropdown)
 *   - Opening the active environment tab
 *
 * Note: Request/rule creation requires IPC handlers not yet built.
 * Draft-based creation (useDraftSave) works for now.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import type { Tab } from './useTabs';

interface UseEntityCreationOptions {
  sources: V5.RequestNode[];
  rules: V5.Rule[];
  environments: V5.Environment[];
  collections: V5.Collection[];
  activeEnvironment: string | null;
  createEnvironment: (opts: { name: string }) => Promise<V5.Environment | null>;
  switchEnvironment: (name: string | null) => Promise<boolean> | Promise<void>;
  openTab: (tab: Omit<Tab, 'pinned' | 'unsaved'>) => void;
  setPendingRenameTabId: (tabId: string | null) => void;
}

export function useEntityCreation({
  sources,
  rules,
  environments,
  collections,
  activeEnvironment,
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
    async (_options?: { collectionId?: string; folderId?: string }) => {
      // TODO: add IPC handler for creating a rule in a collection
      // For now, use draft tabs (createDraftRule)
    },
    [],
  );

  const createNewSource = useCallback(
    async (_options?: { collectionId?: string; folderId?: string }) => {
      // TODO: add IPC handler for creating a request in a collection
      // For now, use draft tabs (createDraftSource)
    },
    [],
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
    createNewSource,
    createNewRule,
    createNewEnvironment,
    createAndActivateEnvironment,
    openActiveEnvironment,
  };
}
