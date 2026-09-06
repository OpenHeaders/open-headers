/**
 * The query BUILDER — the explorer's two-way half over the AST. The
 * document is the source of truth: the explorer PROJECTS the picked
 * operation's direct selections onto the schema by PATH (field names
 * from the operation's root), and every checkbox gesture becomes span
 * edits on the current text — never a re-print — so the editor applies
 * them through its own edit stack: undoable, dirty-deriving, the
 * user's layout and comments kept. The edited text re-parses and the
 * projection follows: one parse, two surfaces.
 *
 * Reads walk direct Field nodes by name (an alias keeps the name; the
 * first match wins). Fragment spreads and inline fragments are reported
 * as read-only rows and never projected as selections. Writes follow
 * the local layout — a multi-line selection set gets the new selection
 * on its own line at the siblings' indent, a single-line one gets it
 * space-separated — and keep the document valid at every step: a
 * composite field lands with its first leaf, the last selection leaving
 * a nested set takes its parent field with it, the last root selection
 * removes the operation, and a variable the builder no longer
 * references loses its declaration.
 */

import { parseValue } from './parse';
import {
  fieldsOf,
  type GraphqlField,
  type GraphqlInputValue,
  type GraphqlNamedType,
  type GraphqlSchema,
  isLeafType,
  namedTypeOf,
  printTypeRef,
  rootTypeName,
} from './schema';
import type {
  ArgumentNode,
  DefinitionNode,
  DirectiveNode,
  DocumentNode,
  FieldNode,
  OperationDefinitionNode,
  OperationType,
  SelectionNode,
  SelectionSetNode,
  Span,
  ValueNode,
} from './types';

/** One replacement on the source text — `text` over `[start, end)`. */
export interface BuilderEdit extends Span {
  readonly text: string;
}

export interface BuilderContext {
  readonly source: string;
  /** The parse of `source`; null when the text is empty (a buildable blank) or broken (nothing is). */
  readonly document: DocumentNode | null;
  /** The picked operation — the projection's root; null when the document holds none. */
  readonly operation: OperationDefinitionNode | null;
  readonly schema: GraphqlSchema;
}

/** A fragment in a selection set — shown read-only, never projected. */
export interface BuilderFragmentRow extends Span {
  readonly kind: 'spread' | 'inline';
  /** `...Name` / `... on Type` / `...` */
  readonly label: string;
}

interface VariableEntry {
  readonly name: string;
  readonly type: string;
}

// ── Projection ─────────────────────────────────────────────────────

function directField(set: SelectionSetNode, name: string): FieldNode | null {
  for (const selection of set.selections) {
    if (selection.kind === 'Field' && selection.name.value === name) return selection;
  }
  return null;
}

/** The direct Field at `path`, or null when any step is missing. */
export function fieldAt(operation: OperationDefinitionNode, path: readonly string[]): FieldNode | null {
  let set: SelectionSetNode | null = operation.selectionSet;
  let field: FieldNode | null = null;
  for (const name of path) {
    if (set === null) return null;
    field = directField(set, name);
    if (field === null) return null;
    set = field.selectionSet;
  }
  return field;
}

/** The selection set under `path` — the operation's own for `[]`; null when a step is missing or the field has none. */
export function selectionSetAt(operation: OperationDefinitionNode, path: readonly string[]): SelectionSetNode | null {
  if (path.length === 0) return operation.selectionSet;
  const field = fieldAt(operation, path);
  return field === null ? null : field.selectionSet;
}

export function argumentAt(field: FieldNode, name: string): ArgumentNode | null {
  for (const argument of field.arguments) if (argument.name.value === name) return argument;
  return null;
}

export function fragmentsAt(
  operation: OperationDefinitionNode,
  path: readonly string[],
): readonly BuilderFragmentRow[] {
  const set = selectionSetAt(operation, path);
  if (set === null) return [];
  const rows: BuilderFragmentRow[] = [];
  for (const selection of set.selections) {
    if (selection.kind === 'FragmentSpread') {
      rows.push({ kind: 'spread', label: `...${selection.name.value}`, start: selection.start, end: selection.end });
    } else if (selection.kind === 'InlineFragment') {
      const label = selection.typeCondition === null ? '...' : `... on ${selection.typeCondition.name.value}`;
      rows.push({ kind: 'inline', label, start: selection.start, end: selection.end });
    }
  }
  return rows;
}

