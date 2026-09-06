/**
 * GraphQL plane — the hand-rolled grammar behind the GraphQL client:
 * lexer, parser (executable + type-system documents), printer, the
 * schema model with its introspection / SDL bridges, operation
 * census, the validation subset, the completion model, example
 * variables, and the compile into the HTTP request the executor runs.
 * Pure functions, zero platform deps. Import via
 * `@openheaders/core/graphql`.
 */

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
export { type ParseResult, parseDocument } from './parse';
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
export { operationNameFor, type SynthesizedOperation, type SynthesizeOptions, synthesizeOperation } from './synthesize';
export * from './types';
export { type GraphqlDiagnostic, type ValidationRule, validateDocument } from './validate';
export { type VariablesDiagnostic, validateVariables } from './variables';
