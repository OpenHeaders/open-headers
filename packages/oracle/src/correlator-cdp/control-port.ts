/**
 * CDP control-plane ports — the command counterpart to the observation
 * {@link CdpEventSource} seam. Observation flows OUT of CDP (events
 * normalized into a host-neutral vocabulary the correlator reduces);
 * control flows IN through these typed ports. There is no raw
 * `send(method, params)` escape hatch: oracle stays chrome-free and the
 * chrome adapter (in `correlator-host/`) maps each typed command onto the
 * existing session-routed `chrome.debugger.sendCommand`.
 *
 * Two ports, split on the one axis the epic's load-bearing law — *replay
 * over persistence* — turns on:
 *
 *   - {@link CdpTabControlPort} — DECLARATIVE standing state. A tab's CDP
 *     environment (cache, throttle, UA/geo/tz/locale overrides, bootstrap
 *     scripts, Fetch-enable patterns, CSP bypass) is a single desired-state
 *     value, {@link CdpTabControlState}, `apply`'d to the session. It is
 *     idempotent and replayed verbatim on every (re-)attach, because the
 *     prior applied state is `forget`-ten on detach. This is where "nothing
 *     imperative survives a detach" lives structurally.
 *   - {@link CdpRequestControlPort} — IMPERATIVE transient reactions. The
 *     one-shot answer to a live `Fetch.requestPaused` (fulfill / continue /
 *     answer-auth), keyed by a `requestId` that exists only while the
 *     request is paused. NEVER replayed — replaying a fulfill for a
 *     long-gone request is meaningless. This is the output edge of the
 *     Phase-D interception loop.
 *
 * Every command targets a {@link CdpSessionTarget} — `(tabId, sessionId)`,
 * uniform with the event identity. The synthetic root session id maps to a
 * `{tabId}` debuggee in the adapter exactly as the body-fetch path does; a
 * flattened child session (worker / OOPIF) carries its real id, so the same
 * surface reaches child-target traffic (the Phase-D row-5 / Phase-E row-10
 * capability).
 */

/**
 * A CDP session to command — `(tabId, sessionId)`, the control-side twin of
 * the event identity. `sessionId` is the synthetic root session id for the
 * page target or a flattened child's real id (worker / OOPIF).
 */
export interface CdpSessionTarget {
  readonly tabId: number;
  readonly sessionId: string;
}

// ── standing tab state (declarative, replayed) ───────────────────────────

/**
 * Tab-wide network emulation (`Network.emulateNetworkConditions`).
 * Throughputs are bytes/second; `-1` disables a cap.
 */
export interface CdpNetworkConditions {
  readonly offline: boolean;
  readonly latencyMs: number;
  readonly downloadThroughputBps: number;
  readonly uploadThroughputBps: number;
}

/** A geolocation override (`Emulation.setGeolocationOverride`). */
export interface CdpGeolocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
}

/**
 * Tab environment overrides (Phase F): UA + the `Emulation.*` cluster.
 * Every field is optional; an absent field leaves that facet at the
 * browser default, a present one pins it. `geolocation: null` denies
 * geolocation outright (distinct from absent = no override).
 */
export interface CdpEnvironmentOverrides {
  readonly userAgent?: string;
  readonly acceptLanguage?: string;
  readonly platform?: string;
  readonly locale?: string;
  readonly timezoneId?: string;
  readonly geolocation?: CdpGeolocation | null;
  readonly emulatedMedia?: string;
}

/**
 * A document-bootstrap script (Phase E,
 * `Page.addScriptToEvaluateOnNewDocument`). `key` is a stable identity for
 * diffing across re-applies; it is NOT the CDP-returned script identifier
 * (the add → identifier → remove lifecycle is an adapter-side concern).
 */
export interface CdpBootstrapScript {
  readonly key: string;
  readonly source: string;
}

/** A `Fetch.enable` URL pattern (Phase D). */
export interface CdpFetchPattern {
  readonly urlPattern: string;
  readonly requestStage?: 'Request' | 'Response';
  readonly resourceType?: string;
}

/**
 * The full standing CDP control state for one tab session — a single value
 * that fully describes the tab's CDP environment. `apply`'ing it reconciles
 * the session to it; re-`apply`'ing it after a (re-)attach replays it.
 *
 * Fields are added as their phase lands (D: `fetchPatterns`; E:
 * `bootstrapScripts`; F: `overrides`). The vocabulary is complete now so
 * the surface is stable across the epic; {@link reconcileTabControl}'s
 * coverage grows per phase.
 */
