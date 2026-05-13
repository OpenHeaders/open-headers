/**
 * Request Executor — runs a Request through `fetch()` from the
 * service worker and returns a response snapshot the UI can render.
 *
 * Design:
 *   - Variables resolve against the same 4-scope chain the DNR pipeline
 *     uses (vault > environment > collection > workspace) so requests
 *     see the same values the rules would. Collection scope is derived
 *     from the request's path.
 *   - Fetch runs inside the SW, which holds `<all_urls>` host
 *     permission — no CORS gating. User-defined DNR rules DO apply to
 *     SW fetches (they hit webRequest like any other request), which
 *     is intentional: users can test their own rules end-to-end.
 *   - Body types: `none`, `json`, `xml`, `text`, `form` (urlencoded).
 *     `graphql` and `multipart` land in a later phase — the shape
 *     variant is declared in `BodyType` but the executor falls back
 *     to `none` if asked to send one.
 *   - Auth: `none` | `inherit` are no-ops (nothing to inject). `basic`
 *     and `bearer` add Authorization; `api-key` adds either a header or
 *     a query param depending on its `in` field. `inherit` at the
 *     request level defaults to `none` — inheritance from containing
 *     collections is scheduled for v2 alongside request scripts.
 *
 * Response size cap: 2 MiB for the body preview. Larger responses are
 * truncated with a flag so the UI can render a message instead of
 * trying to display megabytes in a <pre>.
 */

