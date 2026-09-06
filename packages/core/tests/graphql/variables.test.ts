/**
 * Variables validation — the Variables pane's JSON against the
 * operation's definitions and the schema: JSON validity, the object
 * root, required variables, undeclared ones, built-in scalar kinds,
 * enums, lists (with single-value coercion), input objects (required
 * fields, unknown fields, @oneOf), nullability, and the schema-free
 * posture where custom types pass.
 */

import { censusDocument, type GraphqlSchema, validateVariables } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, parseOrThrow, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

function operation(source: string) {
  const census = censusDocument(parseOrThrow(source));
  return census.operations[0].node;
}

const CREATE = operation(
  'mutation Create($input: NoteInput!, $tags: [String!], $role: Role) { createNote(input: $input) { id } }',
);
const ECHO = operation('query Echo($t: String!, $n: Int = 1) { echo(text: $t) }');

const messages = (source: ReturnType<typeof operation>, json: string, s: GraphqlSchema | null = schema) =>
  validateVariables(source, s, json).map((d) => `${d.severity}:${d.message}`);

describe('validateVariables', () => {
  it('reports invalid JSON and a non-object root', () => {
    expect(messages(ECHO, '{ "t": ')).toEqual([expect.stringMatching(/^error:Variables are not valid JSON/)]);
    expect(messages(ECHO, '[1]')).toEqual(['error:Variables must be a JSON object.']);
  });

  it('requires the non-null variables without defaults; an empty text is "no variables"', () => {
    expect(messages(ECHO, '')).toEqual(['error:$t is required (String!).']);
    expect(messages(ECHO, '{"t": "hi"}')).toEqual([]);
    expect(messages(ECHO, '{"t": null}')).toEqual(['error:$t must not be null (String!).']);
  });

  it('checks the built-in scalars by JSON kind and warns on undeclared variables', () => {
    expect(messages(ECHO, '{"t": 5}')).toEqual(['error:$t expects String but holds a number.']);
    expect(messages(ECHO, '{"t": "hi", "n": 1.5}')).toEqual(['error:$n expects Int but holds a number.']);
    expect(messages(ECHO, '{"t": "hi", "extra": 1}')).toEqual(['warning:$extra is not declared by the operation.']);
  });

  it('checks enums, lists (a single value coerces) and input objects with the schema', () => {
    const valid = '{"input": {"title": "T", "authorId": "1"}, "tags": "one", "role": "OWNER"}';
    expect(messages(CREATE, valid)).toEqual([]);
    expect(messages(CREATE, '{"input": {"title": "T", "authorId": "1"}, "role": "KING"}')).toEqual([
      'error:$role expects one of OWNER, EDITOR, VIEWER, GUEST (Role).',
    ]);
    expect(messages(CREATE, '{"input": {"title": "T"}}')).toEqual(['error:$input.authorId is required (ID!).']);
    expect(messages(CREATE, '{"input": {"title": "T", "authorId": "1", "nope": 1}}')).toEqual([
      'error:$input.nope is not a field of NoteInput.',
    ]);
    expect(messages(CREATE, '{"input": {"title": "T", "authorId": "1", "location": {"latitude": "x"}}}')).toEqual([
      'error:$input.location.latitude expects Float but holds a string.',
      'error:$input.location.longitude is required (Float!).',
    ]);
    expect(messages(CREATE, '{"input": "T"}')).toEqual([
      'error:$input expects an object (NoteInput) but holds a string.',
    ]);
    expect(messages(CREATE, '{"input": {"title": "T", "authorId": "1"}, "tags": [1]}')).toEqual([
      'error:$tags[0] expects String but holds a number.',
    ]);
  });

  it('enforces @oneOf — exactly one field set', () => {
    const lookup = operation('query Note($lookup: NoteLookup!) { note(lookup: $lookup) { id } }');
    expect(messages(lookup, '{"lookup": {"id": "1"}}')).toEqual([]);
    expect(messages(lookup, '{"lookup": {"id": "1", "title": "T"}}')).toEqual([
      'error:$lookup must set exactly one field of NoteLookup.',
    ]);
    expect(messages(lookup, '{"lookup": {}}')).toEqual(['error:$lookup must set exactly one field of NoteLookup.']);
  });

  it('without a schema still checks the built-in scalars and lets custom types pass', () => {
    expect(messages(CREATE, '{"input": "anything", "role": 1}', null)).toEqual([]);
    expect(messages(ECHO, '{"t": true}', null)).toEqual(['error:$t expects String but holds a boolean.']);
  });
});
