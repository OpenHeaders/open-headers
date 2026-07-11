/**
 * Chain fetch adapter — implements the core runner's {@link FetchAdapter}
 * seam by resolving + executing each step's persisted request through the
 * host-neutral request executor.
 *
 * Both hosts build their adapter from this one factory, differing only in
 * the injected {@link RequestTransport} (browser SW fetch vs. Node fetch),
 * the optional OAuth-refresh hook, and `prepareRequest` — the browser
 * stamps the `X-OH-Live-Bypass` DNR header (a no-op on the desktop, which
 * has no DNR engine, so it simply omits the hook).
 *
 * Per-origin rate limiting wraps every step fetch so N workflows against
 * one upstream serialize instead of racing to 429s. The bucket is keyed
 * on the pre-resolution URL template (same template → same bucket),
 * avoiding a resolution round-trip just to pick a slot.
 */

import type { FetchAdapter } from '@openheaders/core/live';
import type { Request } from '@openheaders/core/types';
import { getRequestInWorkspace } from '../../entity/request-store';
import { withRefreshRateLimit } from './rate-limiter';
import type { OAuthRefreshFn } from './resolve-request';
import { runStepRequest } from './run-step-request';
import type { RequestTransport } from './transport';

export interface ChainFetchAdapterOptions {
  /** Workspace owning the workflow — every store read + cooldown
   *  partition resolves against it. */
  workspaceId: string;
  /** Env the chain was scheduled under. `null` = "No environment". */
  environmentId: string | null;
  /** Host network capability. */
  transport: RequestTransport;
  /** Optional host hook to refresh an expired OAuth token before send. */
  refreshOAuth?: OAuthRefreshFn;
  /**
   * Optional per-step request decorator the host applies before resolve
   * — the browser stamps the DNR-bypass header here so rules referencing
   * this workflow's live values don't fire on the fetch that produces
   * them. Omitted on hosts without a DNR engine.
   */
  prepareRequest?: (request: Request) => Request;
}

export function buildChainFetchAdapter(options: ChainFetchAdapterOptions): FetchAdapter {
  const { workspaceId, environmentId, transport, refreshOAuth, prepareRequest } = options;
  return {
    async executeStep(step, stepCaptures) {
      const request = getRequestInWorkspace(step.requestUid, workspaceId);
      if (!request) {
        // A fetch-phase failure to the core runner — the workflow is
        // structurally broken (references a deleted request); the
        // scheduler keeps backing off until the user rebinds or deletes.
        throw new Error(`Step request ${step.requestUid} not found`);
      }
      const prepared = prepareRequest ? prepareRequest(request) : request;

      const snapshot = await withRefreshRateLimit(request.url, () =>
        runStepRequest(prepared, {
          workspaceId,
          environmentId,
          stepCaptures,
          transport,
          refreshOAuth,
          timeoutMs: step.timeoutMs,
        }),
      );

      if (snapshot.error != null) {
        // Network / DNS / abort — throw so the runner classifies this as
        // `failedPhase: 'fetch'`. 4xx/5xx do NOT throw: extractors may
        // legitimately read error bodies and status-code gates branch.
        throw new Error(snapshot.error);
      }

      return {
        status: snapshot.status,
        statusText: snapshot.statusText,
        url: snapshot.url,
        headers: snapshot.headers,
        body: snapshot.body,
      };
    },
  };
}
