/**
 * GraphQL schema MODEL — the type system as data, shared by the
 * validator, the completion model, the docs explorer, example
 * synthesis and the playground probe. Four bridges in and out:
 *
 *   introspection JSON  ──fromIntrospection──▶  model  ──toIntrospection──▶  introspection JSON
 *   SDL source          ──fromSdl───────────▶  model  ──toSdl───────────▶  SDL source
 *
 * Built-in scalars, the introspection types and the built-in
 * directives are part of every model (a real server's introspection
 * lists them), and `toSdl` omits them the way every printer does.
 * Building REPORTS problems (duplicate names, an extension of nothing,
 * a schema-definition operation type that is not an object) and never
 * throws; references to unknown types stay as names — the validator
 * reports them where they are used.
 */

import { parseDocument } from './parse';
import { printNode, printString } from './print';
import type {
  ConstValueNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  GraphqlError,
  InputValueDefinitionNode,
  NamedTypeNode,
  NameNode,
  OperationType,
  StringValueNode,
  TypeNode,
} from './types';

// ── Model ──────────────────────────────────────────────────────────

export type GraphqlTypeRef =
  | { readonly kind: 'NAMED'; readonly name: string }
  | { readonly kind: 'LIST'; readonly ofType: GraphqlTypeRef }
  | { readonly kind: 'NON_NULL'; readonly ofType: GraphqlTypeRef };

export interface GraphqlInputValue {
  readonly name: string;
  readonly description: string | null;
  readonly type: GraphqlTypeRef;
  /** The default as GraphQL literal text (introspection's form), or null. */
  readonly defaultValue: string | null;
  readonly deprecationReason: string | null;
}

export interface GraphqlField {
  readonly name: string;
  readonly description: string | null;
  readonly args: readonly GraphqlInputValue[];
  readonly type: GraphqlTypeRef;
  readonly deprecationReason: string | null;
}

export interface GraphqlEnumValue {
  readonly name: string;
  readonly description: string | null;
  readonly deprecationReason: string | null;
}

export interface GraphqlScalarType {
  readonly kind: 'SCALAR';
  readonly name: string;
  readonly description: string | null;
  readonly specifiedByUrl: string | null;
}

export interface GraphqlObjectType {
  readonly kind: 'OBJECT';
  readonly name: string;
  readonly description: string | null;
  readonly fields: readonly GraphqlField[];
  readonly interfaces: readonly string[];
}

export interface GraphqlInterfaceType {
  readonly kind: 'INTERFACE';
  readonly name: string;
  readonly description: string | null;
  readonly fields: readonly GraphqlField[];
  readonly interfaces: readonly string[];
  /** Object and interface types implementing it. */
  readonly possibleTypes: readonly string[];
}

export interface GraphqlUnionType {
  readonly kind: 'UNION';
  readonly name: string;
  readonly description: string | null;
  readonly possibleTypes: readonly string[];
}

export interface GraphqlEnumType {
  readonly kind: 'ENUM';
  readonly name: string;
  readonly description: string | null;
  readonly values: readonly GraphqlEnumValue[];
}

export interface GraphqlInputObjectType {
  readonly kind: 'INPUT_OBJECT';
  readonly name: string;
  readonly description: string | null;
  readonly inputFields: readonly GraphqlInputValue[];
  readonly oneOf: boolean;
}

export type GraphqlNamedType =
  | GraphqlScalarType
  | GraphqlObjectType
  | GraphqlInterfaceType
  | GraphqlUnionType
  | GraphqlEnumType
  | GraphqlInputObjectType;

export type GraphqlTypeKind = GraphqlNamedType['kind'];

export interface GraphqlDirective {
  readonly name: string;
  readonly description: string | null;
  readonly locations: readonly string[];
  readonly args: readonly GraphqlInputValue[];
  readonly isRepeatable: boolean;
}

export interface GraphqlSchema {
  readonly description: string | null;
  readonly queryType: string | null;
  readonly mutationType: string | null;
  readonly subscriptionType: string | null;
  /** Declaration order; built-ins included. */
  readonly types: ReadonlyMap<string, GraphqlNamedType>;
  readonly directives: readonly GraphqlDirective[];
}

export interface SchemaResult {
  readonly schema: GraphqlSchema | null;
  readonly errors: readonly GraphqlError[];
}

// ── Built-ins ──────────────────────────────────────────────────────

export const BUILT_IN_SCALARS = ['Int', 'Float', 'String', 'Boolean', 'ID'] as const;

const BUILT_IN_SCALAR_SET: ReadonlySet<string> = new Set(BUILT_IN_SCALARS);

export function isBuiltInScalar(name: string): boolean {
  return BUILT_IN_SCALAR_SET.has(name);
}

/** `__Schema`, `__Type`, … — the introspection types and meta fields. */
export function isIntrospectionName(name: string): boolean {
  return name.startsWith('__');
}

const BUILT_IN_DIRECTIVE_NAMES: ReadonlySet<string> = new Set([
  'include',
  'skip',
  'deprecated',
  'specifiedBy',
  'oneOf',
]);

export function isBuiltInDirective(name: string): boolean {
  return BUILT_IN_DIRECTIVE_NAMES.has(name);
}

