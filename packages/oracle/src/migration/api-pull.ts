/**
 * Data API puller — the network half of migration ladder rung 3
 * (MIGRATION_PLAN.md §3.3), host-neutral: the host supplies the fetch
 * port and the same pipeline runs on desktop and the extension service
 * worker alike. Core owns the endpoint table, pacing policy, response
 * interpretation, and budget/failure classification; this module sends
 * the requests and paces them: enumeration serial at the 10-per-10s
 * bucket, item pulls launched under the 300 rpm global limit, a 429
 * pause honoring RetryAfter, and a terminal stop (monthly cap, rejected
 * key) that ends the run with a clearly-labeled partial result — every
 * unpulled item skips WITH a reason.
 *
 * The key lives in the caller's memory for this run only: it rides the
 * `X-Api-Key` header and never reaches events, reasons, results, or
 * logs.
 */

import {
  buildPullPlan,
  classifyPullFailure,
  collectionUrl,
  ENUMERATION_CALL_SPACING_MS,
  environmentUrl,
  ITEM_CALL_SPACING_MS,
  MAX_RATE_LIMIT_RETRIES,
  POSTMAN_API_KEY_HEADER,
  POSTMAN_DATA_API_ORIGIN,
  type PostmanPullEvent,
  type PostmanPullOutcome,
  type PostmanPullResult,
  type PostmanPullSkip,
  type PostmanWorkspaceListResult,
  type PostmanWorkspacePreview,
  type PulledCollection,
  type PulledEnvironment,
  type PulledWorkspaceGlobals,
  type PullFailure,
  type PullWorkspaceSummary,
  readCollectionPayload,
  readEnvironmentPayload,
  readRateBudget,
  readWorkspaceDetail,
  readWorkspaceGlobals,
  readWorkspaceList,
  type WorkspaceDetail,
  workspaceDetailUrl,
  workspaceGlobalsUrl,
  workspaceListUrl,
} from '@openheaders/core/import';

/** The response surface the puller needs — any WHATWG Response satisfies it. */
export interface PullHttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type PullFetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<PullHttpResponse>;

export type SleepFn = (ms: number) => Promise<void>;

export interface PullPostmanDataOptions {
  /** Held in memory for the run only — never persisted, never logged. */
  apiKey: string;
  /**
   * Stand-in origin replacing the Data API's — a harness seam (e2e
   * stub servers). Core still builds every URL against the real
   * origin; only the outgoing call is redirected.
   */
  apiOrigin?: string;
  /**
   * Pull only these vendor workspaces (the selection step's choice).
   * Omitted, every workspace on the account pulls.
   */
  workspaceIds?: string[];
  /** The host's fetch port — undici on node, the SW's global fetch on the extension. */
  fetchFn: PullFetchFn;
  sleep?: SleepFn;
  onEvent?: (event: PostmanPullEvent) => void;
}

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ends the whole run: monthly cap exhausted or key rejected. */
class TerminalPullError extends Error {
  constructor(readonly failure: PullFailure) {
    super(failure.reason);
  }
}

/** Fails one call: an HTTP error, a network error, or persistent 429s. */
class CallFailedError extends Error {}

function failureReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface ApiCallerOptions {
  apiKey: string;
  apiOrigin?: string;
  fetchFn: PullFetchFn;
  sleep: SleepFn;
  /** Budget changes + 429 pauses surface here (the pull's event stream). */
  onEvent: (event: PostmanPullEvent) => void;
}

interface ApiCaller {
  callApi(url: string): Promise<string>;
  budget: { limitMonth?: number; remainingMonth?: number };
  calls(): number;
}

/**
 * The paced Data API caller both entry points share: key on every call,
 * budget folded off response headers, 429 pauses honoring RetryAfter,
 * terminal failures (rejected key, monthly cap) thrown as
 * `TerminalPullError`.
 */
