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

import { validateStepRequestsExist, validateWorkflowShape } from '@openheaders/core/live';
import {
  EnvironmentSchema,
  LiveVariableSchema,
  LiveWorkflowSchema,
  RequestSchema,
  RuleSchema,
} from '@openheaders/core/schemas';
import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  invalidateResolverIntent,
  type MutationBody,
  mintBatch,
  REQUEST_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { buildSetCollectionVarBatch } from '@openheaders/core/sync-builders/mutations/collection-mutations';
import { buildAddEnvironmentBatch } from '@openheaders/core/sync-builders/mutations/env-mutations';
import { buildAddLiveVariableBatch } from '@openheaders/core/sync-builders/mutations/live-variable-mutations';
import {
  buildAddLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import { buildSetRequestCollectionVarBatch } from '@openheaders/core/sync-builders/mutations/request-collection-mutations';
import {
  buildAddBatch as buildAddRequestBatch,
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
import type {
  Collection,
  Environment,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Variable,
} from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import type { EntityOracle } from '@openheaders/oracle/sync/oracle';
import {
  getOracleForWorkspace,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotWorkspaceVariablesPostStates,
} from '@openheaders/oracle/sync/service';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import {
  applyMcpMutation,
  findRequest,
  mintMcpContext,
  parseOrThrow,
  requireStringArg,
  requireWorkspace,
  resolveWorkspaceIdArg,
  WORKSPACE_ID_PROPERTY,
} from './common';

// ── Shared helpers ──────────────────────────────────────────────────

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
 * ensure-on-demand shape the request store applies. Shared with
 * `requests_import`, which commits parsed requests through the same
 * create path.
 */
export async function resolveRequestParentPath(
  workspaceId: string,
  collectionUid: string | undefined,
): Promise<string> {
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

// ── Live workflows ──────────────────────────────────────────────────

/**
 * Mint row uids across a workflow payload's nested set-modeled arrays:
 * steps, each step's captures, and each step's `runIf.all` gate
 * clauses. Same identity discipline as {@link withRowUids} — agents
 * supply content, the host supplies identity; rows that already carry
 * a uid keep it.
 */
function withWorkflowRowUids(record: Record<string, unknown>): Record<string, unknown> {
  const mintRow = (row: unknown): unknown =>
    typeof row === 'object' && row !== null && !Array.isArray(row)
      ? { uid: generateUid(), ...(row as Record<string, unknown>) }
      : row;

  if (!Array.isArray(record.steps)) return record;
  const steps = record.steps.map((raw) => {
    const step = mintRow(raw);
    if (typeof step !== 'object' || step === null) return step;
    const next = step as Record<string, unknown>;
    if (Array.isArray(next.captures)) next.captures = next.captures.map(mintRow);
    const runIf = next.runIf;
    if (typeof runIf === 'object' && runIf !== null && !Array.isArray(runIf)) {
      const gate = runIf as Record<string, unknown>;
      if (Array.isArray(gate.all)) next.runIf = { ...gate, all: gate.all.map(mintRow) };
    }
    return next;
  });
  return { ...record, steps };
}

function findWorkflow(workspaceId: string, uid: string): LiveWorkflow {
  const match = snapshotLiveWorkflowPostStates(workspaceId).find((ps) => ps.workflow.uid === uid);
  if (!match) {
    throw new McpToolInputError(`no workflow with uid '${uid}' in workspace '${workspaceId}' — see workflows_list`);
  }
  return match.workflow;
}

/** Canonical structural validation, shared by create and update. */
function assertWorkflowStructure(workspaceId: string, workflow: LiveWorkflow): void {
  const knownRequestUids = new Set(snapshotRequestPostStates(workspaceId).map((ps) => ps.request.uid));
  const structural = [...validateWorkflowShape(workflow), ...validateStepRequestsExist(workflow, knownRequestUids)];
  if (structural.length > 0) {
    throw new McpToolInputError(
      `invalid workflow: ${structural
        .slice(0, 5)
        .map((e) => e.message)
        .join('; ')}`,
    );
  }
}

/**
 * Update guard: a patch may not remove a step or capture that an
 * existing live variable is bound to — that restructuring re-points
 * bindings, which is Workbench territory.
 */
function assertBoundLiveVariablesIntact(workspaceId: string, merged: LiveWorkflow): void {
  const orphaned = snapshotLiveVariablePostStates(workspaceId)
    .map((ps) => ps.liveVariable)
    .filter((lv) => lv.workflowUid === merged.uid)
    .filter((lv) => {
      const step = merged.steps.find((s) => s.id === lv.stepId);
      return !step || !step.captures.some((c) => c.name === lv.captureName);
    });
  if (orphaned.length > 0) {
    throw new McpToolInputError(
      `this patch removes the step/capture behind ${orphaned
        .map((lv) => `{{live.${lv.name}}}`)
        .join(', ')} — restructure the workflow in Open Headers, where bindings can be re-pointed`,
    );
  }
}

interface ExposeInput {
  name: string;
  stepId: string;
  captureName: string;
  description?: string;
}

/**
 * Validate the `exposes` bindings against the workflow they attach to:
 * each must reference a declared step + capture, and names must be
 * unique within the call and against the workspace's existing live
 * variables (`{{live.<name>}}` is a workspace-wide namespace).
 */
function readExposeInputs(raw: unknown, workflow: LiveWorkflow, workspaceId: string): ExposeInput[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new McpToolInputError("'exposes' must be an array of { name, stepId, captureName } records");
  }
  const existingNames = new Set(snapshotLiveVariablePostStates(workspaceId).map((ps) => ps.liveVariable.name));
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new McpToolInputError(`'exposes[${index}]' must be an object`);
    }
    const record = entry as Record<string, unknown>;
    for (const field of ['name', 'stepId', 'captureName'] as const) {
      if (typeof record[field] !== 'string' || record[field].length === 0) {
        throw new McpToolInputError(`'exposes[${index}].${field}' is required`);
      }
    }
    const name = record.name as string;
    const stepId = record.stepId as string;
    const captureName = record.captureName as string;
    if (existingNames.has(name) || seen.has(name)) {
      throw new McpToolInputError(`live variable name '${name}' is already taken — names are workspace-unique`);
    }
    seen.add(name);
    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new McpToolInputError(`'exposes[${index}]' references unknown step '${stepId}'`);
    }
    if (!step.captures.some((c) => c.name === captureName)) {
      throw new McpToolInputError(
        `'exposes[${index}]' references unknown capture '${captureName}' on step '${stepId}'`,
      );
    }
    return {
      name,
      stepId,
      captureName,
      ...(typeof record.description === 'string' && record.description ? { description: record.description } : {}),
    };
  });
}