const BUILT_IN_SDL = `
"""The \`Int\` scalar type represents non-fractional signed whole numeric values."""
scalar Int

"""The \`Float\` scalar type represents signed double-precision fractional values."""
scalar Float

"""The \`String\` scalar type represents textual data, represented as UTF-8 character sequences."""
scalar String

"""The \`Boolean\` scalar type represents \`true\` or \`false\`."""
scalar Boolean

"""The \`ID\` scalar type represents a unique identifier, serialized as a string."""
scalar ID

"""Directs the executor to include this field or fragment only when the \`if\` argument is true."""
directive @include("Included when true." if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

"""Directs the executor to skip this field or fragment when the \`if\` argument is true."""
directive @skip("Skipped when true." if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

"""Marks an element of a GraphQL schema as no longer supported."""
directive @deprecated(
  """Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data."""
  reason: String = "No longer supported"
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE

"""Exposes a URL that specifies the behavior of this scalar."""
directive @specifiedBy("The URL that specifies the behavior of this scalar." url: String!) on SCALAR

"""Indicates exactly one field must be supplied and this field must not be \`null\`."""
directive @oneOf on INPUT_OBJECT

"""A GraphQL Schema defines the capabilities of a GraphQL server."""
type __Schema {
  description: String
  """A list of all types supported by this server."""
  types: [__Type!]!
  """The type that query operations will be rooted at."""
  queryType: __Type!
  """If this server supports mutation, the type that mutation operations will be rooted at."""
  mutationType: __Type
  """If this server support subscription, the type that subscription operations will be rooted at."""
  subscriptionType: __Type
  """A list of all directives supported by this server."""
  directives: [__Directive!]!
}

"""The fundamental unit of any GraphQL Schema is the type."""
type __Type {
  kind: __TypeKind!
  name: String
  description: String
  specifiedByURL: String
  fields(includeDeprecated: Boolean = false): [__Field!]
  interfaces: [__Type!]
  possibleTypes: [__Type!]
  enumValues(includeDeprecated: Boolean = false): [__EnumValue!]
  inputFields(includeDeprecated: Boolean = false): [__InputValue!]
  ofType: __Type
  isOneOf: Boolean
}

"""An enum describing what kind of type a given \`__Type\` is."""
enum __TypeKind {
  SCALAR
  OBJECT
  INTERFACE
  UNION
  ENUM
  INPUT_OBJECT
  LIST
  NON_NULL
}

"""Object and Interface types are described by a list of Fields."""
type __Field {
  name: String!
  description: String
  args(includeDeprecated: Boolean = false): [__InputValue!]!
  type: __Type!
  isDeprecated: Boolean!
  deprecationReason: String
}

"""Arguments provided to Fields or Directives and the input fields of an InputObject."""
type __InputValue {
  name: String!
  description: String
  type: __Type!
  """A GraphQL-formatted string representing the default value for this input value."""
  defaultValue: String
  isDeprecated: Boolean!
  deprecationReason: String
}

"""One possible value for a given Enum."""
type __EnumValue {
  name: String!
  description: String
  isDeprecated: Boolean!
  deprecationReason: String
}

"""A Directive provides a way to describe alternate runtime execution and type validation behavior."""
type __Directive {
  name: String!
  description: String
  isRepeatable: Boolean!
  locations: [__DirectiveLocation!]!
  args(includeDeprecated: Boolean = false): [__InputValue!]!
}

"""A Directive can be adjacent to many parts of the GraphQL language."""
enum __DirectiveLocation {
  QUERY
  MUTATION
  SUBSCRIPTION
  FIELD
  FRAGMENT_DEFINITION
  FRAGMENT_SPREAD
  INLINE_FRAGMENT
  VARIABLE_DEFINITION
  SCHEMA
  SCALAR
  OBJECT
  FIELD_DEFINITION
  ARGUMENT_DEFINITION
  INTERFACE
  UNION
  ENUM
  ENUM_VALUE
  INPUT_OBJECT
  INPUT_FIELD_DEFINITION
}
`;

/** The standard introspection query — descriptions, deprecations
 *  (arguments and input fields included), `specifiedByURL`,
 *  `isRepeatable`, `isOneOf`; nine levels of `ofType`. */