import { isExpired as isOAuthTokenExpired } from '@openheaders/core/oauth';
import type { RequestMutation, RequestSnapshot, ResponseSnapshot, TestAssertion } from '@openheaders/core/scripts';
import { generateTotp } from '@openheaders/core/totp';
import type { AuthConfig, BodyType, Collection, CredentialsMode, Environment, ExecutedRequestSnapshot, FormField, HttpMethod, MultipartPart, Request, RequestBody, Vault, VaultSecretTotp, WorkspaceVariables } from '@openheaders/core/types';
import { appendQueryParams, generateUid, isRequestResolvable } from '@openheaders/core/utils';
import { resolveTemplate, type TotpRegistry, VariableResolver } from '@openheaders/core/variables';
import { logger } from '@utils/logger';
import { ensureScheme } from '@/shared/fetch/ensure-scheme';
import { withHostAccess } from '@/shared/fetch/with-host-access';
import { report as reportStatus } from '@/shared/status';
import { feedCollectionVariablesToResolver } from '@/shared/variables/collection-scope';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getDefaultEnvironmentIdForWorkspace,
  getEnvironments,
  getEnvironmentsForWorkspace,
  getVault,
  getVaultForWorkspace,
  getWorkspaceVariables,
  getWorkspaceVariablesForWorkspace,
} from '@openheaders/oracle/entity/environment-store';
import { getFileBlob, listFiles } from '@openheaders/oracle/entity/files-store';
import { OAuth2FlowError, performRefresh as performOAuthRefresh } from './oauth-flow';
import { getTokenBundle as getOAuthTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { recordLog } from './observability-log';
import { __setExecuteRequestDraft, isOffscreenSupported, runScript } from './offscreen-host';
import {
  getRequest,
  getRequestCollections,
  getRequestCollectionsForWorkspace,
  getRequestInWorkspace,
} from '@openheaders/oracle/entity/request-store';
import {
  getCollections as getRuleCollections,
  getCollectionsForWorkspace as getRuleCollectionsForWorkspace,
} from '@openheaders/oracle/entity/rule-store';
import { getTemplateCollections, getTemplateCollectionsForWorkspace } from '@openheaders/oracle/entity/template-store';
import { checkCooldown as checkTotpCooldown, recordUsage as recordTotpUsage } from '@openheaders/oracle/entity/totp-cooldown-store';
import { getLiveRegistrySnapshot, getLiveRegistrySnapshotForWorkspace } from './variables-resolver';
import { getActiveWorkspaceId } from './workspace-store';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// ── Executor API ───────────────────────────────────────────────────

export type { ExecutedRequestSnapshot } from '@openheaders/core/types';

export interface ExecuteRequestOptions {
  /**
   * Pin the workspace this execution resolves against. When omitted,
   * every store read defaults to the runtime-Active workspace's mirror
   * (the user-initiated `Send` path inside the workbench). When set,
   * the resolver pulls vault / environments / vars / collections / live-
   * registry / files via per-workspace caches keyed on this id —
   * required for live-refresh chain dispatches against a non-Active
   * workspace (MWPT-FULL session #19). Resolving against the wrong
   * workspace would silently substitute a different workspace's
   * variable values and capture garbage.
   */
  workspaceId?: string;
  /** Pin a specific environment for this execution — leave undefined
   *  to use the workspace's active environment. */
  environmentId?: string;
  /**
   * Install a step-capture context on the resolver for the duration of
   * this execution so `{{step.<stepId>.<captureName>}}` references in
   * the request's templates resolve. Only used by Live Workflow chain
   * runs — regular user fetches leave this unset (any `{{step.X.Y}}`
   * in their templates surfaces as `step-out-of-context`).
   */
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /**
   * Skip the `requests` Status-pill report. Workflow refreshes aren't
   * user-initiated requests; their success/failure belongs to the
   * `live` subsystem (Phase G wires that) rather than flipping the
   * generic request-executor pill on every chain step.
   */
  silentStatus?: boolean;
  /**
   * Skip pre-request + post-response script hooks. Chain step fetches
   * are pure data-source fetches — running user scripts on them would
   * blur the boundary between "my request" and "workflow refresh" and
   * open a trivial infinite-recursion path (script calls sendRequest
   * which triggers the same workflow).
   */
  skipScripts?: boolean;
}

/** Resolve + execute a persisted request by uid. */
export async function executeRequest(
  requestUid: string,
  options: ExecuteRequestOptions = {},
): Promise<ExecutedRequestSnapshot> {
  const request = options.workspaceId ? getRequestInWorkspace(requestUid, options.workspaceId) : getRequest(requestUid);
  if (!request) {
    return errorSnapshot(`Request ${requestUid} not found`);
  }
  return executeRequestDraft(request, options);
}

/** Execute an in-memory request shape (for unsaved drafts + tests). */
export async function executeRequestDraft(
  request: Request,
  options: ExecuteRequestOptions = {},
): Promise<ExecutedRequestSnapshot> {
  let outcome: ResolvedRequestOutcome;
  try {
    outcome = await resolveRequest(request, options);
  } catch (err) {
    // The resolvability gate is the only throwing path we surface as a
    // structured snapshot today. Other exceptions (file-registry load
    // failure, unexpected resolver throw) bubble up to the caller's
    // try/catch, which is where they belong.
    if (err instanceof UnresolvedRequestError) return errorSnapshot(err.message);
    throw err;
  }

  // ── TOTP cooldown gate ─────────────────────────────────────────
  // If the resolved request reuses a TOTP code that was already used
  // inside the same window, refuse to send. Most providers reject the
  // reuse with a 401 anyway; surfacing this here gives the user an
  // actionable message ("wait Ns") instead of a confusing provider
  // error after a wasted round-trip.
  if (outcome.totpUsed.length > 0) {
    const workspaceId = options.workspaceId ?? getActiveWorkspaceId();
    for (const usage of outcome.totpUsed) {
      const status = checkTotpCooldown(workspaceId, usage.name, usage.code);
      if (status.inCooldown) {
        return errorSnapshot(
          `TOTP '${usage.name}' code can't be reused — wait ${status.remainingSeconds}s for the next window.`,
        );
      }
    }
  }

  // ── Pre-request script hook ────────────────────────────────────
  // Run BEFORE the wire fetch. Script mutations land on top of the
  // resolved request (after variable substitution). Missing scripts
  // / Firefox fallback / empty source are all no-ops.
  let scriptOutcome: ExecutedRequestSnapshot['scripts'] = null;
  const finalResolved: ResolvedRequest = { ...outcome.resolved };

  if (!options.skipScripts && request.preRequestScript?.trim() && isOffscreenSupported()) {
    const snapshot = resolvedToSnapshot(finalResolved);
    const result = await runScript({
      kind: 'pre-request',
      source: request.preRequestScript,
      request: snapshot,
    });
    scriptOutcome = {
      preRequest: {
        succeeded: result.succeeded,
        error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
        consoleLog: result.consoleLog,
        durationMs: result.durationMs,
        mutation: result.mutation,
      },
    };
    if (result.succeeded && result.mutation) {
      applyMutation(finalResolved, result.mutation);
    }
  }

  const wireResult = await executeResolved(finalResolved, { silentStatus: options.silentStatus });

  // ── TOTP cooldown record ───────────────────────────────────────
  // Only record on a successful round-trip — a fetch that never
  // reached the wire (DNS failure, CORS reject) didn't actually
  // burn the code with the provider. Recording too eagerly would
  // turn a transient network blip into an avoidable Ns wait.
  if (wireResult.error == null && outcome.totpUsed.length > 0) {
    const workspaceId = options.workspaceId ?? getActiveWorkspaceId();
    for (const usage of outcome.totpUsed) {
      recordTotpUsage(workspaceId, usage.name, usage.code, usage.period);
    }
  }

  // ── Post-response script hook ──────────────────────────────────
  if (
    !options.skipScripts &&
    request.postResponseScript?.trim() &&
    isOffscreenSupported() &&
    wireResult.error == null
  ) {
    const responseSnap: ResponseSnapshot = {
      status: wireResult.status,
      statusText: wireResult.statusText,
      url: wireResult.url,
      headers: wireResult.headers,
      body: wireResult.body,
      durationMs: wireResult.durationMs,
    };
    const result = await runScript({
      kind: 'post-response',
      source: request.postResponseScript,
      request: resolvedToSnapshot(finalResolved),
      response: responseSnap,
    });
    scriptOutcome = {
      ...(scriptOutcome ?? {}),
      postResponse: {
        succeeded: result.succeeded,
        error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
        assertions: result.assertions,
        consoleLog: result.consoleLog,
        durationMs: result.durationMs,
      },
    };
  }

  return scriptOutcome ? { ...wireResult, scripts: scriptOutcome } : wireResult;
}

// Register the executor with the offscreen host so `oh.sendRequest`
// calls can route through our resolve + fetch pipeline. Done once at
// module eval — idempotent if called again.
__setExecuteRequestDraft(executeRequestDraft);

// ── Live Workflow chain step executor ──────────────────────────────

/**
 * Bypass tag stamped on every Live Workflow chain fetch. Value is the
 * owning workflow uid. User rules whose value templates reference any
 * `{{live.X}}` bound to the SAME workflow exclude that exact value via
 * `excludedRequestHeaders` at DNR compile time — the rule engine's
 * `attachLiveBypassExclusions` wraps compiled rules with the filter so
 * a rule injecting `Authorization: {{live.token}}` never fires on the
 * chain fetches that PRODUCE `live.token`.
 *
 * Chrome DNR's `HeaderInfo.values` uses case-insensitive exact match,
 * which is why the value is the opaque workflow uid alone — composite
 * values like `<workflowUid>:<stepId>` couldn't be excluded without
 * enumerating every step id. The step id stays in the observability
 * log's `context.stepId`, which is where triage needs it anyway.
 */
export const LIVE_BYPASS_HEADER = 'X-OH-Live-Bypass';

/**
 * Compose the header value. Exported so the DNR compile path uses the
 * exact same string the executor stamps — any codec drift produces
 * the "rule still fires on its own source" feedback loop this whole
 * contract exists to prevent.
 */
export function liveBypassHeaderValue(workflowUid: string): string {
  return workflowUid;
}

export interface LiveChainExecuteOptions {
  /**
   * Workspace owning the workflow. Threaded through so every store read
   * (request, env, vault, vars, collection-vars, live-registry, files)
   * resolves against the per-workspace cache rather than the runtime-
   * Active mirror — required for cross-workspace chain refresh under
   * MWPT-FULL session #19.
   */
  workspaceId: string;
  /** Active env the chain was scheduled under. `null` = "No environment". */
  environmentId: string | null;
  /** Parent workflow uid — stamped into the bypass header. */
  workflowUid: string;
  /** Current step id — carried in the executor log context only. */
  stepId: string;
  /**
   * Captures extracted from prior steps of this chain run. Keys are
   * step ids; values are `captureName → extractedValue` maps. Installed
   * on the resolver so `{{step.<id>.<name>}}` templates in this step's
   * request resolve correctly.
   */
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

/**
 * Execute a persisted-request shape as one step of a Live Workflow
 * chain. Shares the resolve → fetch pipeline with `executeRequestDraft`
 * but:
 *   - threads the step-capture context into variable resolution,
 *   - skips pre/post script hooks (chain fetches are pure data-source
 *     fetches; running user scripts here would blur "my request" vs
 *     "workflow refresh" and trivially recurse via `oh.sendRequest`),
 *   - stamps the `X-OH-Live-Bypass` header so DNR rules referencing
 *     the workflow's LVs exclude themselves from this request,
 *   - suppresses the `requests` Status pill (workflow refresh belongs
 *     to the `live` subsystem, not the generic request pill).
 *
 * Returned `ExecutedRequestSnapshot` is the same shape as user-facing
 * executions; the chain adapter maps it down to the core's
 * `StepResponse`.
 */
export async function executeForLiveChain(
  request: Request,
  options: LiveChainExecuteOptions,
): Promise<ExecutedRequestSnapshot> {
  const stamped: Request = {
    ...request,
    headers: [
      ...request.headers,
      {
        uid: generateUid(),
        key: LIVE_BYPASS_HEADER,
        value: liveBypassHeaderValue(options.workflowUid),
        enabled: true,
      },
    ],
  };
  return executeRequestDraft(stamped, {
    workspaceId: options.workspaceId,
    environmentId: options.environmentId ?? undefined,
    stepCaptures: options.stepCaptures,
    skipScripts: true,
    silentStatus: true,
  });
}

// ── Script integration helpers ─────────────────────────────────────

function resolvedToSnapshot(req: ResolvedRequest): RequestSnapshot {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers.map((h) => ({ key: h.key, value: h.value })),
    params: [],
    // The body is already a discriminated-union value; pass it through
    // verbatim so the script sandbox sees the same shape we'll send.
    body: req.body,
  };
}

function applyMutation(target: ResolvedRequest, mutation: RequestMutation): void {
  if (mutation.method) target.method = mutation.method;
  if (mutation.url) target.url = mutation.url;
  if (mutation.headers) target.headers = mutation.headers.map((h) => ({ key: h.key, value: h.value }));
  // Body mutations are discriminated unions in their own right — assign
  // the whole new shape rather than cherry-picking fields. Any field
  // not on the chosen variant simply doesn't exist on the new value.
  if (mutation.body) target.body = mutation.body;
}

// ── Variable resolution ────────────────────────────────────────────

interface ResolverContext {
  workspaceId: string | null;
  environmentId: string | null;
  vault: Vault;
}

/**
 * Build the resolver and capture the per-execution scope used for
 * {{ref}} resolution. Returns the vault snapshot alongside so the
 * caller can index TOTP entries by name without re-reading a store
 * that may have rotated between calls.
 *
 * When `workspaceId` is supplied, every store read routes through the
 * per-workspace cache for that workspace — required when the dispatch
 * is keyed on a non-runtime-Active workspace (live-refresh chain
 * executor for a per-tab MWPT workspace, MWPT-FULL session #19).
 * Otherwise the resolver pulls from the Active-bound module mirrors,
 * the Send-from-workbench path the user-initiated executor has always
 * used.
 */
async function buildResolver(
  workspaceId: string | undefined,
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>,
): Promise<{ resolver: VariableResolver; context: ResolverContext }> {
  const resolver = new VariableResolver();
  const scope = workspaceId ? await readPerWorkspaceScope(workspaceId) : readActiveScope();
  resolver.setVault(scope.vault);
  resolver.setEnvironments(scope.environments);
  resolver.setActiveEnvironmentId(scope.activeEnvironmentId);
  resolver.setDefaultEnvironmentId(scope.defaultEnvironmentId);
  resolver.setWorkspaceVariables(scope.workspaceVariables);
  // TOTP scope — precompute the current code for every kind:'totp'
  // vault entry so the resolver's `vault` arm can return them
  // synchronously. Codes have ~30s lifetime; we compute fresh on every
  // request execution so the user never sees a stale code. The DNR
  // compile pipeline does NOT precompute (no TotpRegistry installed
  // there) — TOTP-kind entries surface as unresolved at compile time
  // and the rule is dropped, which is the architectural gate keeping
  // 30s-codes out of static rule values.
  resolver.setTotpRegistry(await buildTotpRegistry(scope.vault));
  // Live scope — for an Active-workspace dispatch we read the snapshot
  // that backs the DNR compile pipeline (same mirror the rule engine
  // uses). For a per-workspace dispatch we read the workspace's own
  // mirror keyed on the explicit envId (Active-env pointer is irrelevant
  // for chain execution, which is keyed on (workspaceId, envId)).
  resolver.setLiveRegistry(
    workspaceId
      ? getLiveRegistrySnapshotForWorkspace(workspaceId, scope.activeEnvironmentId)
      : getLiveRegistrySnapshot(),
  );
  if (stepCaptures) {
    // Step-capture context — only present during Live Workflow chain
    // runs. Installed here so `{{step.<id>.<name>}}` references in a
    // step's templates see prior steps' extracted values.
    resolver.setStepCaptures(stepCaptures);
  }
  // Feed variables from EVERY collection family — rule, request, AND
  // template. Uids are minted from one pool and never collide, so the
  // resolver's single Map keyed by uid carries them all. The shared
  // helper centralizes this so renderer surfaces and the SW agree on
  // the merged scope.
  feedCollectionVariablesToResolver(resolver, scope.collections);
  // File registry — powers `{{file.X}}` (ARCHITECTURE §6). Loading
  // the full workspace file list once per request is cheap (metadata
  // only, no blob bytes), and matches how other scopes are fed.
  try {
    const files = await listFiles(workspaceId);
    resolver.setFileRegistry(files);
  } catch {
    // If IDB is briefly unavailable (SW restart race) we proceed
    // without a registry; `{{file.X}}` surfaces `unset-in-scope` on
    // the error channel rather than breaking the request entirely.
  }
  return {
    resolver,
    context: {
      workspaceId: workspaceId ?? null,
      environmentId: null,
      vault: scope.vault,
    },
  };
}

interface ExecutionScope {
  vault: Vault;
  environments: Environment[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  workspaceVariables: WorkspaceVariables;
  collections: {
    ruleCollections: Collection[];
    requestCollections: Collection[];
    templateCollections: Collection[];
  };
}

function readActiveScope(): ExecutionScope {
  return {
    vault: getVault(),
    environments: getEnvironments(),
    activeEnvironmentId: getActiveEnvironmentId(),
    defaultEnvironmentId: getDefaultEnvironmentId(),
    workspaceVariables: getWorkspaceVariables(),
    collections: {
      ruleCollections: getRuleCollections(),
      requestCollections: getRequestCollections(),
      templateCollections: getTemplateCollections(),
    },
  };
}

async function readPerWorkspaceScope(workspaceId: string): Promise<ExecutionScope> {
  // The default-env pointer is the only scope value not tracked by an
  // entity cache (it's a singleton scalar persisted as `oh.ws.<id>
  // .defaultEnvironmentId`); read it via storage. Active-env pointer is
  // irrelevant for chain execution — the chain is dispatched against an
  // explicit env, so we leave activeEnvironmentId null and rely on the
  // `ResolutionContext.environmentId` override the executor threads
  // through. Other scopes route through their workspace caches.
  const defaultEnvironmentId = await getDefaultEnvironmentIdForWorkspace(workspaceId);
  return {
    vault: getVaultForWorkspace(workspaceId),
    environments: getEnvironmentsForWorkspace(workspaceId),
    activeEnvironmentId: null,
    defaultEnvironmentId,
    workspaceVariables: getWorkspaceVariablesForWorkspace(workspaceId),
    collections: {
      ruleCollections: getRuleCollectionsForWorkspace(workspaceId),
      requestCollections: getRequestCollectionsForWorkspace(workspaceId),
      templateCollections: getTemplateCollectionsForWorkspace(workspaceId),
    },
  };
}

/**
 * Find the collection a request belongs to. Requests live under
 * `requests/<coll-name-uid>/...`, so we look in the REQUEST collection
 * tree — not the rule tree (paths under `rules/` never prefix a
 * request path). Returns `undefined` for orphaned requests (defensive —
 * every persisted request should have an owning collection).
 *
 * `workspaceId` routes the lookup through the per-workspace request-
 * collection cache when supplied — required for cross-workspace chain
 * dispatches where the runtime-Active workspace's collections aren't
 * the right namespace.
 */
function collectionIdForRequest(request: Request, workspaceId: string | null): string | undefined {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  const hit = collections.find((c) => request.path.startsWith(`${c.path}/`));
  return hit?.uid;
}

interface ResolvedRequest {
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: RequestBody;
  /** Wire-level cookie policy. `'omit'` unless the request opts into `'include'`. */
  credentialsMode: CredentialsMode;
  /**
   * Redirect policy forwarded to `fetch`. `false` maps to `'manual'`,
   * `undefined`/`true` map to `'follow'`. See the `followRedirects`
   * field on `Request` for the architectural note about the missing
   * max-redirects cap.
   */
  followRedirects?: boolean;
  // auth and params are folded into `url` + `headers` below.
}

/** Tagged error thrown from {@link resolveRequest} when any `{{ref}}`
 *  in the draft can't be resolved against the current scopes. Caught
 *  by {@link executeRequestDraft} and turned into an `errorSnapshot`
 *  with a stable `error` message the UI matches on. Same architectural
 *  discipline as the DNR compile gate — we refuse to ship literal
 *  `{{env.var}}` strings on the wire. */
export class UnresolvedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedRequestError';
  }
}

