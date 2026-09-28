/**
 * Inheritable settings — the `settings` record a collection or folder
 * carries for the requests under it: one slice PER REQUEST KIND (HTTP
 * · WebSocket · MQTT · gRPC), each under the kind's own field names.
 *
 * A request's Settings tab knobs are per-request synced data; a
 * container's slice of the request's kind holds the same knobs one
 * level up, and a request that leaves a knob absent reads the nearest
 * ancestor's value (`@openheaders/core/settings-inheritance` — THE
 * rule). Every key is an optional scalar validated by the request
 * schemas' own field schemas, so a container never stores a value a
 * request could not; the sync flattener turns the record into one
 * leaf per knob per kind, so two devices editing two knobs never
 * clobber each other.
 *
 * The vocabulary object below is the UNION of the four kinds' knobs —
 * one name, one value type, one row label wherever a knob is shown;
 * the per-kind key lists carve the slices out of it, typed against
 * each request schema so a renamed request field fails here first. A
 * shared NAME is still a separate VALUE per kind: the HTTP slice's
 * `timeoutMs` bounds HTTP round-trips alone, the WebSocket slice's the
 * session dial (the per-kind law).
 *
 * Request-only knobs never inherit and are absent from the object:
 * the WebSocket `namespace` and `subprotocols`, the MQTT
 * `protocolVersion`, `clientId` and `lastWill`, the gRPC `tls` and
 * `authority` — each names the target or the session identity, not a
 * policy a whole collection shares.
 */

import * as v from 'valibot';
import type { AuthProtocolKind } from '../auth-inheritance';
import type { GrpcRequestSchema } from './grpc-request';
import {
  MqttAlpnProtocolSchema,
  MqttKeepAliveSchema,
  MqttMaximumPacketSizeSchema,
  MqttReceiveMaximumSchema,
  type MqttRequestSchema,
  MqttSessionExpiryIntervalSchema,
  MqttTopicAliasMaximumSchema,
} from './mqtt-request';
import {
  ClientCertificateRefSchema,
  CredentialsModeSchema,
  HeartbeatMessageSchema,
  HttpVersionSchema,
  MaxRedirectsSchema,
  MaxResponseBytesSchema,
  ProxyCredentialRefSchema,
  ProxyModeSchema,
  ProxyUrlSchema,
  proxyPairChecks,
  ReconnectMaxAttemptsSchema,
  type RequestSchema,
  RequestTimeoutMsSchema,
  ResolveToAddressSchema,
  SniServerNameSchema,
  TlsCipherSuitesSchema,
  TlsVersionSchema,
  UnixSocketPathSchema,
} from './request';
import { SocketIoProtocolSchema, type WebSocketRequestSchema } from './websocket-request';

/**
 * The object without the cross-field ties — what a projection reads
 * fail-soft (per-leaf writes compose transiently) and what the key
 * lists type against.
 */