export const INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    description
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives {
      name
      description
      isRepeatable
      locations
      args(includeDeprecated: true) { ...InputValue }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  specifiedByURL
  isOneOf
  fields(includeDeprecated: true) {
    name
    description
    args(includeDeprecated: true) { ...InputValue }
    type { ...TypeRef }
    isDeprecated
    deprecationReason
  }
  inputFields(includeDeprecated: true) { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes { ...TypeRef }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
  isDeprecated
  deprecationReason
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType { kind name }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

/** A minimal introspection query — the operation-type names only —
 *  for a fast "is this a GraphQL endpoint" probe. */
export const INTROSPECTION_PROBE_QUERY = '{ __schema { queryType { name } } }';

// ── Type-reference helpers ─────────────────────────────────────────

/** The named type at the bottom of a list / non-null wrapping. */
export function namedTypeOf(type: GraphqlTypeRef): string {
  let current = type;
  while (current.kind !== 'NAMED') current = current.ofType;
  return current.name;
}

/** `[String!]!` — the reference as SDL text. */
export function printTypeRef(type: GraphqlTypeRef): string {
  switch (type.kind) {
    case 'NAMED':
      return type.name;
    case 'LIST':
      return `[${printTypeRef(type.ofType)}]`;
    case 'NON_NULL':
      return `${printTypeRef(type.ofType)}!`;
  }
}

export function isNonNullRef(type: GraphqlTypeRef): boolean {
  return type.kind === 'NON_NULL';
}

/** Type-node → reference. */
export function typeRefOf(node: TypeNode): GraphqlTypeRef {
  switch (node.kind) {
    case 'NamedType':
      return { kind: 'NAMED', name: node.name.value };
    case 'ListType':
      return { kind: 'LIST', ofType: typeRefOf(node.type) };
    case 'NonNullType':
      return { kind: 'NON_NULL', ofType: typeRefOf(node.type) };
  }
}

export function isCompositeType(
  type: GraphqlNamedType,
): type is GraphqlObjectType | GraphqlInterfaceType | GraphqlUnionType {
  return type.kind === 'OBJECT' || type.kind === 'INTERFACE' || type.kind === 'UNION';
}

export function isLeafType(type: GraphqlNamedType): type is GraphqlScalarType | GraphqlEnumType {
  return type.kind === 'SCALAR' || type.kind === 'ENUM';
}

export function isInputType(
  type: GraphqlNamedType,
): type is GraphqlScalarType | GraphqlEnumType | GraphqlInputObjectType {
  return type.kind === 'SCALAR' || type.kind === 'ENUM' || type.kind === 'INPUT_OBJECT';
}

/** The fields selectable on an object or interface type; empty otherwise. */
export function fieldsOf(type: GraphqlNamedType | undefined): readonly GraphqlField[] {
  return type !== undefined && (type.kind === 'OBJECT' || type.kind === 'INTERFACE') ? type.fields : [];
}

export function rootTypeName(schema: GraphqlSchema, operation: OperationType): string | null {
  switch (operation) {
    case 'query':
      return schema.queryType;
    case 'mutation':
      return schema.mutationType;
    case 'subscription':
      return schema.subscriptionType;
  }
}

/** The object types a composite type can resolve to. */
export function possibleTypesOf(schema: GraphqlSchema, type: GraphqlNamedType): readonly string[] {
  if (type.kind === 'OBJECT') return [type.name];
  if (type.kind === 'INTERFACE' || type.kind === 'UNION') {
    return type.possibleTypes.filter((name) => schema.types.get(name)?.kind === 'OBJECT');
  }
  return [];
}

// ── SDL → model ────────────────────────────────────────────────────

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Draft {
  description: string | null;
  operationTypes: Partial<Record<OperationType, string>>;
  types: Map<string, Mutable<GraphqlNamedType>>;
  directives: GraphqlDirective[];
  errors: GraphqlError[];
}

function textOf(node: StringValueNode | null): string | null {
  return node === null ? null : node.value;
}

function deprecationOf(directives: readonly DirectiveNode[]): string | null {
  const directive = directives.find((entry) => entry.name.value === 'deprecated');
  if (directive === undefined) return null;
  const reason = directive.arguments.find((arg) => arg.name.value === 'reason');
  if (reason === undefined) return 'No longer supported';
  return reason.value.kind === 'StringValue' ? reason.value.value : 'No longer supported';
}

function specifiedByOf(directives: readonly DirectiveNode[]): string | null {
  const directive = directives.find((entry) => entry.name.value === 'specifiedBy');
  const url = directive?.arguments.find((arg) => arg.name.value === 'url');
  return url !== undefined && url.value.kind === 'StringValue' ? url.value.value : null;
}

function defaultTextOf(node: ConstValueNode | null): string | null {
  return node === null ? null : printNode(node, { pretty: false });
}

function inputValueOf(node: InputValueDefinitionNode): GraphqlInputValue {
  return {
    name: node.name.value,
    description: textOf(node.description),
    type: typeRefOf(node.type),
    defaultValue: defaultTextOf(node.defaultValue),
    deprecationReason: deprecationOf(node.directives),
  };
}

function fieldOf(node: FieldDefinitionNode): GraphqlField {
  return {
    name: node.name.value,
    description: textOf(node.description),
    args: node.arguments.map(inputValueOf),
    type: typeRefOf(node.type),
    deprecationReason: deprecationOf(node.directives),
  };
}

function enumValueOf(node: EnumValueDefinitionNode): GraphqlEnumValue {
  return {
    name: node.name.value,
    description: textOf(node.description),
    deprecationReason: deprecationOf(node.directives),
  };
}

function names(nodes: readonly NamedTypeNode[]): string[] {
  return nodes.map((node) => node.name.value);
}

function directiveOf(node: DirectiveDefinitionNode): GraphqlDirective {
  return {
    name: node.name.value,
    description: textOf(node.description),
    locations: node.locations.map((location) => location.value),
    args: node.arguments.map(inputValueOf),
    isRepeatable: node.repeatable,
  };
}

function defineType(draft: Draft, name: NameNode, type: Mutable<GraphqlNamedType>): void {
  if (draft.types.has(name.value)) {
    draft.errors.push({
      message: `Type \`${name.value}\` is defined more than once.`,
      start: name.start,
      end: name.end,
    });
    return;
  }
  draft.types.set(name.value, type);
}

function extendType(
  draft: Draft,
  name: NameNode,
  kind: GraphqlTypeKind,
  label: string,
): Mutable<GraphqlNamedType> | null {
  const existing = draft.types.get(name.value);
  if (existing === undefined) {
    draft.errors.push({
      message: `Cannot extend ${label} \`${name.value}\` — it is not defined.`,
      start: name.start,
      end: name.end,
    });
    return null;
  }
  if (existing.kind !== kind) {
    draft.errors.push({
      message: `Cannot extend \`${name.value}\` as ${label} — it is not one.`,
      start: name.start,
      end: name.end,
    });
    return null;
  }
  return existing;
}

function applyDefinition(draft: Draft, node: DefinitionNode): void {
  switch (node.kind) {
    case 'SchemaDefinition':
      draft.description = textOf(node.description);
      for (const entry of node.operationTypes) draft.operationTypes[entry.operation] = entry.type.name.value;
      return;
    case 'SchemaExtension':
      for (const entry of node.operationTypes) draft.operationTypes[entry.operation] = entry.type.name.value;
      return;
    case 'ScalarTypeDefinition':
      defineType(draft, node.name, {
        kind: 'SCALAR',
        name: node.name.value,
        description: textOf(node.description),
        specifiedByUrl: specifiedByOf(node.directives),
      });
      return;
    case 'ObjectTypeDefinition':
      defineType(draft, node.name, {
        kind: 'OBJECT',
        name: node.name.value,
        description: textOf(node.description),
        fields: node.fields.map(fieldOf),
        interfaces: names(node.interfaces),
      });
      return;
    case 'InterfaceTypeDefinition':
      defineType(draft, node.name, {
        kind: 'INTERFACE',
        name: node.name.value,
        description: textOf(node.description),
        fields: node.fields.map(fieldOf),
        interfaces: names(node.interfaces),
        possibleTypes: [],
      });
      return;
    case 'UnionTypeDefinition':
      defineType(draft, node.name, {
        kind: 'UNION',
        name: node.name.value,
        description: textOf(node.description),
        possibleTypes: names(node.types),
      });
      return;
    case 'EnumTypeDefinition':
      defineType(draft, node.name, {
        kind: 'ENUM',
        name: node.name.value,
        description: textOf(node.description),
        values: node.values.map(enumValueOf),
      });
      return;
    case 'InputObjectTypeDefinition':
      defineType(draft, node.name, {
        kind: 'INPUT_OBJECT',
        name: node.name.value,
        description: textOf(node.description),
        inputFields: node.fields.map(inputValueOf),
        oneOf: node.directives.some((directive) => directive.name.value === 'oneOf'),
      });
      return;
    case 'DirectiveDefinition':
      if (draft.directives.some((directive) => directive.name === node.name.value)) {
        draft.errors.push({
          message: `Directive \`@${node.name.value}\` is defined more than once.`,
          start: node.name.start,
          end: node.name.end,
        });
        return;
      }
      draft.directives.push(directiveOf(node));
      return;
    case 'ScalarTypeExtension': {
      const target = extendType(draft, node.name, 'SCALAR', 'scalar');
      if (target !== null && target.kind === 'SCALAR') {
        target.specifiedByUrl = specifiedByOf(node.directives) ?? target.specifiedByUrl;
      }
      return;
    }
    case 'ObjectTypeExtension': {
      const target = extendType(draft, node.name, 'OBJECT', 'type');
      if (target !== null && target.kind === 'OBJECT') {
        target.fields = [...target.fields, ...node.fields.map(fieldOf)];
        target.interfaces = [...target.interfaces, ...names(node.interfaces)];
      }
      return;
    }
    case 'InterfaceTypeExtension': {
      const target = extendType(draft, node.name, 'INTERFACE', 'interface');
      if (target !== null && target.kind === 'INTERFACE') {
        target.fields = [...target.fields, ...node.fields.map(fieldOf)];
        target.interfaces = [...target.interfaces, ...names(node.interfaces)];
      }
      return;
    }
    case 'UnionTypeExtension': {
      const target = extendType(draft, node.name, 'UNION', 'union');
      if (target !== null && target.kind === 'UNION') {
        target.possibleTypes = [...target.possibleTypes, ...names(node.types)];
      }
      return;
    }
    case 'EnumTypeExtension': {
      const target = extendType(draft, node.name, 'ENUM', 'enum');
      if (target !== null && target.kind === 'ENUM')
        target.values = [...target.values, ...node.values.map(enumValueOf)];
      return;
    }
    case 'InputObjectTypeExtension': {
      const target = extendType(draft, node.name, 'INPUT_OBJECT', 'input');
      if (target !== null && target.kind === 'INPUT_OBJECT') {
        target.inputFields = [...target.inputFields, ...node.fields.map(inputValueOf)];
        target.oneOf = target.oneOf || node.directives.some((directive) => directive.name.value === 'oneOf');
      }
      return;
    }
    case 'OperationDefinition':
    case 'FragmentDefinition':
      draft.errors.push({
        message: 'An executable definition cannot appear in a schema document.',
        start: node.start,
        end: node.end,
      });
      return;
  }
}

let builtInDocument: DocumentNode | null = null;

function builtIns(): DocumentNode {
  if (builtInDocument === null) {
    const parsed = parseDocument(BUILT_IN_SDL);
    if (parsed.document === null) throw new Error('The built-in GraphQL SDL failed to parse.');
    builtInDocument = parsed.document;
  }
  return builtInDocument;
}

function finish(draft: Draft): GraphqlSchema {
  // Interfaces learn their implementers; unions keep their declared members.
  for (const type of draft.types.values()) {
    if (type.kind !== 'OBJECT' && type.kind !== 'INTERFACE') continue;
    for (const interfaceName of type.interfaces) {
      const target = draft.types.get(interfaceName);
      if (target !== undefined && target.kind === 'INTERFACE' && !target.possibleTypes.includes(type.name)) {
        target.possibleTypes = [...target.possibleTypes, type.name];
      }
    }
  }
  const rootOf = (operation: OperationType, conventional: string): string | null => {
    const declared = draft.operationTypes[operation];
    if (declared !== undefined) return declared;
    return draft.types.get(conventional)?.kind === 'OBJECT' ? conventional : null;
  };
  return {
    description: draft.description,
    queryType: rootOf('query', 'Query'),
    mutationType: rootOf('mutation', 'Mutation'),
    subscriptionType: rootOf('subscription', 'Subscription'),
    types: draft.types,
    directives: draft.directives,
  };
}

/** Build the model from a parsed SDL document. Never throws. */
export function schemaFromDocument(document: DocumentNode): SchemaResult {
  const draft: Draft = { description: null, operationTypes: {}, types: new Map(), directives: [], errors: [] };
  const userDefined = new Set<string>();
  for (const node of document.definitions) {
    if ('name' in node && node.kind !== 'OperationDefinition' && node.kind !== 'FragmentDefinition') {
      if (node.kind === 'DirectiveDefinition') userDefined.add(`@${node.name.value}`);
      else if (!node.kind.endsWith('Extension')) userDefined.add(node.name.value);
    }
  }
  // Built-ins first so extensions of them resolve; a user definition of
  // a built-in scalar / directive wins over the bundled one.
  for (const node of builtIns().definitions) {
    if (node.kind === 'DirectiveDefinition' && userDefined.has(`@${node.name.value}`)) continue;
    if (node.kind === 'ScalarTypeDefinition' && userDefined.has(node.name.value)) continue;
    applyDefinition(draft, node);
  }
  for (const node of document.definitions) applyDefinition(draft, node);
  const schema = finish(draft);
  return { schema, errors: draft.errors };
}

/** Parse SDL source and build the model. A syntax error yields a null
 *  schema; build problems yield a schema plus errors. */
export function schemaFromSdl(source: string): SchemaResult {
  const parsed = parseDocument(source);
  if (parsed.document === null) return { schema: null, errors: parsed.errors };
  return schemaFromDocument(parsed.document);
}

// ── Model → SDL ────────────────────────────────────────────────────

function sdlDescription(description: string | null, indent: string): string {
  if (description === null) return '';
  const escaped = description.replace(/"""/g, '\\"""');
  if (!escaped.includes('\n') && escaped.length <= 70 && !escaped.endsWith('"') && !escaped.endsWith('\\')) {
    return `${indent}"""${escaped}"""\n`;
  }
  const lines = escaped.split('\n').map((line) => (line.length === 0 ? '' : `${indent}${line}`));
  return `${indent}"""\n${lines.join('\n')}\n${indent}"""\n`;
}

function sdlDeprecation(reason: string | null): string {
  if (reason === null) return '';
  return reason === 'No longer supported' ? ' @deprecated' : ` @deprecated(reason: ${printString(reason)})`;
}

function sdlInputValue(value: GraphqlInputValue, indent: string): string {
  const defaultValue = value.defaultValue === null ? '' : ` = ${value.defaultValue}`;
  return `${sdlDescription(value.description, indent)}${indent}${value.name}: ${printTypeRef(value.type)}${defaultValue}${sdlDeprecation(value.deprecationReason)}`;
}

function sdlArguments(args: readonly GraphqlInputValue[]): string {
  if (args.length === 0) return '';
  if (args.some((arg) => arg.description !== null)) {
    return `(\n${args.map((arg) => sdlInputValue(arg, '    ')).join('\n')}\n  )`;
  }
  return `(${args.map((arg) => sdlInputValue(arg, '')).join(', ')})`;
}

function sdlFields(fields: readonly GraphqlField[]): string {
  if (fields.length === 0) return '';
  const body = fields
    .map(
      (field) =>
        `${sdlDescription(field.description, '  ')}  ${field.name}${sdlArguments(field.args)}: ${printTypeRef(field.type)}${sdlDeprecation(field.deprecationReason)}`,
    )
    .join('\n');
  return ` {\n${body}\n}`;
}

function sdlImplements(interfaces: readonly string[]): string {
  return interfaces.length === 0 ? '' : ` implements ${interfaces.join(' & ')}`;
}

function sdlType(type: GraphqlNamedType): string {
  const description = sdlDescription(type.description, '');
  switch (type.kind) {
    case 'SCALAR':
      return `${description}scalar ${type.name}${type.specifiedByUrl === null ? '' : ` @specifiedBy(url: ${printString(type.specifiedByUrl)})`}`;
    case 'OBJECT':
      return `${description}type ${type.name}${sdlImplements(type.interfaces)}${sdlFields(type.fields)}`;
    case 'INTERFACE':
      return `${description}interface ${type.name}${sdlImplements(type.interfaces)}${sdlFields(type.fields)}`;
    case 'UNION':
      return `${description}union ${type.name}${type.possibleTypes.length === 0 ? '' : ` = ${type.possibleTypes.join(' | ')}`}`;
    case 'ENUM': {
      const values = type.values
        .map(
          (value) =>
            `${sdlDescription(value.description, '  ')}  ${value.name}${sdlDeprecation(value.deprecationReason)}`,
        )
        .join('\n');
      return `${description}enum ${type.name}${type.values.length === 0 ? '' : ` {\n${values}\n}`}`;
    }
    case 'INPUT_OBJECT': {
      const fields = type.inputFields.map((field) => sdlInputValue(field, '  ')).join('\n');
      const oneOf = type.oneOf ? ' @oneOf' : '';
      return `${description}input ${type.name}${oneOf}${type.inputFields.length === 0 ? '' : ` {\n${fields}\n}`}`;
    }
  }
}

function sdlDirective(directive: GraphqlDirective): string {
  const repeatable = directive.isRepeatable ? ' repeatable' : '';
  return `${sdlDescription(directive.description, '')}directive @${directive.name}${sdlArguments(directive.args)}${repeatable} on ${directive.locations.join(' | ')}`;
}

function sdlSchemaDefinition(schema: GraphqlSchema): string | null {
  const conventional =
    (schema.queryType === null || schema.queryType === 'Query') &&
    (schema.mutationType === null || schema.mutationType === 'Mutation') &&
    (schema.subscriptionType === null || schema.subscriptionType === 'Subscription');
  if (conventional && schema.description === null) return null;
  const entries: string[] = [];
  if (schema.queryType !== null) entries.push(`  query: ${schema.queryType}`);
  if (schema.mutationType !== null) entries.push(`  mutation: ${schema.mutationType}`);
  if (schema.subscriptionType !== null) entries.push(`  subscription: ${schema.subscriptionType}`);
  return `${sdlDescription(schema.description, '')}schema {\n${entries.join('\n')}\n}`;
}

/** The model as SDL — built-in scalars, introspection types and
 *  built-in directives omitted (they are implied). */
export function schemaToSdl(schema: GraphqlSchema): string {
  const blocks: string[] = [];
  const definition = sdlSchemaDefinition(schema);
  if (definition !== null) blocks.push(definition);
  for (const directive of schema.directives) {
    if (!isBuiltInDirective(directive.name)) blocks.push(sdlDirective(directive));
  }
  for (const type of schema.types.values()) {
    if (isBuiltInScalar(type.name) || isIntrospectionName(type.name)) continue;
    blocks.push(sdlType(type));
  }
  return `${blocks.join('\n\n')}\n`;
}

// ── Introspection JSON ↔ model ─────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readTypeRef(value: unknown): GraphqlTypeRef | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  if (value.kind === 'LIST' || value.kind === 'NON_NULL') {
    const inner = readTypeRef(value.ofType);
    return inner === null ? null : { kind: value.kind, ofType: inner };
  }
  return typeof value.name === 'string' ? { kind: 'NAMED', name: value.name } : null;
}

class IntrospectionReader {
  readonly errors: GraphqlError[] = [];

  fail(message: string): null {
    this.errors.push({ message, start: 0, end: 0 });
    return null;
  }

  typeRef(value: unknown, where: string): GraphqlTypeRef | null {
    const ref = readTypeRef(value);
    return ref ?? this.fail(`Introspection: malformed type reference on ${where}.`);
  }

  inputValues(value: unknown, where: string): GraphqlInputValue[] | null {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) return this.fail(`Introspection: ${where} is not a list.`);
    const out: GraphqlInputValue[] = [];
    for (const entry of value) {
      if (!isRecord(entry) || typeof entry.name !== 'string')
        return this.fail(`Introspection: malformed input value on ${where}.`);
      const type = this.typeRef(entry.type, `${where}.${entry.name}`);
      if (type === null) return null;
      out.push({
        name: entry.name,
        description: optionalString(entry.description),
        type,
        defaultValue: optionalString(entry.defaultValue),
        deprecationReason:
          entry.isDeprecated === true ? (optionalString(entry.deprecationReason) ?? 'No longer supported') : null,
      });
    }
    return out;
  }

  fields(value: unknown, where: string): GraphqlField[] | null {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) return this.fail(`Introspection: ${where}.fields is not a list.`);
    const out: GraphqlField[] = [];
    for (const entry of value) {
      if (!isRecord(entry) || typeof entry.name !== 'string')
        return this.fail(`Introspection: malformed field on ${where}.`);
      const type = this.typeRef(entry.type, `${where}.${entry.name}`);
      const args = this.inputValues(entry.args, `${where}.${entry.name} args`);
      if (type === null || args === null) return null;
      out.push({
        name: entry.name,
        description: optionalString(entry.description),
        args,
        type,
        deprecationReason:
          entry.isDeprecated === true ? (optionalString(entry.deprecationReason) ?? 'No longer supported') : null,
      });
    }
    return out;
  }

  names(value: unknown, where: string): string[] | null {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) return this.fail(`Introspection: ${where} is not a list.`);
    const out: string[] = [];
    for (const entry of value) {
      if (!isRecord(entry) || typeof entry.name !== 'string')
        return this.fail(`Introspection: malformed type name on ${where}.`);
      out.push(entry.name);
    }
    return out;
  }

  type(value: unknown): GraphqlNamedType | null {
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.kind !== 'string') {
      return this.fail('Introspection: malformed type entry.');
    }
    const name = value.name;
    const description = optionalString(value.description);
    switch (value.kind) {
      case 'SCALAR':
        return { kind: 'SCALAR', name, description, specifiedByUrl: optionalString(value.specifiedByURL) };
      case 'OBJECT': {
        const fields = this.fields(value.fields, name);
        const interfaces = this.names(value.interfaces, `${name}.interfaces`);
        return fields === null || interfaces === null
          ? null
          : { kind: 'OBJECT', name, description, fields, interfaces };
      }
      case 'INTERFACE': {
        const fields = this.fields(value.fields, name);
        const interfaces = this.names(value.interfaces, `${name}.interfaces`);
        const possibleTypes = this.names(value.possibleTypes, `${name}.possibleTypes`);
        return fields === null || interfaces === null || possibleTypes === null
          ? null
          : { kind: 'INTERFACE', name, description, fields, interfaces, possibleTypes };
      }
      case 'UNION': {
        const possibleTypes = this.names(value.possibleTypes, `${name}.possibleTypes`);
        return possibleTypes === null ? null : { kind: 'UNION', name, description, possibleTypes };
      }
      case 'ENUM': {
        if (!Array.isArray(value.enumValues)) return this.fail(`Introspection: ${name}.enumValues is not a list.`);
        const values: GraphqlEnumValue[] = [];
        for (const entry of value.enumValues) {
          if (!isRecord(entry) || typeof entry.name !== 'string')
            return this.fail(`Introspection: malformed enum value on ${name}.`);
          values.push({
            name: entry.name,
            description: optionalString(entry.description),
            deprecationReason:
              entry.isDeprecated === true ? (optionalString(entry.deprecationReason) ?? 'No longer supported') : null,
          });
        }
        return { kind: 'ENUM', name, description, values };
      }
      case 'INPUT_OBJECT': {
        const inputFields = this.inputValues(value.inputFields, `${name}.inputFields`);
        return inputFields === null
          ? null
          : { kind: 'INPUT_OBJECT', name, description, inputFields, oneOf: value.isOneOf === true };
      }
      default:
        return this.fail(`Introspection: unknown type kind \`${value.kind}\` on \`${name}\`.`);
    }
  }
}

