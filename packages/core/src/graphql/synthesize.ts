/**
 * Operation synthesis — one runnable document for a root field, the
 * way Generate Collection seeds a request per field: every argument
 * declared as a same-named variable (a declared default carried onto
 * the variable definition), the field selected with those variables,
 * and a SHALLOW selection set under it — the leaf fields of the return
 * type at the first level, composite fields expanded one more level,
 * unions spread per member — so the generated request answers with
 * something on the first Query. Deprecated fields and fields that need
 * an argument stay out of the selection; a composite with nothing
 * selectable falls back to `__typename`. The document is laid out by
 * the printer, and the variables come from the example synthesis so
 * both halves agree with the explorer's insert and the drawer's
 * Generate.
 */

import { exampleVariables, type JsonValue } from './example';
import { parseDocument } from './parse';
import { printNode } from './print';
import {
  type GraphqlField,
  type GraphqlInputValue,
  type GraphqlNamedType,
  type GraphqlSchema,
  isLeafType,
  namedTypeOf,
  printTypeRef,
} from './schema';
import type { OperationType } from './types';

export interface SynthesizeOptions {
  /** Selection depth under the root field: 1 = its leaves only (default 2). */
  readonly depth?: number;
}

export interface SynthesizedOperation {
  /** The operation's name (`CreateNote` for `createNote`). */
  readonly name: string;
  /** The pretty-printed document. */
  readonly document: string;
  /** Example variables for the declared arguments; null when the field takes none. */
  readonly variables: { [key: string]: JsonValue } | null;
}

const DEFAULT_DEPTH = 2;

/** `createNote` → `CreateNote`; a name the grammar accepts in every case. */
export function operationNameFor(fieldName: string): string {
  const cleaned = fieldName.replace(/[^_0-9A-Za-z]/g, '_');
  const named = cleaned.length === 0 ? 'Operation' : cleaned;
  const capitalized = named.charAt(0).toUpperCase() + named.slice(1);
  return /^[0-9]/.test(capitalized) ? `_${capitalized}` : capitalized;
}

/** An argument the selection can leave out — nullable or defaulted. */
function isOptional(arg: GraphqlInputValue): boolean {
  return arg.type.kind !== 'NON_NULL' || arg.defaultValue !== null;
}

function isSelectable(field: GraphqlField): boolean {
  return field.deprecationReason === null && field.args.every(isOptional);
}

function selectionFor(
  type: GraphqlNamedType | undefined,
  depth: number,
  schema: GraphqlSchema,
  stack: Set<string>,
): string {
  if (type === undefined || isLeafType(type)) return '';
  if (type.kind === 'UNION') {
    if (depth <= 1) return '{ __typename }';
    const spreads = type.possibleTypes.flatMap((name) => {
      const member = schema.types.get(name);
      if (member === undefined || member.kind !== 'OBJECT') return [];
      const inner = objectSelection(member, depth - 1, schema, stack);
      return inner === '' ? [] : [`... on ${name} ${inner}`];
    });
    return `{ __typename ${spreads.join(' ')} }`;
  }
  const inner = objectSelection(type, depth, schema, stack);
  return inner === '' ? '{ __typename }' : inner;
}

/** The selection on an object / interface: leaves first, then composites one level deeper; '' when nothing applies. */
function objectSelection(type: GraphqlNamedType, depth: number, schema: GraphqlSchema, stack: Set<string>): string {
  if (type.kind !== 'OBJECT' && type.kind !== 'INTERFACE') return '';
  if (stack.has(type.name)) return '';
  stack.add(type.name);
  const parts: string[] = [];
  for (const field of type.fields) {
    if (!isSelectable(field)) continue;
    const named = schema.types.get(namedTypeOf(field.type));
    if (named === undefined) continue;
    if (isLeafType(named)) {
      parts.push(field.name);
      continue;
    }
    if (depth <= 1) continue;
    const inner = selectionFor(named, depth - 1, schema, stack);
    if (inner !== '' && inner !== '{ __typename }') parts.push(`${field.name} ${inner}`);
  }
  stack.delete(type.name);
  return parts.length === 0 ? '' : `{ ${parts.join(' ')} }`;
}

function variableDefinitions(args: readonly GraphqlInputValue[]): string {
  if (args.length === 0) return '';
  const entries = args.map((arg) => {
    const base = `$${arg.name}: ${printTypeRef(arg.type)}`;
    return arg.defaultValue === null ? base : `${base} = ${arg.defaultValue}`;
  });
  return `(${entries.join(', ')})`;
}

function argumentList(args: readonly GraphqlInputValue[]): string {
  if (args.length === 0) return '';
  return `(${args.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})`;
}

/** One operation document for a root field of `operation`'s type. */
export function synthesizeOperation(
  schema: GraphqlSchema,
  operation: OperationType,
  field: GraphqlField,
  options: SynthesizeOptions = {},
): SynthesizedOperation {
  const depth = options.depth ?? DEFAULT_DEPTH;
  const name = operationNameFor(field.name);
  const returnType = schema.types.get(namedTypeOf(field.type));
  const selection = selectionFor(returnType, depth, schema, new Set());
  const compact = `${operation} ${name}${variableDefinitions(field.args)} { ${field.name}${argumentList(field.args)} ${selection} }`;
  const parsed = parseDocument(compact);
  const document = parsed.document === null ? compact : printNode(parsed.document);
  const definition = parsed.document?.definitions.find((node) => node.kind === 'OperationDefinition');
  const variables =
    field.args.length === 0 || definition === undefined || definition.kind !== 'OperationDefinition'
      ? null
      : exampleVariables(definition, schema);
  return { name, document, variables };
}