/**
 * One TOTP vault entry the resolved request used. Carries the code
 * (so the cooldown gate can match against the recently-used code) and
 * the entry's `period` (so {@link recordTotpUsage} can compute the
 * window-end deadline). `name` doubles as the cooldown-store key
 * partition.
 */
interface TotpUsage {
  name: string;
  code: string;
  period: number;
}

interface ResolvedRequestOutcome {
  resolved: ResolvedRequest;
  /** Every TOTP vault entry referenced by the resolved request. Empty
   *  when no `{{vault.X}}` template hit a kind:'totp' entry. */
  totpUsed: ReadonlyArray<TotpUsage>;
}

async function resolveRequest(request: Request, options: ExecuteRequestOptions): Promise<ResolvedRequestOutcome> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId, options.stepCaptures);
  const context = {
    collectionId: collectionIdForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };

  // Architectural gate: refuse to dispatch when any `{{ref}}` in the
  // draft can't be resolved. Mirrors the DNR compile pipeline's
  // `getUnresolvableRuleUids` filter — shipping literal `{{env.var}}`
  // on the wire is almost never the user's intent. `isRequestResolvable`
  // excludes reserved-namespace errors (`{{file.X}}` / `{{dynamic.X}}`)
  // so those don't block until their features ship.
  const resolvable = isRequestResolvable(
    request,
    (name) => resolver.resolve(name, context),
    (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
  );
  if (!resolvable) {
    throw new UnresolvedRequestError(
      'Request has unresolved variables. Define them in vault, environment, collection, workspace, or a live workflow before sending.',
    );
  }

  // Track every kind:'totp' vault entry referenced during this resolve.
  // Index TOTP entries by name once so the per-template scan is O(1).
  // `scope.vault` is the per-workspace snapshot when `options.workspaceId`
  // is set — guards against a vault rotation between buildResolver and
  // here, and keeps cross-workspace dispatches honest.
  const totpEntries = new Map<string, VaultSecretTotp>();
  for (const s of scope.vault.secrets) {
    if (s.kind === 'totp') totpEntries.set(s.name, s);
  }
  const totpUsed = new Map<string, TotpUsage>();

  const resolveStr = (s: string): string => {
    const result = resolveTemplate(
      s,
      (name) => resolver.resolve(name, context),
      (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
    );
    if (totpEntries.size > 0) {
      for (const v of result.variables) {
        if (!v.resolved || v.scope !== 'vault' || !v.value) continue;
        // Template-variable names carry the namespace prefix when the
        // user wrote `{{vault.X}}`; strip it before matching the bare
        // entry name. Flat `{{X}}` resolves the same way but the name
        // arrives unprefixed.
        const bareName = v.name.startsWith('vault.') ? v.name.slice('vault.'.length) : v.name;
        const entry = totpEntries.get(bareName);
        if (entry) totpUsed.set(bareName, { name: bareName, code: v.value, period: entry.period });
      }
    }
    return result.result;
  };

  // ── URL with query params ───────────────────────────────────────
  let resolvedUrl = resolveStr(request.url);
  const enabledParams = request.params
    .filter((p) => (p.enabled ?? true) && p.key.trim())
    .map((p) => ({ key: resolveStr(p.key), value: resolveStr(p.value) }));

  // ── Headers ─────────────────────────────────────────────────────
  const headers: Array<{ key: string; value: string }> = request.headers
    .filter((h) => (h.enabled ?? true) && h.key.trim())
    .map((h) => ({ key: resolveStr(h.key), value: resolveStr(h.value) }));

  // ── Auth folds into headers/params ──────────────────────────────
  await applyAuth(request.auth, headers, enabledParams, resolveStr);

  // Append params to URL after auth — api-key-in-query lives in
  // enabledParams and MUST be appended too.
  resolvedUrl = appendQueryParams(resolvedUrl, enabledParams);

  // ── Body ────────────────────────────────────────────────────────
  const resolvedBody = buildResolvedBody(request.body, resolveStr);

  // Ensure a Content-Type header matches the body shape if the user
  // didn't set one. Skipped for `none` (no body), `form` (set by the
  // URLSearchParams path below), and `multipart` (set by the browser
  // with a generated boundary that we MUST NOT override).
  if (
    resolvedBody.type !== 'none' &&
    resolvedBody.type !== 'form' &&
    resolvedBody.type !== 'multipart' &&
    !headers.some((h) => h.key.toLowerCase() === 'content-type')
  ) {
    const ct = defaultContentType(resolvedBody);
    if (ct) headers.push({ key: 'Content-Type', value: ct });
  }

  return {
    resolved: {
      method: request.method,
      url: resolvedUrl,
      headers,
      body: resolvedBody,
      // Cookie-jar policy. `'omit'` is the safe default when the request
      // doesn't explicitly opt in — even with `<all_urls>` granted, we
      // never ride the browser's cookie jar by accident. See ARCHITECTURE.md §14.
      credentialsMode: request.credentialsMode === 'include' ? 'include' : 'omit',
      followRedirects: request.followRedirects,
    },
    totpUsed: [...totpUsed.values()],
  };
}

/**
 * Build the precomputed TOTP code map for every kind:'totp' vault entry.
 * Awaited concurrently so a vault with N TOTP entries pays one
 * `Promise.all` round-trip rather than N serial waits. Entries whose
 * seed fails to decode (malformed base32) are skipped; the resolver
 * surfaces them as `unset-in-scope` and the request gate rejects the
 * send with a structured error.
 */
async function buildTotpRegistry(vault: Vault): Promise<TotpRegistry> {
  const totpEntries = vault.secrets.filter((s): s is VaultSecretTotp => s.kind === 'totp');
  if (totpEntries.length === 0) return new Map();
  const codes = await Promise.all(
    totpEntries.map(async (e) => {
      try {
        const code = await generateTotp({
          seed: e.seed,
          algorithm: e.algorithm,
          digits: e.digits,
          period: e.period,
        });
        return [e.name, code] as const;
      } catch (err) {
        logger.info('RequestExecutor', `TOTP code generation failed for '${e.name}': ${(err as Error).message}`);
        return null;
      }
    }),
  );
  const out = new Map<string, string>();
  for (const entry of codes) {
    if (entry) out.set(entry[0], entry[1]);
  }
  return out;
}

/**
 * Build the resolved body payload the executor will attach to the
 * fetch. Exhaustive over the discriminated union — every variant
 * runs its templatable fields through `resolveStr` so the wire body
 * never carries a literal `{{ref}}`. File-part bytes are read later
 * by `buildMultipartForm` via the BlobStore; the `fileRefs` list
 * passes through unchanged because file paths/hashes aren't
 * user-templated.
 *
 * Disabled rows on form / multipart bodies are NOT skipped here —
 * they're carried with `enabled: false` so `executeResolved` can
 * filter them at the wire boundary. Centralizing the filter there
 * keeps the resolved shape a faithful map of the input shape and
 * avoids re-introducing a "did the resolved body keep the disabled
 * row?" question in any downstream consumer (snapshot, mutation,
 * scripts).
 */
function buildResolvedBody(body: RequestBody, resolveStr: (s: string) => string): RequestBody {
  switch (body.type) {
    case 'none':
      return { type: 'none' };
    case 'json':
      return { type: 'json', content: resolveStr(body.content) };
    case 'xml':
      return { type: 'xml', content: resolveStr(body.content) };
    case 'text':
      return body.rawFormat !== undefined
        ? { type: 'text', content: resolveStr(body.content), rawFormat: body.rawFormat }
        : { type: 'text', content: resolveStr(body.content) };
    case 'graphql': {
      // GraphQL variables are JSON text the user typed — resolve
      // templates inside it the same way as the query string. The
      // wire-side JSON wrap happens in `executeResolved`.
      const variables = body.graphqlVariables !== undefined ? resolveStr(body.graphqlVariables) : undefined;
      return variables !== undefined
        ? { type: 'graphql', content: resolveStr(body.content), graphqlVariables: variables }
        : { type: 'graphql', content: resolveStr(body.content) };
    }
    case 'form': {
      const resolvedParts: FormField[] = body.formParts.map((part) => {
        // Skip resolveStr for disabled rows — they aren't sent, so
        // their `{{ref}}` references shouldn't burn TOTP cooldown or
        // contribute to the resolver's variable-usage tracking. The
        // structural fields (description, enabled flag) round-trip
        // verbatim.
        if (part.enabled === false) return { ...part };
        return {
          ...part,
          key: resolveStr(part.key),
          value: resolveStr(part.value),
        };
      });
      return { type: 'form', formParts: resolvedParts };
    }
    case 'multipart': {
      const resolvedParts: MultipartPart[] = body.multipartParts.map((part) => {
        if (part.enabled === false) {
          // Same disabled-row contract as form — skip resolveStr so
          // disabled parts can't leak vault TOTP usage into the
          // cooldown tracker for codes that won't be sent.
          return part;
        }
        const name = resolveStr(part.name);
        if (part.kind === 'text') {
          return { kind: 'text', uid: part.uid, name, value: resolveStr(part.value), enabled: part.enabled };
        }
        return {
          kind: 'file',
          uid: part.uid,
          name,
          fileRefs: part.fileRefs,
          enabled: part.enabled,
        };
      });
      return { type: 'multipart', multipartParts: resolvedParts };
    }
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return { type: 'none' };
    }
  }
}

