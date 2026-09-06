/**
 * GraphQL outline derivation — the structure pane's groups for a
 * `graphql` spec. Pins the contract: the three root groups carry the
 * root types' fields, the type groups split by kind (roots excluded),
 * enum values and input fields nest, extensions fold into their type,
 * field rows carry their declared type and deprecation, an SDL root
 * navigates by declaration offset while an introspection root lists
 * without positions, and a non-parsing buffer returns null.
 */

import { schemaFromSdl, schemaToIntrospection } from '@openheaders/core/graphql';
import { buildGraphqlOutline } from '@openheaders/ui/workbench/components/specs/graphql-outline';
import { GRAPHQL_SDL_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import { describe, expect, it } from 'vitest';

const GROUP_KEYS = [
  'query',
  'mutation',
  'subscription',
  'types',
  'interfaces',
  'unions',
  'enums',
  'inputs',
  'scalars',
  'directives',
];

describe('buildGraphqlOutline', () => {
  it('derives the ten groups from the SDL scaffold, roots first, each type under its kind', () => {
    const groups = buildGraphqlOutline(GRAPHQL_SDL_SCAFFOLD);
    expect(groups).not.toBeNull();
    if (groups === null) return;
    expect(groups.map((g) => g.key)).toEqual(GROUP_KEYS);
    expect(groups[0].children.map((n) => n.label)).toEqual(['viewer', 'user', 'search']);
    expect(groups[1].children.map((n) => n.label)).toEqual(['createNote', 'deleteNote']);
    expect(groups[2].children.map((n) => n.label)).toEqual(['noteCreated']);
    // Roots stay out of Types.
    expect(groups[3].children.map((n) => n.label)).toEqual(['User', 'Note']);
    expect(groups[4].children.map((n) => n.label)).toEqual(['Node']);
    expect(groups[5].children.map((n) => n.label)).toEqual(['SearchResult']);
    expect(groups[6].children[0].children.map((n) => n.label)).toEqual(['OWNER', 'EDITOR', 'VIEWER']);
    expect(groups[7].children[0].children.map((n) => n.label)).toEqual(['title', 'body', 'tags', 'authorId']);
    expect(groups[8].children.map((n) => n.label)).toEqual(['DateTime']);
    expect(groups[9].children.map((n) => n.label)).toEqual(['@cost']);
  });

  it('rows carry declaration offsets, declared types and deprecation on an SDL root', () => {
    const sdl = `type Query { me: User @deprecated(reason: "Use viewer.") viewer: User }
type User { id: ID! }
extend type User { name: String }`;
    const groups = buildGraphqlOutline(sdl);
    expect(groups).not.toBeNull();
    if (groups === null) return;
    const [query, , , types] = groups;
    expect(query.offset).toBe(0);
    expect(query.children[0]).toMatchObject({ label: 'me', typeText: 'User', deprecated: true });
    expect(query.children[0].offset).toBe(sdl.indexOf('me:'));
    expect(query.children[1]).toMatchObject({ label: 'viewer', typeText: 'User' });
    expect(query.children[1].deprecated).toBeUndefined();
    // The extension's field folds into the type it extends.
    expect(types.children[0].children.map((n) => `${n.label}:${n.typeText}`)).toEqual(['id:ID!', 'name:String']);
  });

  it('lists an introspection root without positions', () => {
    const built = schemaFromSdl(GRAPHQL_SDL_SCAFFOLD).schema;
    expect(built).not.toBeNull();
    if (built === null) return;
    const groups = buildGraphqlOutline(JSON.stringify({ data: schemaToIntrospection(built) }));
    expect(groups).not.toBeNull();
    if (groups === null) return;
    expect(groups.map((g) => g.key)).toEqual(GROUP_KEYS);
    expect(groups[0].children.map((n) => n.label)).toEqual(['viewer', 'user', 'search']);
    expect(groups[0].children[0].offset).toBeNull();
    expect(groups[0].children[0].typeText).toBe('User');
    // Built-in scalars and the introspection types stay out.
    expect(groups[8].children.map((n) => n.label)).toEqual(['DateTime']);
  });

  it('returns null when the buffer does not parse', () => {
    expect(buildGraphqlOutline('type Query {')).toBeNull();
    expect(buildGraphqlOutline('{ "data": ')).toBeNull();
  });
});
