/**
 * GraphQL collection generation plan (the GraphQL-client plan Phase E). Pins:
 *   - one GraphqlRequest per Query / Mutation root field named after it,
 *     the synthesized document + example variables + ids-only specLink
 *     + the field's description on the seed, the endpoint URL applied;
 *   - roots group in query-then-mutation order; the request count
 *     aggregates across them; a query-only schema plans one root;
 *   - subscription fields are recorded, never generated;
 *   - an introspection-JSON root reads through the same reader;
 *   - schema problems surface on the plan while what resolved still
 *     plans; an unreadable document plans empty with the problem.
 */

import { schemaFromSdl, schemaToIntrospection } from '@openheaders/core/graphql';
import type { Spec } from '@openheaders/core/types';
import { buildGraphqlCollectionPlan } from '@openheaders/ui/workbench/components/specs/graphql-collection-plan';
import { describe, expect, it } from 'vitest';

const NOTES_SDL = [
  'schema { query: Query mutation: Mutation subscription: Subscription }',
  '"""A person with an account."""',
  'type User { id: ID! name: String! email: String! }',
  'type Note { id: ID! title: String! author: User! }',
  'input NoteInput { title: String! authorId: ID! }',
  'type Query {',
  '  """The signed-in user."""',
  '  viewer: User',
  '  user(id: ID!): User',
  '  search(term: String!, limit: Int = 5): [Note!]!',
  '}',
  'type Mutation {',
  '  createNote(input: NoteInput!): Note!',
  '  deleteNote(id: ID!): Boolean!',
  '}',
  'type Subscription { noteCreated: Note! }',
  '',
].join('\n');

function makeSpec(overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/notes-spc00001',
    name: 'Notes Schema',
    format: 'graphql',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.graphql', content: NOTES_SDL }],
    ...overrides,
  };
}

describe('buildGraphqlCollectionPlan', () => {
  it('plans one request per Query and Mutation field with document, variables, specLink and docs on the seed', () => {
    const plan = buildGraphqlCollectionPlan(makeSpec(), { url: 'https://api.openheaders.io/graphql' });
    expect(plan.requestCount).toBe(5);
    expect(plan.roots.map((r) => [r.operation, r.typeName, r.requests.map((q) => q.name)])).toEqual([
      ['query', 'Query', ['viewer', 'user', 'search']],
      ['mutation', 'Mutation', ['createNote', 'deleteNote']],
    ]);
    const viewer = plan.roots[0]?.requests[0];
    expect(viewer?.seed.url).toBe('https://api.openheaders.io/graphql');
    expect(viewer?.seed.query).toBe('query Viewer {\n  viewer {\n    id\n    name\n    email\n  }\n}\n');
    expect(viewer?.seed.variables).toBeUndefined();
    expect(viewer?.seed.specLink).toEqual({ specUid: 'spc00001' });
    expect(viewer?.seed.description).toBe('The signed-in user.');
    const search = plan.roots[0]?.requests[2];
    expect(search?.seed.query).toContain('query Search($term: String!, $limit: Int = 5)');
    expect(JSON.parse(search?.seed.variables ?? '')).toEqual({ term: 'term', limit: 5 });
    const createNote = plan.roots[1]?.requests[0];
    expect(createNote?.seed.query?.startsWith('mutation CreateNote($input: NoteInput!)')).toBe(true);
    expect(JSON.parse(createNote?.seed.variables ?? '')).toEqual({ input: { title: 'John Doe', authorId: '1' } });
    expect(plan.subscriptions).toEqual(['noteCreated']);
    expect(plan.problems).toEqual([]);
  });

  it('leaves the URL empty (a draft) when none is given and plans a query-only schema as one root', () => {
    const content = 'type Query { ping: String! }';
    const plan = buildGraphqlCollectionPlan(
      makeSpec({ files: [{ uid: 'fil00001', fileName: 'index.graphql', content }] }),
    );
    expect(plan.requestCount).toBe(1);
    expect(plan.roots.map((r) => r.operation)).toEqual(['query']);
    expect(plan.roots[0]?.requests[0]?.seed.url).toBe('');
    expect(plan.subscriptions).toEqual([]);
  });

  it('reads an introspection-JSON root through the same reader', () => {
    const built = schemaFromSdl(NOTES_SDL);
    if (built.schema === null) throw new Error('fixture schema');
    const content = JSON.stringify({ data: schemaToIntrospection(built.schema) });
    const plan = buildGraphqlCollectionPlan(
      makeSpec({ files: [{ uid: 'fil00001', fileName: 'index.json', content }] }),
    );
    expect(plan.requestCount).toBe(5);
    expect(plan.roots[1]?.requests.map((q) => q.name)).toEqual(['createNote', 'deleteNote']);
  });

  it('surfaces schema problems while the resolved part still plans, and plans empty on an unreadable document', () => {
    const withProblem = buildGraphqlCollectionPlan(
      makeSpec({
        files: [
          {
            uid: 'fil00001',
            fileName: 'index.graphql',
            content: 'type Query { ping: String! }\nextend type Missing { x: Int }',
          },
        ],
      }),
    );
    expect(withProblem.requestCount).toBe(1);
    expect(withProblem.problems.length).toBeGreaterThan(0);

    const broken = buildGraphqlCollectionPlan(
      makeSpec({ files: [{ uid: 'fil00001', fileName: 'index.graphql', content: 'type Query {' }] }),
    );
    expect(broken.requestCount).toBe(0);
    expect(broken.roots).toEqual([]);
    expect(broken.problems.length).toBeGreaterThan(0);
  });
});