export const InheritableSettingsObjectSchema = v.object({
  // ── Connection ──
  httpVersion: v.optional(HttpVersionSchema),
  resolveToAddress: v.optional(ResolveToAddressSchema),
  proxyMode: v.optional(ProxyModeSchema),
  proxyUrl: v.optional(ProxyUrlSchema),
  proxyCredentialRef: v.optional(ProxyCredentialRefSchema),
  unixSocketPath: v.optional(UnixSocketPathSchema),
  // ── TLS & trust ──
  sslVerification: v.optional(v.boolean()),
  clientCertificateRef: v.optional(ClientCertificateRefSchema),
  tlsMinVersion: v.optional(TlsVersionSchema),
  tlsMaxVersion: v.optional(TlsVersionSchema),
  tlsCipherSuites: v.optional(TlsCipherSuitesSchema),
  sniServerName: v.optional(SniServerNameSchema),
  alpnProtocol: v.optional(MqttAlpnProtocolSchema),
  // ── Redirects ──
  followRedirects: v.optional(v.boolean()),
  maxRedirects: v.optional(MaxRedirectsSchema),
  followOriginalHttpMethod: v.optional(v.boolean()),
  followAuthorizationHeader: v.optional(v.boolean()),
  // ── Cookies ──
  credentialsMode: v.optional(CredentialsModeSchema),
  cookieJar: v.optional(v.boolean()),
  // ── Execution & limits ──
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  maxResponseBytes: v.optional(MaxResponseBytesSchema),
  maxMessageBytes: v.optional(MaxResponseBytesSchema),
  // ── Session resilience ──
  autoReconnect: v.optional(v.boolean()),
  reconnectPeriodMs: v.optional(RequestTimeoutMsSchema),
  reconnectMaxAttempts: v.optional(ReconnectMaxAttemptsSchema),
  reconnectBackoff: v.optional(v.boolean()),
  idleTimeoutMs: v.optional(RequestTimeoutMsSchema),
  heartbeatMessage: v.optional(HeartbeatMessageSchema),
  heartbeatIntervalMs: v.optional(RequestTimeoutMsSchema),
  // ── Socket.IO ──
  handshakePath: v.optional(v.string()),
  socketioProtocol: v.optional(SocketIoProtocolSchema),
  ackTimeoutMs: v.optional(RequestTimeoutMsSchema),
  // ── MQTT session ──
  cleanStart: v.optional(v.boolean()),
  keepAlive: v.optional(MqttKeepAliveSchema),
  sessionExpiryInterval: v.optional(MqttSessionExpiryIntervalSchema),
  receiveMaximum: v.optional(MqttReceiveMaximumSchema),
  maximumPacketSize: v.optional(MqttMaximumPacketSizeSchema),
  topicAliasMaximum: v.optional(MqttTopicAliasMaximumSchema),
  requestResponseInformation: v.optional(v.boolean()),
  requestProblemInformation: v.optional(v.boolean()),
  // ── gRPC channel ──
  keepaliveIntervalMs: v.optional(RequestTimeoutMsSchema),
  keepaliveTimeoutMs: v.optional(RequestTimeoutMsSchema),
});

/** The persisted shape with the proxy mode / URL tie — see
 *  {@link proxyPairChecks}; the same three checks every request
 *  schema pipes. */
export const InheritableSettingsSchema = v.pipe(
  InheritableSettingsObjectSchema,
  ...proxyPairChecks<v.InferOutput<typeof InheritableSettingsObjectSchema>>(),
);

type InheritableSettingsShape = v.InferOutput<typeof InheritableSettingsObjectSchema>;

/** Every knob the object holds, in the object's own order. */
export const INHERITABLE_SETTING_KEYS = [
  'httpVersion',
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'sslVerification',
  'clientCertificateRef',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
  'alpnProtocol',
  'followRedirects',
  'maxRedirects',
  'followOriginalHttpMethod',
  'followAuthorizationHeader',
  'credentialsMode',
  'cookieJar',
  'timeoutMs',
  'maxResponseBytes',
  'maxMessageBytes',
  'autoReconnect',
  'reconnectPeriodMs',
  'reconnectMaxAttempts',
  'reconnectBackoff',
  'idleTimeoutMs',
  'heartbeatMessage',
  'heartbeatIntervalMs',
  'handshakePath',
  'socketioProtocol',
  'ackTimeoutMs',
  'cleanStart',
  'keepAlive',
  'sessionExpiryInterval',
  'receiveMaximum',
  'maximumPacketSize',
  'topicAliasMaximum',
  'requestResponseInformation',
  'requestProblemInformation',
  'keepaliveIntervalMs',
  'keepaliveTimeoutMs',
] as const satisfies readonly (keyof InheritableSettingsShape)[];

/** The proxy trio resolves as ONE unit — the level that sets the mode
 *  supplies the URL and the credential ref with it, never a mode from
 *  one level and a URL from another. */
export const PROXY_SETTING_KEYS = ['proxyMode', 'proxyUrl', 'proxyCredentialRef'] as const satisfies readonly (
  | 'proxyMode'
  | 'proxyUrl'
  | 'proxyCredentialRef'
)[];

