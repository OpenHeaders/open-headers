/**
 * OpenAPI import — parse an OpenAPI 3.x document (JSON or YAML) into
 * one collection of requests, with one `ImportReport` covering the
 * run (Import Fidelity epic, Phase I).
 *
 * Mapping highlights:
 *   • `info.title` → collection name; `info.description` +
 *     `info.version` → collection description.
 *   • `servers[0]` → the `{{baseUrl}}` collection variable (server
 *     variables substitute their declared defaults, recorded);
 *     additional servers are named in a transform. Path/operation
 *     level servers pin that request's base URL literally.
 *   • `paths` × operations → requests named from `summary` /
 *     `operationId` / `METHOD /path`; first tag → folder (root tag
 *     descriptions carried); path templating `{id}` → `{{id}}` with
 *     valued path parameters seeding collection variables.
 *   • query/header parameters → request rows (optional ones land
 *     disabled); cookie parameters drop (session state).
 *   • Internal `$ref`s resolve with a cycle guard; external refs are
 *     never fetched — both failure classes drop with reasons.
 *   • Request bodies, security schemes, and response documentation
 *     carry honest `#todo-openapi-*` notes until their slices land;
 *     TRACE operations, callbacks, and webhooks are permanent drops.
 */

export { parseOpenApi } from './parse';
export {
  type OpenApiCollectionVariable,
  type OpenApiParsedFolder,
  type OpenApiParsedRequest,
  OpenApiParseError,
  type OpenApiParseResult,
} from './types';
