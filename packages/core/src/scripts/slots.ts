/**
 * Script slots — the storage vocabulary every script-carrying entity
 * shares: the kinds, where each kind's source lives on an entity, and
 * the sibling file it fans out to on disk.
 *
 * Kinds group by the request kind whose lifecycle they hook. The HTTP
 * pair predates the vocabulary and keeps its own top-level fields and
 * file names (`preRequestScript` ↔ `pre-request.js`,
 * `postResponseScript` ↔ `post-response.js`) — frozen storage. Every
 * session kind lives in the entity's `scripts` record under its own
 * kind as the key, and fans out to `<kind>.js` beside the manifest:
 * one naming table, no per-scope switch, the same on a WebSocket
 * request's folder and on a collection's.
 *
 * A container (collection, folder) carries every session kind: its
 * gRPC slots run for the gRPC requests under it and nothing else, and
 * so on per kind. A session request carries its own kind's slots.
 * Scripts compose outer → inner; a slot has no inherit state.
 */

export const HTTP_SCRIPT_KINDS = ['pre-request', 'post-response'] as const;
export const GRPC_SCRIPT_KINDS = ['grpc-before-invoke', 'grpc-on-message', 'grpc-after-response'] as const;
export const WS_SCRIPT_KINDS = ['ws-before-connect', 'ws-before-send', 'ws-on-message', 'ws-after-close'] as const;
export const MQTT_SCRIPT_KINDS = [
  'mqtt-before-connect',
  'mqtt-before-publish',
  'mqtt-on-message',
  'mqtt-after-close',
] as const;
export const SESSION_SCRIPT_KINDS = [...GRPC_SCRIPT_KINDS, ...WS_SCRIPT_KINDS, ...MQTT_SCRIPT_KINDS] as const;
export const SCRIPT_KINDS = [...HTTP_SCRIPT_KINDS, ...SESSION_SCRIPT_KINDS] as const;

export type HttpScriptKind = (typeof HTTP_SCRIPT_KINDS)[number];
export type GrpcScriptKind = (typeof GRPC_SCRIPT_KINDS)[number];
export type WsScriptKind = (typeof WS_SCRIPT_KINDS)[number];
export type MqttScriptKind = (typeof MQTT_SCRIPT_KINDS)[number];
export type SessionScriptKind = (typeof SESSION_SCRIPT_KINDS)[number];
export type ScriptKind = HttpScriptKind | SessionScriptKind;

const SESSION_KIND_SET: ReadonlySet<string> = new Set(SESSION_SCRIPT_KINDS);

export function isSessionScriptKind(kind: ScriptKind): kind is SessionScriptKind {
  return SESSION_KIND_SET.has(kind);
}

/** The session slots an entity carries — a container holds every
 *  kind's, a session request its own kind's. Absent key ↔ no script. */
export type ScriptSlotRecord = Partial<Record<SessionScriptKind, string>>;

/** Anything carrying script slots: a collection, a folder, an HTTP
 *  request (the pair alone), a session request (the record alone). */
export interface ScriptSlotCarrier {
  preRequestScript?: string;
  postResponseScript?: string;
  scripts?: ScriptSlotRecord;
}

/** The sync leaf a slot is written at — a top-level field for the HTTP
 *  pair, a leaf of the `scripts` record for a session kind. */
export type ScriptSlotPath = 'preRequestScript' | 'postResponseScript' | `scripts.${SessionScriptKind}`;

export function scriptSlotPath(kind: ScriptKind): ScriptSlotPath {
  switch (kind) {
    case 'pre-request':
      return 'preRequestScript';
    case 'post-response':
      return 'postResponseScript';
    default:
      return `scripts.${kind}`;
  }
}

export const PRE_REQUEST_SCRIPT_FILE = 'pre-request.js';
export const POST_RESPONSE_SCRIPT_FILE = 'post-response.js';

/** The sibling file a slot fans out to beside its entity's manifest. */
export function scriptSlotFile(kind: ScriptKind): string {
  switch (kind) {
    case 'pre-request':
      return PRE_REQUEST_SCRIPT_FILE;
    case 'post-response':
      return POST_RESPONSE_SCRIPT_FILE;
    default:
      return `${kind}.js`;
  }
}

const KIND_BY_FILE: ReadonlyMap<string, ScriptKind> = new Map(SCRIPT_KINDS.map((kind) => [scriptSlotFile(kind), kind]));

/** The slot a sibling file carries; `null` for any other file. */
export function scriptKindOfFile(fileName: string): ScriptKind | null {
  return KIND_BY_FILE.get(fileName) ?? null;
}

/** A slot's source off a carrier; `undefined` when the slot is absent. */
export function readScriptSlot(carrier: ScriptSlotCarrier, kind: ScriptKind): string | undefined {
  switch (kind) {
    case 'pre-request':
      return carrier.preRequestScript;
    case 'post-response':
      return carrier.postResponseScript;
    default:
      return carrier.scripts?.[kind];
  }
}

/** A carrier with one slot's source replaced — a draft's edit. Removal
 *  (absent ↔ no script) is the write path's `unsetField`, never a
 *  draft state. */
export function withScriptSlot<C extends ScriptSlotCarrier>(carrier: C, kind: ScriptKind, value: string): C {
  switch (kind) {
    case 'pre-request':
      return { ...carrier, preRequestScript: value };
    case 'post-response':
      return { ...carrier, postResponseScript: value };
    default:
      return { ...carrier, scripts: { ...carrier.scripts, [kind]: value } };
  }
}

/** Every slot the carrier holds with a non-blank source, in kind order. */
export function presentScriptSlots(carrier: ScriptSlotCarrier): Array<{ kind: ScriptKind; source: string }> {
  const out: Array<{ kind: ScriptKind; source: string }> = [];
  for (const kind of SCRIPT_KINDS) {
    const source = readScriptSlot(carrier, kind);
    if (source !== undefined && source.trim() !== '') out.push({ kind, source });
  }
  return out;
}

/** True when the carrier holds any non-blank slot of the given kinds. */
export function hasScriptSlots(carrier: ScriptSlotCarrier, kinds: readonly ScriptKind[] = SCRIPT_KINDS): boolean {
  return kinds.some((kind) => (readScriptSlot(carrier, kind) ?? '').trim() !== '');
}
