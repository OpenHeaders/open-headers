/**
 * The query builder — the projection of a document's direct selections
 * by path, and the span edits every checkbox gesture becomes: select
 * (the missing tail as one nested selection, required arguments as
 * declared variables, a composite end with its first leaf, the operation
 * minted on a blank), deselect (the separator goes with the node, the
 * last child takes its parent, the last root selection takes the
 * operation, orphaned variables undeclared), arguments (set in place /
 * appended / opened, removed with their parentheses), and the layout
 * rules (multi-line sets get a line, single-line sets a space).
 */

import {
  applyBuilderEdits,
  argumentAt,
  type BuilderContext,
  deselectFieldEdits,
  fieldAt,
  fragmentsAt,
  isBuilderBroken,
  type OperationDefinitionNode,
  parseDocument,
  parseValue,
  removeArgumentEdits,
  selectFieldEdits,
  setArgumentEdits,
  validateDocument,
} from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

function context(source: string): BuilderContext {
  const document = parseDocument(source).document;
  const operation =
    document?.definitions.find((node): node is OperationDefinitionNode => node.kind === 'OperationDefinition') ?? null;
  return { source, document, operation, schema };
}

function operationOf(source: string): OperationDefinitionNode {
  const { operation } = context(source);
  if (operation === null) throw new Error('no operation');
  return operation;
}

/** Apply the gesture and pin that the result still parses and validates. */
function applied(source: string, edits: ReturnType<typeof selectFieldEdits>): string {
  const next = applyBuilderEdits(source, edits);
  if (next.trim() !== '') {
    const parsed = parseDocument(next);
    expect(parsed.errors).toEqual([]);
    if (parsed.document !== null) expect(validateDocument(parsed.document, schema)).toEqual([]);
  }
  return next;
}

describe('projection', () => {
  it('walks direct fields by name and reports fragments read-only', () => {
    const operation = operationOf(
      'query { viewer { id ...UserFields notes(first: 2) { edges { node { title } } } ... on User { email } } }\nfragment UserFields on User { name }',
    );
    expect(fieldAt(operation, ['viewer'])?.name.value).toBe('viewer');
    expect(fieldAt(operation, ['viewer', 'notes', 'edges', 'node', 'title'])?.name.value).toBe('title');
    expect(fieldAt(operation, ['viewer', 'name'])).toBeNull();
    expect(fieldAt(operation, ['viewer', 'email'])).toBeNull();
    expect(fragmentsAt(operation, ['viewer']).map((row) => row.label)).toEqual(['...UserFields', '... on User']);
    const notes = fieldAt(operation, ['viewer', 'notes']);
    expect(notes === null ? null : argumentAt(notes, 'first')?.value.kind).toBe('IntValue');
  });

  it('keeps the name of an aliased field and takes the first match', () => {
    const operation = operationOf('{ me: viewer { id } viewer { email } }');
    expect(fieldAt(operation, ['viewer'])?.alias?.value).toBe('me');
  });

  it('tells a blank from a broken document', () => {
    expect(isBuilderBroken(context(''))).toBe(false);
    expect(isBuilderBroken(context('   \n'))).toBe(false);
    expect(isBuilderBroken(context('query {'))).toBe(true);
  });
});

describe('selectFieldEdits', () => {
  it('mints the operation on a blank, with a composite end landing on its first leaf', () => {
    const source = '';
    const next = applied(source, selectFieldEdits(context(source), 'query', ['viewer']));
    expect(next).toBe('query {\n  viewer { id }\n}\n');
  });

  it('declares the required arguments of every inserted field as variables', () => {
    const source = '';
    const next = applied(source, selectFieldEdits(context(source), 'mutation', ['setRole']));
    expect(next).toBe('mutation ($userId: ID!, $role: Role!) {\n  setRole(userId: $userId, role: $role) { id }\n}\n');
  });

  it('appends after the last selection following the layout — a space on one line, a line at the indent', () => {
    const oneLine = 'query Echo($t: String!) { echo(text: $t) }';
    expect(applied(oneLine, selectFieldEdits(context(oneLine), 'query', ['viewer']))).toBe(
      'query Echo($t: String!) { echo(text: $t) viewer { id } }',
    );
    const pretty = 'query {\n  viewer {\n    id\n  }\n}\n';
    expect(applied(pretty, selectFieldEdits(context(pretty), 'query', ['viewer', 'email']))).toBe(
      'query {\n  viewer {\n    id\n    email\n  }\n}\n',
    );
  });

  it('inserts the missing tail of a path as one nested selection and opens a set on a bare composite', () => {
    const source = '{ viewer { id } }';
    expect(applied(source, selectFieldEdits(context(source), 'query', ['viewer', 'notes', 'edges', 'cursor']))).toBe(
      '{ viewer { id notes { edges { cursor } } } }',
    );
    const bare = 'query { viewer }';
    expect(applyBuilderEdits(bare, selectFieldEdits(context(bare), 'query', ['viewer', 'name']))).toBe(
      'query { viewer { name } }',
    );
  });

  it('declares a required variable on an operation without a list — the shorthand gains the keyword', () => {
    const shorthand = '{ viewer { id } }';
    expect(applied(shorthand, selectFieldEdits(context(shorthand), 'query', ['user', 'id']))).toBe(
      'query ($id: ID!) { viewer { id } user(id: $id) { id } }',
    );
    const named = 'query Q { viewer { id } }';
    expect(applied(named, selectFieldEdits(context(named), 'query', ['user']))).toBe(
      'query Q($id: ID!) { viewer { id } user(id: $id) { id } }',
    );
    const declared = 'query Q($id: ID!) { user(id: $id) { id } }';
    expect(applied(declared, selectFieldEdits(context(declared), 'query', ['node']))).toBe(
      'query Q($id: ID!) { user(id: $id) { id } node(id: $id) { id } }',
    );
  });

  it('refuses another operation type, an unknown path, a selected path and a broken document', () => {
    expect(selectFieldEdits(context('{ viewer { id } }'), 'mutation', ['createNote'])).toEqual([]);
    expect(selectFieldEdits(context('{ viewer { id } }'), 'query', ['viewer', 'nope'])).toEqual([]);
    expect(selectFieldEdits(context('{ viewer { id } }'), 'query', ['viewer', 'id'])).toEqual([]);
    expect(selectFieldEdits(context('{ viewer {'), 'query', ['viewer'])).toEqual([]);
  });

  it('appends an operation after a document of fragments', () => {
    const source = 'fragment F on User { id }\n';
    expect(applied(source, selectFieldEdits(context(source), 'query', ['partial', 'ok']))).toBe(
      'fragment F on User { id }\n\nquery {\n  partial { ok }\n}\n',
    );
  });
});