/** The schema field at each step of `path` under the root type of `operationType`; null when a step is unknown. */
export function schemaFieldsAlong(
  schema: GraphqlSchema,
  operationType: OperationType,
  path: readonly string[],
): readonly GraphqlField[] | null {
  const rootName = rootTypeName(schema, operationType);
  if (rootName === null) return null;
  let type = schema.types.get(rootName);
  const fields: GraphqlField[] = [];
  for (const name of path) {
    const field = fieldsOf(type).find((entry) => entry.name === name);
    if (field === undefined) return null;
    fields.push(field);
    type = schema.types.get(namedTypeOf(field.type));
  }
  return fields;
}

/** The first leaf a composite lands with — a plain (argument-free, live) leaf field, else `__typename`. */
export function firstLeafSelection(schema: GraphqlSchema, type: GraphqlNamedType): string {
  for (const field of fieldsOf(type)) {
    if (field.deprecationReason !== null || field.args.some(isRequired)) continue;
    const named = schema.types.get(namedTypeOf(field.type));
    if (named !== undefined && isLeafType(named)) return field.name;
  }
  return '__typename';
}

// ── Variables ──────────────────────────────────────────────────────

function isRequired(arg: GraphqlInputValue): boolean {
  return arg.type.kind === 'NON_NULL' && arg.defaultValue === null;
}

function collectVariables(
  node: SelectionNode | SelectionSetNode | ArgumentNode | DirectiveNode | ValueNode,
  into: Set<string>,
  except: FieldNode | ArgumentNode | null = null,
): void {
  if (node === except) return;
  switch (node.kind) {
    case 'Variable':
      into.add(node.name.value);
      return;
    case 'ListValue':
      for (const value of node.values) collectVariables(value, into, except);
      return;
    case 'ObjectValue':
      for (const field of node.fields) collectVariables(field.value, into, except);
      return;
    case 'Argument':
      collectVariables(node.value, into, except);
      return;
    case 'Directive':
      for (const argument of node.arguments) collectVariables(argument, into, except);
      return;
    case 'SelectionSet':
      for (const selection of node.selections) collectVariables(selection, into, except);
      return;
    case 'Field':
      for (const argument of node.arguments) collectVariables(argument, into, except);
      for (const directive of node.directives) collectVariables(directive, into, except);
      if (node.selectionSet !== null) collectVariables(node.selectionSet, into, except);
      return;
    case 'FragmentSpread':
      for (const directive of node.directives) collectVariables(directive, into, except);
      return;
    case 'InlineFragment':
      for (const directive of node.directives) collectVariables(directive, into, except);
      collectVariables(node.selectionSet, into, except);
      return;
    default:
      return;
  }
}

/** The variables `removed` references that nothing else in the operation (nor `replacement`) does. */
function orphanedVariables(
  operation: OperationDefinitionNode,
  removed: FieldNode | ArgumentNode,
  replacement: ValueNode | null,
): ReadonlySet<string> {
  const gone = new Set<string>();
  collectVariables(removed, gone);
  if (gone.size === 0) return gone;
  const stay = new Set<string>();
  collectVariables(operation.selectionSet, stay, removed);
  for (const directive of operation.directives) collectVariables(directive, stay);
  if (replacement !== null) collectVariables(replacement, stay);
  const orphaned = new Set<string>();
  for (const name of gone) if (!stay.has(name)) orphaned.add(name);
  return orphaned;
}

function isShorthand(source: string, operation: OperationDefinitionNode): boolean {
  return source.charAt(operation.start) === '{';
}

function isSeparator(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',';
}

