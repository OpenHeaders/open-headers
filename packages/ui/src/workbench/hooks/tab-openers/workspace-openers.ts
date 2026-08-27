/**
 * Workspace-level tab openers — mostly singleton tabs (settings,
 * workspace manager, workspace variables, vault) plus environment
 * edit tabs.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useCallback } from 'react';
import { SERVER_ADMIN_SECTION_MAP, serverAdminTabId } from '../../components/server-admin/sections';
import type { ServerAdminSection } from '../../types';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export type WorkspaceOpeners = Pick<
  UseTabOpenersApi,
  | 'openSettingsTab'
  | 'openWhatsNew'
  | 'openWorkspaceManager'
  | 'openServerAdmin'
  | 'openEnvironmentEdit'
  | 'openSpecEdit'
  | 'openWorkspaceVariables'
  | 'openVault'
  | 'openTrustedRoots'
  | 'openScriptPackages'
>;

export function useWorkspaceOpeners({
  allTabs,
  addTab,
  switchTab,
  setPendingRenameTabId,
}: TabOpenerContext): WorkspaceOpeners {
  const t = useT();
  const openSettingsTab = useCallback(
    (options?: { settingKey?: string; categoryId?: string }) => {
      const id = 'settings';
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.breadcrumbs.settings'),
        ruleType: '',
        dirty: false,
        mode: 'settings',
        settingsInitialKey: options?.settingKey,
        settingsInitialCategory: options?.categoryId,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openWhatsNew = useCallback(() => {
    const id = 'whats-new';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: t('workbench.shell.breadcrumbs.whatsNew'),
      ruleType: '',
      dirty: false,
      mode: 'whats-new',
    });
  }, [allTabs, addTab, switchTab, t]);

  const openWorkspaceManager = useCallback(() => {
    const id = 'workspace-manager';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: t('workbench.shell.breadcrumbs.workspaces'),
      ruleType: '',
      dirty: false,
      mode: 'workspace-manager',
    });
  }, [allTabs, addTab, switchTab, t]);

  const openServerAdmin = useCallback(
    (section: ServerAdminSection = 'users') => {
      // One singleton tab per administration domain — the Server admin
      // panel's rows land here. The Users tab keeps the historic
      // `server-admin` id (see `serverAdminTabId`) so pre-decomposition
      // layouts restore onto the directory surface.
      const id = serverAdminTabId(section);
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const def = SERVER_ADMIN_SECTION_MAP.get(section);
      addTab({
        id,
        label: def ? t(def.labelKey) : t('workbench.shell.breadcrumbs.serverAdmin'),
        ruleType: '',
        dirty: false,
        mode: 'server-admin',
        serverAdminSection: section,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

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

  const openSpecEdit = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `spec-${uid}`;
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
        mode: 'spec-edit',
        specUid: uid,
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
      label: t('workbench.shell.breadcrumbs.workspaceVariables'),
      ruleType: '',
      dirty: false,
      mode: 'workspace-vars',
    });
  }, [allTabs, addTab, switchTab, t]);

  const openVault = useCallback(() => {
    const id = 'vault';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: t('workbench.shell.breadcrumbs.vault'),
      ruleType: '',
      dirty: false,
      mode: 'vault',
    });
  }, [allTabs, addTab, switchTab, t]);

  const openTrustedRoots = useCallback(() => {
    const id = 'trusted-roots';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: t('workbench.shell.breadcrumbs.trustedRoots'),
      ruleType: '',
      dirty: false,
      mode: 'trusted-roots',
    });
  }, [allTabs, addTab, switchTab, t]);

  const openScriptPackages = useCallback(() => {
    const id = 'script-packages';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: t('workbench.shell.breadcrumbs.packageLibrary'),
      ruleType: '',
      dirty: false,
      mode: 'script-packages',
    });
  }, [allTabs, addTab, switchTab, t]);

  return {
    openSettingsTab,
    openWhatsNew,
    openWorkspaceManager,
    openServerAdmin,
    openEnvironmentEdit,
    openSpecEdit,
    openWorkspaceVariables,
    openVault,
    openTrustedRoots,
    openScriptPackages,
  };
}
