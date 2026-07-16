/**
 * Protobuf outline derivation — the structure pane's groups for a
 * `protobuf` spec, computed from the source text through the census
 * parser (`@openheaders/core/proto`) on the same parse-on-idle tick as
 * validation. Groups mirror the document's anatomy: Package / Imports /
 * Services / Messages / Enums, with rpc rows carrying their streaming
 * shape for the pane's call-shape glyphs (the same metadata the gRPC
 * editor's method selector consumes in a later phase). Message rows
 * nest their inner messages and enums; fields stay out of the outline
 * (the codec phase reads them, the structure pane doesn't).
 */

import { type ProtoCensus, type ProtoEnum, type ProtoMessage, parseProto } from '@openheaders/core/proto';
import type { SpecOutlineNode } from './spec-outline';

function enumNode(entry: ProtoEnum): SpecOutlineNode {
  return { key: `enum:${entry.fullName}`, label: entry.name, kind: 'enum', offset: entry.offset, children: [] };
}

function messageNode(message: ProtoMessage): SpecOutlineNode {
  return {
    key: `message:${message.fullName}`,
    label: message.name,
    kind: 'message',
    offset: message.offset,
    children: [...message.messages.map(messageNode), ...message.enums.map(enumNode)],
  };
}

function group(key: string, offset: number | null, children: SpecOutlineNode[]): SpecOutlineNode {
  return { key, label: key, kind: 'group', offset, children };
}

/** Census → outline groups, in document-anatomy order. */
export function protoOutlineGroups(census: ProtoCensus): SpecOutlineNode[] {
  const packageChildren: SpecOutlineNode[] =
    census.packageName === null
      ? []
      : [
          {
            key: `package:${census.packageName}`,
            label: census.packageName,
            kind: 'package',
            offset: census.packageOffset,
            children: [],
          },
        ];
  const services = census.services.map(
    (service): SpecOutlineNode => ({
      key: `service:${service.fullName}`,
      label: service.name,
      kind: 'service',
      offset: service.offset,
      children: service.rpcs.map((rpc) => ({
        key: `rpc:${service.fullName}.${rpc.name}`,
        label: rpc.name,
        kind: 'rpc',
        offset: rpc.offset,
        streaming: rpc.streaming,
        children: [],
      })),
    }),
  );
  return [
    group('package', census.packageOffset, packageChildren),
    group(
      'imports',
      census.imports[0]?.offset ?? null,
      census.imports.map((entry) => ({
        key: `import:${entry.path}`,
        label: entry.path,
        kind: 'import',
        offset: entry.offset,
        children: [],
      })),
    ),
    group('services', census.services[0]?.offset ?? null, services),
    group('messages', census.messages[0]?.offset ?? null, census.messages.map(messageNode)),
    group('enums', census.enums[0]?.offset ?? null, census.enums.map(enumNode)),
  ];
}

/**
 * Derive the outline groups from `.proto` source text. Returns null
 * when the text does not parse — the caller keeps the last good tree
 * on screen (same posture as the OpenAPI outline).
 */
export function buildProtoOutline(content: string): SpecOutlineNode[] | null {
  try {
    return protoOutlineGroups(parseProto(content));
  } catch {
    return null;
  }
}