async function applyAuth(
  auth: AuthConfig,
  headers: Array<{ key: string; value: string }>,
  params: Array<{ key: string; value: string }>,
  resolveStr: (s: string) => string,
): Promise<void> {
  if (auth.type === 'none' || auth.type === 'inherit') return;
  if (auth.type === 'basic') {
    const u = resolveStr(auth.username);
    const p = resolveStr(auth.password);
    // RFC 7617 mandates UTF-8. `btoa` throws on non-ASCII, so we
    // encode the credential pair as UTF-8 bytes first, then base64 the
    // byte string. Without this, a password like `pässwörd` crashes
    // the executor with `InvalidCharacterError` before fetch is even
    // called.
    const bytes = new TextEncoder().encode(`${u}:${p}`);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const token = btoa(binary);
    headers.push({ key: 'Authorization', value: `Basic ${token}` });
    return;
  }
  if (auth.type === 'bearer') {
    headers.push({ key: 'Authorization', value: `Bearer ${resolveStr(auth.token)}` });
    return;
  }
  if (auth.type === 'api-key') {
    const k = resolveStr(auth.key);
    const v = resolveStr(auth.value);
    if (auth.in === 'header') headers.push({ key: k, value: v });
    else params.push({ key: k, value: v });
    return;
  }
  if (auth.type === 'oauth2') {
    // OAuth2 access tokens live in the SW's per-workspace token
    // store (ARCHITECTURE §18). We fetch the bundle, refresh if
    // expired + a refresh token is available, then attach the
    // `Authorization: Bearer <access_token>` header.
    //
    // Silent failures on the send path are the right default here:
    // a missing/expired token surfaces in the response panel as a
    // 401 from the target API, which is more actionable for the
    // user than an extension-generated error. The Status pill +
    // observability log capture the detail either way.
    let bundle = await getOAuthTokenBundle(auth.credentialRef);
    if (bundle && isOAuthTokenExpired(bundle) && bundle.refreshToken) {
      try {
        bundle = await performOAuthRefresh(auth);
      } catch (err) {
        if (err instanceof OAuth2FlowError) {
          logger.info('RequestExecutor', `OAuth refresh failed for ${auth.credentialRef}: ${err.message}`);
        } else {
          throw err;
        }
      }
    }
    if (bundle) {
      if (auth.sendAs === 'query') {
        // Legacy URI Query Parameter method (RFC 6750 §2.3) — the UI
        // warns the user this is deprecated; we still honor it for
        // providers that require it.
        params.push({ key: 'access_token', value: bundle.accessToken });
      } else {
        headers.push({ key: 'Authorization', value: `${bundle.tokenType} ${bundle.accessToken}` });
      }
    }
  }
}

