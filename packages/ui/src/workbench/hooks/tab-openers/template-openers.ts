/**
 * Template-family tab openers — edit tabs plus template collection /
 * folder overviews and collection variables.
 */

import type { Template } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useCallback } from 'react';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export interface UseTemplateOpenersOptions {
  templates: Template[];
}

export type TemplateOpeners = Pick<
  UseTabOpenersApi,
  | 'openTemplateEditTab'
  | 'openTemplateCollectionOverview'
  | 'openTemplateFolderOverview'
  | 'openTemplateCollectionVariables'
>;

export function useTemplateOpeners(
  { templates }: UseTemplateOpenersOptions,
  { allTabs, addTab, switchTab, setPendingRenameTabId }: TabOpenerContext,
): TemplateOpeners {
  const t = useT();
  const openTemplateEditTab = useCallback(
    (uid: string) => {
      const existing = allTabs.find((tab) => tab.mode === 'template-edit' && tab.templateUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const tpl = templates.find((template) => template.uid === uid);
      addTab({
        id: `tpl-edit-${uid}`,
        label: tpl?.name ?? t('workbench.shell.fallback.template'),
        ruleType: tpl?.ruleType ?? '',
        dirty: false,
        mode: 'template-edit',
        templateUid: uid,
      });
    },
    [allTabs, templates, addTab, switchTab, t],
  );

  const openTemplateCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `tpl-col-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({ id, label: name, ruleType: '', dirty: false, mode: 'collection-overview', entityId: uid });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openTemplateFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `tpl-folder-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({ id, label: name, ruleType: '', dirty: false, mode: 'folder-overview', entityId: uid });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openTemplateCollectionVariables = useCallback(
    (uid: string, name: string) => {
      const id = `tpl-coll-vars-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionVariables', { name }),
        ruleType: '',
        dirty: false,
        mode: 'template-collection-vars',
        collectionUid: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  return {
    openTemplateEditTab,
    openTemplateCollectionOverview,
    openTemplateFolderOverview,
    openTemplateCollectionVariables,
  };
}
