/**
 * Hand-rolled AsyncAPI census parser — 3.0 first-class, 2.x
 * read-tolerant. No third-party toolchain: `yaml.parseDocument` is the
 * single position source for BOTH syntaxes (YAML 1.2 is a strict
 * superset of JSON), and the census walks the AST directly so every
 * named node keeps the character offset of its declaration for outline
 * navigation.
 *
 * Intra-document `$ref`s (JSON Pointer, `#/…`) resolve against the
 * same AST wherever a section reads a mapping. Structural problems —
 * an unresolvable reference, an operation naming no known channel, a
 * malformed entry — are REPORTED on `census.issues`, never thrown;
 * only a document that is not an AsyncAPI mapping at all throws
 * `AsyncApiParseError` (invalid YAML/JSON, non-mapping root, missing
 * `asyncapi` declaration).
 */

import type { Pair, YAMLMap, YAMLSeq } from 'yaml';
import { isMap, isNode, isScalar, isSeq, parseDocument } from 'yaml';
import {
  type AsyncApiCensus,
  type AsyncApiChannel,
  type AsyncApiIssue,
  type AsyncApiMessage,
  type AsyncApiOperation,
  type AsyncApiOperationAction,
  AsyncApiParseError,
  type AsyncApiSchema,
  type AsyncApiServer,
} from './types';

// ── AST helpers ────────────────────────────────────────────────────

function nodeRange(node: unknown): [number, number, number] | null {
  if (node !== null && typeof node === 'object' && 'range' in node) {
    const range = (node as { range?: [number, number, number] | null }).range;
    if (Array.isArray(range)) return range;
  }
  return null;
}

function nodeOffset(node: unknown): number | null {
  return nodeRange(node)?.[0] ?? null;
}

/** End of the node's own source text (`range[2]` — past trailing content). */
function nodeEnd(node: unknown): number | null {
  return nodeRange(node)?.[2] ?? null;
}

function pairOffset(pair: Pair): number {
  return nodeOffset(pair.key) ?? nodeOffset(pair.value) ?? 0;
}

/** A pair's section spans key start → value end. */
function pairEnd(pair: Pair): number | null {
  return nodeEnd(pair.value) ?? nodeEnd(pair.key);
}

function keyString(pair: Pair): string | null {
  return isScalar(pair.key) && (typeof pair.key.value === 'string' || typeof pair.key.value === 'number')
    ? String(pair.key.value)
    : null;
}

/** The pair for `key` on a map, or null — offsets need the Pair, not the value. */
function findPair(map: YAMLMap, key: string): Pair | null {
  return map.items.find((item) => keyString(item) === key) ?? null;
}