/**
 * The operation's variable definitions after `add` (declared with the
 * given types unless already declared) and `drop` — ONE edit over the
 * list: rewritten in place, opened at the head when there is none, the
 * parentheses removed with the last definition.
 */
function variableDefinitionsEdit(
  context: BuilderContext,
  operation: OperationDefinitionNode,
  add: readonly VariableEntry[],
  drop: ReadonlySet<string>,
): BuilderEdit | null {
  const definitions = operation.variableDefinitions;
  const kept = definitions.filter((definition) => !drop.has(definition.variable.name.value));
  const declared = new Set(kept.map((definition) => definition.variable.name.value));
  const fresh: string[] = [];
  for (const entry of add) {
    if (declared.has(entry.name)) continue;
    declared.add(entry.name);
    fresh.push(`$${entry.name}: ${entry.type}`);
  }
  if (kept.length === definitions.length && fresh.length === 0) return null;
  const parts = [...kept.map((definition) => context.source.slice(definition.start, definition.end)), ...fresh];
  const first = definitions[0];
  const last = definitions[definitions.length - 1];
  if (first !== undefined && last !== undefined) {
    if (parts.length > 0) return { start: first.start, end: last.end, text: parts.join(', ') };
    const open = context.source.lastIndexOf('(', first.start);
    const close = context.source.indexOf(')', last.end);
    if (open < 0 || close < 0) return null;
    // The whitespace before `(` goes too — `query ($x: T) {` reads `query {` after.
    let from = open;
    while (from > 0 && isSeparator(context.source.charAt(from - 1))) from--;
    return { start: from, end: close + 1, text: '' };
  }
  const list = `(${parts.join(', ')})`;
  if (isShorthand(context.source, operation)) {
    return { start: operation.start, end: operation.start, text: `query ${list} ` };
  }
  if (operation.name === null) {
    const at = operation.start + operation.operation.length;
    return { start: at, end: at, text: ` ${list}` };
  }
  return { start: operation.name.end, end: operation.name.end, text: list };
}

// ── Selections ─────────────────────────────────────────────────────

/** The whitespace opening the line `offset` sits on — its indent when nothing else precedes it, else that line's indent stepped in. */
function indentOf(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const lead = source.slice(lineStart, offset);
  if (/^[ \t]*$/.test(lead)) return lead;
  const own = /^[ \t]*/.exec(lead);
  return `${own === null ? '' : own[0]}  `;
}

/** Insert `text` as the last selection of `set`, following the set's layout. */
function appendSelectionEdit(source: string, set: SelectionSetNode, text: string): BuilderEdit {
  const last = set.selections[set.selections.length - 1];
  if (last === undefined) return { start: set.start + 1, end: set.start + 1, text: ` ${text} ` };
  const multiLine = source.slice(set.start, set.end).includes('\n');
  if (!multiLine) return { start: last.end, end: last.end, text: ` ${text}` };
  return { start: last.end, end: last.end, text: `\n${indentOf(source, last.start)}${text}` };
}

/** Remove one of several selections with the separator before it (after it, for the first). */
function removeSelectionEdit(set: SelectionSetNode, node: SelectionNode): BuilderEdit {
  const index = set.selections.indexOf(node);
  const previous = set.selections[index - 1];
  if (previous !== undefined) return { start: previous.end, end: node.end, text: '' };
  const next = set.selections[index + 1];
  return { start: node.start, end: next === undefined ? node.end : next.start, text: '' };
}

/** Remove a whole definition with the whitespace that separated it. */
function removeDefinitionEdit(context: BuilderContext, node: DefinitionNode): BuilderEdit {
  const definitions = context.document === null ? [] : context.document.definitions;
  const index = definitions.indexOf(node);
  if (definitions.length <= 1) return { start: 0, end: context.source.length, text: '' };
  const previous = definitions[index - 1];
  if (previous !== undefined) return { start: previous.end, end: node.end, text: '' };
  const next = definitions[index + 1];
  return { start: node.start, end: next === undefined ? node.end : next.start, text: '' };
}

