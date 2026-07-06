/**
 * Write-tier MCP tools — Phase 2 of the catalog. Every mutation is
 * minted with the same core batch builders the Workbench write clients
 * use, validated against the canonical valibot schemas (one vocabulary,
 * no MCP-flavored dialect), and routed through `applySyncRequest` — so
 * an agent-driven change is HLC-stamped, persisted, and broadcast live
 * to every open Workbench window and connected extension.
 *
 * `published` semantics (publication-gate contract):
 *   - New rules start `published: false` (draft) unless the agent
 *     explicitly passes `published: true`.
 *   - An update or toggle on a published rule carries `published: true`
 *     in the same batch — an MCP call is an ATOMIC gesture like a
 *     quick-edit popover, not a keystroke stream, so the edit takes
 *     effect live instead of silently dropping the rule to draft.
 *
 * Entity-managed fields (`uid`, `path`, `schemaVersion`) are minted
 * host-side on create and rejected in update patches.
 */

import { EnvironmentSchema, RequestSchema, RuleSchema } from '@openheaders/core/schemas';
import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  invalidateResolverIntent,
  type MutationBody,
  mintBatch,
  REQUEST_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { buildAddEnvironmentBatch } from '@openheaders/core/sync-builders/mutations/env-mutations';
import {
  buildAddBatch as buildAddRequestBatch,
  buildDeleteBatch as buildDeleteRequestBatch,
  buildUpdateBatch as buildUpdateRequestBatch,
} from '@openheaders/core/sync-builders/mutations/request-mutations';
import {
  buildAddBatch as buildAddRuleBatch,
  buildDeleteBatch as buildDeleteRuleBatch,
  buildUpdateBatch as buildUpdateRuleBatch,
  type LiveSetEntries,
} from '@openheaders/core/sync-builders/mutations/rule-mutations';
import { buildSetWorkspaceVarBatch } from '@openheaders/core/sync-builders/mutations/workspace-variables-mutations';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Collection, Environment, Request, Rule, Variable } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import type { EntityOracle } from '@openheaders/oracle/sync/oracle';
import {
  getOracleForWorkspace,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotWorkspaceVariablesPostStates,
} from '@openheaders/oracle/sync/service';
import * as v from 'valibot';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import { applyMcpMutation, mintMcpContext, requireStringArg, requireWorkspace, WORKSPACE_ID_PROPERTY } from './common';

// ── Shared helpers ──────────────────────────────────────────────────

function schemaIssueSummary(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => {
      const path = (issue.path ?? []).map((segment) => String(segment.key)).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

function parseOrThrow<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  raw: unknown,
  what: string,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, raw);
  if (!result.success) {
    throw new McpToolInputError(`invalid ${what}: ${schemaIssueSummary(result.issues)}`);
  }
  return result.output;
}

function requireObjectArg(args: Record<string, unknown>, name: string): Record<string, unknown> {
  const raw = args[name];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new McpToolInputError(`'${name}' is required and must be an object`);
  }
  return raw as Record<string, unknown>;
}

function rejectEntityManagedFields(patch: Record<string, unknown>): void {
  for (const field of ['uid', 'path', 'schemaVersion'] as const) {
    if (field in patch) {
      throw new McpToolInputError(`'${field}' is entity-managed and cannot appear in an update patch`);
    }
  }
}

function oracleFor(workspaceId: string): EntityOracle {
  const oracle = getOracleForWorkspace(workspaceId);
  if (!oracle) {
    throw new McpToolInputError(`workspace '${workspaceId}' is not loaded on this host`);
  }
  return oracle;
}

/**
 * Adapt the oracle's live-set reader to the `(itemId, orderKey, item)`
 * triplet shape the set-diff synthesizer consumes. Same adapter the
 * SW request-store uses (`entry.key` → `orderKey` rename).
 */
function liveSetEntriesFor(oracle: EntityOracle, entityType: string): LiveSetEntries {
  return (id, setPath) =>
    oracle
      .liveOrderedSetItems(entityType, id, setPath)
      .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item }));
}

/**
 * Mint row uids on the set-modeled arrays of an inbound rule/request
 * payload. Row uids double as the sync engine's set-member itemIds —
 * agents supply row content, the host supplies identity. Rows that
 * already carry a uid (an agent round-tripping a `*_get` result) keep it.
 */
