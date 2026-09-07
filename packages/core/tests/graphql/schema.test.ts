/**
 * Schema model — SDL → model (built-ins, extensions, deprecations,
 * descriptions, interface implementers, the schema definition), model
 * → SDL, model → introspection → model, introspection envelope
 * tolerance, and the build errors that report instead of throwing.
 */

import {
  isBuiltInScalar,
  isIntrospectionName,
  namedTypeOf,
  possibleTypesOf,
  printTypeRef,
  rootTypeName,
  schemaFromIntrospection,
  schemaFromSdl,
  schemaToIntrospection,
  schemaToSdl,
} from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { fixture, OPENHEADERS_SDL, schemaOrThrow } from './helpers';

describe('schemaFromSdl — the openheaders fixture', () => {
  const schema = schemaOrThrow(OPENHEADERS_SDL);

  it('reads the schema definition and roots', () => {
    expect(schema.queryType).toBe('Query');
    expect(schema.mutationType).toBe('Mutation');
    expect(schema.subscriptionType).toBe('Subscription');
    expect(schema.description).toContain('The OpenHeaders playground schema');
  });

  it('carries the built-in scalars, introspection types and directives', () => {
    for (const name of ['Int', 'Float', 'String', 'Boolean', 'ID']) expect(schema.types.get(name)?.kind).toBe('SCALAR');
    expect(schema.types.get('__Schema')?.kind).toBe('OBJECT');
    expect(schema.types.get('__TypeKind')?.kind).toBe('ENUM');
    expect(schema.directives.map((directive) => directive.name)).toEqual([
      'include',
      'skip',
      'deprecated',
      'specifiedBy',
      'oneOf',
      'cost',
    ]);
  });

  it('models fields, arguments, defaults, deprecations and descriptions', () => {
    const user = schema.types.get('User');
    if (user?.kind !== 'OBJECT') throw new Error('expected User');
    expect(user.interfaces).toEqual(['Node', 'Timestamped']);
    const notes = user.fields.find((field) => field.name === 'notes');
    expect(notes?.args.map((arg) => [arg.name, printTypeRef(arg.type), arg.defaultValue])).toEqual([
      ['first', 'Int', '10'],
      ['after', 'String', null],
    ]);
    expect(printTypeRef(notes?.type ?? { kind: 'NAMED', name: '?' })).toBe('NoteConnection!');
    const username = user.fields.find((field) => field.name === 'username');
    expect(username?.deprecationReason).toBe('Use `name`.');
    expect(user.fields.find((field) => field.name === 'name')?.description).toBe('Display name, e.g. `John Doe`.');
  });

  it('computes interface implementers and keeps union members', () => {
    const node = schema.types.get('Node');
    if (node?.kind !== 'INTERFACE') throw new Error('expected Node');
    expect(node.possibleTypes).toEqual(['User', 'Note']);
    const result = schema.types.get('SearchResult');
    if (result?.kind !== 'UNION') throw new Error('expected SearchResult');
    expect(result.possibleTypes).toEqual(['User', 'Note']);
    expect(possibleTypesOf(schema, node)).toEqual(['User', 'Note']);
  });

  it('models enums with deprecations, scalars with specifiedBy, inputs with oneOf and defaults', () => {
    const role = schema.types.get('Role');
    if (role?.kind !== 'ENUM') throw new Error('expected Role');
    expect(role.values.map((value) => [value.name, value.deprecationReason])).toEqual([
      ['OWNER', null],
      ['EDITOR', null],
      ['VIEWER', null],
      ['GUEST', 'Use VIEWER.'],
    ]);
    const dateTime = schema.types.get('DateTime');
    expect(dateTime?.kind === 'SCALAR' && dateTime.specifiedByUrl).toBe('https://openheaders.io/scalars/date-time');
    const lookup = schema.types.get('NoteLookup');
    expect(lookup?.kind === 'INPUT_OBJECT' && lookup.oneOf).toBe(true);
    const input = schema.types.get('NoteInput');
    if (input?.kind !== 'INPUT_OBJECT') throw new Error('expected NoteInput');
    expect(input.inputFields.find((field) => field.name === 'tags')?.defaultValue).toBe('[]');
    expect(input.inputFields.find((field) => field.name === 'visibleTo')?.defaultValue).toBe('EDITOR');
  });

  it('models user directives with repeatable and locations', () => {
    const cost = schema.directives.find((directive) => directive.name === 'cost');
    expect(cost).toMatchObject({ isRepeatable: true, locations: ['FIELD_DEFINITION', 'OBJECT'] });
    expect(cost?.args[0]).toMatchObject({ name: 'weight', defaultValue: '1' });
  });
});