type HttpRequestKey = keyof v.InferOutput<typeof RequestSchema>;
type WebSocketRequestKey = keyof v.InferOutput<typeof WebSocketRequestSchema>;
type MqttRequestKey = keyof v.InferOutput<typeof MqttRequestSchema>;
type GrpcRequestKey = keyof v.InferOutput<typeof GrpcRequestSchema>;

/** The knobs an HTTP request reads — its Settings tab's whole vocabulary. */
export const HTTP_INHERITABLE_SETTING_KEYS = [
  'httpVersion',
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'sslVerification',
  'clientCertificateRef',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
  'followRedirects',
  'maxRedirects',
  'followOriginalHttpMethod',
  'followAuthorizationHeader',
  'credentialsMode',
  'cookieJar',
  'timeoutMs',
  'maxResponseBytes',
] as const satisfies readonly (HttpRequestKey & keyof InheritableSettingsShape)[];

/** The knobs a WebSocket / Socket.IO session reads — everything on its
 *  Settings tab but the subprotocol offer and the namespace. */
export const WEBSOCKET_INHERITABLE_SETTING_KEYS = [
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'sslVerification',
  'clientCertificateRef',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
  'followRedirects',
  'maxRedirects',
  'timeoutMs',
  'maxMessageBytes',
  'autoReconnect',
  'reconnectPeriodMs',
  'reconnectMaxAttempts',
  'reconnectBackoff',
  'idleTimeoutMs',
  'heartbeatMessage',
  'heartbeatIntervalMs',
  'handshakePath',
  'socketioProtocol',
  'ackTimeoutMs',
] as const satisfies readonly (WebSocketRequestKey & keyof InheritableSettingsShape)[];

/** The knobs an MQTT session reads — everything on its Settings tab
 *  but the client id (the protocol version and the last will are their
 *  own surfaces and stay per-request too). */
export const MQTT_INHERITABLE_SETTING_KEYS = [
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'sslVerification',
  'clientCertificateRef',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
  'alpnProtocol',
  'timeoutMs',
  'autoReconnect',
  'reconnectPeriodMs',
  'reconnectMaxAttempts',
  'reconnectBackoff',
  'cleanStart',
  'keepAlive',
  'sessionExpiryInterval',
  'receiveMaximum',
  'maximumPacketSize',
  'topicAliasMaximum',
  'requestResponseInformation',
  'requestProblemInformation',
] as const satisfies readonly (MqttRequestKey & keyof InheritableSettingsShape)[];

/** The knobs a gRPC call reads — everything on its Settings tab but
 *  the `:authority` override (the channel's TLS lock is the editor
 *  header's, per request). */
export const GRPC_INHERITABLE_SETTING_KEYS = [
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'sslVerification',
  'clientCertificateRef',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
  'timeoutMs',
  'maxResponseBytes',
  'keepaliveIntervalMs',
  'keepaliveTimeoutMs',
] as const satisfies readonly (GrpcRequestKey & keyof InheritableSettingsShape)[];

/** Per kind, the knob names that kind's requests read. */
export interface InheritableSettingKeysByKind {
  http: (typeof HTTP_INHERITABLE_SETTING_KEYS)[number];
  websocket: (typeof WEBSOCKET_INHERITABLE_SETTING_KEYS)[number];
  mqtt: (typeof MQTT_INHERITABLE_SETTING_KEYS)[number];
  grpc: (typeof GRPC_INHERITABLE_SETTING_KEYS)[number];
}

/** The per-kind key lists under the shared kind vocabulary. */
export const INHERITABLE_SETTING_KEYS_BY_KIND: {
  readonly [K in AuthProtocolKind]: readonly InheritableSettingKeysByKind[K][];
} = {
  http: HTTP_INHERITABLE_SETTING_KEYS,
  websocket: WEBSOCKET_INHERITABLE_SETTING_KEYS,
  mqtt: MQTT_INHERITABLE_SETTING_KEYS,
  grpc: GRPC_INHERITABLE_SETTING_KEYS,
};

/** The kinds a container's record slices by, in the record's order. */
export const SETTINGS_KINDS = ['http', 'websocket', 'mqtt', 'grpc'] as const satisfies readonly AuthProtocolKind[];

