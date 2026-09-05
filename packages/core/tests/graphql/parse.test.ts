/**
 * Parser + printer — the grammar summary end to end. Pins parse →
 * print → parse round trips (pretty AND compact) over the three
 * fixtures, the AST shape of every executable and type-system
 * production, and the syntax error set with spans.
 */

import { type DocumentNode, parseDocument, printBlockString, printCompact, printNode } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { fixture, parseOrThrow, stripSpans } from './helpers';

const definitionsOf = (document: DocumentNode) => document.definitions;

function roundTrip(source: string): void {
  const first = parseOrThrow(source);
  const pretty = printNode(first);
  const second = parseOrThrow(pretty);
  expect(stripSpans(second)).toEqual(stripSpans(first));
  expect(printNode(second)).toBe(pretty);
  const compact = printCompact(first);
  expect(stripSpans(parseOrThrow(compact))).toEqual(stripSpans(first));
}

describe('graphql parser — round trips', () => {
  it.each(['kitchen-sink.graphql', 'schema-kitchen-sink.graphql', 'openheaders.graphql', 'public-shaped.graphql'])(
    'parse → print → parse is identity for %s',
    (name) => {
      roundTrip(fixture(name));
    },
  );

  it('round-trips block strings that need the multi-line form', () => {
    const values = ['ends with a quote"', 'trailing slash\\', 'x\n    y', 'say """hi"""', ' leading space', 'a\n\n  b'];
    for (const [index, value] of values.entries()) {
      const source = `{ f(s: ${printBlockString(value)}) }`;
      const field = parseOrThrow(source).definitions[0];
      if (field.kind !== 'OperationDefinition' || field.selectionSet.selections[0].kind !== 'Field')
        throw new Error('shape');
      const argument = field.selectionSet.selections[0].arguments[0].value;
      expect(argument.kind === 'StringValue' && argument.block && argument.value, `value ${index}`).toBe(value);
      roundTrip(source);
    }
  });

  it('round-trips escaped strings', () => {
    roundTrip('{ a(s: "tab\\there \\"quoted\\" \\\\ \\u0007 \\u{1F600}") }');
  });
});

describe('graphql parser — executable shapes', () => {
  it('parses the shorthand query as an anonymous operation', () => {
    const [definition] = definitionsOf(parseOrThrow('{ viewer { id } }'));
    expect(definition.kind).toBe('OperationDefinition');
    if (definition.kind !== 'OperationDefinition') return;
    expect(definition.operation).toBe('query');
    expect(definition.name).toBeNull();
    expect(definition.selectionSet.selections.map((selection) => selection.kind)).toEqual(['Field']);
  });

  it('parses aliases, arguments, directives and nested selections', () => {
    const document = parseOrThrow(
      'query Q($id: ID!) { u: user(id: $id) @include(if: true) { id ...F ... on User { name } } }',
    );
    const operation = document.definitions[0];
    if (operation.kind !== 'OperationDefinition') throw new Error('expected an operation');
    expect(operation.name?.value).toBe('Q');
    expect(operation.variableDefinitions[0].type).toMatchObject({
      kind: 'NonNullType',
      type: { kind: 'NamedType', name: { value: 'ID' } },
    });
    const field = operation.selectionSet.selections[0];
    if (field.kind !== 'Field') throw new Error('expected a field');
    expect(field.alias?.value).toBe('u');
    expect(field.name.value).toBe('user');
    expect(field.arguments[0]).toMatchObject({
      name: { value: 'id' },
      value: { kind: 'Variable', name: { value: 'id' } },
    });
    expect(field.directives[0]).toMatchObject({
      name: { value: 'include' },
      arguments: [{ value: { kind: 'BooleanValue', value: true } }],
    });
    expect(field.selectionSet?.selections.map((selection) => selection.kind)).toEqual([
      'Field',
      'FragmentSpread',
      'InlineFragment',
    ]);
  });

  it('parses every value kind', () => {
    const document = parseOrThrow(
      '{ f(a: 1, b: -2.5, c: "s", d: true, e: null, g: RED, h: [1, [2]], i: { x: 1, y: { z: $v } }, j: $v) }',
    );
    const field =
      document.definitions[0].kind === 'OperationDefinition'
        ? document.definitions[0].selectionSet.selections[0]
        : null;
    if (field === null || field.kind !== 'Field') throw new Error('expected a field');
    expect(field.arguments.map((arg) => arg.value.kind)).toEqual([
      'IntValue',
      'FloatValue',
      'StringValue',
      'BooleanValue',
      'NullValue',
      'EnumValue',
      'ListValue',
      'ObjectValue',
      'Variable',
    ]);
  });

  it('parses variable definitions with defaults and directives', () => {
    const document = parseOrThrow('query ($a: [Int!] = [1], $b: In = { k: "v" } @d) { x }');
    const operation = document.definitions[0];
    if (operation.kind !== 'OperationDefinition') throw new Error('expected an operation');
    expect(operation.variableDefinitions[0].defaultValue?.kind).toBe('ListValue');
    expect(operation.variableDefinitions[1].defaultValue?.kind).toBe('ObjectValue');
    expect(operation.variableDefinitions[1].directives[0].name.value).toBe('d');
  });

  it('parses fragment definitions and inline fragments without a type condition', () => {
    const document = parseOrThrow('fragment F on User @d { id ... @include(if: $x) { name } } { ...F }');
    const [fragment, operation] = document.definitions;
    expect(fragment).toMatchObject({
      kind: 'FragmentDefinition',
      name: { value: 'F' },
      typeCondition: { name: { value: 'User' } },
    });
    if (fragment.kind !== 'FragmentDefinition') return;
    const inline = fragment.selectionSet.selections[1];
    expect(inline).toMatchObject({ kind: 'InlineFragment', typeCondition: null });
    expect(operation.kind).toBe('OperationDefinition');
  });

  it('records spans on every node', () => {
    const source = 'query Q { user(id: 1) { id } }';
    const operation = parseOrThrow(source).definitions[0];
    if (operation.kind !== 'OperationDefinition') throw new Error('expected an operation');
    expect(source.slice(operation.start, operation.end)).toBe(source);
    const field = operation.selectionSet.selections[0];
    expect(source.slice(field.start, field.end)).toBe('user(id: 1) { id }');
    if (field.kind !== 'Field') return;
    expect(source.slice(field.arguments[0].start, field.arguments[0].end)).toBe('id: 1');
  });

  it('parses mutation and subscription keywords', () => {
    const kinds = parseOrThrow('mutation M { a } subscription S { b }').definitions.map((definition) =>
      definition.kind === 'OperationDefinition' ? definition.operation : definition.kind,
    );
    expect(kinds).toEqual(['mutation', 'subscription']);
  });
});

