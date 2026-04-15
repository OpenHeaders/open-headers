/**
 * useTabOpeners — factory for every "open a tab" entry point consumed
 * by App.tsx. Centralizes the create/edit/overview/template/run/flow
 * tab construction so App.tsx stops carrying ~300 LOC of imperative
 * handlers that only exist to route a click into the correct RulesTab
 * shape.
 *
 * Also owns `pendingRenameTabId` — the "just created, focus the
 * breadcrumb for rename" hint — because every creation path that needs
 * it lives in here.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useState } from 'react';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import type { ClosedTab, LandingView, RuleFlowScope, RulesTab } from '../types';

interface UseTabOpenersOptions {
  rules: V5.Rule[];
  templates: V5.Template[];
  localCollections: V5.Collection[];
  allTabs: RulesTab[];
  createLocalRule: (
    rule: Omit<V5.Rule, 'uid' | 'path'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<V5.Rule | null>;
  createLocalCollection: (name: string) => Promise<V5.Collection | null>;
  addTab: (tab: RulesTab) => void;
  switchTab: (tabId: string) => void;
  reopenTab?: (closed: ClosedTab) => void;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  delay: 'Delay Rule',
  body: 'API Request Body Rule',
  mock: 'API Response Rule',
};

export function getRuleTypeLabel(type: string): string {
  return RULE_TYPE_LABELS[type] ?? 'Rule';
}

export interface UseTabOpenersApi {
  pendingRenameTabId: string | null;
  setPendingRenameTabId: (id: string | null) => void;
  generateDraftName: (type: string) => string;

  openCreateTab: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  openEditTab: (uid: string) => void;
  openCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openTemplateEditTab: (uid: string) => void;
  openTemplateCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openTemplateFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openRunReport: (
    runId: string,
    owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
    ownerName?: string,
  ) => void;
  openRuleFlow: (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => void;
  openSettingsTab: (options?: { settingKey?: string; categoryId?: string }) => void;
  openLandingTab: (view: LandingView) => void;
}

export function useTabOpeners({
  rules,
  templates,
  localCollections,
  allTabs,
  createLocalRule,
  createLocalCollection,
  addTab,
  switchTab,
}: UseTabOpenersOptions): UseTabOpenersApi {
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);

  const generateDraftName = useCallback(
    (type: string) => {
      const label = RULE_TYPE_LABELS[type] ?? 'Rule';
      const baseName = `New ${label}`;
      const existingNames = new Set(rules.map((r) => r.name));
      for (const tab of allTabs) existingNames.add(tab.label);
      if (!existingNames.has(baseName)) return baseName;
      let counter = 2;
      while (existingNames.has(`${baseName} (${counter})`)) counter++;
      return `${baseName} (${counter})`;
    },
    [rules, allTabs],
  );

  const openCreateTab = useCallback(
    (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => {
      if (context?.collectionId) {
        const draftName = generateDraftName(type);
        const template = templateKey ? (TEMPLATES_BY_TYPE[type] ?? []).find((t) => t.key === templateKey) : undefined;
        const baseConditions = template?.conditions ?? ([] as V5.RuleCondition[]);
        const base = { name: draftName, type, enabled: true, conditions: baseConditions };

        let rule: Omit<V5.Rule, 'uid' | 'path'>;
        switch (type) {
          case 'header': {
            const fv = template?.formValues ?? {};
            rule = {
              ...base,
              type: 'header',
              action: {
                requestHeaders: (fv.requestHeaders as V5.HeaderModification[]) ?? [
                  { operation: 'override' as const, headerName: '', value: '' },
                ],
                responseHeaders: (fv.responseHeaders as V5.HeaderModification[]) ?? [],
              },
            } as Omit<V5.HeaderRule, 'uid' | 'path'>;
            break;
          }
          case 'block':
            rule = { ...base, type: 'block', action: { statusCode: 403 } } as Omit<V5.BlockRule, 'uid' | 'path'>;
            break;
          case 'redirect':
            rule = { ...base, type: 'redirect', action: { matchPattern: '', redirectTo: '' } } as Omit<
              V5.RedirectRule,
              'uid' | 'path'
            >;
            break;
          case 'query-param':
            rule = { ...base, type: 'query-param', action: { params: [] } } as Omit<V5.QueryParamRule, 'uid' | 'path'>;
            break;
          case 'inject':
            rule = {
              ...base,
              type: 'inject',
              action: { injectType: 'script', source: 'code', code: '', position: 'body-end' },
            } as Omit<V5.InjectRule, 'uid' | 'path'>;
            break;
          case 'delay':
            rule = {
              ...base,
              type: 'delay',
              action: { delayMs: 1000 },
            } as Omit<V5.DelayRule, 'uid' | 'path'>;
            break;
          case 'body':
            rule = {
              ...base,
              type: 'body',
              action: { bodyType: 'static', body: '', resourceType: 'rest' },
            } as Omit<V5.BodyRule, 'uid' | 'path'>;
            break;
          case 'mock':
            rule = {
              ...base,
              type: 'mock',
              action: {
                statusCode: 0,
                responseBody: '',
                contentType: 'application/json',
                responseHeaders: {},
                bodyType: 'static',
              },
            } as Omit<V5.MockRule, 'uid' | 'path'>;
            break;
          default:
            return;
        }
        void createLocalRule(rule, context.collectionId, context.folderPath).then((created) => {
          if (created) {
            const editId = `edit-${created.uid}`;
            addTab({
              id: editId,
              label: created.name,
              ruleType: created.type,
              dirty: false,
              mode: 'edit',
              ruleUid: created.uid,
              templateKey,
            });
            setPendingRenameTabId(editId);
          }
        });
        return;
      }

      // No collection context — pick or create one, then recurse.
      const resolveAndCreate = async () => {
        let collectionId: string;
        if (localCollections.length > 0) {
          collectionId = localCollections[0].uid;
        } else {
          const col = await createLocalCollection('My Rules');
          if (!col) return;
          collectionId = col.uid;
        }
        openCreateTab(type, { collectionId }, templateKey);
      };
      void resolveAndCreate();
    },
    [generateDraftName, createLocalRule, localCollections, createLocalCollection, addTab],
  );

  const openEditTab = useCallback(
    (uid: string) => {
      const existing = allTabs.find((t) => t.mode === 'edit' && t.ruleUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const rule = rules.find((r) => r.uid === uid);
      addTab({
        id: `edit-${uid}`,
        label: rule?.name ?? 'Rule',
        ruleType: rule?.type ?? 'header',
        dirty: false,
        mode: 'edit',
        ruleUid: uid,
        testOwnerType: 'rule',
        testOwnerId: uid,
      });
    },
    [allTabs, rules, addTab, switchTab],
  );

  const openCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `col-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'collection-overview',
        entityId: uid,
        testOwnerType: 'collection',
        testOwnerId: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
  );

  const openFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `folder-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'folder-overview',
        entityId: uid,
        testOwnerType: 'folder',
        testOwnerId: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
  );

  const openTemplateEditTab = useCallback(
    (uid: string) => {
      const existing = allTabs.find((t) => t.mode === 'template-edit' && t.templateUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const tpl = templates.find((t) => t.uid === uid);
      addTab({
        id: `tpl-edit-${uid}`,
        label: tpl?.name ?? 'Template',
        ruleType: tpl?.ruleType ?? '',
        dirty: false,
        mode: 'template-edit',
        templateUid: uid,
      });
    },
    [allTabs, templates, addTab, switchTab],
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
    [allTabs, addTab, switchTab],
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
    [allTabs, addTab, switchTab],
  );

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
    (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => {
      const id = entityId ? `flow-${entityId}` : `flow-${scope}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const flowLabel = label
        ? `Flow — ${label}`
        : scope === 'all-active'
          ? 'Flow — All Active Rules'
          : 'Flow — This Page';
      addTab({
        id,
        label: flowLabel,
        ruleType: '',
        dirty: false,
        mode: 'rule-flow',
        entityId,
        flowScope: scope,
        flowTabUrl: tabUrl,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openLandingTab = useCallback(
    (view: LandingView) => {
      const id = `landing-${view}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const label = view === 'home' ? 'Home' : view === 'rules' ? 'Rules' : 'Collections';
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'landing',
        landingView: view,
      });
    },
    [allTabs, addTab, switchTab],
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

  return {
    pendingRenameTabId,
    setPendingRenameTabId,
    generateDraftName,
    openCreateTab,
    openEditTab,
    openCollectionOverview,
    openFolderOverview,
    openTemplateEditTab,
    openTemplateCollectionOverview,
    openTemplateFolderOverview,
    openRunReport,
    openRuleFlow,
    openSettingsTab,
    openLandingTab,
  };
}