/**
 * Build the model from an introspection result — either the bare
 * `{ __schema: … }` object or the whole `{ data: { __schema } }`
 * response envelope. Never throws.
 */
export function schemaFromIntrospection(json: unknown): SchemaResult {
  const reader = new IntrospectionReader();
  const root = isRecord(json) && isRecord(json.data) ? json.data : json;
  const introspection = isRecord(root) ? root.__schema : undefined;
  if (!isRecord(introspection)) {
    reader.fail('Introspection: no `__schema` object in the response.');
    return { schema: null, errors: reader.errors };
  }
  if (!Array.isArray(introspection.types)) {
    reader.fail('Introspection: `__schema.types` is not a list.');
    return { schema: null, errors: reader.errors };
  }
  const types = new Map<string, GraphqlNamedType>();
  for (const entry of introspection.types) {
    const type = reader.type(entry);
    if (type === null) return { schema: null, errors: reader.errors };
    types.set(type.name, type);
  }
  const directives: GraphqlDirective[] = [];
  if (Array.isArray(introspection.directives)) {
    for (const entry of introspection.directives) {
      if (!isRecord(entry) || typeof entry.name !== 'string') {
        reader.fail('Introspection: malformed directive entry.');
        return { schema: null, errors: reader.errors };
      }
      const args = reader.inputValues(entry.args, `@${entry.name} args`);
      if (args === null) return { schema: null, errors: reader.errors };
      directives.push({
        name: entry.name,
        description: optionalString(entry.description),
        locations: Array.isArray(entry.locations)
          ? entry.locations.filter((l): l is string => typeof l === 'string')
          : [],
        args,
        isRepeatable: entry.isRepeatable === true,
      });
    }
  }
  const rootName = (value: unknown): string | null => (isRecord(value) ? optionalString(value.name) : null);
  return {
    schema: {
      description: optionalString(introspection.description),
      queryType: rootName(introspection.queryType),
      mutationType: rootName(introspection.mutationType),
      subscriptionType: rootName(introspection.subscriptionType),
      types,
      directives,
    },
    errors: reader.errors,
  };
}