describe('deselectFieldEdits', () => {
  it('removes a selection with the separator before it, or after it for the first', () => {
    const source = 'query {\n  viewer {\n    id\n    email\n  }\n}\n';
    expect(applied(source, deselectFieldEdits(context(source), ['viewer', 'email']))).toBe(
      'query {\n  viewer {\n    id\n  }\n}\n',
    );
    expect(applied(source, deselectFieldEdits(context(source), ['viewer', 'id']))).toBe(
      'query {\n  viewer {\n    email\n  }\n}\n',
    );
  });

  it('takes the parent with the last child and the operation with the last root selection', () => {
    const source = '{ partial { ok } viewer { id } }';
    expect(applied(source, deselectFieldEdits(context(source), ['viewer', 'id']))).toBe('{ partial { ok } }');
    const single = 'query Q {\n  viewer {\n    notes {\n      totalCount\n    }\n  }\n}\n';
    expect(applied(single, deselectFieldEdits(context(single), ['viewer', 'notes', 'totalCount']))).toBe('');
    const withFragment = 'fragment F on User { id }\n\nquery { viewer { id } }\n';
    expect(applied(withFragment, deselectFieldEdits(context(withFragment), ['viewer']))).toBe(
      'fragment F on User { id }\n',
    );
  });

  it('undeclares the variables only the removed subtree referenced', () => {
    const source = 'query Q($id: ID!, $t: String!) { user(id: $id) { id } echo(text: $t) }';
    expect(applied(source, deselectFieldEdits(context(source), ['user']))).toBe(
      'query Q($t: String!) { echo(text: $t) }',
    );
    const shared = 'query ($id: ID!) { user(id: $id) { id } node(id: $id) { id } }';
    expect(applied(shared, deselectFieldEdits(context(shared), ['node']))).toBe(
      'query ($id: ID!) { user(id: $id) { id } }',
    );
    const last = 'query ($t: String!) { echo(text: $t) partial { ok } }';
    expect(applied(last, deselectFieldEdits(context(last), ['echo']))).toBe('query { partial { ok } }');
  });

  it('yields nothing for an unselected path', () => {
    expect(deselectFieldEdits(context('{ viewer { id } }'), ['viewer', 'email'])).toEqual([]);
  });
});

describe('arguments', () => {
  it('opens the list, appends to it, and replaces a value in place', () => {
    const bare = '{ users { totalCount } }';
    const opened = applied(bare, setArgumentEdits(context(bare), ['users'], 'first', '$first'));
    expect(opened).toBe('query ($first: Int) { users(first: $first) { totalCount } }');
    const appended = applied(opened, setArgumentEdits(context(opened), ['users'], 'role', 'OWNER'));
    expect(appended).toBe('query ($first: Int) { users(first: $first, role: OWNER) { totalCount } }');
    const replaced = applied(appended, setArgumentEdits(context(appended), ['users'], 'first', '5'));
    expect(replaced).toBe('query { users(first: 5, role: OWNER) { totalCount } }');
  });

  it('accepts one GraphQL value only, and keeps a variable that is still referenced elsewhere', () => {
    const source = 'query ($id: ID!) { user(id: $id) { id } node(id: $id) { id } }';
    expect(setArgumentEdits(context(source), ['user'], 'id', 'not a value')).toEqual([]);
    expect(setArgumentEdits(context(source), ['user'], 'id', '')).toEqual([]);
    expect(applied(source, setArgumentEdits(context(source), ['user'], 'id', '"u1"'))).toBe(
      'query ($id: ID!) { user(id: "u1") { id } node(id: $id) { id } }',
    );
  });

  it('removes an argument with its separator, the parentheses with the last, and the orphaned variable', () => {
    const source = 'query ($first: Int, $role: Role) { users(first: $first, role: $role) { totalCount } }';
    const first = applied(source, removeArgumentEdits(context(source), ['users'], 'first'));
    expect(first).toBe('query ($role: Role) { users(role: $role) { totalCount } }');
    const none = applied(first, removeArgumentEdits(context(first), ['users'], 'role'));
    expect(none).toBe('query { users { totalCount } }');
    const middle = '{ users(first: 1, after: "a", role: OWNER) { totalCount } }';
    expect(applied(middle, removeArgumentEdits(context(middle), ['users'], 'after'))).toBe(
      '{ users(first: 1, role: OWNER) { totalCount } }',
    );
  });

  it('parses a standalone value and nothing more', () => {
    expect(parseValue('{ id: $x, tags: ["a"] }').value?.kind).toBe('ObjectValue');
    expect(parseValue('1 2').value).toBeNull();
    expect(parseValue('').value).toBeNull();
  });
});