describe('graphql parser — type-system shapes', () => {
  it('parses a schema definition with a description and directives', () => {
    const [definition] = parseOrThrow('"""Desc""" schema @d { query: Q mutation: M }').definitions;
    expect(definition).toMatchObject({
      kind: 'SchemaDefinition',
      description: { value: 'Desc', block: true },
      directives: [{ name: { value: 'd' } }],
      operationTypes: [
        { operation: 'query', type: { name: { value: 'Q' } } },
        { operation: 'mutation', type: { name: { value: 'M' } } },
      ],
    });
  });

  it('parses object types with implements lists, arguments, defaults and field descriptions', () => {
    const [definition] = parseOrThrow(
      'type T implements & A & B @d { "desc" f("arg desc" a: Int = 1, b: [String!]! @x): [T!]! @deprecated(reason: "r") }',
    ).definitions;
    expect(definition).toMatchObject({
      kind: 'ObjectTypeDefinition',
      interfaces: [{ name: { value: 'A' } }, { name: { value: 'B' } }],
      fields: [
        {
          description: { value: 'desc', block: false },
          name: { value: 'f' },
          arguments: [
            {
              description: { value: 'arg desc' },
              name: { value: 'a' },
              defaultValue: { kind: 'IntValue', value: '1' },
            },
            { name: { value: 'b' }, directives: [{ name: { value: 'x' } }] },
          ],
          type: { kind: 'NonNullType', type: { kind: 'ListType' } },
          directives: [{ name: { value: 'deprecated' } }],
        },
      ],
    });
  });

  it('parses interfaces, unions, enums, inputs, scalars and directive definitions', () => {
    const kinds = parseOrThrow(
      'interface I implements J { a: Int } union U = | A | B enum E { A B @deprecated } input In { a: Int = 1 } scalar S @specifiedBy(url: "https://openheaders.io") directive @d(a: Int) repeatable on FIELD | QUERY',
    ).definitions.map((definition) => definition.kind);
    expect(kinds).toEqual([
      'InterfaceTypeDefinition',
      'UnionTypeDefinition',
      'EnumTypeDefinition',
      'InputObjectTypeDefinition',
      'ScalarTypeDefinition',
      'DirectiveDefinition',
    ]);
    const directive = parseOrThrow('directive @d(a: Int) repeatable on | FIELD | QUERY').definitions[0];
    expect(directive).toMatchObject({
      kind: 'DirectiveDefinition',
      repeatable: true,
      locations: [{ value: 'FIELD' }, { value: 'QUERY' }],
    });
  });

  it('parses every extension form', () => {
    const kinds = parseOrThrow(
      'extend schema @d extend scalar S @d extend type T { a: Int } extend interface I @d extend union U = A extend enum E { X } extend input In { a: Int }',
    ).definitions.map((definition) => definition.kind);
    expect(kinds).toEqual([
      'SchemaExtension',
      'ScalarTypeExtension',
      'ObjectTypeExtension',
      'InterfaceTypeExtension',
      'UnionTypeExtension',
      'EnumTypeExtension',
      'InputObjectTypeExtension',
    ]);
  });

  it('allows body-less type definitions', () => {
    expect(parseOrThrow('type T type U implements T enum E input I').definitions).toHaveLength(4);
  });
});

describe('graphql parser — errors', () => {
  it.each([
    ['', 'Expected a definition but found end of input.', 0],
    ['{ a', 'Expected `}` but found end of input.', 3],
    ['{ }', 'Expected a name but found `}`.', 2],
    ['query { a(: 1) }', 'Expected a name but found `:`.', 10],
    ['fragment on on User { a }', 'A fragment cannot be named `on`.', 9],
    ['"desc" query Q { a }', 'An operation cannot carry a description.', 0],
    ['query ($a: Int = $b) { a }', 'Unexpected variable in a constant value.', 17],
    ['extend type T', 'An extension must add something.', 7],
    ['type T { a: [Int }', 'Expected `]` but found `}`.', 17],
    ['{ a } }', 'Expected a definition but found `}`.', 6],
    ['query Q { a }} ', 'Expected a definition but found `}`.', 13],
    ['bogus { a }', 'Unexpected `bogus`.', 0],
    ['{ a(b: ) }', 'Expected a value but found `)`.', 7],
    ['{ a @ }', 'Expected a name but found `}`.', 6],
    ['type T { a: Int! ! }', 'Expected a name but found `!`.', 17],
    ['enum E { true }', '`true` is not a valid enum value name.', 9],
    ['{ a(s: "unterminated) }', 'Unterminated string.', 7],
  ])('reports %j', (source, message, start) => {
    const result = parseDocument(source);
    expect(result.document).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe(message);
    expect(result.errors[0].start).toBe(start);
  });
});
