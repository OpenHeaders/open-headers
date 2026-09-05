/**
 * Example variables — deterministic, name-aware samples on the
 * openheaders.io flavor for every input kind; declared defaults win;
 * cycles cut; the schema-less fallback still samples built-in scalars.
 */

import { exampleForType, exampleVariables, valueToJson } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, parseOrThrow, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

function variablesFor(source: string, withSchema = true) {
  const operation = parseOrThrow(source).definitions[0];
  if (operation.kind !== 'OperationDefinition') throw new Error('expected an operation');
  return exampleVariables(operation, withSchema ? schema : null);
}

describe('exampleVariables', () => {
  it('fills every scalar kind, enum, list and nested input of NoteInput', () => {
    expect(variablesFor('mutation ($input: NoteInput!) { createNote(input: $input) { id } }')).toEqual({
      input: {
        title: 'John Doe',
        body: 'body',
        tags: [],
        pinned: false,
        priority: 1,
        score: 1.5,
        authorId: '1',
        visibleTo: 'EDITOR',
        location: { latitude: 1.5, longitude: 1.5 },
        remindAt: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('samples built-in scalars by name and enums by first value', () => {
    expect(
      variablesFor(
        'query ($id: ID!, $email: String!, $url: String, $host: String, $role: Role, $ok: Boolean, $n: Int, $f: Float, $ids: [ID!]!) { echo(text: "a") }',
      ),
    ).toEqual({
      id: '1',
      email: 'john.doe@openheaders.io',
      url: 'https://openheaders.io',
      host: 'openheaders.io',
      role: 'OWNER',
      ok: true,
      n: 1,
      f: 1.5,
      ids: ['1'],
    });
  });

  it('lets a declared default win', () => {
    expect(
      variablesFor(
        'query ($first: Int = 25, $role: Role = VIEWER, $geo: GeoInput = { latitude: 1, longitude: 2 }) { echo(text: "a") }',
      ),
    ).toEqual({
      first: 25,
      role: 'VIEWER',
      geo: { latitude: 1, longitude: 2 },
    });
  });

  it('fills exactly one field of a @oneOf input', () => {
    expect(variablesFor('query ($lookup: NoteLookup!) { note(lookup: $lookup) { id } }')).toEqual({
      lookup: { id: '1' },
    });
  });

  it('samples custom scalars by well-known name and unknown ones by the variable name', () => {
    expect(variablesFor('query ($at: DateTime!, $x: Mystery) { echo(text: "a") }')).toEqual({
      at: '2026-01-01T00:00:00Z',
      x: 'x',
    });
  });

  it('cuts reference cycles to an empty object', () => {
    const recursive = schemaOrThrow(
      'input Filter { name: String, and: [Filter!], not: Filter } type Query { a(f: Filter): Int }',
    );
    expect(exampleForType({ kind: 'NAMED', name: 'Filter' }, 'f', recursive)).toEqual({
      name: 'John Doe',
      and: [{}],
      not: {},
    });
  });

  it('works without a schema for built-in scalars and lists', () => {
    expect(variablesFor('query ($id: ID!, $tags: [String!], $in: NoteInput) { echo(text: "a") }', false)).toEqual({
      id: '1',
      tags: ['tags'],
      in: 'in',
    });
  });
});

describe('valueToJson', () => {
  it('converts every literal kind', () => {
    const operation = parseOrThrow(
      'query ($v: In = { a: 1, b: 2.5, c: "s", d: true, e: null, f: RED, g: [1, "x"] }) { a }',
    ).definitions[0];
    if (operation.kind !== 'OperationDefinition') throw new Error('expected an operation');
    const value = operation.variableDefinitions[0].defaultValue;
    if (value === null) throw new Error('expected a default');
    expect(valueToJson(value)).toEqual({ a: 1, b: 2.5, c: 's', d: true, e: null, f: 'RED', g: [1, 'x'] });
  });
});
