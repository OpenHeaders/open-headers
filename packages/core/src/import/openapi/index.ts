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
 *   • request bodies import per media type (JSON preferred; concrete
 *     examples win, schema-only JSON bodies synthesize a bounded
 *     placeholder scaffold; urlencoded/multipart/text mapped, file
 *     parts as placeholder FileRefs).
 *   • security schemes → AuthConfig arms (http basic/bearer/digest,
 *     apiKey header/query, oauth2 flows per the Phase G dispositions
 *     with `{{clientId}}`/`{{clientSecret}}` placeholders); the
 *     document-level requirement becomes the collection default and
 *     requests without their own security import as `inherit`.
 *   • documented responses mint Response Example payloads under
 *     `OpenApiParseOptions.responseExamples` (off = honest note);
 *     schema-only responses stay a counted note.
 *   • Internal `$ref`s resolve with a cycle guard; external refs are
 *     never fetched — both failure classes drop with reasons.
 *   • TRACE operations, cookie material, callbacks, webhooks, and
 *     response links are permanent drops.
 */

export { parseOpenApi } from './parse';
export {
  type OpenApiCollectionVariable,
  type OpenApiParsedExample,
  type OpenApiParsedFolder,
  type OpenApiParsedRequest,
  OpenApiParseError,
  type OpenApiParseOptions,
  type OpenApiParseResult,
} from './types';
