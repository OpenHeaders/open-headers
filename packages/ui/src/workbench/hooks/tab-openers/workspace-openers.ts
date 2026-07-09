/**
 * Workspace-level tab openers — mostly singleton tabs (settings,
 * workspace manager, workspace variables, vault) plus run reports,
 * rule-flow views, and environment edit tabs.
 */

import { useCallback } from 'react';
import type { RuleFlowScope } from '../../types';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export type WorkspaceOpeners = Pick<
  UseTabOpenersApi,
  | 'openRunReport'
  | 'openRuleFlow'
  | 'openSettingsTab'
  | 'openWorkspaceManager'
  | 'openEnvironmentEdit'
  | 'openWorkspaceVariables'
  | 'openVault'
  | 'openScriptPackages'
>;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

export function useWorkspaceOpeners({
  allTabs,
  addTab,
  switchTab,
  updateTab,
  setPendingRenameTabId,
}: TabOpenerContext): WorkspaceOpeners {
  const openRunReport = useCallback(
    (
      runId: string,
      owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
      ownerName?: string,
    ) => {
      const id = `run-${runId}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const label = ownerName ? `Test Run · ${ownerName}` : 'Test Run';
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'run-report',
        testRunId: runId,
        testOwnerType: owner?.type,
        testOwnerId: owner?.id,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openRuleFlow = useCallback(
    (scope: RuleFlowScope, entityId?: string, label?: string, page?: { url: string; tabId?: number }) => {
      const id = entityId ? `flow-${entityId}` : `flow-${scope}`;
      const pageHost = scope === 'this-page' && page ? hostnameOf(page.url) : null;
      const flowLabel = label
        ? `Flow — ${label}`
        : scope === 'all-active'
          ? 'Flow — All Active Rules'
          : `Flow — ${pageHost ?? 'This Page'}`;
      if (allTabs.some((t) => t.id === id)) {
        // Reused this-page flow tab: retarget it to the page the gesture
        // came from — the URL (and hence the matched rule set) may have
        // changed since the tab was first opened.
        if (page) updateTab(id, { label: flowLabel, flowTabUrl: page.url, flowBrowserTabId: page.tabId });
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: flowLabel,
        ruleType: '',
        dirty: false,
        mode: 'rule-flow',
        entityId,
        flowScope: scope,
        flowTabUrl: page?.url,
        flowBrowserTabId: page?.tabId,
      });
    },
    [allTabs, addTab, switchTab, updateTab],
  );

  const openSettingsTab = useCallback(
    (options?: { settingKey?: string; categoryId?: string }) => {
      const id = 'settings';
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: 'Settings',
        ruleType: '',
        dirty: false,
        mode: 'settings',
        settingsInitialKey: options?.settingKey,
        settingsInitialCategory: options?.categoryId,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openWorkspaceManager = useCallback(() => {
    const id = 'workspace-manager';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Workspaces',
      ruleType: '',
      dirty: false,
      mode: 'workspace-manager',
    });
  }, [allTabs, addTab, switchTab]);

  const openEnvironmentEdit = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `env-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        if (autoRename) setPendingRenameTabId(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'env-edit',
        environmentUid: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openWorkspaceVariables = useCallback(() => {
    const id = 'workspace-vars';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Workspace Variables',
      ruleType: '',
      dirty: false,
      mode: 'workspace-vars',
    });
  }, [allTabs, addTab, switchTab]);

  const openVault = useCallback(() => {
    const id = 'vault';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Vault',
      ruleType: '',
      dirty: false,
      mode: 'vault',
    });
  }, [allTabs, addTab, switchTab]);

  const openScriptPackages = useCallback(() => {
    const id = 'script-packages';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Package Library',
      ruleType: '',
      dirty: false,
      mode: 'script-packages',
    });
  }, [allTabs, addTab, switchTab]);

  return {
    openRunReport,
    openRuleFlow,
    openSettingsTab,
    openWorkspaceManager,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openScriptPackages,
  };
}
