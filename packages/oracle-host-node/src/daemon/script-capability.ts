/**
 * Host script capability — the seam through which a Node host's shell
 * hands the spine a script runtime for pre-request / post-response
 * scripts. The desktop app registers its sandboxed-renderer broker at
 * boot; the headless daemon registers nothing and every send / chain
 * step stays scriptless (the honest "scripts don't run here" posture).
 *
 * The capability speaks the same contract as the extension's offscreen
 * host: `runScript` never throws for the callers wired here (the
 * runner builders below fold transport faults into a failed
 * `ScriptExecutionResult`), and `hostContext` selects the host-API
 * tier — `'interactive'` (a user's workbench Send) gets the full
 * `oh.*` surface, `'chain'` (a workflow step with `runScripts: true`)
 * gets the read-only tier enforced by the host's broker.
 *
 * Mode gate: the per-workspace script execution mode is HOST-LOCAL
 * (`OH.scriptExecutionModes` — a synced workspace must never carry
 * Developer mode onto another device). `resolveScriptRunner` consults
 * the slot only for a LOCAL INTERACTIVE dispatch: a peer-forwarded
 * send never rides anything but Safe (foreign scripts run Safe or not
 * at all), and chain steps stay Safe regardless of the slot — the
 * strict contract and read-only tier are about unattended scheduling,
 * not just trust. A `'developer'` slot value without a registered
 * Developer runtime falls back to Safe, and the recorded mode says so
 * honestly.
 */

import type {
  RequestSnapshot,
  ResponseSnapshot,
  ScriptExecutionMode,
  ScriptExecutionResult,
  ScriptKind,
} from '@openheaders/core/scripts';
import { DEFAULT_SCRIPT_EXECUTION_MODE, readScriptExecutionMode } from '@openheaders/core/scripts';
import type { StepScriptRunner } from '@openheaders/oracle/live/request-exec/script-hooks';
import { hostStorage, OH } from '@openheaders/oracle/storage';

/** One script execution the host's broker runs. Mirrors the extension
 *  offscreen host's `RunScriptOptions`. */
export interface HostScriptRunOptions {
  kind: ScriptKind;
  source: string;
  request: RequestSnapshot;
  response?: ResponseSnapshot;
  timeoutMs?: number;
  /** Host-API tier — `'chain'` gets the read-only `oh.*` surface. */
  hostContext?: 'interactive' | 'chain';
}

export interface HostScriptCapability {
  /** The trust posture this runtime provides. The sandboxed-renderer
   *  broker is `'safe'`; the full-runtime `utilityProcess` worker is
   *  `'developer'`. */
  mode: ScriptExecutionMode;
  runScript(opts: HostScriptRunOptions): Promise<ScriptExecutionResult>;
}

/** The host's registered runtimes, keyed by the mode each provides. A
 *  host may register Safe alone (every dispatch runs Safe) or both. A
 *  Developer-only registration is rejected at install: Safe is the
 *  fallback every non-interactive dispatch depends on. */
export type HostScriptCapabilities = Partial<Record<ScriptExecutionMode, HostScriptCapability>>;

let capabilities: HostScriptCapabilities = {};

/** Install (or clear, with `null`) the host's script runtimes. The
 *  desktop shell calls this once at boot; tests swap fakes; the daemon
 *  never calls. */
export function setHostScriptCapabilities(next: HostScriptCapabilities | null): void {
  if (next?.developer && !next.safe) {
    throw new Error('script capabilities: a Developer runtime requires a Safe runtime to fall back to');
  }
  capabilities = next ?? {};
}

export function getHostScriptCapability(
  mode: ScriptExecutionMode = DEFAULT_SCRIPT_EXECUTION_MODE,
): HostScriptCapability | null {
  return capabilities[mode] ?? null;
}

/**
 * Read the host-local per-workspace mode slot. Absent slot / entry /
 * unknown value = `'safe'`. Shipped ahead of the chooser UI so it has
 * somewhere to write; a storage fault reads as the safe default.
 */
export async function readScriptExecutionModeSlot(workspaceId: string | null): Promise<ScriptExecutionMode> {
  try {
    const modes = await hostStorage.get(OH.scriptExecutionModes);
    return readScriptExecutionMode(modes, workspaceId);
  } catch {
    return DEFAULT_SCRIPT_EXECUTION_MODE;
  }
}

export interface ResolvedScriptRunner {
  runner: StepScriptRunner;
  /** The mode the run will actually execute under — recorded on the
   *  executed-run snapshot, never re-read from live settings. */
  mode: ScriptExecutionMode;
}

/**
 * Resolve the script runner for one dispatch, or `null` when this host
 * has no script runtime (the daemon today). The mode slot is consulted
 * only for a LOCAL INTERACTIVE dispatch: `forwarded` marks a
 * peer-forwarded send (foreign scripts run Safe or not at all), and
 * chain steps stay Safe regardless of the slot — unattended scheduled
 * runs must not inherit a full-runtime opt-in made for hands-on work.
 * A `'developer'` slot without a registered Developer runtime resolves
 * the Safe capability, and the recorded mode says so honestly.
 */
export async function resolveScriptRunner(options: {
  workspaceId: string | null;
  hostContext: 'interactive' | 'chain';
  forwarded?: boolean;
}): Promise<ResolvedScriptRunner | null> {
  const requestedMode =
    options.forwarded === true || options.hostContext === 'chain'
      ? DEFAULT_SCRIPT_EXECUTION_MODE
      : await readScriptExecutionModeSlot(options.workspaceId);
  const cap = capabilities[requestedMode] ?? capabilities[DEFAULT_SCRIPT_EXECUTION_MODE];
  if (!cap) return null;
  return {
    mode: cap.mode,
    runner: (input) =>
      cap
        .runScript({
          kind: input.kind,
          source: input.source,
          request: input.request,
          response: input.response,
          hostContext: options.hostContext,
        })
        .catch((err: unknown) => ({
          // The port contract is "never throw" — a broker/transport
          // fault surfaces as a failed script result, which the step
          // runner turns into a run failure with the carrier message.
          executionId: 'script-runtime-unavailable',
          succeeded: false,
          error: {
            name: 'ScriptRuntimeError',
            message: err instanceof Error ? err.message : String(err),
          },
          assertions: [],
          consoleLog: [],
          durationMs: 0,
        })),
  };
}
