/**
 * Hover model — the schema symbol under a cursor offset in an
 * executable document: the field of the enclosing selection's type, an
 * argument of that field, a directive or one of its arguments, a
 * variable (its definition or a use), a fragment spread, a type
 * condition. Pure read of the AST against the schema model; the
 * editor's hover provider renders what it returns. Without a schema
 * only the document's own symbols resolve — variables and fragments.
 */

import { printNode } from './print';
import {
  fieldsOf,
  type GraphqlDirective,
  type GraphqlField,
  type GraphqlInputValue,
  type GraphqlNamedType,
  type GraphqlSchema,
  namedTypeOf,
  rootTypeName,
  typeRefOf,
} from './schema';
import type {
  ArgumentNode,
  DirectiveNode,
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  SelectionSetNode,
  Span,
  ValueNode,
} from './types';

export type HoverSymbol =
  | { readonly kind: 'field'; readonly parentType: string; readonly field: GraphqlField; readonly span: Span }
  | {
      readonly kind: 'argument';
      readonly parentType: string;
      readonly field: GraphqlField;
      readonly argument: GraphqlInputValue;
      readonly span: Span;
    }
  | { readonly kind: 'directive'; readonly directive: GraphqlDirective; readonly span: Span }
  | {
      readonly kind: 'directive-argument';
      readonly directive: GraphqlDirective;
      readonly argument: GraphqlInputValue;
      readonly span: Span;
    }
  | { readonly kind: 'type'; readonly type: GraphqlNamedType; readonly span: Span }
  | { readonly kind: 'variable'; readonly name: string; readonly type: string; readonly span: Span }
  | { readonly kind: 'fragment'; readonly name: string; readonly typeCondition: string; readonly span: Span };

/** The operation's variable definitions, by name → declared type text. */
type VariableTypes = ReadonlyMap<string, string>;

interface Walk {
  readonly schema: GraphqlSchema | null;
  readonly offset: number;
  readonly variables: VariableTypes;
  readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
}

function contains(span: Span, offset: number): boolean {
  return offset >= span.start && offset <= span.end;
}

function typeSymbol(walk: Walk, name: string, span: Span): HoverSymbol | null {
  const type = walk.schema?.types.get(name);
  return type === undefined ? null : { kind: 'type', type, span };
}

function variableSymbol(walk: Walk, name: string, span: Span): HoverSymbol | null {
  const type = walk.variables.get(name);
  return type === undefined ? null : { kind: 'variable', name, type, span };
}

/** A value under the cursor — a variable use is the one value that names a symbol. */
function inValue(walk: Walk, value: ValueNode): HoverSymbol | null {
  if (!contains(value, walk.offset)) return null;
  switch (value.kind) {
    case 'Variable':
      return variableSymbol(walk, value.name.value, value);
    case 'ListValue':
      for (const entry of value.values) {
        const hit = inValue(walk, entry);
        if (hit !== null) return hit;
      }
      return null;
    case 'ObjectValue':
      for (const field of value.fields) {
        const hit = inValue(walk, field.value);
        if (hit !== null) return hit;
      }
      return null;
    default:
      return null;
  }
}

/** The arguments of a field or directive — a name resolves against the
 *  declared list (nothing when the owner is unknown), a value only ever
 *  names a variable. */
function inArguments(
  walk: Walk,
  args: readonly ArgumentNode[],
  declared: readonly GraphqlInputValue[],
  symbolFor: (argument: GraphqlInputValue, span: Span) => HoverSymbol | null,
): HoverSymbol | null {
  for (const argument of args) {
    if (!contains(argument, walk.offset)) continue;
    if (contains(argument.name, walk.offset)) {
      const match = declared.find((entry) => entry.name === argument.name.value);
      return match === undefined ? null : symbolFor(match, argument.name);
    }
    return inValue(walk, argument.value);
  }
  return null;
}

function inDirectives(walk: Walk, directives: readonly DirectiveNode[]): HoverSymbol | null {
  for (const directive of directives) {
    if (!contains(directive, walk.offset)) continue;
    const declared = walk.schema?.directives.find((entry) => entry.name === directive.name.value);
    if (contains(directive.name, walk.offset)) {
      return declared === undefined ? null : { kind: 'directive', directive: declared, span: directive.name };
    }
    return inArguments(walk, directive.arguments, declared?.args ?? [], (argument, span) =>
      declared === undefined ? null : { kind: 'directive-argument', directive: declared, argument, span },
    );
  }
  return null;
}