describe('schemaFromSdl — extensions and defaults', () => {
  const schema = schemaOrThrow(fixture('schema-kitchen-sink.graphql'));

  it('applies every extension form', () => {
    const thing = schema.types.get('Thing');
    if (thing?.kind !== 'OBJECT') throw new Error('expected Thing');
    expect(thing.fields.map((field) => field.name)).toEqual(['id', 'name', 'price', 'labels', 'parent', 'extra']);
    expect(thing.fields[5].deprecationReason).toBe('No longer supported');
    const named = schema.types.get('Named');
    expect(named?.kind === 'INTERFACE' && named.fields.map((field) => field.name)).toEqual(['name', 'alias']);
    const anything = schema.types.get('Anything');
    expect(anything?.kind === 'UNION' && anything.possibleTypes).toEqual(['Thing', 'Other', 'Third']);
    const color = schema.types.get('Color');
    expect(color?.kind === 'ENUM' && color.values.map((value) => value.name)).toEqual(['RED', 'GREEN', 'BLUE']);
    const filter = schema.types.get('Filter');
    if (filter?.kind !== 'INPUT_OBJECT') throw new Error('expected Filter');
    expect(filter.oneOf).toBe(true);
    expect(filter.inputFields.map((field) => field.name)).toEqual(['id', 'name', 'color', 'nested']);
    expect(filter.inputFields[3].defaultValue).toBe('[{id: "1"},{name: "x"}]');
  });

  it('reads custom operation-type names', () => {
    expect([schema.queryType, schema.mutationType, schema.subscriptionType]).toEqual([
      'QueryRoot',
      'MutationRoot',
      'SubscriptionRoot',
    ]);
    expect(rootTypeName(schema, 'subscription')).toBe('SubscriptionRoot');
  });

  it('falls back to the conventional root names without a schema definition', () => {
    const conventional = schemaOrThrow('type Query { a: Int } type Mutation { b: Int }');
    expect([conventional.queryType, conventional.mutationType, conventional.subscriptionType]).toEqual([
      'Query',
      'Mutation',
      null,
    ]);
  });
});

describe('schemaFromSdl — errors', () => {
  it('reports duplicate types and directives', () => {
    const result = schemaFromSdl('type A { a: Int } type A { b: Int } directive @d on FIELD directive @d on FIELD');
    expect(result.schema).not.toBeNull();
    expect(result.errors.map((error) => error.message)).toEqual([
      'Type `A` is defined more than once.',
      'Directive `@d` is defined more than once.',
    ]);
    expect(result.errors[0].start).toBe(23);
  });

  it('reports an extension of nothing or of the wrong kind', () => {
    const result = schemaFromSdl('type A { a: Int } extend type B { b: Int } extend enum A { X }');
    expect(result.errors.map((error) => error.message)).toEqual([
      'Cannot extend type `B` — it is not defined.',
      'Cannot extend `A` as enum — it is not one.',
    ]);
  });

  it('reports executable definitions in a schema document', () => {
    const result = schemaFromSdl('type Query { a: Int } query Q { a }');
    expect(result.errors[0].message).toBe('An executable definition cannot appear in a schema document.');
  });

  it('yields a null schema on a syntax error', () => {
    const result = schemaFromSdl('type Query { a: }');
    expect(result.schema).toBeNull();
    expect(result.errors[0].message).toBe('Expected a name but found `}`.');
  });

  it('lets a user definition of a built-in scalar win over the bundled one', () => {
    const schema = schemaOrThrow('"""Mine""" scalar ID type Query { a: ID }');
    expect(schema.types.get('ID')?.description).toBe('Mine');
  });
});

