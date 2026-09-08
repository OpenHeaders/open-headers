/**
 * The query builder — the projection of a document's direct selections
 * by path, and the span edits every checkbox gesture becomes: select
 * (the missing tail as one nested selection, required arguments as
 * declared variables, a composite end with its first leaf, the operation
 * minted on a blank), deselect (the separator goes with the node, the
 * last child takes its parent, the last root selection takes the
 * operation, orphaned variables undeclared), arguments (set in place /
 * appended / opened, removed with their parentheses), input fields
 * (the argument's object literal opened / promoted / appended /
 * replaced by key path, a key removed with its emptied parents up to
 * the argument), and the layout rules (multi-line sets get a line,
 * single-line sets a space).
 */

import {
  applyBuilderEdits,
  argumentAt,
  type BuilderContext,
  deselectFieldEdits,
  fieldAt,
  fragmentsAt,
  inputFieldAt,
  inputFieldsAlong,
  isBuilderBroken,
  nodeAt,
  type OperationDefinitionNode,
  parseDocument,
  parseValue,
  removeArgumentEdits,
  removeInputFieldEdits,
  selectFieldEdits,
  setArgumentEdits,
  setInputFieldEdits,
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
    expect(fragmentsAt(operation, ['viewer'], ['User']).map((row) => row.label)).toEqual(['...UserFields']);
    const notes = fieldAt(operation, ['viewer', 'notes']);
    expect(notes === null ? null : argumentAt(notes, 'first')?.value.kind).toBe('IntValue');
  });

  it('walks an `on` step into the first inline fragment with that type condition', () => {
    const operation = operationOf(
      '{ search(term: "x") { __typename ... on User { id } ... on User { email } ... on Note { title } ... { body } } }',
    );
    expect(nodeAt(operation, ['search', { on: 'User' }])?.kind).toBe('InlineFragment');
    expect(fieldAt(operation, ['search', { on: 'User' }])).toBeNull();
    expect(fieldAt(operation, ['search', { on: 'User' }, 'id'])?.name.value).toBe('id');
    expect(fieldAt(operation, ['search', { on: 'User' }, 'email'])).toBeNull();
    expect(fieldAt(operation, ['search', { on: 'Note' }, 'title'])?.name.value).toBe('title');
    expect(nodeAt(operation, ['search', { on: 'Role' }])).toBeNull();
    expect(fragmentsAt(operation, ['search'], ['User', 'Note']).map((row) => row.label)).toEqual(['...']);
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

describe('member rows', () => {
  it("lands a union-typed field's own check on `__typename` and a member's `... on T` with its first leaf", () => {
    expect(applied('', selectFieldEdits(context(''), 'query', ['search']))).toBe(
      'query ($term: String!) {\n  search(term: $term) { __typename }\n}\n',
    );
    expect(applied('', selectFieldEdits(context(''), 'query', ['search', { on: 'User' }]))).toBe(
      'query ($term: String!) {\n  search(term: $term) { ... on User { id } }\n}\n',
    );
  });

  it('creates the missing fragment on the way down following the layout, and appends inside an existing one', () => {
    const oneLine = '{ search(term: "x") { __typename } }';
    expect(applied(oneLine, selectFieldEdits(context(oneLine), 'query', ['search', { on: 'Note' }, 'title']))).toBe(
      '{ search(term: "x") { __typename ... on Note { title } } }',
    );
    const pretty = 'query ($term: String!) {\n  search(term: $term) {\n    ... on User {\n      id\n    }\n  }\n}\n';
    expect(applied(pretty, selectFieldEdits(context(pretty), 'query', ['search', { on: 'User' }, 'name']))).toBe(
      'query ($term: String!) {\n  search(term: $term) {\n    ... on User {\n      id\n      name\n    }\n  }\n}\n',
    );
    expect(applied(pretty, selectFieldEdits(context(pretty), 'query', ['search', { on: 'Note' }]))).toBe(
      'query ($term: String!) {\n  search(term: $term) {\n    ... on User {\n      id\n    }\n    ... on Note { id }\n  }\n}\n',
    );
  });

  it("removes a fragment with its children, leaving `__typename` when it was the field's last selection", () => {
    const beside = '{ search(term: "x") { __typename ... on User { id } } }';
    expect(applied(beside, deselectFieldEdits(context(beside), ['search', { on: 'User' }]))).toBe(
      '{ search(term: "x") { __typename } }',
    );
    const alone = 'query ($term: String!) { search(term: $term) { ... on User { id name } } }';
    expect(applied(alone, deselectFieldEdits(context(alone), ['search', { on: 'User' }]))).toBe(
      'query ($term: String!) { search(term: $term) { __typename } }',
    );
    expect(applied(alone, deselectFieldEdits(context(alone), ['search', { on: 'User' }, 'id']))).toBe(
      'query ($term: String!) { search(term: $term) { ... on User { name } } }',
    );
    const leaf = 'query ($term: String!) { search(term: $term) { ... on User { id } } }';
    expect(applied(leaf, deselectFieldEdits(context(leaf), ['search', { on: 'User' }, 'id']))).toBe(
      'query ($term: String!) { search(term: $term) { __typename } }',
    );
  });

  it('undeclares the variables only the removed fragment referenced', () => {
    const source =
      'query ($term: String!, $first: Int) { search(term: $term) { ... on User { notes(first: $first) { totalCount } } } }';
    expect(applied(source, deselectFieldEdits(context(source), ['search', { on: 'User' }]))).toBe(
      'query ($term: String!) { search(term: $term) { __typename } }',
    );
  });

  it("lists an interface's own fields as plain steps and its implementers as members", () => {
    const source = '{ node(id: "n1") { id } }';
    const withMember = applied(source, selectFieldEdits(context(source), 'query', ['node', { on: 'User' }, 'name']));
    expect(withMember).toBe('{ node(id: "n1") { id ... on User { name } } }');
    expect(applied(withMember, deselectFieldEdits(context(withMember), ['node', { on: 'User' }]))).toBe(source);
  });

  it('takes the operation with a root fragment that was its last selection', () => {
    const source = '{ ... on Query { viewer { id } } }';
    expect(applied(source, deselectFieldEdits(context(source), [{ on: 'Query' }]))).toBe('');
  });

  it('refuses a type that is not a possible type of the step, and arguments on a fragment step', () => {
    expect(selectFieldEdits(context(''), 'query', ['search', { on: 'Role' }])).toEqual([]);
    expect(selectFieldEdits(context(''), 'query', ['viewer', { on: 'Note' }])).toEqual([]);
    const source = '{ search(term: "x") { ... on User { id } } }';
    expect(setArgumentEdits(context(source), ['search', { on: 'User' }], 'term', '"y"')).toEqual([]);
    expect(removeArgumentEdits(context(source), ['search', { on: 'User' }], 'term')).toEqual([]);
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

describe('input fields', () => {
  const CREATE = ['createNote'];
  const set = (source: string, keys: readonly string[], text: string) =>
    applied(source, setInputFieldEdits(context(source), CREATE, 'input', keys, text));
  const remove = (source: string, keys: readonly string[]) =>
    applied(source, removeInputFieldEdits(context(source), CREATE, 'input', keys));

  it('opens the literal on an unset argument, promotes a variable the argument held, appends a key and replaces one in place', () => {
    expect(set('mutation { createNote { id } }', ['title'], '"Hi"')).toBe(
      'mutation { createNote(input: { title: "Hi" }) { id } }',
    );
    // The `$input` only the promoted value referenced loses its declaration.
    expect(set('mutation ($input: NoteInput!) { createNote(input: $input) { id } }', ['title'], '"Hi"')).toBe(
      'mutation { createNote(input: { title: "Hi" }) { id } }',
    );
    expect(set('mutation { createNote(input: { title: "Hi" }) { id } }', ['authorId'], '"2"')).toBe(
      'mutation { createNote(input: { title: "Hi", authorId: "2" }) { id } }',
    );
    expect(set('mutation { createNote(input: { title: "Hi", authorId: "2" }) { id } }', ['title'], '"Yo"')).toBe(
      'mutation { createNote(input: { title: "Yo", authorId: "2" }) { id } }',
    );
    expect(set('mutation { createNote(input: {}) { id } }', ['title'], '"Hi"')).toBe(
      'mutation { createNote(input: { title: "Hi" }) { id } }',
    );
  });

  it('nests through an input-object field, opening the missing tail as nested literals', () => {
    const one = set(
      'mutation { createNote(input: { title: "Hi", authorId: "2" }) { id } }',
      ['location', 'latitude'],
      '1.5',
    );
    expect(one).toBe(
      'mutation { createNote(input: { title: "Hi", authorId: "2", location: { latitude: 1.5 } }) { id } }',
    );
    expect(set(one, ['location', 'longitude'], '2')).toBe(
      'mutation { createNote(input: { title: "Hi", authorId: "2", location: { latitude: 1.5, longitude: 2 } }) { id } }',
    );
    const field = fieldAt(operationOf(one), CREATE);
    const input = field === null ? null : argumentAt(field, 'input');
    if (input === null) throw new Error('no input argument');
    expect(inputFieldAt(input.value, ['location', 'latitude'])?.name.value).toBe('latitude');
    expect(inputFieldAt(input.value, ['location', 'longitude'])).toBeNull();
    expect(inputFieldAt(input.value, ['title', 'x'])).toBeNull();
    expect(inputFieldAt(input.value, [])).toBeNull();
  });

  it("declares a variable with the input field's type, undeclares it when a literal replaces it, and resolves keys against the schema", () => {
    const declared = set('mutation { createNote(input: { authorId: "2" }) { id } }', ['title'], '$title');
    expect(declared).toBe('mutation ($title: String!) { createNote(input: { authorId: "2", title: $title }) { id } }');
    expect(set(declared, ['title'], '"Hi"')).toBe(
      'mutation { createNote(input: { authorId: "2", title: "Hi" }) { id } }',
    );
    // A variable a sibling key still references stays declared.
    const shared = 'mutation ($t: String!) { createNote(input: { title: $t, body: $t }) { id } }';
    expect(set(shared, ['title'], '"Hi"')).toBe(
      'mutation ($t: String!) { createNote(input: { title: "Hi", body: $t }) { id } }',
    );
    const arg = {
      name: 'input',
      description: null,
      type: { kind: 'NAMED' as const, name: 'NoteInput' },
      defaultValue: null,
      deprecationReason: null,
    };
    expect(inputFieldsAlong(schema, arg, ['location', 'latitude'])?.map((f) => f.name)).toEqual([
      'location',
      'latitude',
    ]);
    expect(inputFieldsAlong(schema, arg, ['title', 'x'])).toBeNull();
    expect(inputFieldsAlong(schema, arg, ['nope'])).toBeNull();
    expect(setInputFieldEdits(context(shared), CREATE, 'input', ['nope'], '1')).toEqual([]);
    expect(setInputFieldEdits(context(shared), CREATE, 'input', ['title'], '"unterminated')).toEqual([]);
  });

  it('removes a key with its separator, the last nested key with its parent, and the last key with the argument — a required one with its field', () => {
    const full =
      'mutation { createNote(input: { title: "Hi", authorId: "2", location: { latitude: 1.5, longitude: 2 } }) { id } }';
    expect(remove(full, ['location', 'longitude'])).toBe(
      'mutation { createNote(input: { title: "Hi", authorId: "2", location: { latitude: 1.5 } }) { id } }',
    );
    expect(
      remove('mutation { createNote(input: { title: "Hi", location: { latitude: 1.5 } }) { id } }', [
        'location',
        'latitude',
      ]),
    ).toBe('mutation { createNote(input: { title: "Hi" }) { id } }');
    expect(remove(full, ['title'])).toBe(
      'mutation { createNote(input: { authorId: "2", location: { latitude: 1.5, longitude: 2 } }) { id } }',
    );
    // `input` is required — its last key takes the field, and the operation with it.
    expect(remove('mutation { createNote(input: { title: "Hi" }) { id } }', ['title'])).toBe('');
    expect(remove('mutation { createNote(input: { title: "Hi" }) { id } deleteNote(id: "1") }', ['title'])).toBe(
      'mutation { deleteNote(id: "1") }',
    );
    expect(remove('mutation { createNote(input: { title: "Hi" }) { id } }', ['nope'])).toBe(
      'mutation { createNote(input: { title: "Hi" }) { id } }',
    );
  });
});