function createApiCaller(options: ApiCallerOptions): ApiCaller {
  let callsMade = 0;
  const budget: { limitMonth?: number; remainingMonth?: number } = {};

  async function callApi(url: string): Promise<string> {
    const target = options.apiOrigin !== undefined ? url.replace(POSTMAN_DATA_API_ORIGIN, options.apiOrigin) : url;
    for (let attempt = 0; ; attempt++) {
      let response: PullHttpResponse;
      try {
        response = await options.fetchFn(target, { headers: { [POSTMAN_API_KEY_HEADER]: options.apiKey } });
      } catch (err) {
        throw new CallFailedError(`The Data API request failed — ${failureReason(err)}.`);
      }
      callsMade++;
      const seen = readRateBudget((name) => response.headers.get(name));
      if (
        (seen.limitMonth !== undefined && seen.limitMonth !== budget.limitMonth) ||
        (seen.remainingMonth !== undefined && seen.remainingMonth !== budget.remainingMonth)
      ) {
        if (seen.limitMonth !== undefined) budget.limitMonth = seen.limitMonth;
        if (seen.remainingMonth !== undefined) budget.remainingMonth = seen.remainingMonth;
        options.onEvent({ kind: 'budget', ...budget });
      }
      const text = await response.text();
      if (response.ok) return text;
      const failure = classifyPullFailure(response.status, text, seen);
      if (failure.kind === 'unauthorized' || failure.kind === 'service-limit-exhausted') {
        throw new TerminalPullError(failure);
      }
      if (failure.kind === 'rate-limited' && attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfterSeconds = failure.retryAfterSeconds ?? 0;
        options.onEvent({ kind: 'rate-limit-pause', retryAfterSeconds });
        await options.sleep(retryAfterSeconds * 1000);
        continue;
      }
      if (failure.kind === 'rate-limited') {
        throw new CallFailedError(
          `Rate limiting persisted through ${MAX_RATE_LIMIT_RETRIES} pauses — the call was not retried further.`,
        );
      }
      throw new CallFailedError(failure.reason);
    }
  }

  return { callApi, budget, calls: () => callsMade };
}

export interface ListPostmanWorkspacesOptions {
  /** Held in memory for the call only — never persisted, never logged. */
  apiKey: string;
  apiOrigin?: string;
  /** The host's fetch port — undici on node, the SW's global fetch on the extension. */
  fetchFn: PullFetchFn;
  sleep?: SleepFn;
}

/**
 * Enumeration-only preflight for the selection step: the workspace list
 * plus per-workspace item counts (1 + W calls). A failed detail read
 * degrades that workspace's counts to zero rather than failing the
 * list; a terminal failure (rejected key, monthly cap) fails the call
 * with its reason.
 */
export async function listPostmanWorkspaces(
  options: ListPostmanWorkspacesOptions,
): Promise<PostmanWorkspaceListResult> {
  const sleep = options.sleep ?? defaultSleep;
  const caller = createApiCaller({
    apiKey: options.apiKey,
    ...(options.apiOrigin !== undefined ? { apiOrigin: options.apiOrigin } : {}),
    fetchFn: options.fetchFn,
    sleep,
    onEvent: () => {},
  });
  try {
    const list = readWorkspaceList(await caller.callApi(workspaceListUrl()));
    if (!list.ok) return { ok: false, reason: list.reason };
    const workspaces: PostmanWorkspacePreview[] = [];
    for (const workspace of list.value.workspaces) {
      await sleep(ENUMERATION_CALL_SPACING_MS);
      let collections = 0;
      let environments = 0;
      try {
        const detail = readWorkspaceDetail(workspace.id, await caller.callApi(workspaceDetailUrl(workspace.id)));
        if (detail.ok) {
          collections = detail.value.collections.length;
          environments = detail.value.environments.length;
        }
      } catch (err) {
        if (err instanceof TerminalPullError) throw err;
        // A single unreadable workspace stays listed with zero counts.
      }
      workspaces.push({
        id: workspace.id,
        name: workspace.name,
        ...(workspace.type !== undefined ? { type: workspace.type } : {}),
        collections,
        environments,
      });
    }
    return { ok: true, workspaces, budget: caller.budget };
  } catch (err) {
    return { ok: false, reason: failureReason(err) };
  }
}

