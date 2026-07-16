/**
 * Protobuf plane — the hand-rolled `.proto` toolchain behind the gRPC
 * client: census parsing now, the schema registry and JSON ⇄ wire
 * codec in later phases. Import via `@openheaders/core/proto`.
 */

export { parseProto } from './parse';
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
