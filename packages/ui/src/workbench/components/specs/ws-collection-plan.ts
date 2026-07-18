/**
 * AsyncAPI spec → collection generation plan (WEBSOCKET_CLIENT_PLAN.md
 * Phase F, ratified GO) — the pure derivation behind the asyncapi spec
 * editor's Generate Collection action, the `proto-collection-plan`
 * sibling.
 *
 * Operations are the seed unit: one WebSocketRequest (raw flavor) per
 * censused operation, named by its operation id, targeting the first
 * ws/wss server joined with the operation's channel address, its
 * compose message pre-filled from the channel's first synthesizable
 * message payload (the ratified subset), specLink bound ids-only. The
 * whole plan is gated on the census naming at least one ws/wss server —
 * an mqtt/kafka-only document is the honest no-go (`server: null`).
 * Operations whose channel did not resolve are skipped with a reason,
 * never thrown — what resolved still generates.
 */

import {
  type AsyncApiChannel,
  type AsyncApiIssue,
  AsyncApiParseError,
  type AsyncApiServer,
  parseAsyncApi,
  synthesizeExamplePayload,
} from '@openheaders/core/asyncapi';
import type { Spec, WebSocketRequest } from '@openheaders/core/types';

export interface WsRequestPlan {
  /** Request name — the operation's own id (`sendLightMeasurement`). */
  name: string;
  seed: Partial<WebSocketRequest>;
}

export interface WsCollectionPlan {
  requests: WsRequestPlan[];
  /** The ws/wss server every generated URL binds to; null = no-go. */
  server: AsyncApiServer | null;
  parseError: string | null;
  issues: AsyncApiIssue[];
  /** Operations left out of the plan, with the reason. */
  skipped: { operation: string; reason: string }[];
}

/** True when the census names a server this client can dial. */
export function isWsProtocol(protocol: string | null): boolean {
  return protocol === 'ws' || protocol === 'wss';
}

function urlFor(server: AsyncApiServer, channel: AsyncApiChannel): string {
  const scheme = server.protocol === 'wss' ? 'wss' : 'ws';
  const host = server.host ?? '';
  const address = channel.address ?? '';
  if (address === '') return `${scheme}://${host}`;
  return `${scheme}://${host}${address.startsWith('/') ? address : `/${address}`}`;
}

/** Derive the generation plan from an AsyncAPI spec's saved root file. */
export function buildWsCollectionPlan(spec: Spec): WsCollectionPlan {
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  if (root === undefined) {
    return { requests: [], server: null, parseError: null, issues: [], skipped: [] };
  }
  let census: ReturnType<typeof parseAsyncApi>;
  try {
    census = parseAsyncApi(root.content);
  } catch (err) {
    return {
      requests: [],
      server: null,
      parseError: err instanceof AsyncApiParseError ? err.message : String(err),
      issues: [],
      skipped: [],
    };
  }
  const server = census.servers.find((s) => isWsProtocol(s.protocol)) ?? null;
  if (server === null) {
    return { requests: [], server: null, parseError: null, issues: census.issues, skipped: [] };
  }
  const channelsByName = new Map(census.channels.map((channel) => [channel.name, channel]));
  const requests: WsRequestPlan[] = [];
  const skipped: { operation: string; reason: string }[] = [];
  for (const operation of census.operations) {
    const channel = operation.channelName !== null ? channelsByName.get(operation.channelName) : undefined;
    if (channel === undefined) {
      skipped.push({ operation: operation.name, reason: 'unknown-channel' });
      continue;
    }
    // First synthesizable message pre-fills the compose draft so the
    // generated request sends something meaningful immediately.
    let message: string | null = null;
    for (const candidate of channel.messages) {
      const synth = synthesizeExamplePayload(candidate.payload, census.componentSchemas);
      if (synth !== null) {
        message = JSON.stringify(synth.value, null, 2);
        break;
      }
    }
    requests.push({
      name: operation.name,
      seed: {
        url: urlFor(server, channel),
        specLink: { specUid: spec.uid },
        ...(message !== null ? { message, messageFormat: 'json' as const } : {}),
      },
    });
  }
  return { requests, server, parseError: null, issues: census.issues, skipped };
}