export interface CdpTabControlState {
  readonly cacheDisabled: boolean;
  readonly networkConditions: CdpNetworkConditions | null;
  readonly overrides: CdpEnvironmentOverrides | null;
  readonly bootstrapScripts: readonly CdpBootstrapScript[];
  readonly fetchPatterns: readonly CdpFetchPattern[];
  /**
   * `Fetch.enable { handleAuthRequests }` (Phase D3). When true, an
   * intercepted request that hits a 401/407 fires a second-stage
   * `Fetch.authRequired` the host answers with `continueWithAuth`. Derived
   * per-tab from "an in-scope rule is auth-capable" — kept narrow so a tab
   * with no auth rule never widens its pause surface to challenges.
   * Meaningful only alongside a non-empty {@link fetchPatterns} set.
   */
  readonly fetchHandleAuthRequests: boolean;
  readonly bypassCsp: boolean;
}

/**
 * The empty standing state — no control applied. The detach/`forget`
 * baseline, and the default a tab reconciles from on its first `apply`.
 */
export const EMPTY_TAB_CONTROL_STATE: CdpTabControlState = {
  cacheDisabled: false,
  networkConditions: null,
  overrides: null,
  bootstrapScripts: [],
  fetchPatterns: [],
  fetchHandleAuthRequests: false,
  bypassCsp: false,
};

/**
 * The declarative standing-state port. The Phase-C foundation's load-bearing
 * seam: the attach controller `apply`s the derived state after every clean
 * attach and `forget`s it on detach, so replay-on-reattach falls out of the
 * type rather than from bespoke imperative bookkeeping.
 */
export interface CdpTabControlPort {
  /** False when `chrome.debugger` is absent (Firefox / Safari). */
  readonly available: boolean;
  /**
   * Drive the session to `state`. Idempotent: re-applying an unchanged
   * state issues no commands; applying after a `forget` (or a re-attach)
   * replays the whole state from {@link EMPTY_TAB_CONTROL_STATE}.
   */
  apply(target: CdpSessionTarget, state: CdpTabControlState): Promise<void>;
  /**
   * Drop the remembered applied state for a session (on detach), so the
   * next `apply` reconciles from {@link EMPTY_TAB_CONTROL_STATE} — the
   * "nothing imperative survives a detach" guarantee.
   */
  forget(target: CdpSessionTarget): void;
}

// ── reconcile (pure: desired-state diff → primitive commands) ────────────

/**
 * A primitive CDP control command the {@link CdpTabControlPort} adapter
 * executes. {@link reconcileTabControl} produces these from a state diff;
 * the chrome adapter maps each onto `chrome.debugger.sendCommand`. This is
 * internal transport vocabulary, not a public escape hatch — the union is
 * closed and typed, and grows only as phases land.
 */
export type CdpControlCommand =
  | { readonly kind: 'set-cache-disabled'; readonly cacheDisabled: boolean }
  | { readonly kind: 'emulate-network-conditions'; readonly conditions: CdpNetworkConditions }
  | { readonly kind: 'clear-network-conditions' }
  | { readonly kind: 'set-bypass-csp'; readonly enabled: boolean }
  | {
      readonly kind: 'enable-fetch';
      readonly patterns: readonly CdpFetchPattern[];
      readonly handleAuthRequests: boolean;
    }
  | { readonly kind: 'disable-fetch' };

/**
 * Pure diff: the CDP commands that carry a session from `prev` to `next`.
 * Host-neutral — the chrome adapter executes the result. Only a field whose
 * value changed emits a command, so a re-apply of unchanged state is empty
 * and a replay from {@link EMPTY_TAB_CONTROL_STATE} re-issues the whole set.
 *
 * Coverage grows per phase: D adds Fetch-enable patterns, E adds
 * bootstrap-script add/remove (which needs CDP-returned script-id tracking,
 * handled in the adapter), F adds the override fan-out. Today, the three
 * single-value idempotent standing commands.
 */
export function reconcileTabControl(prev: CdpTabControlState, next: CdpTabControlState): CdpControlCommand[] {
  const commands: CdpControlCommand[] = [];

  if (prev.cacheDisabled !== next.cacheDisabled) {
    commands.push({ kind: 'set-cache-disabled', cacheDisabled: next.cacheDisabled });
  }

  if (!networkConditionsEqual(prev.networkConditions, next.networkConditions)) {
    commands.push(
      next.networkConditions === null
        ? { kind: 'clear-network-conditions' }
        : { kind: 'emulate-network-conditions', conditions: next.networkConditions },
    );
  }

  if (prev.bypassCsp !== next.bypassCsp) {
    commands.push({ kind: 'set-bypass-csp', enabled: next.bypassCsp });
  }

  // `Fetch.enable` takes the pattern set AND `handleAuthRequests` together,
  // so a change to EITHER re-issues the command wholesale. A non-empty set
  // re-enables with the current patterns + auth flag; an emptied set
  // `disable`s interception entirely (the out-of-scope / no-debug-rule
  // state). An auth-flag flip on an already-empty set is a no-op — there is
  // nothing intercepted for a challenge to fire on.
  const fetchChanged =
    !fetchPatternsEqual(prev.fetchPatterns, next.fetchPatterns) ||
    prev.fetchHandleAuthRequests !== next.fetchHandleAuthRequests;
  if (fetchChanged) {
    if (next.fetchPatterns.length === 0) {
      if (prev.fetchPatterns.length > 0) commands.push({ kind: 'disable-fetch' });
    } else {
      commands.push({
        kind: 'enable-fetch',
        patterns: next.fetchPatterns,
        handleAuthRequests: next.fetchHandleAuthRequests,
      });
    }
  }

  return commands;
}

