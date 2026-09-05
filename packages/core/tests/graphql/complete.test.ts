/**
 * Completion model — the items at a dozen-plus cursor positions over
 * the openheaders fixture: root and nested fields, meta fields,
 * fragments and `on`, type conditions, arguments, enum and boolean
 * values, variables, input-object fields, directives by location,
 * variable-definition types, document keywords, the SDL positions,
 * and the nothing-inside-strings-and-comments rule.
 */

import { completionsAt } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

/** Labels at the `|` marker in the source. */
function labelsAt(marked: string, withSchema = true): string[] {
  const offset = marked.indexOf('|');
  const source = marked.slice(0, offset) + marked.slice(offset + 1);
  return completionsAt(source, offset, withSchema ? schema : null).items.map((item) => item.label);
}

function resultAt(marked: string) {
  const offset = marked.indexOf('|');
  const source = marked.slice(0, offset) + marked.slice(offset + 1);
  return completionsAt(source, offset, schema);
}

describe('completionsAt — selections', () => {
  it('lists the query root fields with the meta fields', () => {
    const labels = labelsAt('{ | }');
    expect(labels).toEqual([
      'echo',
      'viewer',
      'user',
      'users',
      'note',
      'search',
      'node',
      'slow',
      'failing',
      'partial',
      'gated',
      'me',
      '__typename',
      '__schema',
      '__type',
    ]);
  });

  it('lists the mutation root fields for a mutation', () => {
    expect(labelsAt('mutation M { | }')).toEqual(['createNote', 'deleteNote', 'setRole', '__typename']);
  });

  it('descends through fields, lists and non-nulls', () => {
    expect(labelsAt('{ users { edges { node { | } } } }')).toEqual([
      'id',
      'name',
      'email',
      'role',
      'avatarUrl',
      'createdAt',
      'updatedAt',
      'notes',
      'username',
      '__typename',
    ]);
    expect(labelsAt('{ users { edges { node { notes(first: 2) { pageInfo { | } } } } } }')).toEqual([
      'hasNextPage',
      'endCursor',
      '__typename',
    ]);
  });

  it('carries signatures, descriptions and deprecations on field items', () => {
    const items = resultAt('{ viewer { | } }').items;
    expect(items.find((item) => item.label === 'notes')).toMatchObject({
      kind: 'field',
      detail: '(first: Int, after: String): NoteConnection!',
      description: 'Notes the user authored, newest first.',
    });
    expect(items.find((item) => item.label === 'username')?.deprecationReason).toBe('Use `name`.');
  });

  it('completes the word under the cursor with its replace span', () => {
    const result = resultAt('{ vie| }');
    expect(result.prefix).toBe('vie');
    expect(result.replace).toEqual({ start: 2, end: 5 });
    expect(result.items.map((item) => item.label)).toContain('viewer');
    const inside = resultAt('{ vi|ewer }');
    expect(inside.prefix).toBe('vi');
    expect(inside.replace).toEqual({ start: 2, end: 8 });
  });

  it('completes after an alias and after a sibling with arguments', () => {
    expect(labelsAt('{ me: | }')).toContain('viewer');
    expect(labelsAt('{ echo(text: "x") | }')).toContain('viewer');
    expect(labelsAt('{ viewer { id } | }')).toContain('users');
  });

  it('follows an inline fragment and a union member', () => {
    expect(labelsAt('{ search(term: "a") { | } }')).toEqual(['__typename']);
    expect(labelsAt('{ search(term: "a") { ... on Note { | } } }')).toEqual([
      'id',
      'title',
      'body',
      'tags',
      'author',
      'pinned',
      'createdAt',
      'updatedAt',
      '__typename',
    ]);
    expect(labelsAt('{ node(id: "1") { | } }')).toEqual(['id', '__typename']);
  });

  it('completes fragment definitions on their type condition', () => {
    expect(labelsAt('fragment F on Note { | }')).toContain('title');
  });
});

describe('completionsAt — fragments and type conditions', () => {
  it('offers `on` and the document fragments after a spread', () => {
    expect(labelsAt('fragment F on User { id } fragment G on Note { id } { viewer { ...| } }')).toEqual([
      'on',
      'F',
      'G',
    ]);
    const items = resultAt('fragment F on User { id } { viewer { ... | } }').items;
    expect(items.find((item) => item.label === 'F')).toMatchObject({ kind: 'fragment', detail: 'on User' });
  });

  it('offers composite types after `on`', () => {
    const labels = labelsAt('{ search(term: "a") { ... on | } }');
    expect(labels).toContain('User');
    expect(labels).toContain('Node');
    expect(labels).toContain('SearchResult');
    expect(labels).not.toContain('Role');
    expect(labels).not.toContain('__Type');
    expect(labelsAt('fragment F on | { id }')).toContain('Note');
  });
});

