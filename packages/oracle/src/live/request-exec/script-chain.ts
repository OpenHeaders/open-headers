/**
 * Script chain — the ancestor levels' slots composed onto a request's
 * own, and the fold that runs a chain and records it.
 *
 * ONE composition law for every slot kind: the collection's slot, then
 * each folder's outer → inner, then the request's own — a slot has no
 * inherit state and no override; every level that carries a non-blank
 * source runs. `collectSlotChain` derives that chain for any kind off
 * the shared ancestor carrier walk (`ancestor-chain.ts` — the tree
 * index, never a stored path); `collectScriptChain` is the HTTP pair's
 * reading of it, the shape the three HTTP pipelines consume.
 *
 * ONE fold law: each level runs in its OWN sandbox invocation, in
 * order; the phase reports ONE folded outcome — succeeded = every level
 * succeeded, the first failure's error carries the failing level's
 * label, console entries carry a `[label]` prefix when more than one
 * level contributed, durations sum, assertions concatenate — and,
 * beside the fold, `chain` records every level that RAN (level ·
 * container · duration · verdict), the per-level attribution the fold
 * loses. `strict` stops at the first failure (chain-step semantics);
 * lenient runs every level (interactive Send). The HTTP pre-request
 * runner feeds each level's mutation into the next level's snapshot;
 * the session hooks ride the same fold with their own inputs.
 */

import type {
  RequestMutation,
  RequestSnapshot,
  ResponseSnapshot,
  ScriptConsoleEntry,
  ScriptExecutionResult,
  ScriptKind,
  ScriptSlotCarrier,
} from '@openheaders/core/scripts';
import { readScriptSlot } from '@openheaders/core/scripts';
import type { ExecutedRequestSnapshot, ExecutedScriptChainStep, Request } from '@openheaders/core/types';
import { type AncestorCarrier, collectAncestorCarriers } from './ancestor-chain';
import type { StepScriptRunner } from './script-hooks';

/** One script in the composed chain, labeled for error attribution. */
export interface ChainScript {
  level: ExecutedScriptChainStep['level'];
  /** The contributing container's (or the request's) uid and name — the run record's attribution. */
  uid: string;
  name: string;
  /** Attribution label, e.g. `Collection 'Auth'`, `Folder 'Tokens'`, `Request`. */
  label: string;
  source: string;
}

/** A leaf as the chain sees it — its identity and its own slots. */
export interface SlotChainLeaf extends ScriptSlotCarrier {
  uid: string;
  name: string;
}

function nonBlank(source: string | undefined): source is string {
  return source !== undefined && source.trim() !== '';
}

/**
 * Compose one kind's chain over already-collected carriers (outer →
 * inner) and the leaf's own slot last. Pure — the page-realm hosts
 * inject their carriers the way they inject the auth chain. `leaf`
 * `null` composes the ancestor levels alone.
 */
export function composeSlotChain(
  carriers: readonly AncestorCarrier[],
  leaf: SlotChainLeaf | null,
  kind: ScriptKind,
): ChainScript[] {
  const chain: ChainScript[] = [];
  for (const { level, label, entity } of carriers) {
    const source = readScriptSlot(entity, kind);
    if (nonBlank(source)) chain.push({ level, uid: entity.uid, name: entity.name, label, source });
  }
  if (leaf !== null) {
    const source = readScriptSlot(leaf, kind);
    if (nonBlank(source)) chain.push({ level: 'request', uid: leaf.uid, name: leaf.name, label: 'Request', source });
  }
  return chain;
}

/**
 * One kind's chain for a leaf in the tree — the ancestor carriers off
 * the tree-index walk (see {@link collectAncestorCarriers} for the
 * workspace tri-state), the leaf's own slot last. A scratch draft
 * matches no ancestors and composes to its own slot alone.
 */
export function collectSlotChain(
  leaf: SlotChainLeaf & { path: string },
  workspaceId: string | null,
  kind: ScriptKind,
): ChainScript[] {
  return composeSlotChain(collectAncestorCarriers(leaf, workspaceId), leaf, kind);
}

export interface RequestScriptChain {
  /** Ancestor-first pre-request scripts, request-level last. */
  pre: ChainScript[];
  /** Ancestor-first post-response scripts, request-level last. */
  post: ChainScript[];
}

/**
 * The HTTP pair's ANCESTOR levels alone (collection, then folders
 * outer→inner) — no request-level slots. Also feeds the
 * definitional-freshness detector, which folds these sources into
 * each embedded request's executable fingerprint.
 */