function fieldText(field: GraphqlField, variables: VariableEntry[]): string {
  const required = field.args.filter(isRequired);
  for (const arg of required) variables.push({ name: arg.name, type: printTypeRef(arg.type) });
  if (required.length === 0) return field.name;
  return `${field.name}(${required.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})`;
}

/** `a { b { c { leaf } } }` for the tail of a path — a composite end lands with its first leaf. */
function nestedSelection(schema: GraphqlSchema, tail: readonly GraphqlField[], variables: VariableEntry[]): string {
  const last = tail[tail.length - 1];
  if (last === undefined) return '';
  const named = schema.types.get(namedTypeOf(last.type));
  let text = fieldText(last, variables);
  if (named !== undefined && !isLeafType(named)) text = `${text} { ${firstLeafSelection(schema, named)} }`;
  for (let index = tail.length - 2; index >= 0; index--) {
    const field = tail[index];
    if (field !== undefined) text = `${fieldText(field, variables)} { ${text} }`;
  }
  return text;
}

/** A non-empty text that does not parse — the builder has nothing to project or edit. */
export function isBuilderBroken(context: Pick<BuilderContext, 'source' | 'document'>): boolean {
  return context.document === null && context.source.trim() !== '';
}

/**
 * Check a field: the document gains the missing tail of `path` as one
 * nested selection (required arguments as variables, a composite end
 * with its first leaf) and the variables their declarations. An empty
 * document gets the operation minted around it; a document without an
 * operation gets one appended.
 */
export function selectFieldEdits(
  context: BuilderContext,
  operationType: OperationType,
  path: readonly string[],
): readonly BuilderEdit[] {
  if (path.length === 0 || isBuilderBroken(context)) return [];
  const along = schemaFieldsAlong(context.schema, operationType, path);
  if (along === null) return [];
  const { operation } = context;
  if (operation !== null && operation.operation !== operationType) return [];
  let depth = 0;
  let set: SelectionSetNode | null = operation === null ? null : operation.selectionSet;
  let field: FieldNode | null = null;
  while (set !== null && depth < path.length) {
    const name = path[depth];
    const next = name === undefined ? null : directField(set, name);
    if (next === null) break;
    field = next;
    depth++;
    set = next.selectionSet;
  }
  if (depth === path.length) return [];
  const variables: VariableEntry[] = [];
  const text = nestedSelection(context.schema, along.slice(depth), variables);
  if (operation === null) {
    const head =
      variables.length === 0
        ? operationType
        : `${operationType} (${variables.map((entry) => `$${entry.name}: ${entry.type}`).join(', ')})`;
    const body = `${head} {\n  ${text}\n}\n`;
    if (context.document === null) return [{ start: 0, end: context.source.length, text: body }];
    const gap = context.source.endsWith('\n') ? '\n' : '\n\n';
    return [{ start: context.source.length, end: context.source.length, text: `${gap}${body}` }];
  }
  const edits: BuilderEdit[] = [];
  if (set === null && field !== null) {
    // The deepest field has no selection set — it gains one around the tail.
    edits.push({ start: field.end, end: field.end, text: ` { ${text} }` });
  } else if (set !== null) {
    edits.push(appendSelectionEdit(context.source, set, text));
  }
  const declare = variableDefinitionsEdit(context, operation, variables, new Set());
  if (declare !== null) edits.push(declare);
  return edits;
}

/**
 * Uncheck a field: its node goes with the separator before it; the last
 * selection of a nested set takes the parent field with it (up the
 * path), the last root selection takes the operation; variables only
 * the removed subtree referenced lose their declarations.
 */
