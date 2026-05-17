/**
 * Mode-switch Import (M4) — renderer-side bridge wrapper.
 *
 * Symmetric mirror of {@link executeCoexist}. Fires
 * `oh.sync.executeImportToPeer` on the host bridge and surfaces the
 * {@link ImportResult} verbatim; transport errors are folded into a
 * structured `{ ok: false, reason: 'peer-write-unavailable' }` so the
 * dialog dispatcher has one branch per outcome.
 *
 * The orchestration (local collection + peer push) lives entirely on
 * the host — the renderer just kicks it off and hands the result to the
 * UI dispatcher. M4b adds an optional `workspaceIdRemap` carrying the
 * user's name-collision resolution; the host stamps it onto the wire
 * payload before push.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { ImportResult } from '@openheaders/core/sync';

/**
 * User-supplied resolution for the dialog's M7 name-collision banner.
 * `workspaceIdRemap[sourceWorkspaceId] = targetWorkspaceId` instructs
 * the target host to retarget that source's snapshot at the chosen
 * target workspace id before lookup. Missing entries fall through to
 * same-id behavior; an empty record is equivalent to omitting the
 * field.
 */
export interface ExecuteImportInput {
  readonly workspaceIdRemap?: Readonly<Record<string, string>>;
}

export interface ExecuteImportDeps {
  /**
   * Default is `hostBridge.call('oh.sync.executeImportToPeer', input)`.
   * Override only in tests.
   */
  readonly bridgeCall?: (input: ExecuteImportInput) => Promise<ImportResult>;
}

export async function executeImport(
  input: ExecuteImportInput = {},
  deps: ExecuteImportDeps = {},
): Promise<ImportResult> {
  const call = deps.bridgeCall ?? defaultBridgeCall;
  try {
    return await call(input);
  } catch (err) {
    return {
      ok: false,
      reason: 'peer-write-unavailable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function defaultBridgeCall(input: ExecuteImportInput): Promise<ImportResult> {
  return hostBridge.call('oh.sync.executeImportToPeer', input);
}
