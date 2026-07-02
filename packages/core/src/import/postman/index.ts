/**
 * Postman Collection v2.1 import — parse a Postman collection JSON
 * into request-shaped entries + one `ImportReport` covering the
 * whole collection.
 *
 * Scope (v1, ARCHITECTURE.md §23):
 *   • Collection metadata — name, description, collection variables.
 *   • Folder tree — nested `item[]` with `name` + child `item[]` maps
 *     directly to a folder path. Every folder's description is
 *     carried forward.
 *   • Requests — `name` + `request.{method,url,header,body,auth}`
 *     → `CurlRequest` shape for unified downstream handling with
 *     curl + HAR imports.
 *   • URL — string form passed through; object form collapsed to its
 *     `raw` field (Postman's documented canonical form) and query +
 *     path-variable arrays folded back into the URL string.
 *   • Auth — `basic` / `bearer` / `apikey` (header + query) promoted
 *     to first-class auth types. `oauth2` / `awsv4` / `digest` /
 *     `hawk` / `ntlm` / `edgegrid` DROPPED with tracking pointers to
 *     §18 (first-class auth).
 *   • Body — `raw` (content-type from `options.raw.language`),
 *     `urlencoded`, `graphql`, `formdata` (text parts only — file
 *     parts tracked for §6 content-addressed storage). `file` /
 *     `binary` body modes DROPPED with tracking.
 *   • Scripts — `event: prerequest | test` DROPPED with tracking
 *     for §19 (scripts via offscreen document).
 *   • Responses — saved `response[]` entries ignored (they're capture
 *     artifacts, not authoring data).
 *   • Protocol-profile behavior, auth inheritance, cert config —
 *     ignored (extension context can't honor any of them).
 *
 * Format reference: schema v2.1.0 — https://schema.getpostman.com/json/collection/v2.1.0/collection.json
 *
 * One deliberate design choice: this parser does NOT rewrite the
 * `{{var}}` syntax. Postman and our data model both resolve flat `{{var}}`
 * against a scope chain (Postman: globals → environment → collection
 * → local; ours: env → collection → workspace → secret → vault). A
 * reference imported verbatim resolves correctly as long as the
 * referenced variable is defined somewhere in the chain.
 *
 * Postman's collection variables ARE imported here (`collectionVariables`
 * in the result). Postman's environments live in separate
 * `.postman_environment.json` files — import those via
 * `parsePostmanEnvironment` (`./environment`) and wire them as native
 * environments. The resolver's error-as-spec pipeline (Phase 3) then
 * surfaces any remaining unresolved references with a concrete hint.
 */

export {
  type PostmanEnvironmentParseResult,
  type PostmanParsedEnvironmentVariable,
  parsePostmanEnvironment,
} from './environment';
export { parsePostman } from './parse';
export {
  type PostmanCollectionVariable,
  type PostmanParsedFolder,
  type PostmanParsedRequest,
  PostmanParseError,
  type PostmanParseResult,
} from './types';
