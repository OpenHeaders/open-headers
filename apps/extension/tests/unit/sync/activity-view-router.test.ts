/**
 * Phase C F6.a — Activity Feed view router.
 *
 * Pure mapping from `(entityType, entityId)` to the right tab-opener.
 * The router is closed-set over the entity catalogue this surface
 * understands; unknown / ambient-only entity types return `false` so
 * the card can hide the View affordance.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  FILES_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  LAYOUT_STATE_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  OAUTH_BUNDLE_ENTITY_TYPE,
  PAUSE_MARKERS_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  SPEC_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';
import {
  isViewableEntityType,
  viewActivityEntity,
  type ActivityViewRoutes,
} from '@openheaders/ui/workbench/components/panels/activity-view-router';

function makeRoutes(): ActivityViewRoutes & {
  __calls: Record<string, unknown[]>;
} {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls[name] = args;
    });
  return {
    openEditTab: record('openEditTab'),
    openEnvironmentEdit: record('openEnvironmentEdit'),
    openSpecEdit: record('openSpecEdit'),
    openRequestEditTab: record('openRequestEditTab'),
    openTemplateEditTab: record('openTemplateEditTab'),
    openLiveVariableEdit: record('openLiveVariableEdit'),
    openLiveWorkflowEdit: record('openLiveWorkflowEdit'),
    openVault: record('openVault'),
    openWorkspaceVariables: record('openWorkspaceVariables'),
    openCollectionOverview: record('openCollectionOverview'),
    openRequestCollectionOverview: record('openRequestCollectionOverview'),
    openTemplateCollectionOverview: record('openTemplateCollectionOverview'),
    openFolderOverview: record('openFolderOverview'),
    openRequestFolderOverview: record('openRequestFolderOverview'),
    openTemplateFolderOverview: record('openTemplateFolderOverview'),
    __calls: calls,
  };
}

describe('viewActivityEntity', () => {
  it('routes rule entries to openEditTab(uid)', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(RULE_ENTITY_TYPE, 'rule-abc', routes)).toBe(true);
    expect(routes.__calls.openEditTab).toEqual(['rule-abc']);
  });

  it('routes environment entries to openEnvironmentEdit(uid, label)', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(ENVIRONMENT_ENTITY_TYPE, 'env-1', routes)).toBe(true);
    expect(routes.__calls.openEnvironmentEdit).toEqual(['env-1', 'Environment']);
  });

  it('routes spec entries to openSpecEdit(uid, label)', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(SPEC_ENTITY_TYPE, 'spec-1', routes)).toBe(true);
    expect(routes.__calls.openSpecEdit).toEqual(['spec-1', 'Spec']);
  });

  it('routes request entries to openRequestEditTab(uid, label)', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(REQUEST_ENTITY_TYPE, 'req-9', routes)).toBe(true);
    expect(routes.__calls.openRequestEditTab).toEqual(['req-9', 'Request']);
  });

  it('routes template entries to openTemplateEditTab(uid)', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(TEMPLATE_ENTITY_TYPE, 'tpl-1', routes)).toBe(true);
    expect(routes.__calls.openTemplateEditTab).toEqual(['tpl-1']);
  });

  it('routes live-variable entries to openLiveVariableEdit', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(LIVE_VARIABLE_ENTITY_TYPE, 'lv-1', routes)).toBe(true);
    expect(routes.__calls.openLiveVariableEdit).toEqual(['lv-1', 'Live Variable']);
  });

  it('routes live-workflow entries to openLiveWorkflowEdit', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(LIVE_WORKFLOW_ENTITY_TYPE, 'wf-1', routes)).toBe(true);
    expect(routes.__calls.openLiveWorkflowEdit).toEqual(['wf-1', 'Workflow']);
  });

  it('routes vault singleton to openVault()', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(VAULT_ENTITY_TYPE, 'vault', routes)).toBe(true);
    expect(routes.__calls.openVault).toEqual([]);
  });

  it('routes workspace-variables singleton to openWorkspaceVariables()', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(WORKSPACE_VARIABLES_ENTITY_TYPE, 'workspace-variables', routes)).toBe(true);
    expect(routes.__calls.openWorkspaceVariables).toEqual([]);
  });

  it('routes collection / folder overviews per family', () => {
    const routes = makeRoutes();
    expect(viewActivityEntity(COLLECTION_ENTITY_TYPE, 'c-1', routes)).toBe(true);
    expect(viewActivityEntity(REQUEST_COLLECTION_ENTITY_TYPE, 'c-2', routes)).toBe(true);
    expect(viewActivityEntity(TEMPLATE_COLLECTION_ENTITY_TYPE, 'c-3', routes)).toBe(true);
    expect(viewActivityEntity(FOLDER_ENTITY_TYPE, 'f-1', routes)).toBe(true);
    expect(viewActivityEntity(REQUEST_FOLDER_ENTITY_TYPE, 'f-2', routes)).toBe(true);
    expect(viewActivityEntity(TEMPLATE_FOLDER_ENTITY_TYPE, 'f-3', routes)).toBe(true);
    expect(routes.__calls.openCollectionOverview).toEqual(['c-1', 'Collection']);
    expect(routes.__calls.openRequestCollectionOverview).toEqual(['c-2', 'Collection']);
    expect(routes.__calls.openTemplateCollectionOverview).toEqual(['c-3', 'Collection']);
    expect(routes.__calls.openFolderOverview).toEqual(['f-1', 'Folder']);
    expect(routes.__calls.openRequestFolderOverview).toEqual(['f-2', 'Folder']);
    expect(routes.__calls.openTemplateFolderOverview).toEqual(['f-3', 'Folder']);
  });

  it('returns false for ambient-only entity types — caller hides the affordance', () => {
    const routes = makeRoutes();
    for (const type of [
      OAUTH_BUNDLE_ENTITY_TYPE,
      PAUSE_MARKERS_ENTITY_TYPE,
      LAYOUT_STATE_ENTITY_TYPE,
      FILES_ENTITY_TYPE,
      'extensionWorkspace',
      'unknown-future-type',
    ]) {
      expect(viewActivityEntity(type, 'x', routes)).toBe(false);
    }
    // No openers should have fired for any of those.
    expect(Object.keys(routes.__calls)).toEqual([]);
  });
});

describe('isViewableEntityType', () => {
  it('returns true for every viewable entity', () => {
    for (const t of [
      RULE_ENTITY_TYPE,
      ENVIRONMENT_ENTITY_TYPE,
      REQUEST_ENTITY_TYPE,
      TEMPLATE_ENTITY_TYPE,
      LIVE_VARIABLE_ENTITY_TYPE,
      LIVE_WORKFLOW_ENTITY_TYPE,
      VAULT_ENTITY_TYPE,
      WORKSPACE_VARIABLES_ENTITY_TYPE,
      COLLECTION_ENTITY_TYPE,
      REQUEST_COLLECTION_ENTITY_TYPE,
      TEMPLATE_COLLECTION_ENTITY_TYPE,
      FOLDER_ENTITY_TYPE,
      REQUEST_FOLDER_ENTITY_TYPE,
      TEMPLATE_FOLDER_ENTITY_TYPE,
    ]) {
      expect(isViewableEntityType(t)).toBe(true);
    }
  });

  it('returns false for ambient + unknown entity types', () => {
    expect(isViewableEntityType(OAUTH_BUNDLE_ENTITY_TYPE)).toBe(false);
    expect(isViewableEntityType(PAUSE_MARKERS_ENTITY_TYPE)).toBe(false);
    expect(isViewableEntityType(LAYOUT_STATE_ENTITY_TYPE)).toBe(false);
    expect(isViewableEntityType(FILES_ENTITY_TYPE)).toBe(false);
    expect(isViewableEntityType('extensionWorkspace')).toBe(false);
    expect(isViewableEntityType('something-not-in-the-catalogue')).toBe(false);
  });
});
