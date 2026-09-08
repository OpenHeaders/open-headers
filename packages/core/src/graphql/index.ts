/**
 * GraphQL plane — the hand-rolled grammar behind the GraphQL client:
 * lexer, parser (executable + type-system documents), printer, the
 * schema model with its introspection / SDL bridges, operation
 * census, the validation subset, the completion model, example
 * variables, the compile into the HTTP request the executor runs, and
 * the subscriptions half over `graphql-transport-ws`.
 * Pure functions, zero platform deps. Import via
 * `@openheaders/core/graphql`.
 */

export {
  applyBuilderEdits,
  argumentAt,
  type BuilderContext,
  type BuilderEdit,
  type BuilderFragmentRow,
  type BuilderNode,
  type BuilderPath,
  type BuilderStep,
  deselectFieldEdits,
  fieldAt,
  firstLeafSelection,
  fragmentsAt,
  type InputFieldPath,
  inputFieldAt,
  inputFieldsAlong,
  isBuilderBroken,
  nodeAt,
  type OperationNaming,
  type OperationTarget,
  operationForType,
  operationTargetName,
  removeArgumentEdits,
  removeInputFieldEdits,
  type SchemaStep,
  schemaStepsAlong,
  selectFieldEdits,
  selectionSetAt,
  setArgumentEdits,
  setInputFieldEdits,
} from './builder';
export {
  type CensusFragment,
  type CensusOperation,
  type CensusVariable,
  censusDocument,
  type DocumentCensus,
  selectedOperation,
  wireOperationName,
} from './census';
export {
  type CompileOptions,
  compileGraphqlRequest,
  type GraphqlRequestLike,
  type GraphqlRequestSettings,
  type HttpSettingKey,
  toHttpRequest,
} from './compile';
export { type CompletionItem, type CompletionKind, type CompletionResult, completionsAt } from './complete';
export {
  type ConvertNote,
  fromHttpRequest,
  type GraphqlRequestContent,
  type HttpRequestLike,
  type HttpToGraphqlResult,
  isConvertibleToGraphql,
} from './convert';
export { exampleForType, exampleVariables, type JsonValue, valueToJson } from './example';
export { type HoverSymbol, symbolAt } from './hover';
export {
  dedentBlockString,
  Lexer,
  type LexResult,
  type LinePosition,
  positionAt,
  type Token,
  type TokenKind,
  tokenize,
} from './lexer';
export { type ParseResult, type ParseValueResult, parseDocument, parseValue } from './parse';
export { type PrintOptions, printBlockString, printCompact, printNode, printString } from './print';
export {
  BUILT_IN_SCALARS,
  fieldsOf,
  type GraphqlDirective,
  type GraphqlEnumType,
  type GraphqlEnumValue,
  type GraphqlField,
  type GraphqlInputObjectType,
  type GraphqlInputValue,
  type GraphqlInterfaceType,
  type GraphqlNamedType,
  type GraphqlObjectType,
  type GraphqlScalarType,
  type GraphqlSchema,
  type GraphqlTypeKind,
  type GraphqlTypeRef,
  type GraphqlUnionType,
  INTROSPECTION_PROBE_QUERY,
  INTROSPECTION_QUERY,
  type IntrospectionDirective,
  type IntrospectionEnumValue,
  type IntrospectionField,
  type IntrospectionInputValue,
  type IntrospectionResult,
  type IntrospectionType,
  type IntrospectionTypeRef,
  isBuiltInDirective,
  isBuiltInScalar,
  isCompositeType,
  isInputType,
  isIntrospectionName,
  isLeafType,
  isNonNullRef,
  namedTypeOf,
  possibleTypesOf,
  printTypeRef,
  rootTypeName,
  type SchemaResult,
  schemaFromDocument,
  schemaFromIntrospection,
  schemaFromSdl,
  schemaToIntrospection,
  schemaToSdl,
  typeRefOf,
} from './schema';
export {
  compileGraphqlSubscription,
  decodeGraphqlWsClientMessage,
  decodeGraphqlWsServerMessage,
  encodeGraphqlWsMessage,
  GRAPHQL_WS_INITIAL_STATE,
  GRAPHQL_WS_SUBPROTOCOL,
  GRAPHQL_WS_SUBSCRIPTION_ID,
  type GraphqlSubscriptionCompile,
  type GraphqlWsCapturedFrame,
  type GraphqlWsClientEffect,
  type GraphqlWsClientInput,
  type GraphqlWsClientMessage,
  type GraphqlWsClientState,
  type GraphqlWsClientStep,
  type GraphqlWsCloseMeaning,
  type GraphqlWsExecutionResult,
  type GraphqlWsPhase,
  type GraphqlWsServerMessage,
  type GraphqlWsSubscribePayload,
  type GraphqlWsSubscriptionPlan,
  graphqlWsCloseMeaning,
  graphqlWsSubscribePayload,
  reduceGraphqlWsClient,
  replayGraphqlWsCapture,
  subscriptionUrlOf,
} from './subscription';
export { operationNameFor, type SynthesizedOperation, type SynthesizeOptions, synthesizeOperation } from './synthesize';
export * from './types';
export { type GraphqlDiagnostic, type ValidationRule, validateDocument } from './validate';
export { type VariablesDiagnostic, validateVariables } from './variables';