/** The JSON shape of a `__Type` reference in an introspection result. */
export type IntrospectionTypeRef =
  | { readonly kind: 'LIST' | 'NON_NULL'; readonly name: null; readonly ofType: IntrospectionTypeRef }
  | { readonly kind: GraphqlTypeKind; readonly name: string; readonly ofType: null };

export interface IntrospectionInputValue {
  readonly name: string;
  readonly description: string | null;
  readonly type: IntrospectionTypeRef;
  readonly defaultValue: string | null;
  readonly isDeprecated: boolean;
  readonly deprecationReason: string | null;
}

export interface IntrospectionField {
  readonly name: string;
  readonly description: string | null;
  readonly args: readonly IntrospectionInputValue[];
  readonly type: IntrospectionTypeRef;
  readonly isDeprecated: boolean;
  readonly deprecationReason: string | null;
}

export interface IntrospectionEnumValue {
  readonly name: string;
  readonly description: string | null;
  readonly isDeprecated: boolean;
  readonly deprecationReason: string | null;
}

export interface IntrospectionType {
  readonly kind: GraphqlTypeKind;
  readonly name: string;
  readonly description: string | null;
  readonly specifiedByURL: string | null;
  readonly isOneOf: boolean | null;
  readonly fields: readonly IntrospectionField[] | null;
  readonly inputFields: readonly IntrospectionInputValue[] | null;
  readonly interfaces: readonly IntrospectionTypeRef[] | null;
  readonly enumValues: readonly IntrospectionEnumValue[] | null;
  readonly possibleTypes: readonly IntrospectionTypeRef[] | null;
}