function inSelectionSet(walk: Walk, set: SelectionSetNode, parentType: string | null): HoverSymbol | null {
  for (const selection of set.selections) {
    if (!contains(selection, walk.offset)) continue;
    switch (selection.kind) {
      case 'Field': {
        const field =
          parentType === null || walk.schema === null
            ? undefined
            : fieldsOf(walk.schema.types.get(parentType)).find((entry) => entry.name === selection.name.value);
        const nameHit =
          contains(selection.name, walk.offset) || (selection.alias !== null && contains(selection.alias, walk.offset));
        if (nameHit) {
          return field === undefined || parentType === null
            ? null
            : { kind: 'field', parentType, field, span: selection.name };
        }
        const directive = inDirectives(walk, selection.directives);
        if (directive !== null) return directive;
        const argument = inArguments(walk, selection.arguments, field?.args ?? [], (entry, span) =>
          field === undefined || parentType === null
            ? null
            : { kind: 'argument', parentType, field, argument: entry, span },
        );
        if (argument !== null) return argument;
        if (selection.selectionSet !== null) {
          return inSelectionSet(walk, selection.selectionSet, field === undefined ? null : namedTypeOf(field.type));
        }
        return null;
      }
      case 'FragmentSpread': {
        if (contains(selection.name, walk.offset)) {
          const fragment = walk.fragments.get(selection.name.value);
          return fragment === undefined
            ? null
            : {
                kind: 'fragment',
                name: fragment.name.value,
                typeCondition: fragment.typeCondition.name.value,
                span: selection.name,
              };
        }
        return inDirectives(walk, selection.directives);
      }
      case 'InlineFragment': {
        if (selection.typeCondition !== null && contains(selection.typeCondition, walk.offset)) {
          return typeSymbol(walk, selection.typeCondition.name.value, selection.typeCondition);
        }
        const directive = inDirectives(walk, selection.directives);
        if (directive !== null) return directive;
        const condition = selection.typeCondition === null ? parentType : selection.typeCondition.name.value;
        return inSelectionSet(walk, selection.selectionSet, condition);
      }
    }
  }
  return null;
}

function inOperation(walk: Walk, operation: OperationDefinitionNode): HoverSymbol | null {
  for (const definition of operation.variableDefinitions) {
    if (!contains(definition, walk.offset)) continue;
    if (contains(definition.type, walk.offset)) {
      return typeSymbol(walk, namedTypeOf(typeRefOf(definition.type)), definition.type);
    }
    return variableSymbol(walk, definition.variable.name.value, definition.variable);
  }
  const directive = inDirectives(walk, operation.directives);
  if (directive !== null) return directive;
  const root = walk.schema === null ? null : rootTypeName(walk.schema, operation.operation);
  return inSelectionSet(walk, operation.selectionSet, root);
}

function inFragment(walk: Walk, fragment: FragmentDefinitionNode): HoverSymbol | null {
  if (contains(fragment.typeCondition, walk.offset)) {
    return typeSymbol(walk, fragment.typeCondition.name.value, fragment.typeCondition);
  }
  const directive = inDirectives(walk, fragment.directives);
  if (directive !== null) return directive;
  return inSelectionSet(walk, fragment.selectionSet, fragment.typeCondition.name.value);
}

/**
 * The symbol under `offset`, or null on whitespace, punctuation and
 * names the schema does not know. Variables resolve inside the
 * operation that declares them; fragments resolve document-wide.
 */
export function symbolAt(document: DocumentNode, offset: number, schema: GraphqlSchema | null): HoverSymbol | null {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === 'FragmentDefinition') fragments.set(definition.name.value, definition);
  }
  for (const definition of document.definitions) {
    if (!contains(definition, offset)) continue;
    if (definition.kind === 'OperationDefinition') {
      const variables = new Map<string, string>();
      for (const entry of definition.variableDefinitions) {
        variables.set(entry.variable.name.value, printNode(entry.type));
      }
      return inOperation({ schema, offset, variables, fragments }, definition);
    }
    if (definition.kind === 'FragmentDefinition') {
      return inFragment({ schema, offset, variables: new Map(), fragments }, definition);
    }
    return null;
  }
  return null;
}