export function deselectFieldEdits(context: BuilderContext, path: readonly string[]): readonly BuilderEdit[] {
  const { operation } = context;
  if (operation === null || path.length === 0 || isBuilderBroken(context)) return [];
  if (fieldAt(operation, path) === null) return [];
  let depth = path.length;
  while (depth > 1) {
    const set = selectionSetAt(operation, path.slice(0, depth - 1));
    if (set === null || set.selections.length > 1) break;
    depth--;
  }
  const target = path.slice(0, depth);
  const field = fieldAt(operation, target);
  const parentSet = selectionSetAt(operation, target.slice(0, -1));
  if (field === null || parentSet === null) return [];
  if (parentSet.selections.length <= 1) return [removeDefinitionEdit(context, operation)];
  const edits: BuilderEdit[] = [removeSelectionEdit(parentSet, field)];
  const undeclare = variableDefinitionsEdit(context, operation, [], orphanedVariables(operation, field, null));
  if (undeclare !== null) edits.push(undeclare);
  return edits;
}

/**
 * Give a checked field's argument a value — a literal or a `$variable`
 * (declared with the argument's type when new); the value the argument
 * held before is replaced in place, a variable it alone referenced is
 * undeclared. Text that is not one GraphQL value yields no edit.
 */
export function setArgumentEdits(
  context: BuilderContext,
  path: readonly string[],
  argumentName: string,
  valueText: string,
): readonly BuilderEdit[] {
  const { operation } = context;
  if (operation === null || isBuilderBroken(context)) return [];
  const field = fieldAt(operation, path);
  const along = schemaFieldsAlong(context.schema, operation.operation, path);
  const schemaField = along === null ? undefined : along[along.length - 1];
  if (field === null || schemaField === undefined) return [];
  const arg = schemaField.args.find((entry) => entry.name === argumentName);
  if (arg === undefined) return [];
  const text = valueText.trim();
  const parsed = parseValue(text).value;
  if (parsed === null) return [];
  const existing = argumentAt(field, argumentName);
  const edits: BuilderEdit[] = [];
  const last = field.arguments[field.arguments.length - 1];
  if (existing !== null) {
    edits.push({ start: existing.value.start, end: existing.value.end, text });
  } else if (last !== undefined) {
    edits.push({ start: last.end, end: last.end, text: `, ${argumentName}: ${text}` });
  } else {
    edits.push({ start: field.name.end, end: field.name.end, text: `(${argumentName}: ${text})` });
  }
  const wanted: VariableEntry[] =
    parsed.kind === 'Variable' ? [{ name: parsed.name.value, type: printTypeRef(arg.type) }] : [];
  const orphaned = existing === null ? new Set<string>() : orphanedVariables(operation, existing, parsed);
  const variables = variableDefinitionsEdit(context, operation, wanted, orphaned);
  if (variables !== null) edits.push(variables);
  return edits;
}

/** Uncheck an argument: it goes with its separator (the parentheses with the last one); an orphaned variable is undeclared. */
export function removeArgumentEdits(
  context: BuilderContext,
  path: readonly string[],
  argumentName: string,
): readonly BuilderEdit[] {
  const { operation } = context;
  if (operation === null || isBuilderBroken(context)) return [];
  const field = fieldAt(operation, path);
  if (field === null) return [];
  const existing = argumentAt(field, argumentName);
  if (existing === null) return [];
  const args = field.arguments;
  let removal: BuilderEdit;
  const index = args.indexOf(existing);
  const previous = args[index - 1];
  const next = args[index + 1];
  if (args.length === 1) {
    const open = context.source.lastIndexOf('(', existing.start);
    const close = context.source.indexOf(')', existing.end);
    removal = { start: open < 0 ? existing.start : open, end: close < 0 ? existing.end : close + 1, text: '' };
  } else if (previous !== undefined) {
    removal = { start: previous.end, end: existing.end, text: '' };
  } else {
    removal = { start: existing.start, end: next === undefined ? existing.end : next.start, text: '' };
  }
  const edits: BuilderEdit[] = [removal];
  const undeclare = variableDefinitionsEdit(context, operation, [], orphanedVariables(operation, existing, null));
  if (undeclare !== null) edits.push(undeclare);
  return edits;
}

/** The text after `edits` (non-overlapping, any order) — what the editor's edit stack produces. */
export function applyBuilderEdits(source: string, edits: readonly BuilderEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of ordered) out = `${out.slice(0, edit.start)}${edit.text}${out.slice(edit.end)}`;
  return out;
}