describe('completionsAt — arguments and values', () => {
  it('lists the remaining arguments of a field', () => {
    expect(labelsAt('{ users(| }')).toEqual(['first', 'after', 'role']);
    expect(labelsAt('{ users(first: 1, | }')).toEqual(['after', 'role']);
    const items = resultAt('{ users(| }').items;
    expect(items[0]).toMatchObject({ kind: 'argument', detail: 'Int = 10' });
  });

  it('lists enum values, booleans and variables for a value', () => {
    expect(labelsAt('query ($r: Role, $n: Int) { users(role: | }')).toEqual([
      'OWNER',
      'EDITOR',
      'VIEWER',
      'GUEST',
      '$r',
      '$n',
    ]);
    expect(labelsAt('{ slow(ms: 1) viewer @include(if: | { id } }')).toEqual(['true', 'false']);
    expect(labelsAt('query ($n: Int) { users(first: | }')).toEqual(['$n']);
  });

  it('completes a variable name after `$` with the dollar in the replace span', () => {
    const result = resultAt('query ($first: Int, $after: String) { users(first: $fi| }');
    expect(result.prefix).toBe('$fi');
    expect(result.items.map((item) => item.label)).toEqual(['$first', '$after']);
    expect(result.items[0].detail).toBe('Int');
    expect(result.replace).toEqual({ start: 51, end: 54 });
  });

  it('lists input-object fields and their values', () => {
    expect(labelsAt('mutation { createNote(input: { | }')).toEqual([
      'title',
      'body',
      'tags',
      'pinned',
      'priority',
      'score',
      'authorId',
      'visibleTo',
      'location',
      'remindAt',
    ]);
    expect(labelsAt('mutation { createNote(input: { title: "t", | }')).not.toContain('title');
    expect(labelsAt('mutation { createNote(input: { visibleTo: | }')).toEqual(['OWNER', 'EDITOR', 'VIEWER', 'GUEST']);
    expect(labelsAt('mutation { createNote(input: { location: { | }')).toEqual(['latitude', 'longitude']);
    expect(labelsAt('mutation { createNote(input: { tags: ["a"], | }')).toContain('pinned');
  });

  it('lists list elements against the element type', () => {
    expect(labelsAt('query ($r: Role) { users(role: [| }')).toEqual(['OWNER', 'EDITOR', 'VIEWER', 'GUEST', '$r']);
  });
});

describe('completionsAt — directives, variables and keywords', () => {
  it('lists directives allowed at the location', () => {
    expect(labelsAt('{ viewer @| { id } }')).toEqual(['include', 'skip']);
    expect(labelsAt('{ viewer { ...F @| } }')).toEqual(['include', 'skip']);
    expect(labelsAt('query Q @| { viewer { id } }')).toEqual([]);
  });

  it('lists input types for a variable definition', () => {
    const labels = labelsAt('query ($x: | ) { viewer { id } }');
    expect(labels).toContain('Int');
    expect(labels).toContain('Role');
    expect(labels).toContain('NoteInput');
    expect(labels).not.toContain('User');
    expect(labelsAt('query ($x: [| ) { viewer { id } }')).toContain('ID');
  });

  it('lists the definition keywords at the document level', () => {
    expect(labelsAt('|')).toEqual(['query', 'mutation', 'subscription', 'fragment', '{']);
    expect(labelsAt('query A { a } |')).toEqual(['query', 'mutation', 'subscription', 'fragment', '{']);
  });

  it('completes fragments and variables without a schema', () => {
    expect(labelsAt('fragment F on User { id } { viewer { ...| } }', false)).toEqual(['on', 'F']);
    expect(labelsAt('query ($n: Int) { users(first: | }', false)).toEqual(['$n']);
    expect(labelsAt('{ | }', false)).toEqual([]);
  });

  it('offers nothing inside strings and comments', () => {
    expect(labelsAt('{ echo(text: "vie|wer") }')).toEqual([]);
    expect(labelsAt('{ echo(text: """\n vie|wer\n""") }')).toEqual([]);
    expect(labelsAt('{ # vie|wer\n viewer { id } }')).toEqual([]);
  });
});

describe('completionsAt — SDL positions', () => {
  it('lists output types for a field type and input types for an argument type', () => {
    const output = labelsAt('type T { f: | }');
    expect(output).toContain('User');
    expect(output).toContain('Role');
    expect(output).not.toContain('NoteInput');
    const input = labelsAt('type T { f(a: | ) : Int }');
    expect(input).toContain('NoteInput');
    expect(input).not.toContain('User');
    expect(labelsAt('input I { a: | }')).not.toContain('User');
  });

  it('lists interfaces after implements, objects for union members, locations after on', () => {
    expect(labelsAt('type T implements | { a: Int }')).toEqual(['Node', 'Timestamped']);
    expect(labelsAt('type T implements Node & | { a: Int }')).toEqual(['Node', 'Timestamped']);
    const members = labelsAt('union U = | ');
    expect(members).toContain('User');
    expect(members).not.toContain('Node');
    expect(labelsAt('directive @d on |')).toContain('FIELD_DEFINITION');
    expect(labelsAt('directive @d on FIELD | |')).toContain('QUERY');
  });

  it('lists the field type after arguments close', () => {
    expect(labelsAt('type T { f(a: Int): | }')).toContain('Note');
  });
});
