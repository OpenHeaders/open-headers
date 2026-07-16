/**
 * Protobuf plane — the hand-rolled `.proto` toolchain behind the gRPC
 * client: census parsing, the schema registry resolved from a spec's
 * file set, the JSON ⇄ wire codec, and example-message synthesis.
 * Import via `@openheaders/core/proto`.
 */

export {
  decodeMessage,
  encodeMessage,
  PROTO_UNKNOWN_FIELDS_KEY,
  PROTO_WELL_KNOWN_JSON,
  type ProtoJsonValue,
} from './codec';
export { synthesizeExampleMessage } from './example';
export {
  decodeGrpcMessage,
  encodeGrpcTimeout,
  extractGrpcStatus,
  GRPC_STATUS_NAMES,
  type GrpcCallStatus,
  type GrpcMetadataField,
  type GrpcWireFrame,
  grpcStatusLabel,
  readGrpcFrames,
  writeGrpcFrame,
} from './grpc-wire';
export { parseProto } from './parse';
export {
  buildRegistry,
  isProtoMapKeyType,
  isProtoScalarType,
  jsonNameOf,
  type ProtoMapKeyType,
  type ProtoRegistry,
  type ProtoRegistryIssue,
  type ProtoRegistryIssueKind,
  type ProtoScalarType,
  type ProtoSourceFile,
  type RegistryEnum,
  type RegistryField,
  type RegistryFieldType,
  type RegistryMessage,
  type RegistryRpc,
  type RegistryService,
} from './registry';
export {
  type ProtoCensus,
  type ProtoEnum,
  type ProtoEnumValue,
  type ProtoField,
  type ProtoFieldLabel,
  type ProtoImport,
  type ProtoMessage,
  type ProtoOneof,
  ProtoParseError,
  type ProtoRpc,
  type ProtoService,
  type ProtoStreamingShape,
} from './types';
export { ProtoCodecError } from './wire';