export async function pullPostmanData(options: PullPostmanDataOptions): Promise<PostmanPullResult> {
  const sleep = options.sleep ?? defaultSleep;
  const emit = options.onEvent ?? (() => {});
  const caller = createApiCaller({
    apiKey: options.apiKey,
    ...(options.apiOrigin !== undefined ? { apiOrigin: options.apiOrigin } : {}),
    fetchFn: options.fetchFn,
    sleep,
    onEvent: emit,
  });
  const { callApi, budget } = caller;

  const skipped: PostmanPullSkip[] = [];
  const collections: PulledCollection[] = [];
  const environments: PulledEnvironment[] = [];
  const globals: PulledWorkspaceGlobals[] = [];
  let workspaces: PullWorkspaceSummary[] = [];

  function finish(outcome: PostmanPullOutcome, stopReason?: string): PostmanPullResult {
    emit({
      kind: 'finished',
      outcome,
      ...(stopReason !== undefined ? { stopReason } : {}),
      collections: collections.length,
      environments: environments.length,
      skipped: skipped.length,
    });
    return {
      outcome,
      ...(stopReason !== undefined ? { stopReason } : {}),
      workspaces,
      collections,
      environments,
      globals,
      skipped,
      budget,
      callsMade: caller.calls(),
    };
  }

  // Enumeration — serial, paced to the 10-per-10s bucket.
  emit({ kind: 'enumerating', step: 'workspace-list', completedCalls: 0 });
  let listText: string;
  try {
    listText = await callApi(workspaceListUrl());
  } catch (err) {
    return finish('failed', failureReason(err));
  }
  const list = readWorkspaceList(listText);
  if (!list.ok) return finish('failed', list.reason);
  workspaces = list.value.workspaces;
  if (options.workspaceIds !== undefined) {
    const selected = new Set(options.workspaceIds);
    workspaces = workspaces.filter((workspace) => selected.has(workspace.id));
  }
  if (list.value.malformedEntries > 0) {
    skipped.push({
      item: 'workspace',
      id: '(unknown)',
      reason: `${list.value.malformedEntries} workspace entr${list.value.malformedEntries === 1 ? 'y' : 'ies'} in the list had no usable id — skipped.`,
    });
  }
  emit({ kind: 'enumerating', step: 'workspace-list', completedCalls: caller.calls() });

  const details: WorkspaceDetail[] = [];
  for (const workspace of workspaces) {
    await sleep(ENUMERATION_CALL_SPACING_MS);
    try {
      const detail = readWorkspaceDetail(workspace.id, await callApi(workspaceDetailUrl(workspace.id)));
      if (detail.ok) {
        details.push(detail.value);
        if (detail.value.malformedRefs > 0) {
          skipped.push({
            item: 'workspace',
            id: workspace.id,
            name: workspace.name,
            reason: `${detail.value.malformedRefs} item reference(s) in the workspace had no usable id — skipped.`,
            workspaceIds: [workspace.id],
          });
        }
        if (detail.value.specs.length > 0) {
          skipped.push({
            item: 'workspace',
            id: workspace.id,
            name: workspace.name,
            reason: `${detail.value.specs.length} API spec${detail.value.specs.length === 1 ? '' : 's'} not imported yet — spec import hasn't landed.`,
            names: detail.value.specs.map((spec) => spec.name ?? spec.id),
            workspaceIds: [workspace.id],
          });
        }
      } else {
        skipped.push({
          item: 'workspace',
          id: workspace.id,
          name: workspace.name,
          reason: detail.reason,
          workspaceIds: [workspace.id],
        });
      }
    } catch (err) {
      if (err instanceof TerminalPullError) {
        skipped.push({
          item: 'workspace',
          id: workspace.id,
          name: workspace.name,
          reason: `Not enumerated — the run stopped early: ${err.failure.reason}`,
          workspaceIds: [workspace.id],
        });
        return finish('partial', err.failure.reason);
      }
      skipped.push({
        item: 'workspace',
        id: workspace.id,
        name: workspace.name,
        reason: failureReason(err),
        workspaceIds: [workspace.id],
      });
    }
    emit({ kind: 'enumerating', step: 'workspace-detail', completedCalls: caller.calls() });

    // Workspace globals — its own call in the same enumeration bucket,
    // independent of the detail read (a workspace whose detail was
    // unreadable can still land its globals). A failed read skips with
    // the reason; only a terminal failure stops the run.
    await sleep(ENUMERATION_CALL_SPACING_MS);
    try {
      const read = readWorkspaceGlobals(await callApi(workspaceGlobalsUrl(workspace.id)));
      if (read.ok) {
        globals.push({ workspaceId: workspace.id, variables: read.value.variables });
        if (read.value.malformedValues > 0) {
          skipped.push({
            item: 'workspace',
            id: workspace.id,
            name: workspace.name,
            reason: `${read.value.malformedValues} global variable row(s) in the workspace had no usable name — skipped.`,
            workspaceIds: [workspace.id],
          });
        }
      } else {
        skipped.push({
          item: 'workspace',
          id: workspace.id,
          name: workspace.name,
          reason: `Workspace globals were not pulled — ${read.reason}`,
          workspaceIds: [workspace.id],
        });
      }
    } catch (err) {
      if (err instanceof TerminalPullError) {
        skipped.push({
          item: 'workspace',
          id: workspace.id,
          name: workspace.name,
          reason: `Workspace globals were not pulled — the run stopped early: ${err.failure.reason}`,
          workspaceIds: [workspace.id],
        });
        return finish('partial', err.failure.reason);
      }
      skipped.push({
        item: 'workspace',
        id: workspace.id,
        name: workspace.name,
        reason: `Workspace globals were not pulled — ${failureReason(err)}`,
        workspaceIds: [workspace.id],
      });
    }
    emit({ kind: 'enumerating', step: 'workspace-globals', completedCalls: caller.calls() });
  }

  const plan = buildPullPlan(workspaces, details);
  emit({
    kind: 'planned',
    workspaces: workspaces.length,
    collections: plan.items.filter((item) => item.item === 'collection').length,
    environments: plan.items.filter((item) => item.item === 'environment').length,
    totalCalls: plan.totalCalls,
  });

  // Item pulls — launched under the 300 rpm global limit.
  let completedItems = 0;
  for (const [index, item] of plan.items.entries()) {
    await sleep(ITEM_CALL_SPACING_MS);
    try {
      const text = await callApi(item.item === 'collection' ? collectionUrl(item.id) : environmentUrl(item.id));
      const payload = item.item === 'collection' ? readCollectionPayload(text) : readEnvironmentPayload(text);
      completedItems++;
      const name = payload.ok ? (payload.value.name ?? item.name) : item.name;
      if (payload.ok) {
        const pulled = {
          id: item.id,
          ...(name !== undefined ? { name } : {}),
          json: payload.value.json,
          workspaceIds: [...item.workspaceIds],
        };
        if (item.item === 'collection') collections.push({ item: 'collection', ...pulled });
        else environments.push({ item: 'environment', ...pulled });
        emit({
          kind: 'item-progress',
          item: item.item,
          id: item.id,
          ...(name !== undefined ? { name } : {}),
          status: 'pulled',
          completedItems,
          totalItems: plan.items.length,
        });
      } else {
        skipped.push({
          item: item.item,
          id: item.id,
          ...(name !== undefined ? { name } : {}),
          reason: payload.reason,
          workspaceIds: [...item.workspaceIds],
        });
        emit({
          kind: 'item-progress',
          item: item.item,
          id: item.id,
          ...(name !== undefined ? { name } : {}),
          status: 'skipped',
          reason: payload.reason,
          completedItems,
          totalItems: plan.items.length,
        });
      }
    } catch (err) {
      if (err instanceof TerminalPullError) {
        for (const rest of plan.items.slice(index)) {
          skipped.push({
            item: rest.item,
            id: rest.id,
            ...(rest.name !== undefined ? { name: rest.name } : {}),
            reason: `Not pulled — the run stopped early: ${err.failure.reason}`,
            workspaceIds: [...rest.workspaceIds],
          });
        }
        return finish('partial', err.failure.reason);
      }
      completedItems++;
      const reason = failureReason(err);
      skipped.push({
        item: item.item,
        id: item.id,
        ...(item.name !== undefined ? { name: item.name } : {}),
        reason,
        workspaceIds: [...item.workspaceIds],
      });
      emit({
        kind: 'item-progress',
        item: item.item,
        id: item.id,
        ...(item.name !== undefined ? { name: item.name } : {}),
        status: 'skipped',
        reason,
        completedItems,
        totalItems: plan.items.length,
      });
    }
  }

  return finish('complete');
}