export interface IntrospectionDirective {
  readonly name: string;
  readonly description: string | null;
  readonly isRepeatable: boolean;
  readonly locations: readonly string[];
  readonly args: readonly IntrospectionInputValue[];
}

export interface IntrospectionResult {
  readonly __schema: {
    readonly description: string | null;
    readonly queryType: { readonly name: string } | null;
    readonly mutationType: { readonly name: string } | null;
    readonly subscriptionType: { readonly name: string } | null;
    readonly types: readonly IntrospectionType[];
    readonly directives: readonly IntrospectionDirective[];
  };
}

function introspectionTypeRef(schema: GraphqlSchema, type: GraphqlTypeRef): IntrospectionTypeRef {
  if (type.kind !== 'NAMED') return { kind: type.kind, name: null, ofType: introspectionTypeRef(schema, type.ofType) };
  return { kind: schema.types.get(type.name)?.kind ?? 'SCALAR', name: type.name, ofType: null };
}

function introspectionInputValue(schema: GraphqlSchema, value: GraphqlInputValue): IntrospectionInputValue {
  return {
    name: value.name,
    description: value.description,
    type: introspectionTypeRef(schema, value.type),
    defaultValue: value.defaultValue,
    isDeprecated: value.deprecationReason !== null,
    deprecationReason: value.deprecationReason,
  };
}