function withRowUids(record: Record<string, unknown>): Record<string, unknown> {
  const mintRows = (rows: unknown): unknown =>
    Array.isArray(rows)
      ? rows.map((row) =>
          typeof row === 'object' && row !== null && !Array.isArray(row)
            ? { uid: generateUid(), ...(row as Record<string, unknown>) }
            : row,
        )
      : rows;

  const next: Record<string, unknown> = { ...record };
  for (const key of ['conditions', 'headers', 'params']) {
    if (key in next) next[key] = mintRows(next[key]);
  }
  const action = next.action;
  if (typeof action === 'object' && action !== null && !Array.isArray(action)) {
    const actionNext: Record<string, unknown> = { ...(action as Record<string, unknown>) };
    for (const key of ['requestHeaders', 'responseHeaders', 'params']) {
      if (key in actionNext) actionNext[key] = mintRows(actionNext[key]);
    }
    next.action = actionNext;
  }
  return next;
}

// ── Rules ───────────────────────────────────────────────────────────

function findRule(workspaceId: string, uid: string): Rule {
  const match = snapshotRulePostStates(workspaceId).find((ps) => ps.rule.uid === uid);
  if (!match) {
    throw new McpToolInputError(`no rule with uid '${uid}' in workspace '${workspaceId}' — see rules_list`);
  }
  return match.rule;
}

/**
 * Apply a partial Rule patch: published carry for atomic gestures,
 * merged-shape validation against the canonical schema, then the
 * minimum-diff batch through the oracle.
 */
async function applyRulePatch(workspaceId: string, rule: Rule, patch: Record<string, unknown>): Promise<Rule> {
  const augmented: Record<string, unknown> =
    rule.published === true && !('published' in patch) ? { ...patch, published: true } : patch;
  const merged = parseOrThrow(RuleSchema, { ...rule, ...augmented }, 'rule');
  const oracle = oracleFor(workspaceId);
  const payload = buildUpdateRuleBatch(
    rule.uid,
    rule.type,
    augmented as Partial<Omit<Rule, 'uid' | 'path'>>,
    mintMcpContext(workspaceId),
    liveSetEntriesFor(oracle, RULE_ENTITY_TYPE),
    (uid, path) => (path === 'action' ? findRule(workspaceId, uid).action : undefined),
  );
  await applyMcpMutation(payload);
  return merged;
}

/**
 * Resolve the parent collection for a new rule, minting the default
 * "My Rules" collection when the workspace has none yet — the same
 * ensure-on-demand shape the rule store applies at hydration.
 */
async function resolveRuleParentPath(workspaceId: string, collectionUid: string | undefined): Promise<string> {
  const collections = snapshotCollectionPostStates(workspaceId).map((ps) => ps.collection);
  if (collectionUid !== undefined) {
    const match = collections.find((c) => c.uid === collectionUid);
    if (!match) {
      throw new McpToolInputError(`no rule collection with uid '${collectionUid}' in workspace '${workspaceId}'`);
    }
    return match.path;
  }
  const first = collections[0];
  if (first) return first.path;

  const uid = generateUid();
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `rules/${toFolderName('My Rules', uid)}`,
    name: 'My Rules',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  await applyMcpMutation({
    batch: seedCollection(collection, mintMcpContext(workspaceId)),
    sideEffects: [],
  });
  return collection.path;
}

// ── Requests ────────────────────────────────────────────────────────

/**
 * Resolve the parent collection for a new request, minting the default
 * "My Requests" collection when the workspace has none yet — the same
 * ensure-on-demand shape the request store applies.
 */
