/**
 * A `graphql` spec's root file read into the schema model. The file
 * holds either SDL (`index.graphql`) or an introspection result
 * (`index.json`) — the syntax is the root file's business (invariant
 * #15), so the reader sniffs the text: a document that opens with `{`
 * is JSON, everything else is SDL (an SDL document never starts with a
 * brace). Shared by the spec editor's validation and outline and by
 * the GraphQL request's linked-spec resolution, so the three never
 * disagree on what a spec means.
 */

import { type SchemaResult, schemaFromIntrospection, schemaFromSdl } from '@openheaders/core/graphql';

export type GraphqlSchemaSourceKind = 'sdl' | 'introspection';

export const GRAPHQL_SDL_ROOT_FILE_NAME = 'index.graphql';
export const GRAPHQL_INTROSPECTION_ROOT_FILE_NAME = 'index.json';

/** The extensions a root file carries for either syntax. */
const SDL_EXTENSIONS = ['.graphql', '.gql', '.graphqls'];

export function graphqlSchemaSourceKind(content: string): GraphqlSchemaSourceKind {
  return content.trimStart().startsWith('{') ? 'introspection' : 'sdl';
}

/** True when the file name's extension names one of the two syntaxes. */
export function isGraphqlSchemaFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.json') || SDL_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Monaco language for a `graphql` spec root file. */
export function isGraphqlSdlFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SDL_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export interface GraphqlSchemaSource {
  readonly kind: GraphqlSchemaSourceKind;
  readonly result: SchemaResult;
}

/** Read the root text into the model; problems are reported, never thrown. */
export function readGraphqlSchemaSource(content: string): GraphqlSchemaSource {
  const kind = graphqlSchemaSourceKind(content);
  if (kind === 'sdl') return { kind, result: schemaFromSdl(content) };
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind, result: { schema: null, errors: [{ message: `Not valid JSON: ${message}`, start: 0, end: 0 }] } };
  }
  return { kind, result: schemaFromIntrospection(json) };
}
