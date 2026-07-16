/**
 * Insomnia import — parse an Insomnia export into collections
 * (requests + folder tree) and environments, with one `ImportReport`
 * covering the run.
 *
 * Entry shapes (Migration epic Phase 1):
 *   • Export v4 — the JSON envelope (`_type: 'export'`,
 *     `__export_format: 4`, `resources[]` with snake_case `_type`
 *     discriminators).
 *   • v5 documents — `type: collection.insomnia.rest/5.x` /
 *     `environment.…` / `globals.…`, YAML or JSON (core already ships
 *     the `yaml` codec dependency). Converted to the v4 resource
 *     vocabulary and assembled identically.
 *   • Raw NeDB doc lines — `parseInsomniaDocs(docs)` for the Phase 4
 *     scanner (PascalCase `type` discriminators); the parser itself
 *     never touches the filesystem.
 *
 * Mapping highlights:
 *   • Workspaces → collections; request groups → folder paths;
 *     requests → `CurlRequest` (shared write path with curl/HAR/
 *     Postman importers). `metaSortKey` preserves user ordering.
 *   • `{{ _.var }}` template references rewrite to flat `{{var}}`
 *     (one transform per request); Nunjucks tag blocks (`{% … %}`)
 *     stay verbatim with a drop entry. Environment `data` flattens to
 *     dotted names so rewritten references keep resolving;
 *     sub-environments land merged over their base (sub wins), as a
 *     recorded transform.
 *   • Auth — basic / bearer / apikey promoted; oauth1/2, digest,
 *     ntlm, hawk, netrc, asap, iam DROPPED with the same tracking
 *     vocabulary as the Postman importer.
 *   • Bodies — json / xml / graphql (JSON envelope unwrapped) /
 *     urlencoded / multipart (file parts → placeholder FileRefs) /
 *     octet-stream (one-part multipart placeholder) / plain text.
 *   • API specs (design documents) convert to collections through the
 *     OpenAPI importer AND retain their verbatim source in `specs[]`
 *     so the landing surface mints the spec entity beside the
 *     collection; unparseable specs drop with the parser's error.
 *   • Cookie jars, ws/grpc requests and other resource types drop
 *     with per-type aggregate report entries — never silently.
 */

export { flattenEnvironmentData } from './environment';
export { parseInsomnia, parseInsomniaDocs } from './parse';
export { rewriteTemplateRefs } from './request';
export {
  type InsomniaParsedCollection,
  type InsomniaParsedEnvironment,
  type InsomniaParsedEnvironmentVariable,
  type InsomniaParsedFolder,
  type InsomniaParsedRequest,
  type InsomniaParsedSpec,
  InsomniaParseError,
  type InsomniaParseResult,
} from './types';