async function resolveRequestParentPath(workspaceId: string, collectionUid: string | undefined): Promise<string> {
  const collections = snapshotRequestCollectionPostStates(workspaceId).map((ps) => ps.collection);
  if (collectionUid !== undefined) {
    const match = collections.find((c) => c.uid === collectionUid);
    if (!match) {
      throw new McpToolInputError(`no request collection with uid '${collectionUid}' in workspace '${workspaceId}'`);
    }
    return match.path;
  }
  const first = collections[0];
  if (first) return first.path;

  const uid = generateUid();
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${toFolderName('My Requests', uid)}`,
    name: 'My Requests',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  await applyMcpMutation({
    batch: seedRequestCollection(collection, mintMcpContext(workspaceId)),
    sideEffects: [],
  });
  return collection.path;
}

function findRequest(workspaceId: string, uid: string): Request {
  const match = snapshotRequestPostStates(workspaceId).find((ps) => ps.request.uid === uid);
  if (!match) {
    throw new McpToolInputError(`no request with uid '${uid}' in workspace '${workspaceId}' — see requests_list`);
  }
  return match.request;
}

// ── Environments / variables ────────────────────────────────────────

function findEnvironment(workspaceId: string, uid: string): Environment {
  const match = snapshotEnvironmentPostStates(workspaceId).find((ps) => ps.environment.uid === uid);
  if (!match) {
    throw new McpToolInputError(
      `no environment with uid '${uid}' in workspace '${workspaceId}' — see environments_list`,
    );
  }
  return match.environment;
}

interface VariableInput {
  name: string;
  value: string;
  type?: Variable['type'];
}

function readVariableInputs(raw: unknown, argName: string): VariableInput[] {
  if (!Array.isArray(raw)) {
    throw new McpToolInputError(`'${argName}' must be an array of { name, value, type? } records`);
  }
  return raw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new McpToolInputError(`'${argName}[${index}]' must be an object`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== 'string' || record.name.trim().length === 0) {
      throw new McpToolInputError(`'${argName}[${index}].name' is required`);
    }
    if (typeof record.value !== 'string') {
      throw new McpToolInputError(`'${argName}[${index}].value' is required and must be a string`);
    }
    if (record.type !== undefined && record.type !== 'default' && record.type !== 'secret') {
      throw new McpToolInputError(`'${argName}[${index}].type' must be 'default' or 'secret'`);
    }
    return {
      name: record.name.trim(),
      value: record.value,
      ...(record.type !== undefined ? { type: record.type as Variable['type'] } : {}),
    };
  });
}

const VARIABLE_INPUT_SCHEMA = {
  type: 'array',
  description: 'Variable records to upsert, keyed by name.',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      value: { type: 'string' },
      type: {
        type: 'string',
        enum: ['default', 'secret'],
        description: "Defaults to 'default'; 'secret' values are masked in reads.",
      },
    },
    required: ['name', 'value'],
    additionalProperties: false,
  },
} as const;

// ── Tool definitions ────────────────────────────────────────────────

export function createWriteToolDefinitions(): McpToolDefinition[] {
  const workspaceScoped: Pick<McpToolDefinition, 'tier' | 'resolveWorkspaceId'> = {
    tier: 'write',
    resolveWorkspaceId: (args) => {
      const raw = args.workspaceId;
      return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
    },
  };
  // The gate resolves an explicit workspaceId; when the arg is omitted
  // the handler's `requireWorkspace` falls back to the runtime-active
  // workspace after the gate has skipped (same contract as reads).

  return [
    {
      name: 'rules_toggle',
      title: 'Toggle rule',
      description:
        "Flip a rule's enabled flag. A published rule stays published (the flip takes effect on live " +
        'traffic immediately); a draft stays draft. Rules are executed by connected browser extensions.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Rule uid from rules_list.' },
          enabled: { type: 'boolean' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid', 'enabled'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        if (typeof args.enabled !== 'boolean') {
          throw new McpToolInputError("'enabled' is required and must be a boolean");
        }
        const rule = findRule(workspaceId, requireStringArg(args, 'uid'));
        const updated = await applyRulePatch(workspaceId, rule, { enabled: args.enabled });
        return {
          workspaceId,
          uid: rule.uid,
          enabled: updated.enabled,
          published: updated.published === true,
        };
      },
    },
    {
      name: 'rules_create',
      title: 'Create rule',
      description:
        'Create a traffic rule from the canonical Rule shape (same structure rules_get returns, minus ' +
        'uid/path/schemaVersion — those are minted here). Row uids on conditions and header/param rows ' +
        'are minted when absent. New rules start as drafts (published: false) unless published: true is ' +
        'passed explicitly; drafts never affect live traffic. Rules are executed by connected browser ' +
        'extensions, not the desktop app.',
      inputSchema: {
        type: 'object',
        properties: {
          rule: {
            type: 'object',
            description:
              'Rule definition: name, type (header | redirect | request-body | inject | block | delay | ' +
              'response | query-param | ws | sse | auth), enabled, conditions[], and the type-specific action.',
          },
          collectionUid: {
            type: 'string',
            description: 'Target rule collection. Omit to use the first collection in the workspace.',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['rule'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const input = withRowUids(requireObjectArg(args, 'rule'));
        rejectEntityManagedFields(input);
        const parentPath = await resolveRuleParentPath(
          workspaceId,
          typeof args.collectionUid === 'string' ? args.collectionUid : undefined,
        );
        const uid = generateUid();
        const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Untitled Rule';
        const created = parseOrThrow(
          RuleSchema,
          {
            ...input,
            name,
            schemaVersion: 5,
            uid,
            path: `${parentPath}/${toFolderName(name, uid)}`,
            published: input.published === true,
          },
          'rule',
        );
        await applyMcpMutation(buildAddRuleBatch(created, mintMcpContext(workspaceId)));
        return { workspaceId, rule: created, appliedBy: 'connected browser extension' };
      },
    },
    {
      name: 'rules_update',
      title: 'Update rule',
      description:
        'Apply a partial patch to a rule (same field shapes rules_get returns; uid/path/schemaVersion are ' +
        'immutable). The call is one atomic gesture: a published rule stays published and the change takes ' +
        'effect on live traffic immediately — pass published: false to drop it back to draft instead.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Rule uid from rules_list.' },
          updates: {
            type: 'object',
            description: 'Fields to change: name, enabled, published, conditions[], action, …',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid', 'updates'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const rule = findRule(workspaceId, requireStringArg(args, 'uid'));
        const patch = withRowUids(requireObjectArg(args, 'updates'));
        rejectEntityManagedFields(patch);
        const updated = await applyRulePatch(workspaceId, rule, patch);
        return { workspaceId, rule: updated };
      },
    },
    {
      name: 'rules_delete',
      title: 'Delete rule',
      description: 'Delete a rule permanently. Deletes cannot be reverted — the tombstone wins over any edit.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Rule uid from rules_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const rule = findRule(workspaceId, requireStringArg(args, 'uid'));
        await applyMcpMutation(buildDeleteRuleBatch(rule.uid, mintMcpContext(workspaceId)));
        return { workspaceId, uid: rule.uid, deleted: true };
      },
    },
    {
      name: 'environments_create',
      title: 'Create environment',
      description:
        'Create an environment with an optional starting variable set. Variable row identity is minted ' +
        'here; upsert later edits by name via environments_edit.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          variables: VARIABLE_INPUT_SCHEMA,
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['name'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const name = requireStringArg(args, 'name').trim() || 'Untitled Environment';
        const variables: Variable[] =
          args.variables === undefined
            ? []
            : readVariableInputs(args.variables, 'variables').map((entry) => ({
                uid: generateUid(),
                name: entry.name,
                value: entry.value,
                type: entry.type ?? 'default',
              }));
        const environment = parseOrThrow(
          EnvironmentSchema,
          { schemaVersion: 5, uid: generateUid(), name, variables },
          'environment',
        );
        await applyMcpMutation(buildAddEnvironmentBatch({ environment }, mintMcpContext(workspaceId)));
        return {
          workspaceId,
          environment: { uid: environment.uid, name: environment.name, variableCount: variables.length },
        };
      },
    },
    {
      name: 'environments_edit',
      title: 'Edit environment',
      description:
        'Rename an environment and/or upsert + remove its variables by name, all in one atomic batch. ' +
        'Upserts reuse the existing row when the name matches (value/type edits) and add a row otherwise.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Environment uid from environments_list.' },
          name: { type: 'string', description: 'New environment name.' },
          setVariables: VARIABLE_INPUT_SCHEMA,
          removeVariables: {
            type: 'array',
            items: { type: 'string' },
            description: 'Variable names to remove.',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const environment = findEnvironment(workspaceId, requireStringArg(args, 'uid'));
        const byName = new Map(environment.variables.map((row) => [row.name, row]));

        const bodies: MutationBody[] = [];
        if (args.name !== undefined) {
          const name = typeof args.name === 'string' ? args.name.trim() : '';
          if (!name) throw new McpToolInputError("'name' must be a non-empty string");
          bodies.push({
            kind: 'setField',
            type: ENVIRONMENT_ENTITY_TYPE,
            id: environment.uid,
            path: 'name',
            value: name,
          });
        }
        if (args.removeVariables !== undefined) {
          if (!Array.isArray(args.removeVariables) || args.removeVariables.some((n) => typeof n !== 'string')) {
            throw new McpToolInputError("'removeVariables' must be an array of variable names");
          }
          for (const varName of args.removeVariables as string[]) {
            const existing = byName.get(varName);
            if (!existing) {
              throw new McpToolInputError(`no variable named '${varName}' in environment '${environment.name}'`);
            }
            bodies.push({
              kind: 'removeFromSet',
              type: ENVIRONMENT_ENTITY_TYPE,
              id: environment.uid,
              path: ENV_VARS_PATH,
              itemId: existing.uid,
            });
          }
        }
        if (args.setVariables !== undefined) {
          for (const entry of readVariableInputs(args.setVariables, 'setVariables')) {
            const existing = byName.get(entry.name);
            const variable: Variable = {
              uid: existing?.uid ?? generateUid(),
              name: entry.name,
              value: entry.value,
              type: entry.type ?? existing?.type ?? 'default',
            };
            bodies.push({
              kind: 'addToSet',
              type: ENVIRONMENT_ENTITY_TYPE,
              id: environment.uid,
              path: ENV_VARS_PATH,
              itemId: variable.uid,
              item: variable,
            });
          }
        }
        if (bodies.length === 0) {
          throw new McpToolInputError("nothing to change — pass 'name', 'setVariables', and/or 'removeVariables'");
        }

        const ctx = mintMcpContext(workspaceId);
        await applyMcpMutation({
          batch: mintBatch(ctx, bodies),
          sideEffects: [invalidateResolverIntent(environment.uid, ctx.hlc)],
        });
        return { workspaceId, environment: { uid: environment.uid }, changes: bodies.length };
      },
    },
    {
      name: 'variables_set',
      title: 'Set workspace variable',
      description:
        'Upsert a workspace-scoped variable by name (the lowest-priority scope: Vault > Environment > ' +
        "Collection > Workspace). type: 'secret' masks the value in every read projection.",
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          type: { type: 'string', enum: ['default', 'secret'] },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['name', 'value'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const [entry] = readVariableInputs([{ name: args.name, value: args.value, type: args.type }], 'variable');
        const existing = snapshotWorkspaceVariablesPostStates(workspaceId)
          .flatMap((ps) => ps.workspaceVariables.variables)
          .find((row) => row.name === entry.name);
        const variable: Variable = {
          uid: existing?.uid ?? generateUid(),
          name: entry.name,
          value: entry.value,
          type: entry.type ?? existing?.type ?? 'default',
        };
        await applyMcpMutation(buildSetWorkspaceVarBatch({ variable }, mintMcpContext(workspaceId)));
        return {
          workspaceId,
          variable: { name: variable.name, type: variable.type, updated: existing !== undefined },
        };
      },
    },
    {
      name: 'requests_save',
      title: 'Save API request',
      description:
        'Create or update a saved API request. Omit uid to create (name/method/url plus optional headers, ' +
        'params, auth, body, scripts — same shapes requests_get returns); pass uid to patch an existing ' +
        'request. uid/path/schemaVersion are entity-managed. Saving never sends traffic.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: {
            type: 'string',
            description: 'Request uid from requests_list — update when present, create when absent.',
          },
          request: {
            type: 'object',
            description: 'Request fields: name, method, url, headers[], params[], auth, body, description, scripts.',
          },
          collectionUid: {
            type: 'string',
            description: 'Create only: target request collection. Omit to use (or mint) the default collection.',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['request'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const input = withRowUids(requireObjectArg(args, 'request'));
        rejectEntityManagedFields(input);

        if (typeof args.uid === 'string' && args.uid.length > 0) {
          const existing = findRequest(workspaceId, args.uid);
          const merged = parseOrThrow(RequestSchema, { ...existing, ...input }, 'request');
          const oracle = oracleFor(workspaceId);
          const payload = buildUpdateRequestBatch(
            existing.uid,
            input as Partial<Omit<Request, 'uid' | 'path'>>,
            mintMcpContext(workspaceId),
            liveSetEntriesFor(oracle, REQUEST_ENTITY_TYPE),
            (uid, path) => {
              const current = findRequest(workspaceId, uid);
              if (path === 'auth') return current.auth;
              if (path === 'body') return current.body;
              return undefined;
            },
          );
          await applyMcpMutation(payload);
          return {
            workspaceId,
            request: { uid: merged.uid, name: merged.name, method: merged.method, url: merged.url, path: merged.path },
          };
        }

        const parentPath = await resolveRequestParentPath(
          workspaceId,
          typeof args.collectionUid === 'string' ? args.collectionUid : undefined,
        );
        const uid = generateUid();
        const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Untitled Request';
        const created = parseOrThrow(
          RequestSchema,
          {
            method: 'GET',
            url: '',
            headers: [],
            params: [],
            auth: { type: 'inherit' },
            body: { type: 'none' },
            ...input,
            name,
            schemaVersion: 5,
            uid,
            path: `${parentPath}/${toFolderName(name, uid)}`,
          },
          'request',
        );
        await applyMcpMutation(buildAddRequestBatch(created, mintMcpContext(workspaceId)));
        return {
          workspaceId,
          request: {
            uid: created.uid,
            name: created.name,
            method: created.method,
            url: created.url,
            path: created.path,
          },
        };
      },
    },
  ];
}