describe('schemaToSdl', () => {
  it('omits the built-ins and round-trips the model', () => {
    const schema = schemaOrThrow(OPENHEADERS_SDL);
    const sdl = schemaToSdl(schema);
    expect(sdl).not.toContain('scalar String');
    expect(sdl).not.toContain('__Schema');
    expect(sdl).not.toContain('directive @include');
    expect(sdl).toContain('directive @cost(weight: Int! = 1) repeatable on FIELD_DEFINITION | OBJECT');
    expect(sdl).toContain('username: String @deprecated(reason: "Use `name`.")');
    expect(sdl).toContain('input NoteLookup @oneOf {');
    const again = schemaOrThrow(sdl);
    expect([...again.types.values()]).toEqual([...schema.types.values()]);
    expect(again.directives).toEqual(schema.directives);
    expect(schemaToSdl(again)).toBe(sdl);
  });

  it('emits the schema block only when roots are unconventional or described', () => {
    expect(schemaToSdl(schemaOrThrow('type Query { a: Int }'))).toBe('type Query {\n  a: Int\n}\n');
    expect(schemaToSdl(schemaOrThrow('schema { query: Root } type Root { a: Int }'))).toBe(
      'schema {\n  query: Root\n}\n\ntype Root {\n  a: Int\n}\n',
    );
  });

  it('round-trips the kitchen-sink schema', () => {
    const schema = schemaOrThrow(fixture('schema-kitchen-sink.graphql'));
    const again = schemaOrThrow(schemaToSdl(schema));
    expect([...again.types.values()]).toEqual([...schema.types.values()]);
  });
});

describe('introspection ↔ model', () => {
  it('round-trips the openheaders fixture through the introspection shape', () => {
    const schema = schemaOrThrow(OPENHEADERS_SDL);
    const introspection = schemaToIntrospection(schema);
    expect(introspection.__schema.queryType).toEqual({ name: 'Query' });
    expect(introspection.__schema.types.map((type) => type.name)).toContain('__Directive');
    const user = introspection.__schema.types.find((type) => type.name === 'User');
    expect(user?.fields?.find((field) => field.name === 'notes')?.type).toEqual({
      kind: 'NON_NULL',
      name: null,
      ofType: { kind: 'OBJECT', name: 'NoteConnection', ofType: null },
    });
    expect(user?.fields?.find((field) => field.name === 'username')).toMatchObject({
      isDeprecated: true,
      deprecationReason: 'Use `name`.',
    });
    const again = schemaFromIntrospection(introspection);
    expect(again.errors).toEqual([]);
    expect(again.schema).toEqual(schema);
  });

  it('accepts the whole response envelope', () => {
    const schema = schemaOrThrow(fixture('public-shaped.graphql'));
    const result = schemaFromIntrospection({ data: schemaToIntrospection(schema) });
    expect(result.schema).toEqual(schema);
  });

  it('survives a JSON round trip', () => {
    const schema = schemaOrThrow(fixture('schema-kitchen-sink.graphql'));
    const result = schemaFromIntrospection(JSON.parse(JSON.stringify(schemaToIntrospection(schema))));
    expect(result.schema).toEqual(schema);
  });

  it('reports malformed introspection instead of throwing', () => {
    expect(schemaFromIntrospection(null).errors[0].message).toBe(
      'Introspection: no `__schema` object in the response.',
    );
    expect(schemaFromIntrospection({ __schema: { types: 'nope' } }).errors[0].message).toBe(
      'Introspection: `__schema.types` is not a list.',
    );
    expect(schemaFromIntrospection({ __schema: { types: [{ kind: 'WEIRD', name: 'X' }] } }).errors[0].message).toBe(
      'Introspection: unknown type kind `WEIRD` on `X`.',
    );
    const missingType = schemaFromIntrospection({
      __schema: { types: [{ kind: 'OBJECT', name: 'Q', fields: [{ name: 'a', type: { kind: 'NAMED' } }] }] },
    });
    expect(missingType.schema).toBeNull();
    expect(missingType.errors[0].message).toBe('Introspection: malformed type reference on Q.a.');
  });
});

describe('type-reference helpers', () => {
  it('unwrap and print', () => {
    const ref = {
      kind: 'NON_NULL' as const,
      ofType: { kind: 'LIST' as const, ofType: { kind: 'NAMED' as const, name: 'ID' } },
    };
    expect(namedTypeOf(ref)).toBe('ID');
    expect(printTypeRef(ref)).toBe('[ID]!');
    expect(isBuiltInScalar('ID')).toBe(true);
    expect(isIntrospectionName('__Type')).toBe(true);
    expect(isIntrospectionName('Type')).toBe(false);
  });
});