// `ensureScheme` lives in the shared fetch module so the renderer
// (RequestEditor URL bar) and the executor apply the exact same
// normalization. Re-exported here so the request-executor unit
// test keeps importing from one place.
export { ensureScheme } from '@/shared/fetch/ensure-scheme';

/**
 * Default Content-Type for the resolved body shape. `null` for
 * variants whose Content-Type is set elsewhere (`form` builds the
 * URLSearchParams Content-Type from the encoder; `multipart` lets the
 * browser pick one with a boundary; `none` has no body to type).
 *
 * For `text` bodies the rawFormat hint is honored so the user's
 * "JavaScript" / "HTML" dropdown choice picks `text/javascript` or
 * `text/html` instead of plain `text/plain`. The user can always
 * override by setting an explicit Content-Type header.
 */
function defaultContentType(body: RequestBody): string | null {
  switch (body.type) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'text':
      if (body.rawFormat === 'javascript') return 'text/javascript';
      if (body.rawFormat === 'html') return 'text/html';
      return 'text/plain';
    case 'graphql':
      return 'application/json';
    default:
      return null;
  }
}

// ── Execution ──────────────────────────────────────────────────────

async function executeResolved(
  req: ResolvedRequest,
  options: { silentStatus?: boolean } = {},
): Promise<ExecutedRequestSnapshot> {
  const trimmed = req.url.trim();
  if (!trimmed) {
    return errorSnapshot('URL is empty');
  }
  // Normalize scheme-less URLs. Chrome's `fetch()` resolves relative
  // URLs against the caller's origin — and the SW's origin is
  // `chrome-extension://<id>/`, whose asset filesystem returns
  // `ERR_FILE_NOT_FOUND` for unknown paths. That makes "example.com"
  // + GET produce a confusing "Failed to fetch" with no actionable
  // cause. Scheme inference picks `http://` for loopback + RFC 1918 +
  // mDNS + single-label hosts (intranet / hosts-file / dev-server
  // pattern) and `https://` for everything else. Templated URLs
  // (`{{BASE}}/x`) are left alone — the template may carry the scheme.
  req = { ...req, url: ensureScheme(trimmed) };

  // Pre-flight URL validation — catch malformed inputs BEFORE fetch
  // so the user sees "Invalid URL: <reason>" instead of the browser's
  // generic "Failed to fetch". Matches Postman's "Invalid URI" error
  // surface. Templated URLs still skip — the template may only resolve
  // to a valid URL at runtime, and a pre-resolution parse failure on
  // a raw template string would be a false positive.
  if (!req.url.startsWith('{{')) {
    try {
      const parsed = new URL(req.url);
      // Chrome accepts URLs with empty hostnames (e.g. `http:///path`)
      // at `new URL()`, but fetch() will fail with an opaque "Failed
      // to fetch." Reject here with a specific message.
      if (!parsed.hostname) {
        return errorSnapshot(`Invalid URL — missing host: "${req.url}"`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return errorSnapshot(`Invalid URL: ${reason}`);
    }
  }

  // Offline gate — browsers report every network error as an opaque
  // `TypeError: Failed to fetch`, so we can't classify "DNS failure"
  // vs "connection refused" vs "offline" after the fact. Catching
  // offline up front produces a clean, actionable message; everything
  // else falls through to the catch below and surfaces the browser's
  // raw error.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return errorSnapshot("Can't reach network — device reports offline. Check your connection and try again.");
  }

  const init: RequestInit = {
    method: req.method,
    // `followRedirects !== false` means chase 3xx to the final target
    // (matches curl / browsers by default). `false` selects `'manual'`,
    // which surfaces the first 3xx response verbatim — the fetch
    // resolves with an `opaqueredirect` response so the UI shows that
    // the hop happened without chasing it further. MV3 fetch can't
    // expose intermediate redirect headers, so the UI rail documents
    // that the max-redirects cap is browser-governed.
    redirect: req.followRedirects === false ? 'manual' : 'follow',
    cache: 'no-store',
    // Wire-level cookie policy: default `'omit'` so nothing leaks from
    // the browser's cookie jar to arbitrary hosts. Users opt in per
    // request via `credentialsMode: 'include'` (UI toggle warns about
    // the leak potential).
    credentials: req.credentialsMode,
  };

  const fetchHeaders = new Headers();
  for (const { key, value } of req.headers) fetchHeaders.append(key, value);
  init.headers = fetchHeaders;

  // Body handling — attach the body for any method the user chose.
  // GET-with-body is spec-questionable but some servers (Elasticsearch,
  // search APIs) accept it. If the browser's fetch() rejects the
  // combination we let the TypeError flow through to the catch below —
  // the user sees the actual error in the response panel rather than
  // wondering why their body was silently dropped.
  //
  // Exhaustive over the resolved-body union — every variant attaches
  // its wire payload here. `none` attaches nothing; `form` produces a
  // URLSearchParams (browser-set Content-Type); `multipart` produces
  // FormData (browser-set Content-Type with boundary); JSON / XML /
  // text / graphql produce raw strings using the resolved content.
  switch (req.body.type) {
    case 'none':
      break;
    case 'json':
    case 'xml':
    case 'text':
      init.body = req.body.content;
      break;
    case 'graphql': {
      // GraphQL HTTP transport (https://graphql.org/learn/serving-over-http/):
      // the wire body is `{"query": "...", "variables": {...}}` —
      // application/json. Sending the raw query string verbatim is what
      // the executor used to do; no GraphQL server accepts that.
      // `graphqlVariables` is JSON text the user typed; embed it as
      // parsed JSON when valid so the wire body has a real `variables`
      // object, falling back to omitting the field on parse failure
      // (better to send `{query}` than a malformed wire body that
      // crashes the server JSON parser).
      const wire: { query: string; variables?: unknown } = { query: req.body.content };
      const variablesText = req.body.graphqlVariables?.trim();
      if (variablesText) {
        try {
          wire.variables = JSON.parse(variablesText);
        } catch {
          // Leave `variables` unset; the server sees `{query}` which
          // most accept as "no variables" rather than 400.
        }
      }
      init.body = JSON.stringify(wire);
      break;
    }
    case 'form': {
      // Structured `formParts` is the source of truth — each enabled
      // entry becomes a URLSearchParams field. Disabled rows stay on
      // disk for later re-enable but are skipped on the wire.
      const params = new URLSearchParams();
      for (const p of req.body.formParts) {
        if (p.enabled === false) continue;
        params.append(p.key, p.value);
      }
      init.body = params;
      break;
    }
    case 'multipart': {
      // Build FormData from the structured part list. For file parts
      // we resolve `fileRef.hash` to bytes via the BlobStore; dropped
      // parts (missing blob) land as a report entry in the response
      // snapshot so the user sees exactly what slipped through.
      const form = await buildMultipartForm(req.body.multipartParts);
      init.body = form;
      // IMPORTANT: clear any user-set `Content-Type: multipart/form-data`
      // header. The browser MUST set its own Content-Type with the
      // generated boundary; a manually-set header omits the boundary
      // and every server rejects the request with "malformed multipart".
      if (fetchHeaders.has('Content-Type')) {
        const ct = (fetchHeaders.get('Content-Type') ?? '').toLowerCase();
        if (ct.startsWith('multipart/form-data')) {
          fetchHeaders.delete('Content-Type');
        }
      }
      break;
    }
    default: {
      const _exhaustive: never = req.body;
      void _exhaustive;
    }
  }

  const startedAt = performance.now();
  try {
    // Every user-facing fetch routes through withHostAccess — today a
    // pass-through, tomorrow the gate for a minimal-permissions SKU.
    const response = await withHostAccess(req.url, () => fetch(req.url, init));
    const durationMs = Math.round(performance.now() - startedAt);
    // A successful fetch resets the Status pill — the user sees
    // green again on their next glance. A reset is a clean transition
    // from yellow (most recent failure) back to green (baseline).
    // `silentStatus` suppresses the pill update for non-user-initiated
    // fetches (e.g., Live Workflow refreshes, which report through the
    // `live` subsystem instead).
    if (!options.silentStatus) {
      reportStatus({
        subsystem: 'requests',
        state: 'green',
        message: `Last request: ${response.status} ${response.statusText || 'OK'}`,
      });
    }

    const headers: Array<{ key: string; value: string }> = [];
    response.headers.forEach((value, key) => {
      headers.push({ key, value });
    });

    // Read body with size cap. For large responses we slice + flag so
    // the UI doesn't try to render megabytes of text.
    const bodyText = await response.text();
    const bodyBytes = new TextEncoder().encode(bodyText).byteLength;
    const truncated = bodyBytes > MAX_BODY_BYTES;
    const body = truncated ? bodyText.slice(0, MAX_BODY_BYTES) : bodyText;

    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url || req.url,
      headers,
      body,
      bodyTruncated: truncated,
      bodyBytes,
      durationMs,
      error: null,
      scripts: null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    const rawMessage = err instanceof Error ? err.message : String(err);
    // Chromium's `fetch()` opaques every non-TLS network error — DNS
    // failure, connection refused, unreachable host, host permission
    // missing, offline, abort — into the exact same `TypeError:
    // Failed to fetch`. There is no `err.cause` chain we can unwrap
    // to get the underlying OS error (unlike Node's `getaddrinfo
    // ENOTFOUND` / `ECONNREFUSED`). Best we can do is add context the
    // user can act on: the URL we tried, the fact that it was
    // `http`/`https`, and a hint about common causes. That's what
    // Postman (in the browser/SDK variant) also shows.
    const isGenericFetchFail = err instanceof TypeError && /failed to fetch/i.test(rawMessage);
    const message = isGenericFetchFail ? classifyFetchFailure(req.url, rawMessage) : rawMessage;
    logger.info('RequestExecutor', `fetch failed for ${req.url}: ${rawMessage}`);
    recordLog({
      subsystem: 'request-executor',
      op: 'fetch',
      level: 'error',
      message: `Fetch failed for ${req.url}: ${rawMessage}`,
      context: {
        errorClass: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
    // Surface as a Status pill — one-shot fetch failures don't need
    // red (they may be routine offline / DNS blips), but the user
    // should see the most recent failure when they glance at the footer.
    if (!options.silentStatus) {
      reportStatus({
        subsystem: 'requests',
        state: 'yellow',
        message: `Last request failed: ${message}`,
        context: {
          url: req.url,
          errorClass: err instanceof Error ? err.name : undefined,
        },
      });
    }
    return {
      status: 0,
      statusText: '',
      url: req.url,
      headers: [],
      body: '',
      bodyTruncated: false,
      bodyBytes: 0,
      durationMs,
      error: message,
      scripts: null,
    };
  }
}

/**
 * Produce a user-actionable error string for the generic
 * `TypeError: Failed to fetch` that Chromium's fetch returns for
 * every non-TLS network failure. The browser deliberately withholds
 * the underlying OS error (DNS vs. refused vs. unreachable) from
 * extension code, so we can't reproduce Postman's native-SDK error
 * strings ("getaddrinfo ENOTFOUND ...") — but we CAN replace the
 * content-free default with a breakdown of the likely causes so the
 * user knows where to look.
 */
function classifyFetchFailure(url: string, rawMessage: string): string {
  let hostname = '';
  let protocol = '';
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    protocol = parsed.protocol;
  } catch {
    return `${rawMessage} — invalid URL "${url}"`;
  }
  // Offline is handled by the pre-flight check; if we got here with
  // navigator.onLine=false it means the signal flipped during the
  // fetch. Still worth surfacing cleanly.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return `Network offline — could not reach ${hostname}.`;
  }
  const looksLocal =
    /^(localhost|127\.)/.test(hostname) ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    (!hostname.includes('.') && !hostname.includes(':'));
  if (looksLocal) {
    return `Could not reach ${hostname} (${protocol.replace(':', '')}). Is the service running? If it requires HTTPS, enter the full URL with https:// prefix.`;
  }
  return `Could not reach ${hostname}. Possible causes: host not found (DNS), connection refused, TLS certificate error, or missing host permission. Check the URL and retry.`;
}

/**
 * Build a FormData object from a multipart part list. Text parts
 * go through verbatim; file parts resolve `fileRef.hash` to the
 * actual blob bytes via the per-workspace BlobStore. Missing blobs
 * are skipped silently today — the user sees the mismatch reflected
 * in the response (no part by that name) rather than a hard error.
 * A future dedicated Status-subsystem entry could surface this more
 * loudly once we have the UI affordance.
 */
async function buildMultipartForm(parts: readonly MultipartPart[]): Promise<FormData> {
  const form = new FormData();
  for (const part of parts) {
    if (part.enabled === false) continue;
    if (part.kind === 'text') {
      form.append(part.name, part.value);
      continue;
    }
    // File parts hold a list — emit one FormData append per FileRef so
    // `<input type="file" multiple>` semantics round-trip correctly
    // (HTTP multipart allows repeated field names by design). Missing
    // blobs are skipped silently; the user sees the mismatch reflected
    // in the response.
    for (const ref of part.fileRefs) {
      const blob = await getFileBlob(ref.fileId);
      if (!blob) continue;
      const mimeType = ref.mimeType ?? blob.type ?? 'application/octet-stream';
      // Retype the blob so the multipart boundary carries the right
      // content-type (browsers default to application/octet-stream
      // for generic blobs, which some servers treat as opaque).
      const typed = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
      form.append(part.name, typed, ref.filename);
    }
  }
  return form;
}

function errorSnapshot(message: string): ExecutedRequestSnapshot {
  return {
    status: 0,
    statusText: '',
    url: '',
    headers: [],
    body: '',
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 0,
    error: message,
    scripts: null,
  };
}
