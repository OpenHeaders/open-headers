/**
 * AsyncAPI outline derivation — the structure pane's groups for an
 * `asyncapi` spec, computed from the source text through the census
 * parser (`@openheaders/core/asyncapi`) on the same parse-on-idle tick
 * as validation. Groups mirror the vendor anatomy (user-captured
 * screenshot, 2026-07-18): Servers (with a protocol chip per server) /
 * Channels (nesting their messages) / Operations (send/receive
 * glyphs) / Components with Schemas and Messages subgroups, with
 * declaration offsets for editor navigation.
 */

import { type AsyncApiCensus, parseAsyncApi } from '@openheaders/core/asyncapi';
import type { SpecOutlineNode } from './spec-outline';

function endOf(end: number | null): { end?: number } {
  return end !== null ? { end } : {};
}

function group(key: string, offset: number | null, children: SpecOutlineNode[]): SpecOutlineNode {
  return { key, label: key, kind: 'group', offset, children };
}

/** Census → outline groups, in document-anatomy order. */
export function asyncApiOutlineGroups(census: AsyncApiCensus): SpecOutlineNode[] {
  const servers = census.servers.map(
    (server): SpecOutlineNode => ({
      key: `server:${server.name}`,
      label: server.name,
      kind: 'server',
      offset: server.offset,
      ...endOf(server.end),
      ...(server.protocol !== null ? { protocol: server.protocol } : {}),
      children: [],
    }),
  );
  const channels = census.channels.map(
    (channel): SpecOutlineNode => ({
      key: `channel:${channel.name}`,
      label: channel.address ?? channel.name,
      kind: 'channel',
      offset: channel.offset,
      ...endOf(channel.end),
      children: channel.messages.map(
        (message): SpecOutlineNode => ({
          key: `channel:${channel.name}:message:${message.name}`,
          label: message.name,
          kind: 'message',
          offset: message.offset,
          ...endOf(message.end),
          children: [],
        }),
      ),
    }),
  );
  const operations = census.operations.map(
    (operation): SpecOutlineNode => ({
      key: `asyncOperation:${operation.name}`,
      label: operation.name,
      kind: 'operation',
      offset: operation.offset,
      ...endOf(operation.end),
      action: operation.action,
      children: [],
    }),
  );
  const messages = census.componentMessages.map(
    (message): SpecOutlineNode => ({
      key: `message:${message.name}`,
      label: message.name,
      kind: 'message',
      offset: message.offset,
      ...endOf(message.end),
      children: [],
    }),
  );
  const schemas = census.componentSchemas.map(
    (schema): SpecOutlineNode => ({
      key: `schema:${schema.name}`,
      label: schema.name,
      kind: 'schema',
      offset: schema.offset,
      ...endOf(schema.end),
      children: [],
    }),
  );
  const componentsOffset = census.componentSchemas[0]?.offset ?? census.componentMessages[0]?.offset ?? null;
  return [
    group('servers', census.servers[0]?.offset ?? null, servers),
    group('channels', census.channels[0]?.offset ?? null, channels),
    group('operations', census.operations[0]?.offset ?? null, operations),
    group('components', componentsOffset, [
      {
        key: 'components:schemas',
        label: 'schemas',
        kind: 'group',
        offset: census.componentSchemas[0]?.offset ?? null,
        children: schemas,
      },
      {
        key: 'components:messages',
        label: 'messages',
        kind: 'group',
        offset: census.componentMessages[0]?.offset ?? null,
        children: messages,
      },
    ]),
  ];
}

/**
 * Derive the outline groups from AsyncAPI source text. Returns null
 * when the text does not parse — the caller keeps the last good tree
 * on screen (same posture as the OpenAPI outline).
 */
export function buildAsyncApiOutline(content: string): SpecOutlineNode[] | null {
  try {
    return asyncApiOutlineGroups(parseAsyncApi(content));
  } catch {
    return null;
  }
}
