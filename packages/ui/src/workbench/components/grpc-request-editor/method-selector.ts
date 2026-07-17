/**
 * gRPC method-selector derivation — pure functions from a linked
 * Protobuf spec's live file set to the selector's grouped options.
 *
 * The registry is rebuilt from the spec's CURRENT files on every
 * derivation (ids-only specLink; nothing cached from generation time).
 * Files that fail to parse are reported, not thrown — the selector
 * renders what resolved and surfaces the rest as issues.
 */

import {
  buildRegistry,
  type ProtoRegistry,
  type ProtoRegistryIssue,
  type ProtoSourceFile,
  type ProtoStreamingShape,
  parseProto,
  synthesizeExampleMessage,
} from '@openheaders/core/proto';
import type { GrpcMethodRef, Spec } from '@openheaders/core/types';

/**
 * Call-shape glyph per streaming shape — an up/down arrow pair where a
 * double-struck arrow marks the streaming direction(s), so the shape
 * reads without relying on the selector's color accent alone.
 */
export const GRPC_STREAMING_ARROWS: Record<ProtoStreamingShape, string> = {
  unary: '↑↓',
  'server-streaming': '↑⇓',
  'client-streaming': '⇑↓',
  'bidi-streaming': '⇑⇓',
};

export interface GrpcMethodOption {
  /** Service full name (`library.v1.Library`). */
  service: string;
  /** Rpc name (`ListBooks`). */
  rpc: string;
  streaming: ProtoStreamingShape;
  /** Resolved request message full name; null when unresolved. */
  inputType: string | null;
}

export interface GrpcMethodGroup {
  /** Service full name — the selector's group header. */
  service: string;
  options: GrpcMethodOption[];
}

export interface GrpcParseFailure {
  path: string;
  message: string;
}

export interface GrpcMethodDerivation {
  registry: ProtoRegistry;
  groups: GrpcMethodGroup[];
  issues: readonly ProtoRegistryIssue[];
  parseFailures: GrpcParseFailure[];
}

/**
 * Derive the method selector's grouped options from a Protobuf spec.
 * Never throws: unparseable files land on `parseFailures`, unresolved
 * references on `issues` — the selector shows what it can.
 */
export function deriveGrpcMethods(spec: Spec): GrpcMethodDerivation {
  const files: ProtoSourceFile[] = [];
  const parseFailures: GrpcParseFailure[] = [];
  for (const file of spec.files) {
    try {
      files.push({ path: file.fileName, census: parseProto(file.content) });
    } catch (err) {
      parseFailures.push({ path: file.fileName, message: (err as Error).message });
    }
  }
  const registry = buildRegistry(files);
  const groups: GrpcMethodGroup[] = registry.services.map((service) => ({
    service: service.fullName,
    options: service.rpcs.map((rpc) => ({
      service: service.fullName,
      rpc: rpc.name,
      streaming: rpc.streaming,
      inputType: rpc.inputType,
    })),
  }));
  return { registry, groups, issues: registry.issues, parseFailures };
}

/** Find the derived option for a persisted method ref; null when the
 *  spec no longer declares it (drift renders as unresolved, not a crash). */
export function findMethodOption(
  derivation: GrpcMethodDerivation | null,
  method: { service: string; rpc: string } | undefined,
): GrpcMethodOption | null {
  if (!derivation || !method) return null;
  for (const group of derivation.groups) {
    if (group.service !== method.service) continue;
    for (const option of group.options) {
      if (option.rpc === method.rpc) return option;
    }
  }
  return null;
}

/**
 * The header selector doubles as the spec entry point while no spec is
 * linked: alongside method keys (`service/rpc`) it offers workspace
 * protobuf specs (`spec:<uid>`) and the import-a-.proto action. One
 * value vocabulary, routed here — service full names are proto
 * identifiers (dots, no colons), so the prefixes can't collide.
 */
export const GRPC_SPEC_LINK_VALUE_PREFIX = 'spec:';
export const GRPC_IMPORT_PROTO_VALUE = 'action:import-proto';

export type GrpcSelectAction =
  | { kind: 'method'; method: GrpcMethodRef }
  | { kind: 'link-spec'; specUid: string }
  | { kind: 'import-proto' };

/** Route a selector value to its action; null on a malformed value. */
export function parseGrpcSelectValue(value: string): GrpcSelectAction | null {
  if (value === GRPC_IMPORT_PROTO_VALUE) return { kind: 'import-proto' };
  if (value.startsWith(GRPC_SPEC_LINK_VALUE_PREFIX)) {
    const specUid = value.substring(GRPC_SPEC_LINK_VALUE_PREFIX.length);
    return specUid === '' ? null : { kind: 'link-spec', specUid };
  }
  const slash = value.lastIndexOf('/');
  if (slash <= 0 || slash === value.length - 1) return null;
  return { kind: 'method', method: { service: value.substring(0, slash), rpc: value.substring(slash + 1) } };
}

/**
 * "Use Example Message" — synthesize the selected rpc's input type
 * into pretty-printed canonical JSON. Null when the method or its
 * input type doesn't resolve against the registry.
 */
export function synthesizeExampleText(
  derivation: GrpcMethodDerivation | null,
  method: { service: string; rpc: string } | undefined,
): string | null {
  const option = findMethodOption(derivation, method);
  if (!derivation || !option?.inputType) return null;
  if (!derivation.registry.messages.has(option.inputType)) return null;
  const value = synthesizeExampleMessage(derivation.registry, option.inputType);
  return JSON.stringify(value, null, 2);
}
