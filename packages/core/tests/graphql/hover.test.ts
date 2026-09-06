/**
 * Hover model — the symbol under a cursor offset, resolved against the
 * schema: a field on the enclosing type (through nested selections,
 * fragments and inline fragments), a field argument, a directive and
 * its argument, a variable at its definition and its use, a fragment
 * spread, a type condition; nothing on whitespace, unknown names and
 * — without a schema — anything the document alone cannot name.
 */

import { symbolAt } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, parseOrThrow, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

const SOURCE = `query Users($first: Int = 10, $role: Role) @cost(weight: 2) {
  users(first: $first, role: $role) {
    edges { node { ...Person notes { totalCount } } }
  }
  ... on Query { viewer { id } }
}
fragment Person on User { name email @include(if: true) }`;

const document = parseOrThrow(SOURCE);
const at = (needle: string, skip = 0): number => {
  let index = -1;
  for (let i = 0; i <= skip; i += 1) index = SOURCE.indexOf(needle, index + 1);
  if (index < 0) throw new Error(`${needle} not in source`);
  return index + 1;
};

describe('symbolAt', () => {
  it('resolves a root field, a nested field and one reached through a fragment', () => {
    const users = symbolAt(document, at('users('), schema);
    expect(users?.kind === 'field' && users.parentType).toBe('Query');
    expect(users?.kind === 'field' && users.field.name).toBe('users');
    const totalCount = symbolAt(document, at('totalCount'), schema);
    expect(totalCount?.kind === 'field' && totalCount.parentType).toBe('NoteConnection');
    const email = symbolAt(document, at('email'), schema);
    expect(email?.kind === 'field' && email.parentType).toBe('User');
    expect(email?.kind === 'field' && email.field.description).toBe('Primary e-mail address.');
  });

  it('resolves a field argument, a directive and a directive argument', () => {
    const first = symbolAt(document, at('first: $first'), schema);
    expect(first?.kind === 'argument' && first.argument.name).toBe('first');
    expect(first?.kind === 'argument' && first.field.name).toBe('users');
    const include = symbolAt(document, at('include'), schema);
    expect(include?.kind === 'directive' && include.directive.name).toBe('include');
    const ifArg = symbolAt(document, at('if: true'), schema);
    expect(ifArg?.kind === 'directive-argument' && ifArg.argument.name).toBe('if');
    const weight = symbolAt(document, at('weight'), schema);
    expect(weight?.kind === 'directive-argument' && weight.directive.name).toBe('cost');
  });

  it('resolves variables at their definition and their use, with the declared type', () => {
    const definition = symbolAt(document, at('$role: Role'), schema);
    expect(definition).toMatchObject({ kind: 'variable', name: 'role', type: 'Role' });
    const use = symbolAt(document, at('$role)'), schema);
    expect(use).toMatchObject({ kind: 'variable', name: 'role', type: 'Role' });
    const type = symbolAt(document, at('Role) @cost'), schema);
    expect(type?.kind === 'type' && type.type.name).toBe('Role');
  });

  it('resolves a fragment spread, an inline fragment’s condition and a fragment’s condition', () => {
    const spread = symbolAt(document, at('...Person') + 3, schema);
    expect(spread).toMatchObject({ kind: 'fragment', name: 'Person', typeCondition: 'User' });
    const inline = symbolAt(document, at('on Query') + 3, schema);
    expect(inline?.kind === 'type' && inline.type.name).toBe('Query');
    const condition = symbolAt(document, at('on User') + 3, schema);
    expect(condition?.kind === 'type' && condition.type.name).toBe('User');
  });

  it('names nothing on whitespace, on an unknown field, and — schema-free — on any field', () => {
    expect(symbolAt(document, at('{\n  users') - 1, schema)).toBeNull();
    const unknown = parseOrThrow('{ nope { id } }');
    expect(symbolAt(unknown, 3, schema)).toBeNull();
    expect(symbolAt(document, at('users('), null)).toBeNull();
    // The document's own symbols still resolve without a schema.
    expect(symbolAt(document, at('$role)'), null)).toMatchObject({ kind: 'variable', name: 'role' });
    expect(symbolAt(document, at('...Person') + 3, null)).toMatchObject({ kind: 'fragment', name: 'Person' });
  });
});
