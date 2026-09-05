/**
 * GraphQL AST — the parsed shape of an executable document (operations,
 * fragments, selections, values) and of a type-system document (SDL:
 * schema, type and directive definitions plus their extensions). Every
 * node carries `start` / `end` character offsets so editor surfaces can
 * navigate to it and diagnostics can underline it (the proto census's
 * offset contract, widened to a span).
 *
 * The AST mirrors the spec's grammar summary one production per node
 * kind — nothing is folded or inferred at parse time; the census,
 * validator, completion model and printer all read this shape.
 */

/** Character-offset span of a node in its source. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** A reported problem — the parse, schema build and validation
 *  boundaries all report through this shape, never by throwing. */
export interface GraphqlError extends Span {
  readonly message: string;
}

export interface NameNode extends Span {
  readonly kind: 'Name';
  readonly value: string;
}

// ── Values ─────────────────────────────────────────────────────────

export interface VariableNode extends Span {
  readonly kind: 'Variable';
  readonly name: NameNode;
}

export interface IntValueNode extends Span {
  readonly kind: 'IntValue';
  /** Digits as written. */
  readonly value: string;
}

export interface FloatValueNode extends Span {
  readonly kind: 'FloatValue';
  /** Digits as written. */
  readonly value: string;
}

export interface StringValueNode extends Span {
  readonly kind: 'StringValue';
  /** Decoded value — escapes resolved, block-string indentation removed. */
  readonly value: string;
  readonly block: boolean;
}

export interface BooleanValueNode extends Span {
  readonly kind: 'BooleanValue';
  readonly value: boolean;
}

export interface NullValueNode extends Span {
  readonly kind: 'NullValue';
}

export interface EnumValueNode extends Span {
  readonly kind: 'EnumValue';
  readonly value: string;
}

export interface ListValueNode extends Span {
  readonly kind: 'ListValue';
  readonly values: readonly ValueNode[];
}

export interface ObjectFieldNode extends Span {
  readonly kind: 'ObjectField';
  readonly name: NameNode;
  readonly value: ValueNode;
}

export interface ObjectValueNode extends Span {
  readonly kind: 'ObjectValue';
  readonly fields: readonly ObjectFieldNode[];
}

export type ValueNode =
  | VariableNode
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ListValueNode
  | ObjectValueNode;

/** A value with no variables inside — what defaults and SDL carry. */
export type ConstValueNode = Exclude<ValueNode, VariableNode>;

// ── Types ──────────────────────────────────────────────────────────

export interface NamedTypeNode extends Span {
  readonly kind: 'NamedType';
  readonly name: NameNode;
}

export interface ListTypeNode extends Span {
  readonly kind: 'ListType';
  readonly type: TypeNode;
}

export interface NonNullTypeNode extends Span {
  readonly kind: 'NonNullType';
  readonly type: NamedTypeNode | ListTypeNode;
}

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

// ── Directives ─────────────────────────────────────────────────────

export interface ArgumentNode extends Span {
  readonly kind: 'Argument';
  readonly name: NameNode;
  readonly value: ValueNode;
}

export interface DirectiveNode extends Span {
  readonly kind: 'Directive';
  readonly name: NameNode;
  readonly arguments: readonly ArgumentNode[];
}

// ── Executable definitions ─────────────────────────────────────────

export type OperationType = 'query' | 'mutation' | 'subscription';

export interface VariableDefinitionNode extends Span {
  readonly kind: 'VariableDefinition';
  readonly variable: VariableNode;
  readonly type: TypeNode;
  readonly defaultValue: ConstValueNode | null;
  readonly directives: readonly DirectiveNode[];
}

export interface SelectionSetNode extends Span {
  readonly kind: 'SelectionSet';
  readonly selections: readonly SelectionNode[];
}

