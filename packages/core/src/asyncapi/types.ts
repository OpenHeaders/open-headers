/**
 * AsyncAPI census types — the parsed shape of an AsyncAPI document.
 *
 * The census is the spec plane's structural read of an event-driven API
 * description: servers, channels with their messages, operations, and
 * the reusable component messages/schemas. Every named node carries the
 * character offset of its declaration (and where the AST gives one, the
 * end of its span) so outline surfaces can navigate the editor to it —
 * the OpenAPI/Protobuf outline offset contract.
 *
 * AsyncAPI 3.0 shapes are first-class; 2.x documents are read-tolerant
 * (server `url` read as host, channel-inline `publish`/`subscribe`
 * lifted into operations). Structural problems inside a parseable
 * document are REPORTED on `issues`, never thrown — only a document
 * that is not an AsyncAPI mapping at all fails the parse.
 */

/** Operation direction, from the application's counterpart (the
 *  client) perspective: `send` publishes to the channel, `receive`
 *  consumes from it. 2.x `publish` reads as send, `subscribe` as
 *  receive. */
export type AsyncApiOperationAction = 'send' | 'receive';

export interface AsyncApiServer {
  /** Map key under `servers`. */
  name: string;
  /** 3.0 `host`; 2.x `url` verbatim. Null when absent. */
  host: string | null;
  /** Wire protocol as written (`ws`, `wss`, `mqtt`, `kafka`, …). */
  protocol: string | null;
  offset: number;
  end: number | null;
}

export interface AsyncApiMessage {
  /** The declaring map key (channel-local message names stay local —
   *  the vendor outline shape); the `$ref` target's last segment when
   *  no key names the entry (2.x `oneOf` lists). */
  name: string;
  /**
   * The message's `payload` schema as plain data — kept so
   * example-payload synthesis (the ratified JSON-Schema subset:
   * objects / arrays / scalars / enum / const / default / examples)
   * reads it without re-parsing. A payload that IS a `$ref` resolves
   * one level at census time; refs nested deeper stay verbatim and
   * resolve against the component schema bodies. Null when the
   * message declares none.
   */
  payload: unknown;
  offset: number;
  end: number | null;
}

export interface AsyncApiSchema {
  name: string;
  /** The schema as plain data — nested payload `$ref`s resolve
   *  against these bodies at synthesis time. */
  body: unknown;
  offset: number;
  end: number | null;
}

export interface AsyncApiChannel {
  /** Channel id — the map key under `channels`. */
  name: string;
  /** 3.0 `address`; for 2.x documents the channel key IS the address. */
  address: string | null;
  /** The channel's messages — inline definitions censused in place,
   *  `$ref`s to component messages resolved. */
  messages: AsyncApiMessage[];
  offset: number;
  end: number | null;
}

export interface AsyncApiOperation {
  /** Operation id — the map key under `operations` (3.0), or the 2.x
   *  `operationId` when declared (`<action>:<channel>` otherwise). */
  name: string;
  action: AsyncApiOperationAction;
  /** Resolved channel id; null when the reference did not resolve
   *  (reported as an issue). */
  channelName: string | null;
  summary: string | null;
  offset: number;
  end: number | null;
}

export type AsyncApiIssueKind = 'unresolved-ref' | 'unknown-channel' | 'invalid-node' | 'unsupported-version';

export interface AsyncApiIssue {
  kind: AsyncApiIssueKind;
  /** What went wrong with — a `$ref` as written, a version string, or
   *  the offending value. */
  reference: string;
  /** Where — the declaring section path, e.g. `operations.sendPing`. */
  scope: string;
}

/** Structural census of one AsyncAPI document. */
export interface AsyncApiCensus {
  /** The `asyncapi` version declaration verbatim, e.g. `3.0.0`. */
  version: string;
  /** `info.title`, null when absent. */
  title: string | null;
  servers: AsyncApiServer[];
  channels: AsyncApiChannel[];
  operations: AsyncApiOperation[];
  /** Reusable messages under `components.messages`. */
  componentMessages: AsyncApiMessage[];
  /** Reusable schemas under `components.schemas`. */
  componentSchemas: AsyncApiSchema[];
  issues: AsyncApiIssue[];
}

/** The document is not an AsyncAPI mapping at all — invalid YAML/JSON,
 *  a non-mapping root, or no `asyncapi` version declaration. Position
 *  formatted into the message where the AST carries one. */
export class AsyncApiParseError extends Error {
  /** Character offset of the offending spot. */
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.name = 'AsyncApiParseError';
    this.offset = offset;
  }
}