function introspectionNamed(schema: GraphqlSchema, name: string): IntrospectionTypeRef {
  return { kind: schema.types.get(name)?.kind ?? 'OBJECT', name, ofType: null };
}

function introspectionType(schema: GraphqlSchema, type: GraphqlNamedType): IntrospectionType {
  const base = {
    kind: type.kind,
    name: type.name,
    description: type.description,
    specifiedByURL: null,
    isOneOf: null,
    fields: null,
    inputFields: null,
    interfaces: null,
    enumValues: null,
    possibleTypes: null,
  };
  switch (type.kind) {
    case 'SCALAR':
      return { ...base, specifiedByURL: type.specifiedByUrl };
    case 'OBJECT':
    case 'INTERFACE': {
      const fields = type.fields.map(
        (field): IntrospectionField => ({
          name: field.name,
          description: field.description,
          args: field.args.map((arg) => introspectionInputValue(schema, arg)),
          type: introspectionTypeRef(schema, field.type),
          isDeprecated: field.deprecationReason !== null,
          deprecationReason: field.deprecationReason,
        }),
      );
      const interfaces = type.interfaces.map((name) => introspectionNamed(schema, name));
      if (type.kind === 'OBJECT') return { ...base, fields, interfaces };
      return {
        ...base,
        fields,
        interfaces,
        possibleTypes: type.possibleTypes.map((name) => introspectionNamed(schema, name)),
      };
    }
    case 'UNION':
      return { ...base, possibleTypes: type.possibleTypes.map((name) => introspectionNamed(schema, name)) };
    case 'ENUM':
      return {
        ...base,
        enumValues: type.values.map((value) => ({
          name: value.name,
          description: value.description,
          isDeprecated: value.deprecationReason !== null,
          deprecationReason: value.deprecationReason,
        })),
      };
    case 'INPUT_OBJECT':
      return {
        ...base,
        isOneOf: type.oneOf,
        inputFields: type.inputFields.map((field) => introspectionInputValue(schema, field)),
      };
  }
}

/** The model as the standard introspection result — what a server
 *  answers `INTROSPECTION_QUERY` with (the probe's half). */
export function schemaToIntrospection(schema: GraphqlSchema): IntrospectionResult {
  const nameOf = (value: string | null): { name: string } | null => (value === null ? null : { name: value });
  return {
    __schema: {
      description: schema.description,
      queryType: nameOf(schema.queryType),
      mutationType: nameOf(schema.mutationType),
      subscriptionType: nameOf(schema.subscriptionType),
      types: [...schema.types.values()].map((type) => introspectionType(schema, type)),
      directives: schema.directives.map((directive) => ({
        name: directive.name,
        description: directive.description,
        isRepeatable: directive.isRepeatable,
        locations: directive.locations,
        args: directive.args.map((arg) => introspectionInputValue(schema, arg)),
      })),
    },
  };
}