function fetchPatternsEqual(a: readonly CdpFetchPattern[], b: readonly CdpFetchPattern[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((pattern, i) => {
    const other = b[i];
    return (
      pattern.urlPattern === other.urlPattern &&
      pattern.requestStage === other.requestStage &&
      pattern.resourceType === other.resourceType
    );
  });
}

function networkConditionsEqual(a: CdpNetworkConditions | null, b: CdpNetworkConditions | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.offline === b.offline &&
    a.latencyMs === b.latencyMs &&
    a.downloadThroughputBps === b.downloadThroughputBps &&
    a.uploadThroughputBps === b.uploadThroughputBps
  );
}

// ── per-request reactions (imperative, never replayed) ───────────────────

/** A CDP header entry — `{name, value}`, used by fulfill / continue. */
export interface CdpHeaderEntry {
  readonly name: string;
  readonly value: string;
}

/**
 * Body text + its encoding flag — the shape both body reads return. The
 * observation-plane read (`Network.getResponseBody`, served only for a
 * finished request) and the control-plane read (`Fetch.getResponseBody`, on a
 * request paused at the Fetch Response stage — {@link
 * CdpRequestControlPort.getResponseBody}) share it; the two differ in domain
 * and id space, not in result shape.
 */
export interface CdpResponseBody {
  readonly body: string;
  readonly base64Encoded: boolean;
}

/** `Fetch.fulfillRequest` params. `body` is base64-encoded (CDP's `body`). */
export interface CdpFulfillResponse {
  readonly requestId: string;
  readonly responseCode: number;
  readonly responseHeaders?: readonly CdpHeaderEntry[];
  readonly body?: string;
  readonly responsePhrase?: string;
}

/** `Fetch.continueRequest` params. `postData` is base64-encoded. */
export interface CdpContinueRequest {
  readonly requestId: string;
  readonly url?: string;
  readonly method?: string;
  readonly postData?: string;
  readonly headers?: readonly CdpHeaderEntry[];
  readonly interceptResponse?: boolean;
}

/**
 * `Fetch.continueResponse` params. The release answer for a Response-stage
 * pause whose rule no longer matches (changed mid-flight, or a response-stage
 * condition that failed) — the real reply flows to the page untouched. Body
 * substitution always goes through {@link CdpFulfillResponse} instead, so this
 * carries only the interception handle.
 */
export interface CdpContinueResponse {
  readonly requestId: string;
}

/**
 * `Fetch.getResponseBody` params — the real reply's body for a request paused
 * at the Fetch Response stage. `requestId` is the live FETCH INTERCEPTION id
 * (the same key fulfill / continueResponse use), NOT the network id the
 * observation-plane `Network.getResponseBody` takes; this is a control-plane
 * read on a paused request, a different domain and id space.
 */
export interface CdpGetResponseBody {
  readonly requestId: string;
}

/** `Fetch.continueWithAuth`'s `authChallengeResponse` variants. */
export type CdpAuthChallengeResponse =
  | { readonly response: 'Default' }
  | { readonly response: 'CancelAuth' }
  | { readonly response: 'ProvideCredentials'; readonly username: string; readonly password: string };

/** `Fetch.continueWithAuth` params. */
export interface CdpContinueWithAuth {
  readonly requestId: string;
  readonly authChallengeResponse: CdpAuthChallengeResponse;
}

/**
 * The imperative per-paused-request port. Wired in Phase D as the output
 * edge of the `Fetch.requestPaused` loop. Its reactions are tied to a live
 * `requestId` and are never replayed.
 */
export interface CdpRequestControlPort {
  /** False when `chrome.debugger` is absent (Firefox / Safari). */
  readonly available: boolean;
  fulfill(target: CdpSessionTarget, response: CdpFulfillResponse): Promise<void>;
  continueRequest(target: CdpSessionTarget, request: CdpContinueRequest): Promise<void>;
  /** Release a Response-stage pause unmodified (the no-longer-matches path). */
  continueResponse(target: CdpSessionTarget, request: CdpContinueResponse): Promise<void>;
  continueWithAuth(target: CdpSessionTarget, request: CdpContinueWithAuth): Promise<void>;
  /**
   * Read the real reply's body for a request paused at the Response stage
   * (`Fetch.getResponseBody`) — the input a `network`+dynamic transform runs
   * over (D2b-2b). Returns the raw `{body, base64Encoded}`; the caller decodes.
   * Rejects when the body is unreadable (request gone / evicted) — the caller
   * then releases the reply untouched.
   */
  getResponseBody(target: CdpSessionTarget, request: CdpGetResponseBody): Promise<CdpResponseBody>;
}
