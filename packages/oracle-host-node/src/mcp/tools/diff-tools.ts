/**
 * Workspace diff — read-tier comparison of two workspaces' snapshot
 * post-states, entity family by entity family.
 *
 * Identity is the entity uid: workspaces cloned or synced from the same
 * source (the real comparison use case) share uids, so added/removed/
 * changed is meaningful; two unrelated workspaces simply report
 * everything as added + removed. Name-keyed families (workspace
 * variables, vault secrets) diff by name — their rows are workspace-
 * singletons keyed by name in every consumer.
 *
 * Output discipline: only identity (uid + name) leaves the tool.
 * Entity content — including secret values, which participate in the
 * `changed` comparison — is never emitted; `changed` says THAT a row
 * differs, not how.
 */

import {
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotTemplateCollectionPostStates,
  snapshotTemplatePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from '@openheaders/oracle/sync/service';
import type { McpToolDefinition } from '../registry';
import { assertWorkspaceLoaded, requireStringArg, requireWorkspace, WORKSPACE_ID_PROPERTY } from './common';

interface FamilyRow {
  /** Diff identity — entity uid, or name for name-keyed families. */
  id: string;
  name: string;
  /** Full content, used only for the `changed` comparison. */
  entity: unknown;
}

interface Family {
  key: string;
  rows: (workspaceId: string) => FamilyRow[];
}

const FAMILIES: readonly Family[] = [
  {
    key: 'rules',
    rows: (ws) => snapshotRulePostStates(ws).map((ps) => ({ id: ps.rule.uid, name: ps.rule.name, entity: ps.rule })),
  },
  {
    key: 'ruleCollections',
    rows: (ws) =>
      snapshotCollectionPostStates(ws).map((ps) => ({
        id: ps.collection.uid,
        name: ps.collection.name,
        entity: ps.collection,
      })),
  },
  {
    key: 'requests',
    rows: (ws) =>
      snapshotRequestPostStates(ws).map((ps) => ({ id: ps.request.uid, name: ps.request.name, entity: ps.request })),
  },
  {
    key: 'requestCollections',
    rows: (ws) =>
      snapshotRequestCollectionPostStates(ws).map((ps) => ({
        id: ps.collection.uid,
        name: ps.collection.name,
        entity: ps.collection,
      })),
  },
  {
    key: 'environments',
    rows: (ws) =>
      snapshotEnvironmentPostStates(ws).map((ps) => ({
        id: ps.environment.uid,
        name: ps.environment.name,
        entity: ps.environment,
      })),
  },
  {
    key: 'workspaceVariables',
    rows: (ws) =>
      snapshotWorkspaceVariablesPostStates(ws)
        .flatMap((ps) => ps.workspaceVariables.variables)
        .map((row) => ({ id: row.name, name: row.name, entity: { value: row.value, type: row.type } })),
  },
  {
    key: 'vaultSecrets',
    rows: (ws) =>
      snapshotVaultPostStates(ws)
        .flatMap((ps) => ps.vault.secrets)
        .map((secret) => ({ id: secret.name, name: secret.name, entity: secret })),
  },
  {
    key: 'workflows',
    rows: (ws) =>
      snapshotLiveWorkflowPostStates(ws).map((ps) => ({
        id: ps.workflow.uid,
        name: ps.workflow.name,
        entity: ps.workflow,
      })),
  },
  {
    key: 'liveVariables',
    rows: (ws) =>
      snapshotLiveVariablePostStates(ws).map((ps) => ({
        id: ps.liveVariable.uid,
        name: ps.liveVariable.name,
        entity: ps.liveVariable,
      })),
  },
  {
    key: 'templates',
    rows: (ws) =>
      snapshotTemplatePostStates(ws).map((ps) => ({
        id: ps.template.uid,
        name: ps.template.name,
        entity: ps.template,
      })),
  },
  {
    key: 'templateCollections',
    rows: (ws) =>
      snapshotTemplateCollectionPostStates(ws).map((ps) => ({
        id: ps.collection.uid,
        name: ps.collection.name,
        entity: ps.collection,
      })),
  },
];

interface FamilyDiff {
  added: Array<{ id: string; name: string }>;
  removed: Array<{ id: string; name: string }>;
  changed: Array<{ id: string; name: string }>;
}

function identity(row: FamilyRow): { id: string; name: string } {
  return { id: row.id, name: row.name };
}

function diffFamily(base: FamilyRow[], other: FamilyRow[]): FamilyDiff {
  const baseById = new Map(base.map((row) => [row.id, row]));
  const otherById = new Map(other.map((row) => [row.id, row]));
  const diff: FamilyDiff = { added: [], removed: [], changed: [] };
  for (const row of other) {
    if (!baseById.has(row.id)) diff.added.push(identity(row));
  }
  for (const row of base) {
    const counterpart = otherById.get(row.id);
    if (!counterpart) {
      diff.removed.push(identity(row));
    } else if (JSON.stringify(row.entity) !== JSON.stringify(counterpart.entity)) {
      diff.changed.push(identity(row));
    }
  }
  return diff;
}

export function createDiffToolDefinitions(): McpToolDefinition[] {
  return [
    {
      name: 'workspaces_diff',
      title: 'Diff workspaces',
      description:
        'Compare two workspaces entity by entity (rules, requests, collections, environments, variables, ' +
        'vault secret names, workflows, templates). For each family: added = present only in ' +
        'otherWorkspaceId, removed = present only in workspaceId, changed = present in both with differing ' +
        'content. Reports identity (uid + name) only, never entity content. Both workspaces must be loaded ' +
        'on this host (see workspaces_list). Read-only — no merge tooling.',
      inputSchema: {
        type: 'object',
        properties: {
          otherWorkspaceId: { type: 'string', description: 'Workspace to compare against (see workspaces_list).' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['otherWorkspaceId'],
        additionalProperties: false,
      },
      tier: 'read',
      resolveWorkspaceId: (args) => {
        const raw = args.workspaceId;
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
      },
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const otherWorkspaceId = requireStringArg(args, 'otherWorkspaceId');
        assertWorkspaceLoaded(otherWorkspaceId);
        const diff: Record<string, FamilyDiff> = {};
        for (const family of FAMILIES) {
          diff[family.key] = diffFamily(family.rows(workspaceId), family.rows(otherWorkspaceId));
        }
        return { workspaceId, otherWorkspaceId, diff };
      },
    },
  ];
}
