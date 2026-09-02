/**
 * OAuth 2.0 Device Authorization Grant runner (RFC 8628) — host-neutral
 * over the injected {@link RequestTransport}, so the node hosts and the
 * browser SW run this one module. Two legs:
 *
 *   1. `startDeviceFlow` POSTs the device authorization request (§3.1)
 *      through the per-origin refresh bucket — one token-plane POST
 *      per flow — and parks the pending record in the host's registry.
 *   2. The poll (§3.4) runs on the host's own timer at the cadence the
 *      provider dictates (`interval`, grown by `slow_down`), each poll
 *      its own POST with a fresh client assertion, OUTSIDE the bucket:
 *      the provider's interval IS the back-pressure, and a five-per-
 *      minute bucket would fight it. The rules live in core's
 *      `stepDevicePoll`; this module owns the wire and the clock.
 *
 * The registry keys one flow per (workspace, credential): a second
 * start supersedes the first (its timer stops, no event fires for the
 * loser), a cancel stops the poll and clears the slot, and a terminal
 * state (granted / denied / expired / failed) stays readable until the
 * next start or a cancel — a late reader (the CLI's poll, a reopened
 * editor) sees how the flow ended. Every transition fans out through
 * {@link onDeviceFlowChange}; hosts wire it to their `oauthDeviceState`
 * broadcast. A grant persists through the token store like every other
 * flow, so the editor's bundle subscription lights up on its own.
 *
 * A transport failure mid-poll fails the flow with the host's message
 * — the provider's own refusals arrive as JSON and go through the
 * reducer; a network that vanished is not a state the poll can wait
 * out honestly.
 */

import {
  approvalOf,
  buildClientAuthHeader,
  buildDeviceAuthorizationBody,
  buildDeviceCodeTokenBody,
  DPOP_HEADER,
  mintDpopProof,
  nonBodyExtraParams,
  type OAuth2DeviceAuthorization,
  type OAuth2DeviceState,
  type OAuth2DpopKey,
  parseDeviceAuthorizationResponse,
  stepDevicePoll,
} from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { appendQueryParams, logger } from '@openheaders/core/utils';
import { putTokenBundle } from '../../entity/oauth-token-store';
import { bindDpopKey, OAuth2FlowError, sendWithDpopNonceRetry } from './oauth-exchange';
import { dpopKeyForExchange, mintClientAssertionOrFail } from './oauth-flows';
import { withRefreshRateLimit } from './rate-limiter';
import type { RequestTransport, TransportHeader, TransportResponse } from './transport';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface DeviceFlowChange {
  workspaceId: string | undefined;
  credentialRef: string;
  /** `null` = the slot was cleared (a cancel). */
  state: OAuth2DeviceState | null;
}

interface DeviceFlowSlot {
  workspaceId: string | undefined;
  credentialRef: string;
  config: OAuth2Auth;
  transport: RequestTransport;
  authorization: OAuth2DeviceAuthorization;
  /** The DPoP key the polled token binds to (RFC 9449 §5) — minted at
   *  the start, proved on every poll, attached to the granted bundle. */
  dpopKey: OAuth2DpopKey | undefined;
  state: OAuth2DeviceState;
  timer: ReturnType<typeof setTimeout> | null;
}

const slots = new Map<string, DeviceFlowSlot>();
const listeners = new Set<(change: DeviceFlowChange) => void>();

const slotKey = (credentialRef: string, workspaceId: string | undefined): string =>
  `${workspaceId ?? ''}|${credentialRef}`;