/** One kind's slice of the vocabulary — the knobs its requests read,
 *  every key optional (absent = inherit or the runtime default). */
export type KindSettingsShape<K extends AuthProtocolKind> = {
  [P in InheritableSettingKeysByKind[K]]?: InheritableSettingsShape[P];
};

/** A kind's slice without the cross-field ties — what a projection
 *  reads fail-soft. */
export const HttpSettingsObjectSchema = v.pick(InheritableSettingsObjectSchema, [...HTTP_INHERITABLE_SETTING_KEYS]);
export const WebSocketSettingsObjectSchema = v.pick(InheritableSettingsObjectSchema, [
  ...WEBSOCKET_INHERITABLE_SETTING_KEYS,
]);
export const MqttSettingsObjectSchema = v.pick(InheritableSettingsObjectSchema, [...MQTT_INHERITABLE_SETTING_KEYS]);
export const GrpcSettingsObjectSchema = v.pick(InheritableSettingsObjectSchema, [...GRPC_INHERITABLE_SETTING_KEYS]);

/** A kind's persisted slice — the proxy mode / URL tie every request
 *  schema pipes ({@link proxyPairChecks}). */
export const HttpSettingsSchema = v.pipe(HttpSettingsObjectSchema, ...proxyPairChecks<KindSettingsShape<'http'>>());
export const WebSocketSettingsSchema = v.pipe(
  WebSocketSettingsObjectSchema,
  ...proxyPairChecks<KindSettingsShape<'websocket'>>(),
);
export const MqttSettingsSchema = v.pipe(MqttSettingsObjectSchema, ...proxyPairChecks<KindSettingsShape<'mqtt'>>());
export const GrpcSettingsSchema = v.pipe(GrpcSettingsObjectSchema, ...proxyPairChecks<KindSettingsShape<'grpc'>>());

/**
 * The record a collection or folder carries — one slice per request
 * kind, each optional. A knob set under one kind is that kind's alone:
 * an HTTP TLS floor never reaches a WebSocket session under the same
 * collection (the per-kind law). The sync flattener keys one leaf per
 * knob per kind (`settings.<kind>.<key>`); a slice or the record left
 * behind by unsets reads as empty. Without the ties — the fail-soft
 * projection read.
 */
export const ContainerSettingsObjectSchema = v.object({
  http: v.optional(HttpSettingsObjectSchema),
  websocket: v.optional(WebSocketSettingsObjectSchema),
  mqtt: v.optional(MqttSettingsObjectSchema),
  grpc: v.optional(GrpcSettingsObjectSchema),
});

/** The persisted record — every slice with its proxy tie. */
export const ContainerSettingsSchema = v.object({
  http: v.optional(HttpSettingsSchema),
  websocket: v.optional(WebSocketSettingsSchema),
  mqtt: v.optional(MqttSettingsSchema),
  grpc: v.optional(GrpcSettingsSchema),
});

type ContainerSettingsShape = v.InferOutput<typeof ContainerSettingsObjectSchema>;

/** The knobs a kind's slice sets — defined values only, in the kind's
 *  key order; a slice left behind by unsets reads as empty. */
export function definedSettingKeys<K extends AuthProtocolKind>(
  kind: K,
  slice: KindSettingsShape<K> | undefined,
): InheritableSettingKeysByKind[K][] {
  if (slice === undefined) return [];
  return INHERITABLE_SETTING_KEYS_BY_KIND[kind].filter((key) => slice[key] !== undefined);
}

/** How many knobs the record sets across its kinds. */
export function definedSettingCount(settings: ContainerSettingsShape | undefined): number {
  if (settings === undefined) return 0;
  return SETTINGS_KINDS.reduce((n, kind) => n + definedSettingKeys(kind, settings[kind]).length, 0);
}

/** Whether the record sets anything — a transparent level otherwise. */
export function hasInheritableSettings(settings: ContainerSettingsShape | undefined): boolean {
  return definedSettingCount(settings) > 0;
}
