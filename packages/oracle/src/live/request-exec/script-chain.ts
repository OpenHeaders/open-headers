/**
 * Ancestor script chain — collection/folder script slots composed onto
 * a request's send.
 *
 * Execution order is ancestor-first on the request's chain (collection
 * pre → folder pre → request pre; same order post-response), each
 * level in its OWN sandbox invocation with each pre-script's mutation
 * feeding the next level's snapshot. The phase still reports ONE
 * folded outcome in the snapshot's existing `scripts.preRequest` /
 * `scripts.postResponse` shape: succeeded = every level succeeded, the
 * first failure's error carries the failing level's label, console
 * entries carry a `[label]` prefix when more than one level
 * contributed, durations sum, mutations spread-merge in application
 * order, assertions concatenate.
 *
 * Chain derivation is path-based — the same prefix mechanism
 * `collectionIdForRequest` uses: the collection whose `path` prefixes
 * `request.path`, then every folder along the segments outer→inner. A
 * scratch draft matches no ancestors and composes to just its own
 * scripts, exactly today's behavior.
 */

import type {
  RequestMutation,
  RequestSnapshot,
  ResponseSnapshot,
  ScriptConsoleEntry,
  ScriptExecutionResult,
} from '@openheaders/core/scripts';
import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import {
  getRequestCollections,
  getRequestCollectionsForWorkspace,
  getRequestFolders,
  getRequestFoldersForWorkspace,
} from '../../entity/request-store';
import type { StepScriptRunner } from './script-hooks';

/** One script in the composed chain, labeled for error attribution. */
export interface ChainScript {
  /** Attribution label, e.g. `Collection 'Auth'`, `Folder 'Tokens'`, `Request`. */
  label: string;
  source: string;
}

export interface RequestScriptChain {
  /** Ancestor-first pre-request scripts, request-level last. */
  pre: ChainScript[];
  /** Ancestor-first post-response scripts, request-level last. */
  post: ChainScript[];
}

interface ScriptCarrier {
  path: string;
  name: string;
  preRequestScript?: string;
  postResponseScript?: string;
}

/**
 * Collect ONLY the ancestor levels' scripts (collection, then folders
 * outer→inner) — no request-level slots. `workspaceId: null` reads the
 * runtime-Active mirrors (the workbench Send path); a pinned id reads
 * that workspace's caches — the same tri-state every store read in the
 * executor follows. Whitespace-only sources are skipped. Also feeds
 * the definitional-freshness detector, which folds these sources into
 * each embedded request's executable fingerprint.
 */
export function collectAncestorScripts(request: Request, workspaceId: string | null): RequestScriptChain {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  const folders = workspaceId ? getRequestFoldersForWorkspace(workspaceId) : getRequestFolders();

  const carriers: Array<{ label: string; entity: ScriptCarrier }> = [];
  const collection = collections.find((c) => request.path.startsWith(`${c.path}/`));
  if (collection) carriers.push({ label: `Collection '${collection.name}'`, entity: collection });

  const chainFolders = folders
    .filter((f) => request.path.startsWith(`${f.path}/`))
    .sort((a, b) => a.path.length - b.path.length);
  for (const folder of chainFolders) {
    carriers.push({ label: `Folder '${folder.name}'`, entity: folder });
  }

  const pre: ChainScript[] = [];
  const post: ChainScript[] = [];
  for (const { label, entity } of carriers) {
    if (entity.preRequestScript?.trim()) pre.push({ label, source: entity.preRequestScript });
    if (entity.postResponseScript?.trim()) post.push({ label, source: entity.postResponseScript });
  }
  return { pre, post };
}

/**
 * Compose the request's full script chain: ancestors first, the
 * request's own slots last. See {@link collectAncestorScripts} for the
 * workspace tri-state.
 */
export function collectScriptChain(request: Request, workspaceId: string | null): RequestScriptChain {
  const { pre, post } = collectAncestorScripts(request, workspaceId);
  if (request.preRequestScript?.trim()) pre.push({ label: 'Request', source: request.preRequestScript });
  if (request.postResponseScript?.trim()) post.push({ label: 'Request', source: request.postResponseScript });
  return { pre, post };
}

type ScriptsOutcome = NonNullable<ExecutedRequestSnapshot['scripts']>;

/** Prefix each console entry's args with the contributing level's label. */
function prefixConsole(entries: ScriptConsoleEntry[], label: string, multi: boolean): ScriptConsoleEntry[] {
  if (!multi) return entries;
  return entries.map((e) => ({ ...e, args: [`[${label}]`, ...e.args] }));
}

