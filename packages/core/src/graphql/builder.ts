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
 * A path is a list of steps: a field by name, or an inline fragment by
 * its type condition — the `... on T` row a union or interface member
 * gets. Reads walk direct Field nodes by name (an alias keeps the name;
 * the first match wins) and an `on` step into the first inline fragment
 * with that type condition. Named spreads and the inline fragments the
 * tree does not project are reported as read-only rows. Writes follow
 * the local layout — a multi-line selection set gets the new selection
 * on its own line at the siblings' indent, a single-line one gets it
 * space-separated — and keep the document valid at every step: a
 * composite field or a fragment lands with its first leaf, the last
 * selection leaving a nested set takes its parent field with it, a
 * fragment leaving as a field's last selection leaves `__typename`
 * behind, the last root selection removes the operation, and a variable
 * the builder no longer references loses its declaration.
 *
 * An input-object argument is a subtree of its own: its input fields
 * project onto the argument's object literal by KEY PATH, a key is set
 * in place (the literal opened, or a variable the argument held
 * promoted to one, on the way), and a key removed takes its emptied
 * parents with it up to the argument — the same last-child law as the
 * selections.
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
  possibleTypesOf,
  printTypeRef,
  rootTypeName,
} from './schema';
import type {
  ArgumentNode,
  DefinitionNode,
  DirectiveNode,
  DocumentNode,
  FieldNode,
  InlineFragmentNode,
  ObjectFieldNode,
  ObjectValueNode,
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

/** One step of a builder path — a field by name, or an inline fragment by its type condition (`... on T`). */
export type BuilderStep = string | { readonly on: string };

export type BuilderPath = readonly BuilderStep[];

/** The keys into an argument's object literal — an input field, then the input fields beneath it. */
export type InputFieldPath = readonly string[];

/** The document node a path lands on — the Field of a name step, the InlineFragment of an `on` step. */
export type BuilderNode = FieldNode | InlineFragmentNode;

/** A fragment in a selection set the tree does not project — shown read-only. */
export interface BuilderFragmentRow extends Span {
  readonly kind: 'spread' | 'inline';
  /** `...Name` / `... on Type` / `...` */
  readonly label: string;
}

/** A path step resolved against the schema — the field it names, or the possible type its `on` step narrows to. */
export type SchemaStep =
  | { readonly kind: 'field'; readonly field: GraphqlField }
  | { readonly kind: 'on'; readonly type: GraphqlNamedType };

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

function directFragment(set: SelectionSetNode, type: string): InlineFragmentNode | null {
  for (const selection of set.selections) {
    if (selection.kind === 'InlineFragment' && selection.typeCondition?.name.value === type) return selection;
  }
  return null;
}

function stepInto(set: SelectionSetNode, step: BuilderStep): BuilderNode | null {
  return typeof step === 'string' ? directField(set, step) : directFragment(set, step.on);
}

/** The node at `path` — each step's direct field or inline fragment, the first match; null when any step is missing. */
export function nodeAt(operation: OperationDefinitionNode, path: BuilderPath): BuilderNode | null {
  let set: SelectionSetNode | null = operation.selectionSet;
  let node: BuilderNode | null = null;
  for (const step of path) {
    if (set === null) return null;
    node = stepInto(set, step);
    if (node === null) return null;
    set = node.selectionSet;
  }
  return node;
}

/** The Field at `path`; null when a step is missing or the path ends on an `on` step. */
export function fieldAt(operation: OperationDefinitionNode, path: BuilderPath): FieldNode | null {
  const node = nodeAt(operation, path);
  return node !== null && node.kind === 'Field' ? node : null;
}

/** The selection set under `path` — the operation's own for `[]`; null when a step is missing or the field has none. */
export function selectionSetAt(operation: OperationDefinitionNode, path: BuilderPath): SelectionSetNode | null {
  if (path.length === 0) return operation.selectionSet;
  const node = nodeAt(operation, path);
  return node === null ? null : node.selectionSet;
}

export function argumentAt(field: FieldNode, name: string): ArgumentNode | null {
  for (const argument of field.arguments) if (argument.name.value === name) return argument;
  return null;
}

function objectField(value: ObjectValueNode, key: string): ObjectFieldNode | null {
  for (const field of value.fields) if (field.name.value === key) return field;
  return null;
}

/** The object field at `keys` inside `value` — each step a direct key of an object literal; null when a step is missing, the value there is not an object, or `keys` is empty. */
export function inputFieldAt(value: ValueNode, keys: InputFieldPath): ObjectFieldNode | null {
  let current: ValueNode = value;
  let found: ObjectFieldNode | null = null;
  for (const key of keys) {
    if (current.kind !== 'ObjectValue') return null;
    found = objectField(current, key);
    if (found === null) return null;
    current = found.value;
  }
  return found;
}

/** Each key of `keys` resolved as an input field under `arg`'s input type, then the previous key's; null when a step names no field or the type there is not an input object. */
export function inputFieldsAlong(
  schema: GraphqlSchema,
  arg: GraphqlInputValue,
  keys: InputFieldPath,
): readonly GraphqlInputValue[] | null {
  let type = schema.types.get(namedTypeOf(arg.type));
  const along: GraphqlInputValue[] = [];
  for (const key of keys) {
    if (type === undefined || type.kind !== 'INPUT_OBJECT') return null;
    const field = type.inputFields.find((entry) => entry.name === key);
    if (field === undefined) return null;
    along.push(field);
    type = schema.types.get(namedTypeOf(field.type));
  }
  return along;
}

/** The read-only fragment rows under `path` — every named spread, and the inline fragments whose type condition is not one of `projected` (the member rows the tree walks itself). */
export function fragmentsAt(
  operation: OperationDefinitionNode,
  path: BuilderPath,
  projected: readonly string[] = [],
): readonly BuilderFragmentRow[] {
  const set = selectionSetAt(operation, path);
  if (set === null) return [];
  const rows: BuilderFragmentRow[] = [];
  for (const selection of set.selections) {
    if (selection.kind === 'FragmentSpread') {
      rows.push({ kind: 'spread', label: `...${selection.name.value}`, start: selection.start, end: selection.end });
    } else if (selection.kind === 'InlineFragment') {
      const condition = selection.typeCondition === null ? null : selection.typeCondition.name.value;
      if (condition !== null && projected.includes(condition)) continue;
      const label = condition === null ? '...' : `... on ${condition}`;
      rows.push({ kind: 'inline', label, start: selection.start, end: selection.end });
    }
  }
  return rows;
}

/** Each step of `path` resolved under the root type of `operationType`; null when a step names no field or no possible type. */
export function schemaStepsAlong(
  schema: GraphqlSchema,
  operationType: OperationType,
  path: BuilderPath,
): readonly SchemaStep[] | null {
  const rootName = rootTypeName(schema, operationType);
  if (rootName === null) return null;
  let type = schema.types.get(rootName);
  const steps: SchemaStep[] = [];
  for (const step of path) {
    if (typeof step === 'string') {
      const field = fieldsOf(type).find((entry) => entry.name === step);
      if (field === undefined) return null;
      steps.push({ kind: 'field', field });
      type = schema.types.get(namedTypeOf(field.type));
    } else {
      const member =
        type !== undefined && possibleTypesOf(schema, type).includes(step.on) ? schema.types.get(step.on) : undefined;
      if (member === undefined) return null;
      steps.push({ kind: 'on', type: member });
      type = member;
    }
  }
  return steps;
}

function stepType(schema: GraphqlSchema, step: SchemaStep): GraphqlNamedType | undefined {
  return step.kind === 'field' ? schema.types.get(namedTypeOf(step.field.type)) : step.type;
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

/** A node a gesture removes or replaces — what the orphan check leaves out of the "still referenced" walk. */
type Removed = SelectionNode | ArgumentNode | ObjectFieldNode | ValueNode;

function collectVariables(
  node: SelectionNode | SelectionSetNode | ArgumentNode | DirectiveNode | ObjectFieldNode | ValueNode,
  into: Set<string>,
  except: Removed | null = null,
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
      for (const field of node.fields) collectVariables(field, into, except);
      return;
    case 'ObjectField':
      collectVariables(node.value, into, except);
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
  removed: Removed,
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

/** The step as the document selects it — a field with its required arguments as same-named variables, or `... on T`. */
function stepText(step: SchemaStep, variables: VariableEntry[]): string {
  if (step.kind === 'on') return `... on ${step.type.name}`;
  const { field } = step;
  const required = field.args.filter(isRequired);
  for (const arg of required) variables.push({ name: arg.name, type: printTypeRef(arg.type) });
  if (required.length === 0) return field.name;
  return `${field.name}(${required.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})`;
}

/** `a { b { ... on T { leaf } } }` for the tail of a path — a composite end (a field, or a fragment) lands with its first leaf. */
function nestedSelection(schema: GraphqlSchema, tail: readonly SchemaStep[], variables: VariableEntry[]): string {
  const last = tail[tail.length - 1];
  if (last === undefined) return '';
  const named = stepType(schema, last);
  let text = stepText(last, variables);
  if (named !== undefined && !isLeafType(named)) text = `${text} { ${firstLeafSelection(schema, named)} }`;
  for (let index = tail.length - 2; index >= 0; index--) {
    const step = tail[index];
    if (step !== undefined) text = `${stepText(step, variables)} { ${text} }`;
  }
  return text;
}

/** A non-empty text that does not parse — the builder has nothing to project or edit. */
export function isBuilderBroken(context: Pick<BuilderContext, 'source' | 'document'>): boolean {
  return context.document === null && context.source.trim() !== '';
}

/**
 * Check a row — a field, or a member's `... on T`: the document gains
 * the missing tail of `path` as one nested selection (required
 * arguments as variables, a composite end with its first leaf) and the
 * variables their declarations. An empty document gets the operation
 * minted around it; a document without an operation gets one appended.
 */
export function selectFieldEdits(
  context: BuilderContext,
  operationType: OperationType,
  path: BuilderPath,
): readonly BuilderEdit[] {
  if (path.length === 0 || isBuilderBroken(context)) return [];
  const along = schemaStepsAlong(context.schema, operationType, path);
  if (along === null) return [];
  const { operation } = context;
  if (operation !== null && operation.operation !== operationType) return [];
  let depth = 0;
  let set: SelectionSetNode | null = operation === null ? null : operation.selectionSet;
  let node: BuilderNode | null = null;
  while (set !== null && depth < path.length) {
    const step = path[depth];
    const next = step === undefined ? null : stepInto(set, step);
    if (next === null) break;
    node = next;
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
  if (set === null && node !== null) {
    // The deepest field has no selection set — it gains one around the tail.
    edits.push({ start: node.end, end: node.end, text: ` { ${text} }` });
  } else if (set !== null) {
    edits.push(appendSelectionEdit(context.source, set, text));
  }
  const declare = variableDefinitionsEdit(context, operation, variables, new Set());
  if (declare !== null) edits.push(declare);
  return edits;
}

/** The step at `depth` is a fragment that is a FIELD's selection — removed as the field's last one, it leaves `__typename`, so the field stays selected on a set that is never empty. */
function leavesTypename(path: BuilderPath, depth: number): boolean {
  return depth >= 2 && typeof path[depth - 1] !== 'string' && typeof path[depth - 2] === 'string';
}

/**
 * Uncheck a row: its node goes with the separator before it; the last
 * selection of a nested set takes the parent field with it (up the
 * path) — except a fragment under a field, which leaves `__typename` in
 * its place; the last root selection takes the operation; variables
 * only the removed subtree referenced lose their declarations.
 */
export function deselectFieldEdits(context: BuilderContext, path: BuilderPath): readonly BuilderEdit[] {
  const { operation } = context;
  if (operation === null || path.length === 0 || isBuilderBroken(context)) return [];
  if (nodeAt(operation, path) === null) return [];
  let depth = path.length;
  while (depth > 1) {
    const set = selectionSetAt(operation, path.slice(0, depth - 1));
    if (set === null || set.selections.length > 1 || leavesTypename(path, depth)) break;
    depth--;
  }
  const target = path.slice(0, depth);
  const node = nodeAt(operation, target);
  const parentSet = selectionSetAt(operation, target.slice(0, -1));
  if (node === null || parentSet === null) return [];
  const edits: BuilderEdit[] = [];
  if (parentSet.selections.length > 1) edits.push(removeSelectionEdit(parentSet, node));
  else if (leavesTypename(target, depth)) edits.push({ start: node.start, end: node.end, text: '__typename' });
  else return [removeDefinitionEdit(context, operation)];
  const undeclare = variableDefinitionsEdit(context, operation, [], orphanedVariables(operation, node, null));
  if (undeclare !== null) edits.push(undeclare);
  return edits;
}

/**
 * Give a checked field's argument a value — a literal or a `$variable`
 * (declared with the argument's type when new); the value the argument
 * held before is replaced in place, a variable it alone referenced is
 * undeclared. Text that is not one GraphQL value yields no edit.
 */
/** A checked field's argument as the schema and the document know it; null when the path lands on no field or the field has no such argument. */
interface ArgumentSite {
  readonly operation: OperationDefinitionNode;
  readonly field: FieldNode;
  readonly arg: GraphqlInputValue;
  readonly existing: ArgumentNode | null;
}

function argumentSite(context: BuilderContext, path: BuilderPath, argumentName: string): ArgumentSite | null {
  const { operation } = context;
  if (operation === null || isBuilderBroken(context)) return null;
  const field = fieldAt(operation, path);
  const along = schemaStepsAlong(context.schema, operation.operation, path);
  const end = along === null ? undefined : along[along.length - 1];
  const schemaField = end !== undefined && end.kind === 'field' ? end.field : undefined;
  if (field === null || schemaField === undefined) return null;
  const arg = schemaField.args.find((entry) => entry.name === argumentName);
  if (arg === undefined) return null;
  return { operation, field, arg, existing: argumentAt(field, argumentName) };
}

/** The argument set to `text` — replaced in place, appended to the list, or the list opened. */
function argumentValueEdit(site: ArgumentSite, text: string): BuilderEdit {
  const { field, existing } = site;
  if (existing !== null) return { start: existing.value.start, end: existing.value.end, text };
  const last = field.arguments[field.arguments.length - 1];
  if (last !== undefined) return { start: last.end, end: last.end, text: `, ${site.arg.name}: ${text}` };
  return { start: field.name.end, end: field.name.end, text: `(${site.arg.name}: ${text})` };
}

export function setArgumentEdits(
  context: BuilderContext,
  path: BuilderPath,
  argumentName: string,
  valueText: string,
): readonly BuilderEdit[] {
  const site = argumentSite(context, path, argumentName);
  if (site === null) return [];
  const { operation, arg, existing } = site;
  const text = valueText.trim();
  const parsed = parseValue(text).value;
  if (parsed === null) return [];
  const edits: BuilderEdit[] = [argumentValueEdit(site, text)];
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
  path: BuilderPath,
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

// ── Input fields ───────────────────────────────────────────────────

/** `{ k1: { k2: text } }` for the keys from `from` on — the literal the missing tail of a key path opens. */
function nestedLiteral(keys: InputFieldPath, from: number, text: string): string {
  let inner = text;
  for (let index = keys.length - 1; index >= from; index--) inner = `{ ${keys[index]}: ${inner} }`;
  return inner;
}

/** Insert `text` as the last key of `value` — `{ }` opens around it, a list gains it after the last key. */
function appendObjectFieldEdit(value: ObjectValueNode, text: string): BuilderEdit {
  const last = value.fields[value.fields.length - 1];
  if (last === undefined) return { start: value.start, end: value.end, text: `{ ${text} }` };
  return { start: last.end, end: last.end, text: `, ${text}` };
}

/** Remove one of several keys with the separator before it (after it, for the first). */
function removeObjectFieldEdit(value: ObjectValueNode, field: ObjectFieldNode): BuilderEdit {
  const index = value.fields.indexOf(field);
  const previous = value.fields[index - 1];
  if (previous !== undefined) return { start: previous.end, end: field.end, text: '' };
  const next = value.fields[index + 1];
  return { start: field.start, end: next === undefined ? field.end : next.start, text: '' };
}

/**
 * Give an input field of a checked field's argument a value — a
 * literal or a `$variable` (declared with the input field's type when
 * new). The argument's object literal opens when the argument is not
 * set, a value it holds that is not an object (a `$variable`, a
 * scalar) is promoted to one, the missing keys on the way open as
 * nested literals, and an existing key is replaced in place; a
 * variable only the replaced value referenced is undeclared. Text
 * that is not one GraphQL value yields no edit.
 */
export function setInputFieldEdits(
  context: BuilderContext,
  path: BuilderPath,
  argumentName: string,
  keys: InputFieldPath,
  valueText: string,
): readonly BuilderEdit[] {
  const site = argumentSite(context, path, argumentName);
  if (site === null || keys.length === 0) return [];
  const { operation, arg, existing } = site;
  const along = inputFieldsAlong(context.schema, arg, keys);
  const leaf = along === null ? undefined : along[along.length - 1];
  if (leaf === undefined) return [];
  const text = valueText.trim();
  const parsed = parseValue(text).value;
  if (parsed === null) return [];
  const edits: BuilderEdit[] = [];
  let replaced: ValueNode | null = null;
  if (existing === null) {
    edits.push(argumentValueEdit(site, nestedLiteral(keys, 0, text)));
  } else {
    let current: ValueNode = existing.value;
    let depth = 0;
    while (depth < keys.length) {
      const key = keys[depth];
      if (key === undefined) break;
      if (current.kind !== 'ObjectValue') {
        replaced = current;
        edits.push({ start: current.start, end: current.end, text: nestedLiteral(keys, depth, text) });
        break;
      }
      const field = objectField(current, key);
      if (field === null) {
        edits.push(appendObjectFieldEdit(current, `${key}: ${nestedLiteral(keys, depth + 1, text)}`));
        break;
      }
      current = field.value;
      depth++;
    }
    if (depth === keys.length) {
      replaced = current;
      edits.push({ start: current.start, end: current.end, text });
    }
  }
  const wanted: VariableEntry[] =
    parsed.kind === 'Variable' ? [{ name: parsed.name.value, type: printTypeRef(leaf.type) }] : [];
  const orphaned = replaced === null ? new Set<string>() : orphanedVariables(operation, replaced, parsed);
  const variables = variableDefinitionsEdit(context, operation, wanted, orphaned);
  if (variables !== null) edits.push(variables);
  return edits;
}

/**
 * Uncheck an input field: the key goes with its separator; the last
 * key of a nested literal takes its parent key with it (up the path),
 * and the last key of the argument's literal takes the argument — a
 * required one its field, as the argument's own uncheck does; an
 * orphaned variable is undeclared.
 */
export function removeInputFieldEdits(
  context: BuilderContext,
  path: BuilderPath,
  argumentName: string,
  keys: InputFieldPath,
): readonly BuilderEdit[] {
  const site = argumentSite(context, path, argumentName);
  if (site === null || keys.length === 0) return [];
  const { operation, arg, existing } = site;
  if (existing === null || inputFieldAt(existing.value, keys) === null) return [];
  let depth = keys.length;
  while (depth > 1) {
    const parent = inputFieldAt(existing.value, keys.slice(0, depth - 1));
    if (parent === null || parent.value.kind !== 'ObjectValue' || parent.value.fields.length > 1) break;
    depth--;
  }
  const top = existing.value;
  if (depth === 1 && top.kind === 'ObjectValue' && top.fields.length === 1) {
    return isRequired(arg) ? deselectFieldEdits(context, path) : removeArgumentEdits(context, path, argumentName);
  }
  const target = inputFieldAt(existing.value, keys.slice(0, depth));
  const containerValue = depth === 1 ? top : inputFieldAt(existing.value, keys.slice(0, depth - 1))?.value;
  if (target === null || containerValue === undefined || containerValue.kind !== 'ObjectValue') return [];
  const edits: BuilderEdit[] = [removeObjectFieldEdit(containerValue, target)];
  const undeclare = variableDefinitionsEdit(context, operation, [], orphanedVariables(operation, target, null));
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
