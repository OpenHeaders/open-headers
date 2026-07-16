/**
 * Protobuf census types — the parsed shape of a `.proto` source file.
 *
 * The census is the spec plane's structural read of a Protobuf
 * document: package, imports, message/enum trees, and services with
 * their rpc entries. Every named node carries the character offset of
 * its declaration so outline surfaces can navigate the editor to it
 * (the OpenAPI outline's offset contract). The codec phase builds its
 * schema registry from these same nodes, so fields keep their full
 * declaration detail (label, type, map arms, oneof membership).
 */

/** The four gRPC call shapes, from the `stream` keywords on an rpc. */
export type ProtoStreamingShape = 'unary' | 'server-streaming' | 'client-streaming' | 'bidi-streaming';

/** Proto2 labels are read-tolerated; proto3 fields are `none` unless
 *  explicitly `optional` / `repeated`. */
export type ProtoFieldLabel = 'none' | 'optional' | 'repeated' | 'required';

export interface ProtoField {
  name: string;
  /** Field number as written. */
  number: number;
  label: ProtoFieldLabel;
  /** Scalar / message / enum type name as written (dotted for
   *  qualified references). For map fields this is the VALUE type. */
  type: string;
  /** Non-null marks a `map<key, value>` field; holds the key type. */
  mapKeyType: string | null;
  /** Name of the owning `oneof` group, null for plain fields. */
  oneofName: string | null;
  offset: number;
}

export interface ProtoOneof {
  name: string;
  offset: number;
}

export interface ProtoEnumValue {
  name: string;
  number: number;
  offset: number;
}

export interface ProtoEnum {
  name: string;
  /** Package-and-nesting-qualified name, e.g. `library.v1.Book.Genre`. */
  fullName: string;
  values: ProtoEnumValue[];
  offset: number;
}

export interface ProtoMessage {
  name: string;
  /** Package-and-nesting-qualified name, e.g. `library.v1.Book`. */
  fullName: string;
  fields: ProtoField[];
  oneofs: ProtoOneof[];
  messages: ProtoMessage[];
  enums: ProtoEnum[];
  offset: number;
}

export interface ProtoRpc {
  name: string;
  /** Request message type as written. */
  inputType: string;
  /** Response message type as written. */
  outputType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
  streaming: ProtoStreamingShape;
  offset: number;
}

export interface ProtoService {
  name: string;
  /** Package-qualified name, e.g. `library.v1.LibraryService`. */
  fullName: string;
  rpcs: ProtoRpc[];
  offset: number;
}

export interface ProtoImport {
  /** Import path as written, e.g. `google/protobuf/timestamp.proto`. */
  path: string;
  modifier: 'none' | 'public' | 'weak';
  offset: number;
}

/** Structural census of one `.proto` source file. */
export interface ProtoCensus {
  /** The `syntax` / `edition` declaration value (`proto3`, `proto2`,
   *  an edition year), or null when absent (proto2 per the spec). */
  syntax: string | null;
  packageName: string | null;
  /** Offset of the `package` declaration, null when absent. */
  packageOffset: number | null;
  imports: ProtoImport[];
  messages: ProtoMessage[];
  enums: ProtoEnum[];
  services: ProtoService[];
}

/** Structural parse failure — position formatted into the message. */
export class ProtoParseError extends Error {
  /** Character offset of the offending token. */
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.name = 'ProtoParseError';
    this.offset = offset;
  }
}
