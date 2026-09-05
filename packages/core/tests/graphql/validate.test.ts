/**
 * Validation — every rule of the ratified subset, positive and
 * negative, over the openheaders fixture; the schema-free rules with
 * no schema at all.
 */

import { type GraphqlSchema, type ValidationRule, validateDocument } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, parseOrThrow, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

const rulesOf = (source: string, against: GraphqlSchema | null = schema): ValidationRule[] =>
  validateDocument(parseOrThrow(source), against).map((diagnostic) => diagnostic.rule);

const messagesOf = (source: string, against: GraphqlSchema | null = schema): string[] =>
  validateDocument(parseOrThrow(source), against).map((diagnostic) => diagnostic.message);

const VALID = `
query Users($first: Int = 10, $after: String, $role: Role, $withNotes: Boolean!, $lookup: NoteLookup!) {
  users(first: $first, after: $after, role: $role) {
    totalCount
    edges { cursor node { ...UserFields notes(first: 2) @include(if: $withNotes) { totalCount } } }
  }
  note(lookup: $lookup) { id }
  search(term: "john") {
    __typename
    ... on User { id name }
    ... on Note { id title }
    ... { __typename }
  }
  node(id: "1") { id ... on Note { title } }
  __schema { queryType { name } }
  __type(name: "User") { name }
  echo(text: "hi")
}

mutation Create($input: NoteInput!) {
  createNote(input: $input) { id author { ...UserFields } }
}

fragment UserFields on User { id name email role __typename }
`;

describe('validateDocument — a valid document', () => {
  it('reports nothing for the fixture query', () => {
    expect(messagesOf(VALID)).toEqual([]);
  });

  it('accepts a lone anonymous operation', () => {
    expect(rulesOf('{ viewer { id } }')).toEqual([]);
  });
});

describe('validateDocument — schema rules', () => {
  it('unknown-type: variable types, fragment conditions, inline conditions', () => {
    expect(rulesOf('query ($x: Nope) { echo(text: "a") }')).toContain('unknown-type');
    expect(rulesOf('fragment F on Nope { id } { viewer { ...F } }')).toContain('unknown-type');
    expect(rulesOf('{ search(term: "a") { ... on Nope { id } } }')).toContain('unknown-type');
    expect(rulesOf('subscription { x }')).toEqual(['unknown-type']);
    expect(messagesOf('query ($x: Nope) { echo(text: "a") }')).toContain('Unknown type `Nope`.');
  });

  it('unknown-field: on objects, interfaces, unions and input objects — once, no cascade', () => {
    expect(rulesOf('{ viewer { nope { deeper } } }')).toEqual(['unknown-field']);
    expect(messagesOf('{ viewer { nope } }')).toEqual(['Field `nope` does not exist on type `User`.']);
    expect(messagesOf('{ node(id: "1") { name } }')).toEqual(['Field `name` does not exist on type `Node`.']);
    expect(messagesOf('{ search(term: "a") { id } }')).toEqual([
      'Union `SearchResult` has no fields — select via `... on <Type>`.',
    ]);
    expect(messagesOf('{ note(lookup: { nope: 1 }) { id } }')).toEqual([
      'Field `nope` does not exist on input type `NoteLookup`.',
    ]);
    expect(rulesOf('{ __typename viewer { __typename } search(term: "a") { __typename } }')).toEqual([]);
  });

  it('unknown-argument on fields and directives', () => {
    expect(messagesOf('{ echo(text: "a", nope: 1) }')).toEqual(['Unknown argument `nope` on field `echo`.']);
    expect(messagesOf('{ viewer @include(if: true, nope: 1) { id } }')).toEqual([
      'Unknown argument `nope` on directive `@include`.',
    ]);
  });

  it('unknown-directive and a directive out of place', () => {
    expect(messagesOf('{ viewer @nope { id } }')).toEqual(['Unknown directive `@nope`.']);
    expect(messagesOf('{ viewer @cost { id } }')).toEqual([
      'Directive `@cost` cannot be used here (allowed on FIELD_DEFINITION, OBJECT).',
    ]);
    expect(rulesOf('{ viewer @include(if: true) @skip(if: false) { id } }')).toEqual([]);
  });

  it('required-argument: missing on fields and directives, satisfied by defaults', () => {
    expect(messagesOf('{ echo }')).toEqual(['Field `echo` is missing the required argument `text` of type `String!`.']);
    expect(messagesOf('{ viewer @include { id } }')).toEqual([
      'Directive `@include` is missing the required argument `if` of type `Boolean!`.',
    ]);
    expect(rulesOf('{ users { totalCount } }')).toEqual([]);
    expect(rulesOf('mutation { createNote(input: { title: "t", authorId: "1" }) { id } }')).toEqual([]);
  });

  it('undefined-variable: in the operation and through fragment spreads', () => {
    expect(messagesOf('{ user(id: $id) { id } }')).toEqual(['Variable `$id` is not defined.']);
    expect(messagesOf('query { viewer { ...F } } fragment F on User { notes(first: $n) { totalCount } }')).toEqual([
      'Variable `$n` is not defined.',
    ]);
    expect(
      rulesOf('query ($n: Int) { viewer { ...F } } fragment F on User { notes(first: $n) { totalCount } }'),
    ).toEqual([]);
  });

  it('unused-variable', () => {
    expect(messagesOf('query ($x: Int) { viewer { id } }')).toEqual(['Variable `$x` is defined but never used.']);
    expect(
      rulesOf('query ($x: Int) { viewer { ...F } } fragment F on User { notes(first: $x) { totalCount } }'),
    ).toEqual([]);
  });

  it('unknown-fragment', () => {
    expect(messagesOf('{ viewer { ...Nope } }')).toEqual(['Unknown fragment `Nope`.']);
  });

  it('leaf-selection and composite-selection', () => {
    expect(messagesOf('{ viewer { name { x } } }')).toEqual([
      'Field `name` of type `String!` must not have a selection — it is a scalar.',
    ]);
    expect(messagesOf('{ viewer { role { x } } }')).toEqual([
      'Field `role` of type `Role!` must not have a selection — it is a enum.',
    ]);
    expect(messagesOf('{ viewer }')).toEqual([
      'Field `viewer` of type `User` must have a selection of subfields — try `viewer { … }`.',
    ]);
    expect(messagesOf('{ search(term: "a") }')).toEqual([
      'Field `search` of type `[SearchResult!]!` must have a selection of subfields — try `search { … }`.',
    ]);
  });

  it('variable-type: nullability, lists, defaults, and non-input types', () => {
    expect(messagesOf('query ($id: ID) { user(id: $id) { id } }')).toEqual([
      'Variable `$id` of type `ID` cannot be used where `ID!` is expected.',
    ]);
    expect(rulesOf('query ($id: ID = "1") { user(id: $id) { id } }')).toEqual([]);
    expect(rulesOf('query ($n: Int) { users(first: $n) { totalCount } }')).toEqual([]);
    expect(rulesOf('query ($id: ID!) { user(id: $id) { id } }')).toEqual([]);
    expect(messagesOf('query ($id: String!) { user(id: $id) { id } }')).toEqual([
      'Variable `$id` of type `String!` cannot be used where `ID!` is expected.',
    ]);
    expect(messagesOf('query ($ids: [ID!]) { user(id: $ids) { id } }')).toEqual([
      'Variable `$ids` of type `[ID!]` cannot be used where `ID!` is expected.',
    ]);
    expect(messagesOf('query ($t: String!) { echo(text: [$t]) }')).toEqual([]);
    expect(
      messagesOf('query ($lat: Float) { note(lookup: { id: "1" }) { id } echo(text: "x") createNoteProbe: __typename }')
        .length,
    ).toBe(1);
    expect(
      messagesOf(
        'mutation ($geo: GeoInput!) { createNote(input: { title: "t", authorId: "1", location: $geo }) { id } }',
      ),
    ).toEqual([]);
    expect(
      messagesOf(
        'mutation ($lat: Float) { createNote(input: { title: "t", authorId: "1", location: { latitude: $lat, longitude: 1 } }) { id } }',
      ),
    ).toEqual(['Variable `$lat` of type `Float` cannot be used where `Float!` is expected.']);
    expect(messagesOf('query ($u: User) { echo(text: "a") }')).toEqual([
      'Variable `$u` cannot be of type `User` — only scalars, enums and input objects are input types.',
      'Variable `$u` is defined but never used.',
    ]);
  });
});