/** Mint the {{live.*}} draft bindings a save call's `exposes[]` declares. */
async function mintExposedLiveVariables(
  workspaceId: string,
  workflowUid: string,
  exposes: ExposeInput[],
): Promise<Array<{ name: string; reference: string }>> {
  const liveVariables: Array<{ name: string; reference: string }> = [];
  for (const expose of exposes) {
    const lvUid = generateUid();
    const liveVariable: LiveVariable = parseOrThrow(
      LiveVariableSchema,
      {
        schemaVersion: 5,
        uid: lvUid,
        path: `live-variables/${toFolderName(expose.name, lvUid)}`,
        name: expose.name,
        ...(expose.description ? { description: expose.description } : {}),
        workflowUid,
        stepId: expose.stepId,
        captureName: expose.captureName,
        enabled: true,
      },
      'live variable',
    );
    await applyMcpMutation(buildAddLiveVariableBatch(liveVariable, mintMcpContext(workspaceId)));
    liveVariables.push({ name: liveVariable.name, reference: `{{live.${liveVariable.name}}}` });
  }
  return liveVariables;
}

function projectWorkflowResult(workflow: LiveWorkflow): Record<string, unknown> {
  return {
    uid: workflow.uid,
    name: workflow.name,
    path: workflow.path,
    stepCount: workflow.steps.length,
    enabled: workflow.enabled,
    published: workflow.published === true,
    refresh: workflow.refresh,
  };
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
    // Arg-or-active — the same resolution the handler's `requireWorkspace`
    // applies, so the gate always sees the workspace the write lands on.
    resolveWorkspaceId: resolveWorkspaceIdArg,
  };

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
      title: 'Set workspace or collection variable',
      description:
        'Upsert a variable by name in the workspace scope (the lowest-priority scope: Vault > Environment > ' +
        'Collection > Workspace), or pass collectionId (a collection uid from variables_list) to upsert it ' +
        "in that collection's scope instead. type: 'secret' masks the value in every read projection.",
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          type: { type: 'string', enum: ['default', 'secret'] },
          collectionId: {
            type: 'string',
            description: 'Collection uid from variables_list — targets that collection scope instead of workspace.',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['name', 'value'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const [entry] = readVariableInputs([{ name: args.name, value: args.value, type: args.type }], 'variable');
        const collectionId =
          typeof args.collectionId === 'string' && args.collectionId.length > 0 ? args.collectionId : undefined;

        if (collectionId !== undefined) {
          const ruleCollection = snapshotCollectionPostStates(workspaceId).find(
            (ps) => ps.collection.uid === collectionId,
          )?.collection;
          const requestCollection = ruleCollection
            ? undefined
            : snapshotRequestCollectionPostStates(workspaceId).find((ps) => ps.collection.uid === collectionId)
                ?.collection;
          const target = ruleCollection ?? requestCollection;
          if (!target) {
            throw new McpToolInputError(
              `no collection with uid '${collectionId}' in workspace '${workspaceId}' — see variables_list`,
            );
          }
          const existing = target.variables.find((row) => row.name === entry.name);
          const variable: Variable = {
            uid: existing?.uid ?? generateUid(),
            name: entry.name,
            value: entry.value,
            type: entry.type ?? existing?.type ?? 'default',
          };
          const ctx = mintMcpContext(workspaceId);
          await applyMcpMutation(
            ruleCollection
              ? buildSetCollectionVarBatch({ collectionUid: collectionId, variable }, ctx)
              : buildSetRequestCollectionVarBatch({ requestCollectionUid: collectionId, variable }, ctx),
          );
          return {
            workspaceId,
            scope: ruleCollection ? 'collection:rules' : 'collection:requests',
            collection: { uid: target.uid, name: target.name },
            variable: { name: variable.name, type: variable.type, updated: existing !== undefined },
          };
        }

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
          scope: 'workspace',
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
    {
      name: 'workflows_save',
      title: 'Save live workflow',
      description:
        'Create or update a live workflow — a chained run of saved API requests that feeds {{live.*}} ' +
        'variables. Each step references a saved request by requestUid and declares named captures ' +
        '(json-path, header, body-regex, whole-body, or status-code extractors); later steps reference ' +
        'earlier captures as {{step.<stepId>.<captureName>}}. exposes[] binds captures to {{live.<name>}} ' +
        'variables; a binding goes live after its first successful run (workflows_run). New workflows start ' +
        'as drafts unless published: true is passed — only published workflows are scheduled and resolvable. ' +
        'Pass uid to patch an existing workflow: the call is one atomic gesture (a published workflow stays ' +
        'published), and a patch may not remove a step or capture an existing {{live.*}} variable is bound ' +
        'to — re-point those bindings in Open Headers. Saving never sends traffic.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: {
            type: 'string',
            description: 'Workflow uid from workflows_list — update when present, create when absent.',
          },
          workflow: {
            type: 'object',
            description:
              'Workflow definition: name, steps[] ({ id, requestUid, captures[{ name, extractor }], ' +
              'dependsOn?, runIf? }), refresh ({ kind: manual } default, { kind: interval, seconds ≥ 30 }, ' +
              'or expires-in / expires-at reading a capture), enabled, published. On update, a partial ' +
              'patch of these fields.',
          },
          exposes: {
            type: 'array',
            description: 'Captures to expose as {{live.<name>}} variables.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Workspace-unique identifier used as {{live.<name>}}.' },
                stepId: { type: 'string' },
                captureName: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['name', 'stepId', 'captureName'],
              additionalProperties: false,
            },
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['workflow'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const input = withWorkflowRowUids(requireObjectArg(args, 'workflow'));
        rejectEntityManagedFields(input);

        if (typeof args.uid === 'string' && args.uid.length > 0) {
          const existing = findWorkflow(workspaceId, args.uid);
          const augmented: Record<string, unknown> =
            existing.published === true && !('published' in input) ? { ...input, published: true } : input;
          const merged = parseOrThrow(LiveWorkflowSchema, { ...existing, ...augmented }, 'workflow');
          assertWorkflowStructure(workspaceId, merged);
          assertBoundLiveVariablesIntact(workspaceId, merged);
          const exposes = readExposeInputs(args.exposes, merged, workspaceId);

          await applyMcpMutation(
            buildUpdateLiveWorkflowBatch(
              existing.uid,
              augmented as Partial<Omit<LiveWorkflow, 'uid' | 'path'>>,
              mintMcpContext(workspaceId),
            ),
          );
          const liveVariables = await mintExposedLiveVariables(workspaceId, merged.uid, exposes);
          return { workspaceId, workflow: projectWorkflowResult(merged), liveVariables };
        }

        const uid = generateUid();
        const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Untitled Workflow';
        const created = parseOrThrow(
          LiveWorkflowSchema,
          {
            refresh: { kind: 'manual' },
            enabled: true,
            ...input,
            name,
            schemaVersion: 5,
            uid,
            path: `live-workflows/${toFolderName(name, uid)}`,
            published: input.published === true,
          },
          'workflow',
        );
        assertWorkflowStructure(workspaceId, created);
        const exposes = readExposeInputs(args.exposes, created, workspaceId);

        await applyMcpMutation(buildAddLiveWorkflowBatch(created, mintMcpContext(workspaceId)));
        const liveVariables = await mintExposedLiveVariables(workspaceId, created.uid, exposes);
        return { workspaceId, workflow: projectWorkflowResult(created), liveVariables };
      },
    },
  ];
}