/** Scalar string property of a map node, e.g. a server's `protocol`. */
function scalarProp(node: unknown, key: string): string | null {
  if (!isMap(node)) return null;
  const pair = findPair(node, key);
  if (!pair || !isScalar(pair.value)) return null;
  const value = pair.value.value;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** Plain-data mirror of an AST node (message payloads ride verbatim). */
function plainOf(node: unknown): unknown {
  return isNode(node) ? node.toJSON() : null;
}

/** JSON Pointer segments of an intra-document `$ref`, unescaped
 *  (`~1` → `/`, `~0` → `~`); null for anything but a `#/…` pointer. */
function pointerSegments(ref: string): string[] | null {
  if (!ref.startsWith('#/')) return null;
  return ref
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** The `$ref` string of a single-purpose reference mapping, or null. */
function refOf(node: unknown): string | null {
  if (!isMap(node)) return null;
  const pair = findPair(node, '$ref');
  if (!pair || !isScalar(pair.value) || typeof pair.value.value !== 'string') return null;
  return pair.value.value;
}

// ── Census walk ────────────────────────────────────────────────────

class CensusBuilder {
  readonly issues: AsyncApiIssue[] = [];

  constructor(private readonly root: YAMLMap) {}

  /** Resolve a `#/…` pointer against the document root; null (with an
   *  issue on the caller) when any segment misses. */
  resolvePointer(ref: string): unknown | null {
    const segments = pointerSegments(ref);
    if (segments === null) return null;
    let node: unknown = this.root;
    for (const segment of segments) {
      if (isMap(node)) {
        const pair = findPair(node, segment);
        if (pair === null) return null;
        node = pair.value;
      } else if (isSeq(node)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= node.items.length) return null;
        node = node.items[index];
      } else {
        return null;
      }
    }
    return node;
  }

  /** Follow a node's `$ref` (when it is one) to its target. Returns the
   *  node itself when it is not a reference; null + issue on a
   *  reference that does not resolve. */
  deref(node: unknown, scope: string): { node: unknown; refName: string | null } | null {
    const ref = refOf(node);
    if (ref === null) return { node, refName: null };
    const target = this.resolvePointer(ref);
    if (target === null) {
      this.issues.push({ kind: 'unresolved-ref', reference: ref, scope });
      return null;
    }
    const segments = pointerSegments(ref);
    return { node: target, refName: segments !== null && segments.length > 0 ? segments[segments.length - 1] : null };
  }

  /** Census one message entry. `name` is the declaring map key (kept
   *  as the message's name — the vendor outline shape); pass null for
   *  keyless entries (2.x `oneOf` items), which fall back to the
   *  `$ref` target's last segment, then `fallbackName`. */
  message(
    name: string | null,
    node: unknown,
    scope: string,
    offset: number,
    end: number | null,
    fallbackName = '(message)',
  ): AsyncApiMessage | null {
    const resolved = this.deref(node, scope);
    if (resolved === null) return null;
    if (!isMap(resolved.node)) {
      this.issues.push({ kind: 'invalid-node', reference: name ?? fallbackName, scope });
      return null;
    }
    const payloadPair = findPair(resolved.node, 'payload');
    let payload: unknown = null;
    if (payloadPair !== null) {
      // A payload that IS a `$ref` resolves one level here; deeper
      // refs stay verbatim (component schema bodies carry them).
      const payloadNode = this.deref(payloadPair.value, `${scope}.payload`);
      payload = payloadNode !== null ? plainOf(payloadNode.node) : null;
    }
    return {
      name: name ?? resolved.refName ?? fallbackName,
      payload,
      offset,
      end,
    };
  }
}

function serverFrom(pair: Pair, builder: CensusBuilder, hostKey: 'host' | 'url'): AsyncApiServer | null {
  const name = keyString(pair);
  if (name === null) return null;
  const resolved = builder.deref(pair.value, `servers.${name}`);
  if (resolved === null) return null;
  return {
    name,
    host: scalarProp(resolved.node, hostKey),
    protocol: scalarProp(resolved.node, 'protocol'),
    offset: pairOffset(pair),
    end: pairEnd(pair),
  };
}

/** 3.0 channel: `address` + a `messages` map (inline or `$ref`). */
function channelFrom(pair: Pair, builder: CensusBuilder): AsyncApiChannel | null {
  const name = keyString(pair);
  if (name === null) return null;
  const scope = `channels.${name}`;
  const resolved = builder.deref(pair.value, scope);
  if (resolved === null) return null;
  const messages: AsyncApiMessage[] = [];
  if (isMap(resolved.node)) {
    const messagesPair = findPair(resolved.node, 'messages');
    if (messagesPair !== null && isMap(messagesPair.value)) {
      for (const entry of messagesPair.value.items) {
        const messageName = keyString(entry);
        if (messageName === null) continue;
        const message = builder.message(
          messageName,
          entry.value,
          `${scope}.messages.${messageName}`,
          pairOffset(entry),
          pairEnd(entry),
        );
        if (message !== null) messages.push(message);
      }
    }
  }
  return {
    name,
    address: scalarProp(resolved.node, 'address'),
    messages,
    offset: pairOffset(pair),
    end: pairEnd(pair),
  };
}

/** 3.0 operation: `action` + a channel `$ref` + optional `summary`. */
function operationFrom(
  pair: Pair,
  builder: CensusBuilder,
  channelNames: ReadonlySet<string>,
): AsyncApiOperation | null {
  const name = keyString(pair);
  if (name === null) return null;
  const scope = `operations.${name}`;
  const resolved = builder.deref(pair.value, scope);
  if (resolved === null) return null;
  const node = resolved.node;
  if (!isMap(node)) {
    builder.issues.push({ kind: 'invalid-node', reference: name, scope });
    return null;
  }
  const action = scalarProp(node, 'action');
  if (action !== 'send' && action !== 'receive') {
    builder.issues.push({ kind: 'invalid-node', reference: `action: ${action ?? '(none)'}`, scope });
    return null;
  }
  let channelName: string | null = null;
  const channelPair = findPair(node, 'channel');
  const channelRef = channelPair !== null ? refOf(channelPair.value) : null;
  if (channelRef === null) {
    builder.issues.push({ kind: 'invalid-node', reference: 'channel', scope });
  } else {
    const segments = pointerSegments(channelRef);
    if (segments !== null && segments.length === 2 && segments[0] === 'channels' && channelNames.has(segments[1])) {
      channelName = segments[1];
    } else {
      builder.issues.push({ kind: 'unknown-channel', reference: channelRef, scope });
    }
  }
  return {
    name,
    action,
    channelName,
    summary: scalarProp(node, 'summary'),
    offset: pairOffset(pair),
    end: pairEnd(pair),
  };
}

/** One 2.x channel-inline operation (`publish` / `subscribe`) lifted
 *  into the census's operation + message lists. */
function liftLegacyOperation(
  channelName: string,
  operationPair: Pair,
  action: AsyncApiOperationAction,
  builder: CensusBuilder,
  operations: AsyncApiOperation[],
  messages: AsyncApiMessage[],
): void {
  const legacyKind = action === 'send' ? 'publish' : 'subscribe';
  const scope = `channels.${channelName}.${legacyKind}`;
  const node = operationPair.value;
  operations.push({
    name: scalarProp(node, 'operationId') ?? `${legacyKind}:${channelName}`,
    action,
    channelName,
    summary: scalarProp(node, 'summary'),
    offset: pairOffset(operationPair),
    end: pairEnd(operationPair),
  });
  if (!isMap(node)) return;
  const messagePair = findPair(node, 'message');
  if (messagePair === null) return;
  // `message` is one message or a `oneOf` list of them.
  const oneOfPair = isMap(messagePair.value) ? findPair(messagePair.value, 'oneOf') : null;
  const candidates: { node: unknown; offset: number; end: number | null }[] =
    oneOfPair !== null && isSeq(oneOfPair.value)
      ? (oneOfPair.value as YAMLSeq).items.map((item) => ({
          node: item,
          offset: nodeOffset(item) ?? pairOffset(messagePair),
          end: nodeEnd(item),
        }))
      : [{ node: messagePair.value, offset: pairOffset(messagePair), end: pairEnd(messagePair) }];
  candidates.forEach((candidate, index) => {
    const inlineName = scalarProp(candidate.node, 'name');
    const fallbackName = `${channelName}.message${candidates.length > 1 ? `[${index}]` : ''}`;
    const message = builder.message(
      inlineName,
      candidate.node,
      `${scope}.message`,
      candidate.offset,
      candidate.end,
      fallbackName,
    );
    if (message !== null) messages.push(message);
  });
}

/**
 * Parse one AsyncAPI document (YAML or JSON) into its structural
 * census. Throws `AsyncApiParseError` only when the document is not an
 * AsyncAPI mapping at all; everything else lands on `census.issues`.
 */
export function parseAsyncApi(source: string): AsyncApiCensus {
  const doc = parseDocument(source);
  const firstError = doc.errors[0];
  if (firstError !== undefined) {
    throw new AsyncApiParseError(firstError.message, firstError.pos[0] ?? 0);
  }
  if (!isMap(doc.contents)) {
    throw new AsyncApiParseError('The document is not a mapping.', 0);
  }
  const root = doc.contents;
  const version = scalarProp(root, 'asyncapi');
  if (version === null) {
    throw new AsyncApiParseError('Missing `asyncapi` version declaration.', 0);
  }

  const builder = new CensusBuilder(root);
  const major = version.trim().split('.')[0];
  const legacy = major === '2';
  if (major !== '3' && major !== '2') {
    builder.issues.push({ kind: 'unsupported-version', reference: version, scope: 'asyncapi' });
  }

  const infoPair = findPair(root, 'info');
  const title = infoPair !== null ? scalarProp(infoPair.value, 'title') : null;

  const servers: AsyncApiServer[] = [];
  const serversPair = findPair(root, 'servers');
  if (serversPair !== null && isMap(serversPair.value)) {
    for (const entry of serversPair.value.items) {
      const server = serverFrom(entry, builder, legacy ? 'url' : 'host');
      if (server !== null) servers.push(server);
    }
  }

  const channels: AsyncApiChannel[] = [];
  const operations: AsyncApiOperation[] = [];
  const channelsPair = findPair(root, 'channels');
  if (channelsPair !== null && isMap(channelsPair.value)) {
    if (legacy) {
      // 2.x: the channel key is the address; `publish`/`subscribe`
      // ride inline and lift into the operations census.
      for (const entry of channelsPair.value.items) {
        const name = keyString(entry);
        if (name === null) continue;
        const messages: AsyncApiMessage[] = [];
        if (isMap(entry.value)) {
          const publishPair = findPair(entry.value, 'publish');
          if (publishPair !== null) liftLegacyOperation(name, publishPair, 'send', builder, operations, messages);
          const subscribePair = findPair(entry.value, 'subscribe');
          if (subscribePair !== null)
            liftLegacyOperation(name, subscribePair, 'receive', builder, operations, messages);
        }
        channels.push({ name, address: name, messages, offset: pairOffset(entry), end: pairEnd(entry) });
      }
    } else {
      for (const entry of channelsPair.value.items) {
        const channel = channelFrom(entry, builder);
        if (channel !== null) channels.push(channel);
      }
    }
  }

  if (!legacy) {
    const channelNames = new Set(channels.map((channel) => channel.name));
    const operationsPair = findPair(root, 'operations');
    if (operationsPair !== null && isMap(operationsPair.value)) {
      for (const entry of operationsPair.value.items) {
        const operation = operationFrom(entry, builder, channelNames);
        if (operation !== null) operations.push(operation);
      }
    }
  }

  const componentMessages: AsyncApiMessage[] = [];
  const componentSchemas: AsyncApiSchema[] = [];
  const componentsPair = findPair(root, 'components');
  if (componentsPair !== null && isMap(componentsPair.value)) {
    const messagesPair = findPair(componentsPair.value, 'messages');
    if (messagesPair !== null && isMap(messagesPair.value)) {
      for (const entry of messagesPair.value.items) {
        const name = keyString(entry);
        if (name === null) continue;
        const message = builder.message(
          name,
          entry.value,
          `components.messages.${name}`,
          pairOffset(entry),
          pairEnd(entry),
        );
        if (message !== null) componentMessages.push(message);
      }
    }
    const schemasPair = findPair(componentsPair.value, 'schemas');
    if (schemasPair !== null && isMap(schemasPair.value)) {
      for (const entry of schemasPair.value.items) {
        const name = keyString(entry);
        if (name === null) continue;
        componentSchemas.push({ name, body: plainOf(entry.value), offset: pairOffset(entry), end: pairEnd(entry) });
      }
    }
  }

  return {
    version,
    title,
    servers,
    channels,
    operations,
    componentMessages,
    componentSchemas,
    issues: builder.issues,
  };
}