export interface FieldNode extends Span {
  readonly kind: 'Field';
  readonly alias: NameNode | null;
  readonly name: NameNode;
  readonly arguments: readonly ArgumentNode[];
  readonly directives: readonly DirectiveNode[];
  readonly selectionSet: SelectionSetNode | null;
}

export interface FragmentSpreadNode extends Span {
  readonly kind: 'FragmentSpread';
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
}

export interface InlineFragmentNode extends Span {
  readonly kind: 'InlineFragment';
  readonly typeCondition: NamedTypeNode | null;
  readonly directives: readonly DirectiveNode[];
  readonly selectionSet: SelectionSetNode;
}

export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;

export interface OperationDefinitionNode extends Span {
  readonly kind: 'OperationDefinition';
  readonly operation: OperationType;
  /** Null for an anonymous operation (`query { … }` or the `{ … }` shorthand). */
  readonly name: NameNode | null;
  readonly variableDefinitions: readonly VariableDefinitionNode[];
  readonly directives: readonly DirectiveNode[];
  readonly selectionSet: SelectionSetNode;
}

export interface FragmentDefinitionNode extends Span {
  readonly kind: 'FragmentDefinition';
  readonly name: NameNode;
  readonly typeCondition: NamedTypeNode;
  readonly directives: readonly DirectiveNode[];
  readonly selectionSet: SelectionSetNode;
}

export type ExecutableDefinitionNode = OperationDefinitionNode | FragmentDefinitionNode;

// ── Type-system definitions ────────────────────────────────────────

export interface OperationTypeDefinitionNode extends Span {
  readonly kind: 'OperationTypeDefinition';
  readonly operation: OperationType;
  readonly type: NamedTypeNode;
}

export interface SchemaDefinitionNode extends Span {
  readonly kind: 'SchemaDefinition';
  readonly description: StringValueNode | null;
  readonly directives: readonly DirectiveNode[];
  readonly operationTypes: readonly OperationTypeDefinitionNode[];
}

export interface SchemaExtensionNode extends Span {
  readonly kind: 'SchemaExtension';
  readonly directives: readonly DirectiveNode[];
  readonly operationTypes: readonly OperationTypeDefinitionNode[];
}

export interface InputValueDefinitionNode extends Span {
  readonly kind: 'InputValueDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue: ConstValueNode | null;
  readonly directives: readonly DirectiveNode[];
}

export interface FieldDefinitionNode extends Span {
  readonly kind: 'FieldDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly arguments: readonly InputValueDefinitionNode[];
  readonly type: TypeNode;
  readonly directives: readonly DirectiveNode[];
}

export interface EnumValueDefinitionNode extends Span {
  readonly kind: 'EnumValueDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
}

export interface ScalarTypeDefinitionNode extends Span {
  readonly kind: 'ScalarTypeDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
}

export interface ObjectTypeDefinitionNode extends Span {
  readonly kind: 'ObjectTypeDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly interfaces: readonly NamedTypeNode[];
  readonly directives: readonly DirectiveNode[];
  readonly fields: readonly FieldDefinitionNode[];
}

export interface InterfaceTypeDefinitionNode extends Span {
  readonly kind: 'InterfaceTypeDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly interfaces: readonly NamedTypeNode[];
  readonly directives: readonly DirectiveNode[];
  readonly fields: readonly FieldDefinitionNode[];
}

export interface UnionTypeDefinitionNode extends Span {
  readonly kind: 'UnionTypeDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
  readonly types: readonly NamedTypeNode[];
}

export interface EnumTypeDefinitionNode extends Span {
  readonly kind: 'EnumTypeDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
  readonly values: readonly EnumValueDefinitionNode[];
}

export interface InputObjectTypeDefinitionNode extends Span {
  readonly kind: 'InputObjectTypeDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
  readonly fields: readonly InputValueDefinitionNode[];
}

export type TypeDefinitionNode =
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | InputObjectTypeDefinitionNode;

export interface ScalarTypeExtensionNode extends Span {
  readonly kind: 'ScalarTypeExtension';
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
}

