/**
 * Protobuf outline derivation — the structure pane's groups for a
 * protobuf spec (gRPC epic Phase A).
 *
 * Pins the contract: Package / Imports / Services / Messages / Enums
 * groups derive from the census with declaration offsets, rpc rows
 * carry their streaming shape, message rows nest inner messages and
 * enums (fields stay out), and a non-parsing buffer returns null so
 * the pane keeps the last good tree.
 */

import { buildProtoOutline } from '@openheaders/ui/workbench/components/specs/proto-outline';
import { PROTO3_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import { describe, expect, it } from 'vitest';

const NESTED_PROTO = `syntax = "proto3";
package openheaders.api.v1;

message Outer {
  string id = 1;
  message Inner {
    string value = 1;
  }
  enum Mode {
    MODE_UNSPECIFIED = 0;
  }
}
`;

describe('buildProtoOutline', () => {
  it('derives the five groups from the scaffold in anatomy order', () => {
    const groups = buildProtoOutline(PROTO3_SCAFFOLD);
    expect(groups).not.toBeNull();
    if (groups === null) return;
    expect(groups.map((g) => g.key)).toEqual(['package', 'imports', 'services', 'messages', 'enums']);
    expect(groups[0].children.map((n) => n.label)).toEqual(['sample.library.v1']);
    expect(groups[1].children.map((n) => n.label)).toEqual(['google/protobuf/timestamp.proto']);
    expect(groups[2].children.map((n) => n.label)).toEqual(['LibraryService']);
    expect(groups[3].children.map((n) => n.label)).toEqual([
      'Book',
      'GetBookRequest',
      'ListBooksRequest',
      'AddBookRequest',
      'AddBooksSummary',
      'ChatMessage',
    ]);
    expect(groups[4].children.map((n) => n.label)).toEqual(['Genre']);
  });

  it('rpc rows carry their streaming shape', () => {
    const groups = buildProtoOutline(PROTO3_SCAFFOLD);
    const service = groups?.[2].children[0];
    expect(service?.kind).toBe('service');
    expect(service?.children.map((rpc) => [rpc.label, rpc.streaming])).toEqual([
      ['GetBook', 'unary'],
      ['ListBooks', 'server-streaming'],
      ['AddBooks', 'client-streaming'],
      ['Chat', 'bidi-streaming'],
    ]);
    expect(service?.children.every((rpc) => rpc.kind === 'rpc')).toBe(true);
  });

  it('carries declaration offsets that point at each node', () => {
    const groups = buildProtoOutline(PROTO3_SCAFFOLD);
    if (groups === null) return;
    expect(groups[0].offset).toBe(PROTO3_SCAFFOLD.indexOf('package '));
    expect(groups[2].children[0].offset).toBe(PROTO3_SCAFFOLD.indexOf('service LibraryService'));
    expect(groups[2].children[0].children[0].offset).toBe(PROTO3_SCAFFOLD.indexOf('rpc GetBook'));
    expect(groups[4].children[0].offset).toBe(PROTO3_SCAFFOLD.indexOf('enum Genre'));
  });

  it('nests inner messages and enums under their message row, without fields', () => {
    const groups = buildProtoOutline(NESTED_PROTO);
    const outer = groups?.[3].children[0];
    expect(outer?.label).toBe('Outer');
    expect(outer?.children.map((n) => [n.label, n.kind])).toEqual([
      ['Inner', 'message'],
      ['Mode', 'enum'],
    ]);
    expect(outer?.key).toBe('message:openheaders.api.v1.Outer');
    expect(outer?.children[0].key).toBe('message:openheaders.api.v1.Outer.Inner');
  });

  it('groups are present but empty when their sections are absent', () => {
    const groups = buildProtoOutline('syntax = "proto3";\n');
    expect(groups).not.toBeNull();
    if (groups === null) return;
    expect(groups.map((g) => g.children.length)).toEqual([0, 0, 0, 0, 0]);
    expect(groups[0].offset).toBeNull();
  });

  it('returns null when the buffer does not parse', () => {
    expect(buildProtoOutline('message {')).toBeNull();
    expect(buildProtoOutline('service S { rpc }')).toBeNull();
  });
});
