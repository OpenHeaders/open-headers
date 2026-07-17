/**
 * Live-derived display label for a workbench tab.
 *
 * Tab labels are a projection of entity state. Caching them on the tab
 * struct (the historical `tab.label` shape) means imperative sync at
 * mutation time, which grows linearly with entity types — every new
 * mode adds a new branch to a label-mirror effect. This helper collapses
 * the per-mode logic into one pure function: callers (TabBar,
 * breadcrumbs, command palette) read the label by `(tab, lookups) →
 * string` at consume time. Same pattern as the dirty (structural
 * projection) and attribution (pure helpers, never cache live state)
 * conventions.
 *
 * `tab.label` survives on the struct only as the seed value (set when
 * the opener mints the tab) plus the fallback for two cases the helper
 * can't resolve:
 *   - The entity hasn't loaded yet — brief race window between tab open
 *     and the entity-cache subscription firing.
 *   - The tab is for a draft / create-mode that has no backing entity
 *     yet — `draftName ?? label` is the legitimate seed.
 *
 * Adding a new entity-backed tab mode means adding one branch here. The
 * imperative `useTabSyncEffects` label-mirror is gone; only deletion
 * cleanup remains there.
 */

import type {
  CollectionTree,
  Environment,
  GrpcResponseExample,
  LiveVariable,
  LiveWorkflow,
  Request,
  ResponseExample,
  Rule,
  Spec,
  Template,
  TreeNode,
} from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { WorkbenchTab } from './types';

export interface TabDisplayLookups {
  rules: readonly Rule[];
  templates: readonly Template[];
  environments: readonly Environment[];
  requests: readonly Request[];
  localCollectionTrees: readonly CollectionTree[];
  requestCollectionTrees: readonly CollectionTree[];
  templateCollectionTrees: readonly CollectionTree[];
  liveVariables: readonly LiveVariable[];
  liveWorkflows: readonly LiveWorkflow[];
  responseExamples: readonly ResponseExample[];
  grpcResponseExamples: readonly GrpcResponseExample[];
  specs: readonly Spec[];
}

function findFolderNameInTrees(trees: readonly CollectionTree[], uid: string): string | null {
  for (const col of trees) {
    const stack: TreeNode[] = [...col.tree];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.type !== 'folder') continue;
      if (node.uid === uid) return node.name;
      stack.push(...node.children);
    }
  }
  return null;
}

export function tabDisplayLabel(tab: WorkbenchTab, lookups: TabDisplayLookups, t: Translate): string {
  switch (tab.mode) {
    case 'edit': {
      if (!tab.ruleUid) return tab.label;
      const rule = lookups.rules.find((r) => r.uid === tab.ruleUid);
      return rule ? rule.name : tab.label;
    }
    case 'template-edit': {
      if (!tab.templateUid) return tab.label;
      const tpl = lookups.templates.find((t) => t.uid === tab.templateUid);
      return tpl ? tpl.name : tab.label;
    }
    case 'env-edit': {
      if (!tab.environmentUid) return tab.label;
      const env = lookups.environments.find((e) => e.uid === tab.environmentUid);
      return env ? env.name : tab.label;
    }
    case 'spec-edit': {
      if (!tab.specUid) return tab.label;
      const spec = lookups.specs.find((s) => s.uid === tab.specUid);
      return spec ? spec.name : tab.label;
    }
    case 'request-edit': {
      if (!tab.requestUid) return tab.label;
      const req = lookups.requests.find((r) => r.uid === tab.requestUid);
      return req ? req.name : tab.label;
    }
    case 'response-example': {
      if (!tab.responseExampleUid) return tab.label;
      const example = lookups.responseExamples.find((e) => e.uid === tab.responseExampleUid);
      return example ? example.name : tab.label;
    }
    case 'grpc-response-example': {
      if (!tab.grpcResponseExampleUid) return tab.label;
      const example = lookups.grpcResponseExamples.find((e) => e.uid === tab.grpcResponseExampleUid);
      return example ? example.name : tab.label;
    }
    case 'live-variable-edit': {
      if (!tab.liveVariableUid) return tab.label;
      const lv = lookups.liveVariables.find((v) => v.uid === tab.liveVariableUid);
      return lv ? lv.name : tab.label;
    }
    case 'live-workflow-edit': {
      if (!tab.liveWorkflowUid) return tab.label;
      const wf = lookups.liveWorkflows.find((w) => w.uid === tab.liveWorkflowUid);
      return wf ? wf.name : tab.label;
    }
    case 'collection-overview': {
      if (!tab.entityId) return tab.label;
      const col =
        lookups.localCollectionTrees.find((c) => c.uid === tab.entityId) ??
        lookups.requestCollectionTrees.find((c) => c.uid === tab.entityId) ??
        lookups.templateCollectionTrees.find((c) => c.uid === tab.entityId);
      return col ? col.name : tab.label;
    }
    case 'folder-overview': {
      if (!tab.entityId) return tab.label;
      const name =
        findFolderNameInTrees(lookups.localCollectionTrees, tab.entityId) ??
        findFolderNameInTrees(lookups.requestCollectionTrees, tab.entityId) ??
        findFolderNameInTrees(lookups.templateCollectionTrees, tab.entityId);
      return name ?? tab.label;
    }
    case 'collection-vars':
    case 'request-collection-vars':
    case 'template-collection-vars': {
      if (!tab.collectionUid) return tab.label;
      const trees =
        tab.mode === 'collection-vars'
          ? lookups.localCollectionTrees
          : tab.mode === 'request-collection-vars'
            ? lookups.requestCollectionTrees
            : lookups.templateCollectionTrees;
      const col = trees.find((c) => c.uid === tab.collectionUid);
      return col ? t('workbench.shell.tabLabel.collectionVariables', { name: col.name }) : tab.label;
    }
    // Singleton tabs resolve live through the breadcrumb root nouns so
    // the strip follows a locale switch — the minted seed label is only
    // the session-persisted fallback.
    case 'settings':
      return t('workbench.shell.breadcrumbs.settings');
    case 'whats-new':
      return t('workbench.shell.breadcrumbs.whatsNew');
    case 'workspace-manager':
      return t('workbench.shell.breadcrumbs.workspaces');
    case 'daemon-admin':
      return t('workbench.shell.breadcrumbs.daemonAdmin');
    case 'workspace-vars':
      return t('workbench.shell.breadcrumbs.workspaceVariables');
    case 'vault':
      return t('workbench.shell.breadcrumbs.vault');
    case 'script-packages':
      return t('workbench.shell.breadcrumbs.packageLibrary');
    case 'live-vars':
      return t('workbench.shell.breadcrumbs.liveVariables');
    // Drafts (`*-create`) and one-off tabs keep their seed label —
    // either the user-typed `draftName` or the static `label` set at
    // open time. No entity to look up.
    default:
      return tab.draftName ?? tab.label;
  }
}
