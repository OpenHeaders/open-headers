/**
 * Bruno import — parse `.bru` request files (single file or a whole
 * collection folder) into one collection + environments, with one
 * `ImportReport` covering the run.
 *
 * Entry shapes (Migration epic Phase 1):
 *   • `parseBrunoFiles(files)` — folder composition: collection-relative
 *     paths + contents from the folder picker / Phase 4 scanner. The
 *     parser itself never touches the filesystem.
 *   • `parseBruno(content)` — a lone pasted/dropped `.bru` request.
 *
 * Mapping highlights:
 *   • One file = one request; folder path from the relative dirs
 *     (`folder.bru` `meta.name` overrides the display name); `meta.seq`
 *     preserves user ordering; `bruno.json` / `collection.bru` name the
 *     collection.
 *   • Method blocks (`get`/`post`/…) carry `url` + the active `body` /
 *     `auth` selectors; `headers`, `params:query` (and the legacy bare
 *     `query`), `params:path` (substituted like Postman `url.variable`)
 *     map onto `CurlRequest` — the shared write path with the curl /
 *     HAR / Postman / Insomnia importers.
 *   • Bodies — json (incl. the legacy bare `body` block) / text / xml /
 *     graphql (+ `body:graphql:vars`) / form-urlencoded / multipart
 *     (`@file(…)` parts → placeholder FileRefs) / file / sparql-as-text.
 *   • Auth — basic / bearer / apikey promoted; oauth2, awsv4, digest,
 *     ntlm, wsse, inherit DROPPED with the same tracking vocabulary as
 *     the other importers. Bruno templates already use plain `{{var}}`
 *     — no rewrite pass needed.
 *   • `environments/*.bru` → environments (name from the filename);
 *     `vars:secret` names drop — Bruno keeps secret values out of the
 *     collection files, so there is nothing to carry over.
 *   • Scripts, tests, runtime vars, docs, settings, and collection-level
 *     defaults drop with per-block report entries — never silently.
 */

export { parseBruno, parseBrunoFiles } from './parse';
export {
  type BrunoFile,
  type BrunoParsedEnvironment,
  type BrunoParsedEnvironmentVariable,
  type BrunoParsedFolder,
  type BrunoParsedRequest,
  BrunoParseError,
  type BrunoParseResult,
} from './types';
