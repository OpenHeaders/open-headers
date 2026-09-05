/**
 * Operation census — the operation select's source and the wire's
 * `operationName` pick rule: one operation sends none; several require
 * one, the requested name when present, else the first named.
 */

import { censusDocument, selectedOperation, wireOperationName } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { fixture, parseOrThrow } from './helpers';

describe('censusDocument', () => {
  const census = censusDocument(parseOrThrow(fixture('kitchen-sink.graphql')));

  it('lists every operation with kind, name and span', () => {
    expect(census.operations.map((operation) => [operation.operation, operation.name])).toEqual([
      ['query', 'Users'],
      ['mutation', 'CreateNote'],
      ['subscription', 'OnNote'],
      ['query', null],
    ]);
    expect(census.anonymousCount).toBe(1);
    expect(census.operations[0].start).toBeLessThan(census.operations[1].start);
  });

  it('lists variables with their printed type, required flag and default flag', () => {
    expect(census.operations[0].variables).toEqual([
      { name: 'first', type: 'Int', required: false, hasDefault: true },
      { name: 'after', type: 'String', required: false, hasDefault: false },
      { name: 'role', type: 'Role', required: false, hasDefault: true },
      { name: 'withNotes', type: 'Boolean!', required: true, hasDefault: false },
      { name: 'geo', type: 'GeoInput', required: false, hasDefault: true },
    ]);
    expect(census.operations[1].variables).toEqual([
      { name: 'input', type: 'NoteInput!', required: true, hasDefault: false },
    ]);
  });

  it('lists fragments with their type conditions', () => {
    expect(census.fragments.map((fragment) => [fragment.name, fragment.typeCondition])).toEqual([
      ['UserFields', 'User'],
    ]);
  });
});

describe('wireOperationName', () => {
  const several = censusDocument(parseOrThrow('query A { a } mutation B { b }'));
  const single = censusDocument(parseOrThrow('query A { a }'));

  it('sends nothing for a single operation, whatever was requested', () => {
    expect(wireOperationName(single, undefined)).toBeUndefined();
    expect(wireOperationName(single, 'A')).toBeUndefined();
    expect(wireOperationName(censusDocument(parseOrThrow('fragment F on T { a }')), 'A')).toBeUndefined();
  });

  it('honors a requested name the document holds', () => {
    expect(wireOperationName(several, 'B')).toBe('B');
  });

  it('falls back to the first named operation', () => {
    expect(wireOperationName(several, undefined)).toBe('A');
    expect(wireOperationName(several, 'Missing')).toBe('A');
    expect(wireOperationName(censusDocument(parseOrThrow('{ a } mutation B { b }')), undefined)).toBe('B');
  });
});

describe('selectedOperation', () => {
  it('resolves the operation the wire will run', () => {
    const several = censusDocument(parseOrThrow('query A { a } mutation B { b }'));
    expect(selectedOperation(several, 'B')?.name).toBe('B');
    expect(selectedOperation(several, undefined)?.name).toBe('A');
    expect(selectedOperation(censusDocument(parseOrThrow('{ a }')), 'X')?.name).toBeNull();
    expect(selectedOperation(censusDocument(parseOrThrow('fragment F on T { a }')), undefined)).toBeNull();
  });
});