export function collectAncestorScripts(request: Request, workspaceId: string | null): RequestScriptChain {
  const carriers = collectAncestorCarriers(request, workspaceId);
  return {
    pre: composeSlotChain(carriers, null, 'pre-request'),
    post: composeSlotChain(carriers, null, 'post-response'),
  };
}

/** The HTTP pair's full chain: ancestors first, the request's own slots last. */
export function collectScriptChain(request: Request, workspaceId: string | null): RequestScriptChain {
  const carriers = collectAncestorCarriers(request, workspaceId);
  return {
    pre: composeSlotChain(carriers, request, 'pre-request'),
    post: composeSlotChain(carriers, request, 'post-response'),
  };
}

// ── The fold ────────────────────────────────────────────────────────

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

/** The level's own record — its verdict unprefixed (the level IS the attribution). */
function chainStep(script: ChainScript, result: ScriptExecutionResult): ExecutedScriptChainStep {
  return {
    level: script.level,
    uid: script.uid,
    name: script.name,
    durationMs: result.durationMs,
    succeeded: result.succeeded,
    ...(result.succeeded ? {} : { error: foldError(result, script.label, false) }),
  };
}

/** The folded phase outcome every runner shares, plus the first failing level. */
export interface ChainFold {
  succeeded: boolean;
  error?: { name: string; message: string };
  consoleLog: ScriptConsoleEntry[];
  assertions: ScriptExecutionResult['assertions'];
  durationMs: number;
  /** Every level that ran, in order — see {@link ExecutedScriptChainStep}. */
  chain: ExecutedScriptChainStep[];
  /** Label of the first failing level, `null` when every level succeeded. */
  failedLabel: string | null;
}

export interface RunChainOptions {
  /** Stop at the first failing level (chain-step semantics); lenient
   *  runs every level and merely skips what a failing level produced. */
  strict: boolean;
  /** A level SUCCEEDED — the caller lands what it produced (a
   *  pre-request level's mutation) before the next level runs. */
  onLevelSucceeded?: (result: ScriptExecutionResult) => void;
}

/**
 * Run a chain level by level through `execute` and fold the results —
 * the one fold every hook family rides. Returns `null` for an empty
 * chain: nothing ran, so nothing is recorded.
 */
export async function runScriptChain(
  scripts: readonly ChainScript[],
  execute: (script: ChainScript) => Promise<ScriptExecutionResult>,
  options: RunChainOptions,
): Promise<ChainFold | null> {
  if (scripts.length === 0) return null;
  const multi = scripts.length > 1;

  const fold: ChainFold = {
    succeeded: true,
    consoleLog: [],
    assertions: [],
    durationMs: 0,
    chain: [],
    failedLabel: null,
  };

  for (const script of scripts) {
    const result = await execute(script);
    fold.consoleLog.push(...prefixConsole(result.consoleLog, script.label, multi));
    fold.chain.push(chainStep(script, result));
    fold.assertions.push(...result.assertions);
    fold.durationMs += result.durationMs;
    if (result.succeeded) {
      options.onLevelSucceeded?.(result);
      continue;
    }
    if (fold.succeeded) {
      fold.succeeded = false;
      fold.failedLabel = script.label;
      fold.error = foldError(result, script.label, multi);
    }
    if (options.strict) break;
  }

  return fold;
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
  let mutation: RequestMutation | undefined;
  const fold = await runScriptChain(
    scripts,
    (script) => runner({ kind: 'pre-request', source: script.source, request: getSnapshot() }),
    {
      strict: opts.strict,
      onLevelSucceeded: (result) => {
        if (!result.mutation) return;
        applyMutation(result.mutation);
        mutation = mutation ? { ...mutation, ...result.mutation } : result.mutation;
      },
    },
  );
  if (fold === null) return { outcome: undefined, failedLabel: null };
  const { succeeded, error, consoleLog, durationMs, chain } = fold;
  return {
    outcome: { succeeded, error, consoleLog, durationMs, mutation, chain },
    failedLabel: fold.failedLabel,
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
  const fold = await runScriptChain(
    scripts,
    (script) => runner({ kind: 'post-response', source: script.source, request, response }),
    { strict: opts.strict },
  );
  if (fold === null) return { outcome: undefined, failedLabel: null };
  const { succeeded, error, assertions, consoleLog, durationMs, chain } = fold;
  return {
    outcome: { succeeded, error, assertions, consoleLog, durationMs, chain },
    failedLabel: fold.failedLabel,
  };
}
