/**
 * Operation synthesis — one runnable document per root field: every
 * argument as a same-named variable (defaults carried), a shallow
 * selection under the field, unions spread per member, deprecated and
 * argument-taking fields left out, `__typename` as the last resort,
 * the variables from the example synthesis.
 */

import { operationNameFor, parseDocument, synthesizeOperation, validateDocument } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';
import { OPENHEADERS_SDL, schemaOrThrow } from './helpers';

const schema = schemaOrThrow(OPENHEADERS_SDL);

function rootField(typeName: 'Query' | 'Mutation', fieldName: string) {
  const type = schema.types.get(typeName);
  if (type === undefined || type.kind !== 'OBJECT') throw new Error(`no ${typeName}`);
  const field = type.fields.find((entry) => entry.name === fieldName);
  if (field === undefined) throw new Error(`no ${typeName}.${fieldName}`);
  return field;
}

describe('synthesizeOperation', () => {
  it('declares every argument as a variable, carries defaults, and selects the leaves plus one composite level', () => {
    const result = synthesizeOperation(schema, 'query', rootField('Query', 'users'));
    expect(result.name).toBe('Users');
    expect(result.document).toBe(
      [
        'query Users($first: Int = 10, $after: String, $role: Role) {',
        '  users(first: $first, after: $after, role: $role) {',
        '    edges {',
        '      cursor',
        '    }',
        '    pageInfo {',
        '      hasNextPage',
        '      endCursor',
        '    }',
        '    totalCount',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.variables).toEqual({ first: 10, after: 'Y3Vyc29y', role: 'OWNER' });
  });

  it('leaves deprecated fields and fields with required arguments out of the selection', () => {
    const result = synthesizeOperation(schema, 'query', rootField('Query', 'viewer'));
    expect(result.document).not.toContain('username');
    expect(result.document).toContain('avatarUrl');
    // `notes(first, after)` takes only optional arguments — selected
    // bare, and at the depth cap its connection keeps its leaves only.
    expect(result.document).toContain('notes {\n      totalCount\n    }');
    expect(result.variables).toBeNull();
  });

  it('spreads a union per member with each member’s leaves', () => {
    const result = synthesizeOperation(schema, 'query', rootField('Query', 'search'));
    expect(result.document).toContain('search(term: $term, limit: $limit) {');
    expect(result.document).toContain('__typename');
    expect(result.document).toContain('... on User {');
    expect(result.document).toContain('... on Note {');
    expect(result.variables).toEqual({ term: 'term', limit: 5 });
  });

  it('synthesizes a mutation with its input object filled', () => {
    const result = synthesizeOperation(schema, 'mutation', rootField('Mutation', 'createNote'));
    expect(result.document.startsWith('mutation CreateNote($input: NoteInput!) {')).toBe(true);
    expect(result.variables).toMatchObject({ input: { title: 'John Doe', authorId: '1', visibleTo: 'EDITOR' } });
  });

  it('selects nothing under a leaf field and falls back to __typename under an interface with only deep fields', () => {
    const leaf = synthesizeOperation(schema, 'query', rootField('Query', 'gated'));
    expect(leaf.document).toBe('query Gated {\n  gated\n}\n');
    expect(leaf.variables).toBeNull();
    const node = synthesizeOperation(schema, 'query', rootField('Query', 'node'), { depth: 1 });
    expect(node.document).toContain('node(id: $id) {\n    id\n  }');
  });

  it('produces documents the validator accepts against the schema', () => {
    for (const typeName of ['Query', 'Mutation'] as const) {
      const type = schema.types.get(typeName);
      if (type === undefined || type.kind !== 'OBJECT') throw new Error(`no ${typeName}`);
      for (const field of type.fields) {
        const operation = typeName === 'Query' ? 'query' : 'mutation';
        const result = synthesizeOperation(schema, operation, field);
        const parsed = parseDocument(result.document);
        expect(parsed.document, field.name).not.toBeNull();
        if (parsed.document === null) continue;
        expect(validateDocument(parsed.document, schema), field.name).toEqual([]);
      }
    }
  });

  it('names operations after the field in PascalCase, always a valid Name', () => {
    expect(operationNameFor('createNote')).toBe('CreateNote');
    expect(operationNameFor('_private')).toBe('_private');
    expect(operationNameFor('9lives')).toBe('_9lives');
    expect(operationNameFor('')).toBe('Operation');
  });
});
