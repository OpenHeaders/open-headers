/**
 * Node-host request-suite runner — the execution loop behind the
 * `runs_execute` MCP tool (the `oh run collection|folder` surface).
 *
 * Each request runs through the same `runStepRequest` core the chain
 * runner and `requests_send` use — full scope-chain resolution, TOTP
 * cooldown gate, per-origin refresh rate limiter — with two postures
 * chosen for unattended CI runs:
 *
 *   - Scripts run under the strict chain contract (read-only `oh.*`
 *     tier, script errors and failed assertions fail the item) when
 *     this host has a script runtime; a scriptless host (the bare SEA
 *     binary) reports that honestly in the result instead of quietly
 *     passing everything.
 *   - Expired OAuth tokens refresh before send (the scheduler's
 *     refresh-on-expired hook) — an unattended run can't re-auth
 *     interactively.
 *
 * Items run sequentially in plan order — shared state (cookie jars,
 * `{{live.*}}` publication, the rate limiter's token bucket) assumes
 * one send at a time, and a CI report wants deterministic order.
 *
 * Pass/fail law (mirrored in the tool description): an item fails on
 * a transport/script/assertion error; without any assertions an HTTP
 * status ≥ 400 fails it too (a bare smoke suite should fail on 500s),
 * while a request that asserts takes its assertions as the verdict —
 * explicit tests outrank the status code.
 */

import type { ScriptExecutionMode } from '@openheaders/core/scripts';
import type { Request } from '@openheaders/core/types';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { withRefreshRateLimit } from '@openheaders/oracle/live/request-exec/rate-limiter';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import { createNodeRequestTransport } from '../../live/node-request-transport';
import { resolveScriptRunner } from '../script-capability';

/** One Node transport for the whole process — stateless, so a singleton
 *  avoids rebuilding the `fetch` wrapper on every item (the chain
 *  runner's idiom). */
const nodeTransport = createNodeRequestTransport();

export interface SuiteRunArgs {
  workspaceId: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  /** The plan's requests, already in tree order. */
  requests: readonly Request[];
  /** Stop at the first failure; remaining items report `skipped`. */
  bail: boolean;
}

export interface SuiteRunAssertion {
  name: string;
  passed: boolean;
  message?: string;
}

export interface SuiteRunItem {
  kind: 'request';
  uid: string;
  name: string;
  path: string;
  method: string;
  url: string;
  status: 'passed' | 'failed' | 'skipped';
  /** Present when the send produced a response head. */
  httpStatus?: number;
  /** Wire-truth negotiated protocol (the always-on report), when known. */
  httpVersion?: string;
  durationMs?: number;
  assertions: SuiteRunAssertion[];
  error?: string;
}

export interface SuiteRunResult {
  /** Script-capability honesty: `available: false` means every item ran
   *  scriptless — assertions could not have executed on this host. */
  scripts: { available: boolean; mode?: ScriptExecutionMode };
  items: SuiteRunItem[];
}

export async function runRequestSuite(args: SuiteRunArgs): Promise<SuiteRunResult> {
  const scripts = await resolveScriptRunner({ workspaceId: args.workspaceId, hostContext: 'chain' });
  const refreshOAuth = buildRefreshOAuthHook(args.workspaceId);
  const items: SuiteRunItem[] = [];
  let bailed = false;

  for (const request of args.requests) {
    if (bailed) {
      items.push(itemBase(request, 'skipped', []));
      continue;
    }
    const snapshot = await withRefreshRateLimit(request.url, () =>
      runStepRequest(request, {
        workspaceId: args.workspaceId,
        environmentId: args.environmentId,
        transport: nodeTransport,
        scriptRunner: scripts?.runner,
        refreshOAuth,
      }),
    );

    const assertions: SuiteRunAssertion[] = (snapshot.scripts?.postResponse?.assertions ?? []).map((assertion) => ({
      name: assertion.name,
      passed: assertion.passed,
      ...(assertion.message !== undefined ? { message: assertion.message } : {}),
    }));
    const headReceived = snapshot.status > 0;
    const httpFailed = assertions.length === 0 && snapshot.status >= 400;
    const failed = snapshot.error != null || httpFailed;
    const error =
      snapshot.error != null
        ? snapshot.error
        : httpFailed
          ? `HTTP ${snapshot.status}${snapshot.statusText ? ` ${snapshot.statusText}` : ''}`
          : undefined;

    items.push({
      ...itemBase(request, failed ? 'failed' : 'passed', assertions),
      ...(headReceived ? { httpStatus: snapshot.status, durationMs: snapshot.durationMs } : {}),
      ...(snapshot.httpVersion !== undefined ? { httpVersion: snapshot.httpVersion } : {}),
      ...(error !== undefined ? { error } : {}),
    });
    if (failed && args.bail) bailed = true;
  }

  return {
    scripts: { available: scripts !== null, ...(scripts ? { mode: scripts.mode } : {}) },
    items,
  };
}

function itemBase(request: Request, status: SuiteRunItem['status'], assertions: SuiteRunAssertion[]): SuiteRunItem {
  return {
    kind: 'request',
    uid: request.uid,
    name: request.name,
    path: request.path,
    method: request.method,
    url: request.url,
    status,
    assertions,
  };
}