export interface ObjectTypeExtensionNode extends Span {
  readonly kind: 'ObjectTypeExtension';
  readonly name: NameNode;
  readonly interfaces: readonly NamedTypeNode[];
  readonly directives: readonly DirectiveNode[];
  readonly fields: readonly FieldDefinitionNode[];
}

export interface InterfaceTypeExtensionNode extends Span {
  readonly kind: 'InterfaceTypeExtension';
  readonly name: NameNode;
  readonly interfaces: readonly NamedTypeNode[];
  readonly directives: readonly DirectiveNode[];
  readonly fields: readonly FieldDefinitionNode[];
}

export interface UnionTypeExtensionNode extends Span {
  readonly kind: 'UnionTypeExtension';
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
  readonly types: readonly NamedTypeNode[];
}

export interface EnumTypeExtensionNode extends Span {
  readonly kind: 'EnumTypeExtension';
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
  readonly values: readonly EnumValueDefinitionNode[];
}

export interface InputObjectTypeExtensionNode extends Span {
  readonly kind: 'InputObjectTypeExtension';
  readonly name: NameNode;
  readonly directives: readonly DirectiveNode[];
  readonly fields: readonly InputValueDefinitionNode[];
}

export type TypeExtensionNode =
  | ScalarTypeExtensionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeExtensionNode
  | UnionTypeExtensionNode
  | EnumTypeExtensionNode
  | InputObjectTypeExtensionNode;

/** The spec's nineteen directive locations. */
export const DIRECTIVE_LOCATIONS = [
  'QUERY',
  'MUTATION',
  'SUBSCRIPTION',
  'FIELD',
  'FRAGMENT_DEFINITION',
  'FRAGMENT_SPREAD',
  'INLINE_FRAGMENT',
  'VARIABLE_DEFINITION',
  'SCHEMA',
  'SCALAR',
  'OBJECT',
  'FIELD_DEFINITION',
  'ARGUMENT_DEFINITION',
  'INTERFACE',
  'UNION',
  'ENUM',
  'ENUM_VALUE',
  'INPUT_OBJECT',
  'INPUT_FIELD_DEFINITION',
] as const;

export type DirectiveLocation = (typeof DIRECTIVE_LOCATIONS)[number];

export interface DirectiveDefinitionNode extends Span {
  readonly kind: 'DirectiveDefinition';
  readonly description: StringValueNode | null;
  readonly name: NameNode;
  readonly arguments: readonly InputValueDefinitionNode[];
  readonly repeatable: boolean;
  readonly locations: readonly NameNode[];
}

export type TypeSystemDefinitionNode = SchemaDefinitionNode | TypeDefinitionNode | DirectiveDefinitionNode;

export type TypeSystemExtensionNode = SchemaExtensionNode | TypeExtensionNode;

export type DefinitionNode = ExecutableDefinitionNode | TypeSystemDefinitionNode | TypeSystemExtensionNode;

export interface DocumentNode extends Span {
  readonly kind: 'Document';
  readonly definitions: readonly DefinitionNode[];
}

/** Every node kind the parser produces. */
export type AstNode =
  | NameNode
  | ValueNode
  | ObjectFieldNode
  | TypeNode
  | ArgumentNode
  | DirectiveNode
  | VariableDefinitionNode
  | SelectionSetNode
  | SelectionNode
  | DefinitionNode
  | OperationTypeDefinitionNode
  | InputValueDefinitionNode
  | FieldDefinitionNode
  | EnumValueDefinitionNode
  | DocumentNode;

/** Internal — thrown inside the lexer / parser, converted to a
 *  `GraphqlError` at the public boundary. Never escapes the module. */
export class GraphqlSyntaxError extends Error {
  readonly start: number;
  readonly end: number;

  constructor(message: string, start: number, end: number) {
    super(message);
    this.name = 'GraphqlSyntaxError';
    this.start = start;
    this.end = end;
  }
}