export function onDeviceFlowChange(listener: (change: DeviceFlowChange) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(slot: Pick<DeviceFlowSlot, 'workspaceId' | 'credentialRef'>, state: OAuth2DeviceState | null): void {
  for (const listener of listeners)
    listener({ workspaceId: slot.workspaceId, credentialRef: slot.credentialRef, state });
}

/** The flow's current state for a credential, `null` when none was started. */
export function getDeviceFlowState(credentialRef: string, workspaceId: string | undefined): OAuth2DeviceState | null {
  return slots.get(slotKey(credentialRef, workspaceId))?.state ?? null;
}

/** Stop the poll and clear the slot. `false` when nothing was pending or settled. */
export function cancelDeviceFlow(credentialRef: string, workspaceId: string | undefined): boolean {
  const key = slotKey(credentialRef, workspaceId);
  const slot = slots.get(key);
  if (slot === undefined) return false;
  stopTimer(slot);
  slots.delete(key);
  emit(slot, null);
  return true;
}

/**
 * Run the device authorization request and park the pending flow; the
 * poll starts on the host timer after the first interval. Resolves with
 * the pending state (the approval facts the caller shows the user).
 */
export async function startDeviceFlow(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
): Promise<OAuth2DeviceState> {
  if (config.flow !== 'device-code') {
    throw new OAuth2FlowError('precondition', `device code flow requires flow=device-code, got ${config.flow}`);
  }
  const endpoint = config.deviceAuthorizationEndpoint?.trim();
  if (!endpoint) {
    throw new OAuth2FlowError('precondition', 'device code flow requires a deviceAuthorizationEndpoint');
  }
  // The device authorization request is not a token request (§3.1 of
  // RFC 8628 vs §5 of RFC 9449) — the key mints here so a refusal
  // stops the flow before the wire, and the polls prove with it.
  const dpopKey = await dpopKeyForExchange(config, 'device_authorization');
  const body = buildDeviceAuthorizationBody(config, await mintClientAssertionOrFail(config, 'device_authorization'));
  const headers: TransportHeader[] = [{ key: 'Accept', value: 'application/json' }];
  const clientAuthHeader = buildClientAuthHeader(config);
  if (clientAuthHeader) headers.push({ key: 'Authorization', value: clientAuthHeader });
  const response = await withRefreshRateLimit(endpoint, () =>
    transport.send({
      method: 'POST',
      url: endpoint,
      headers,
      body: { kind: 'urlencoded', fields: [...body.entries()].map(([name, value]) => ({ name, value })) },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: MAX_BODY_BYTES,
    }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new OAuth2FlowError(
      'device_authorization',
      `Device authorization endpoint returned ${response.status} ${response.statusText}: ${truncate(response.body, 200)}`,
    );
  }
  const json = safeJsonParse(response.body);
  if (!json) {
    throw new OAuth2FlowError(
      'device_authorization',
      `Device authorization endpoint returned non-JSON body: ${truncate(response.body, 200)}`,
    );
  }
  let authorization: OAuth2DeviceAuthorization;
  try {
    authorization = parseDeviceAuthorizationResponse(json);
  } catch (err) {
    throw new OAuth2FlowError('device_authorization', (err as Error).message);
  }

  const key = slotKey(config.credentialRef, workspaceId);
  // A restart supersedes silently — the new pending state is the one
  // event the surfaces need.
  const previous = slots.get(key);
  if (previous !== undefined) stopTimer(previous);
  const slot: DeviceFlowSlot = {
    workspaceId,
    credentialRef: config.credentialRef,
    config,
    transport,
    authorization,
    dpopKey,
    state: { state: 'pending', approval: approvalOf(authorization), startedAt: Date.now() },
    timer: null,
  };
  slots.set(key, slot);
  emit(slot, slot.state);
  schedulePoll(key, slot, authorization.intervalSeconds * 1000);
  logger.info(
    'OAuthDevice',
    `Device authorization started for ${config.credentialRef} (code ${authorization.userCode})`,
  );
  return slot.state;
}

function schedulePoll(key: string, slot: DeviceFlowSlot, delayMs: number): void {
  const timer = setTimeout(() => {
    slot.timer = null;
    void poll(key, slot);
  }, delayMs);
  timer.unref?.();
  slot.timer = timer;
}

function stopTimer(slot: DeviceFlowSlot): void {
  if (slot.timer !== null) clearTimeout(slot.timer);
  slot.timer = null;
}

/** Still the live slot? A cancel or a restart retires the old one. */
const isLive = (key: string, slot: DeviceFlowSlot): boolean => slots.get(key) === slot;

async function poll(key: string, slot: DeviceFlowSlot): Promise<void> {
  const { config, transport, authorization, dpopKey } = slot;
  let clientAssertion: string | undefined;
  try {
    clientAssertion = await mintClientAssertionOrFail(config, 'device_code');
  } catch (err) {
    settle(key, slot, { state: 'failed', message: (err as Error).message });
    return;
  }
  const body = buildDeviceCodeTokenBody({ config, deviceCode: authorization.deviceCode, clientAssertion });
  const extras = nonBodyExtraParams(config.extraTokenParams);
  const headers: TransportHeader[] = [{ key: 'Accept', value: 'application/json' }];
  for (const h of extras.headers) headers.push({ key: h.key, value: h.value });
  const clientAuthHeader = buildClientAuthHeader(config);
  if (clientAuthHeader) headers.push({ key: 'Authorization', value: clientAuthHeader });
  const url = extras.query.length > 0 ? appendQueryParams(config.tokenEndpoint, extras.query) : config.tokenEndpoint;
  const send = async (nonce: string | undefined): Promise<TransportResponse> =>
    transport.send({
      method: 'POST',
      url,
      headers:
        dpopKey !== undefined
          ? [...headers, { key: DPOP_HEADER, value: await mintDpopProof(dpopKey, { method: 'POST', url, nonce }) }]
          : headers,
      body: { kind: 'urlencoded', fields: [...body.entries()].map(([name, value]) => ({ name, value })) },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: MAX_BODY_BYTES,
    });
  let status: number;
  let text: string;
  try {
    // A nonce challenge is the provider asking, not a poll outcome —
    // the one immediate resend stays outside the reducer's cadence.
    const response = dpopKey === undefined ? await send(undefined) : await sendWithDpopNonceRetry(url, send);
    status = response.status;
    text = response.body;
  } catch (err) {
    if (isLive(key, slot)) settle(key, slot, { state: 'failed', message: (err as Error).message });
    return;
  }
  if (!isLive(key, slot)) return;
  const step = stepDevicePoll(authorization, { status, json: safeJsonParse(text) });
  switch (step.kind) {
    case 'wait': {
      const grew = step.intervalSeconds !== authorization.intervalSeconds;
      authorization.intervalSeconds = step.intervalSeconds;
      if (grew) {
        slot.state = { state: 'pending', approval: approvalOf(authorization), startedAt: startedAtOf(slot) };
        emit(slot, slot.state);
      }
      schedulePoll(key, slot, step.delayMs);
      return;
    }
    case 'granted':
      if (dpopKey !== undefined) bindDpopKey(step.bundle, dpopKey, 'device_code');
      try {
        await putTokenBundle(config.credentialRef, step.bundle, config, slot.workspaceId);
      } catch (err) {
        settle(key, slot, { state: 'failed', message: `Could not store the token: ${(err as Error).message}` });
        return;
      }
      settle(key, slot, { state: 'granted', grantedAt: Date.now() });
      return;
    case 'denied':
    case 'expired':
    case 'failed':
      settle(key, slot, { state: step.kind, message: step.message });
      return;
  }
}

function startedAtOf(slot: DeviceFlowSlot): number {
  return slot.state.state === 'pending' ? slot.state.startedAt : Date.now();
}

function settle(key: string, slot: DeviceFlowSlot, state: OAuth2DeviceState): void {
  if (!isLive(key, slot)) return;
  stopTimer(slot);
  slot.state = state;
  emit(slot, state);
  logger.info('OAuthDevice', `Device authorization for ${slot.credentialRef} ended: ${state.state}`);
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Stop every poll and forget every slot — test isolation. */
export function __resetDeviceFlowsForTests(): void {
  for (const slot of slots.values()) stopTimer(slot);
  slots.clear();
  listeners.clear();
}