/**
 * Fold a level's failure into the phase error. The level label
 * prefixes the message only when more than one level contributed — a
 * request-only chain keeps today's unprefixed message verbatim.
 */
function foldError(result: ScriptExecutionResult, label: string, multi: boolean): { name: string; message: string } {
  const message = result.error?.message ?? 'script failed';
  const name = result.error?.name ?? 'Error';
  return { name, message: multi ? `${label}: ${message}` : message };
}

export interface PreChainRunResult {
  /** Folded outcome in the snapshot's `scripts.preRequest` shape;
   *  `undefined` when the chain is empty (no scripts ran). */
  outcome: ScriptsOutcome['preRequest'];
  /** Label of the first failing level, `null` when every level succeeded. */
  failedLabel: string | null;
}

/**
 * Run the pre-request chain ancestor-first, one sandbox invocation per
 * level. `getSnapshot` re-projects the (possibly mutated) resolved
 * request between levels; `applyMutation` lands a successful level's
 * mutation before the next level runs. `strict` stops at the first
 * failure (chain-step semantics); lenient runs every level and merely
 * skips the failing level's mutation (interactive Send semantics).
 */
export async function runPreRequestChain(
  scripts: readonly ChainScript[],
  runner: StepScriptRunner,
  getSnapshot: () => RequestSnapshot,
  applyMutation: (mutation: RequestMutation) => void,
  opts: { strict: boolean },
): Promise<PreChainRunResult> {
  if (scripts.length === 0) return { outcome: undefined, failedLabel: null };
  const multi = scripts.length > 1;

  let succeeded = true;
  let error: { name: string; message: string } | undefined;
  let failedLabel: string | null = null;
  const consoleLog: ScriptConsoleEntry[] = [];
  let durationMs = 0;
  let mutation: RequestMutation | undefined;

  for (const script of scripts) {
    const result = await runner({ kind: 'pre-request', source: script.source, request: getSnapshot() });
    consoleLog.push(...prefixConsole(result.consoleLog, script.label, multi));
    durationMs += result.durationMs;
    if (result.succeeded) {
      if (result.mutation) {
        applyMutation(result.mutation);
        mutation = mutation ? { ...mutation, ...result.mutation } : result.mutation;
      }
      continue;
    }
    if (succeeded) {
      succeeded = false;
      failedLabel = script.label;
      error = foldError(result, script.label, multi);
    }
    if (opts.strict) break;
  }

  return {
    outcome: { succeeded, error, consoleLog, durationMs, mutation },
    failedLabel,
  };
}

export interface PostChainRunResult {
  /** Folded outcome in the snapshot's `scripts.postResponse` shape;
   *  `undefined` when the chain is empty (no scripts ran). */
  outcome: ScriptsOutcome['postResponse'];
  /** Label of the first level whose SCRIPT failed (not assertions). */
  failedLabel: string | null;
}

/**
 * Run the post-response chain ancestor-first. Assertions concatenate
 * across levels — a failed assertion never stops later levels (it's a
 * recorded verdict, not a script error); the caller applies its own
 * failure mapping (`firstFailedAssertion` for strict chains). `strict`
 * stops at the first script ERROR.
 */
export async function runPostResponseChain(
  scripts: readonly ChainScript[],
  runner: StepScriptRunner,
  request: RequestSnapshot,
  response: ResponseSnapshot,
  opts: { strict: boolean },
): Promise<PostChainRunResult> {
  if (scripts.length === 0) return { outcome: undefined, failedLabel: null };
  const multi = scripts.length > 1;

  let succeeded = true;
  let error: { name: string; message: string } | undefined;
  let failedLabel: string | null = null;
  const consoleLog: ScriptConsoleEntry[] = [];
  const assertions: ScriptExecutionResult['assertions'] = [];
  let durationMs = 0;

  for (const script of scripts) {
    const result = await runner({ kind: 'post-response', source: script.source, request, response });
    consoleLog.push(...prefixConsole(result.consoleLog, script.label, multi));
    assertions.push(...result.assertions);
    durationMs += result.durationMs;
    if (result.succeeded) continue;
    if (succeeded) {
      succeeded = false;
      failedLabel = script.label;
      error = foldError(result, script.label, multi);
    }
    if (opts.strict) break;
  }

  return {
    outcome: { succeeded, error, assertions, consoleLog, durationMs },
    failedLabel,
  };
}
