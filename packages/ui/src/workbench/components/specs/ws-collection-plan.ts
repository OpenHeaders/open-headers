/**
 * AsyncAPI spec → collection generation plan — the pure derivation
 * behind the asyncapi spec editor's Generate Collection action, the
 * `proto-collection-plan` sibling. Per-family dispatch (the MQTT-client
 * plan Phase E): each session family gates on its OWN servers, so an
 * mqtt-only document generates MqttRequests instead of the old honest
 * no-go, a ws-only document generates WebSocketRequests, and a document
 * naming both generates both from the one census.
 *
 * Operations are the seed unit for both families. WebSocket: one raw
 * WebSocketRequest per operation, named by its operation id, targeting
 * the first ws/wss server joined with the operation's channel address,
 * its compose message pre-filled from the channel's first synthesizable
 * message payload (the ratified subset), specLink bound ids-only.
 * MQTT: one MqttRequest per operation targeting the first mqtt(s)
 * server — the channel ADDRESS is the TOPIC, not a URL path, so the
 * URL is scheme+host and the address seeds the publish topic; a
 * `receive` operation also seeds a subscription row for the address
 * (subscribing IS how an MQTT client receives), and a `send` operation
 * pre-fills the compose payload from the synthesis. Operations whose
 * channel did not resolve are skipped with a reason, never thrown —
 * what resolved still generates.
 */

import {
  type AsyncApiChannel,
  type AsyncApiIssue,
  AsyncApiParseError,
  type AsyncApiServer,
  parseAsyncApi,
  synthesizeExamplePayload,
} from '@openheaders/core/asyncapi';
import type { MqttRequest, Spec, WebSocketRequest } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';

export interface WsRequestPlan {
  /** Request name — the operation's own id (`sendLightMeasurement`). */
  name: string;
  seed: Partial<WebSocketRequest>;
}

export interface MqttRequestPlan {
  /** Request name — the operation's own id (`receiveLightMeasurement`). */
  name: string;
  seed: Partial<MqttRequest>;
}

export interface WsCollectionPlan {
  requests: WsRequestPlan[];
  /** The ws/wss server every generated WS URL binds to; null = the
   *  family does not generate from this document. */
  server: AsyncApiServer | null;
  mqttRequests: MqttRequestPlan[];
  /** The mqtt(s) server every generated MQTT URL binds to; null = the
   *  family does not generate from this document. */
  mqttServer: AsyncApiServer | null;
  parseError: string | null;
  issues: AsyncApiIssue[];
  /** Operations left out of the plan, with the reason. */
  skipped: { operation: string; reason: string }[];
}

/** True when the census names a server the WebSocket client can dial. */
export function isWsProtocol(protocol: string | null): boolean {
  return protocol === 'ws' || protocol === 'wss';
}

/** True when the census names a server the MQTT client can dial —
 *  `secure-mqtt` is the AsyncAPI registry's older TLS spelling. */
export function isMqttProtocol(protocol: string | null): boolean {
  return protocol === 'mqtt' || protocol === 'mqtts' || protocol === 'secure-mqtt';
}

function wsUrlFor(server: AsyncApiServer, channel: AsyncApiChannel): string {
  const scheme = server.protocol === 'wss' ? 'wss' : 'ws';
  const host = server.host ?? '';
  const address = channel.address ?? '';
  if (address === '') return `${scheme}://${host}`;
  return `${scheme}://${host}${address.startsWith('/') ? address : `/${address}`}`;
}

/** MQTT dial target — scheme+host only: the channel address is the
 *  TOPIC an MQTT session publishes/subscribes on, never a URL path. */
function mqttUrlFor(server: AsyncApiServer): string {
  const scheme = server.protocol === 'mqtt' ? 'mqtt' : 'mqtts';
  return `${scheme}://${server.host ?? ''}`;
}

/** First synthesizable message payload of a channel, pretty-printed. */
function exampleTextFor(channel: AsyncApiChannel, census: ReturnType<typeof parseAsyncApi>): string | null {
  for (const candidate of channel.messages) {
    const synth = synthesizeExamplePayload(candidate.payload, census.componentSchemas);
    if (synth !== null) return JSON.stringify(synth.value, null, 2);
  }
  return null;
}

/** Derive the generation plan from an AsyncAPI spec's saved root file. */
export function buildWsCollectionPlan(spec: Spec): WsCollectionPlan {
  const empty: WsCollectionPlan = {
    requests: [],
    server: null,
    mqttRequests: [],
    mqttServer: null,
    parseError: null,
    issues: [],
    skipped: [],
  };
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  if (root === undefined) return empty;
  let census: ReturnType<typeof parseAsyncApi>;
  try {
    census = parseAsyncApi(root.content);
  } catch (err) {
    return { ...empty, parseError: err instanceof AsyncApiParseError ? err.message : String(err) };
  }
  const server = census.servers.find((s) => isWsProtocol(s.protocol)) ?? null;
  const mqttServer = census.servers.find((s) => isMqttProtocol(s.protocol)) ?? null;
  const channelsByName = new Map(census.channels.map((channel) => [channel.name, channel]));
  const requests: WsRequestPlan[] = [];
  const mqttRequests: MqttRequestPlan[] = [];
  const skipped: { operation: string; reason: string }[] = [];
  for (const operation of census.operations) {
    const channel = operation.channelName !== null ? channelsByName.get(operation.channelName) : undefined;
    if (channel === undefined) {
      if (server !== null || mqttServer !== null) {
        skipped.push({ operation: operation.name, reason: 'unknown-channel' });
      }
      continue;
    }
    const message = exampleTextFor(channel, census);
    if (server !== null) {
      // Message pre-fill so the generated request sends something
      // meaningful immediately.
      requests.push({
        name: operation.name,
        seed: {
          url: wsUrlFor(server, channel),
          specLink: { specUid: spec.uid },
          ...(message !== null ? { message, messageFormat: 'json' as const } : {}),
        },
      });
    }
    if (mqttServer !== null) {
      const topic = channel.address ?? channel.name;
      mqttRequests.push({
        name: operation.name,
        seed: {
          url: mqttUrlFor(mqttServer),
          specLink: { specUid: spec.uid },
          topic,
          // A receive operation subscribes — that IS how an MQTT
          // client listens on the channel.
          ...(operation.action === 'receive' ? { topics: [{ uid: generateUid(), topicFilter: topic }] } : {}),
          // A send operation publishes — the synthesis pre-fills what
          // it sends.
          ...(operation.action === 'send' && message !== null
            ? { payload: message, payloadFormat: 'json' as const }
            : {}),
        },
      });
    }
  }
  return { requests, server, mqttRequests, mqttServer, parseError: null, issues: census.issues, skipped };
}