describe('validateDocument — schema-free rules', () => {
  it('lone-anonymous-operation', () => {
    const diagnostics = validateDocument(parseOrThrow('{ a } query B { b }'), null);
    expect(diagnostics.map((diagnostic) => diagnostic.rule)).toEqual(['lone-anonymous-operation']);
    expect(diagnostics[0].start).toBe(0);
  });

  it('duplicate operation, fragment, variable and argument names', () => {
    expect(rulesOf('query A { a } query A { b }', null)).toEqual(['duplicate-name', 'duplicate-name']);
    expect(rulesOf('fragment F on T { a } fragment F on T { b } { ...F }', null)).toEqual([
      'duplicate-name',
      'duplicate-name',
    ]);
    expect(rulesOf('query ($x: Int, $x: Int) { a(v: $x) }', null)).toEqual(['duplicate-name']);
    expect(rulesOf('{ a(v: 1, v: 2) }', null)).toEqual(['duplicate-name']);
  });

  it('unknown fragments and variables without a schema', () => {
    expect(rulesOf('{ ...Nope a(v: $x) }', null)).toEqual(['unknown-fragment', 'undefined-variable']);
    expect(rulesOf('query ($x: Int) { a }', null)).toEqual(['unused-variable']);
  });

  it('not-executable', () => {
    expect(rulesOf('type T { a: Int } { a }', null)).toEqual(['not-executable']);
  });

  it('skips every schema rule without a schema', () => {
    expect(rulesOf('{ nope(x: 1) @what { deeper } }', null)).toEqual([]);
  });

  it('reports spans that point at the offending token', () => {
    const source = '{ viewer { nope } }';
    const [diagnostic] = validateDocument(parseOrThrow(source), schema);
    expect(source.slice(diagnostic.start, diagnostic.end)).toBe('nope');
  });
});
