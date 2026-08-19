/**
 * @openheaders/ui/context — the renderer context layer.
 *
 * React providers + per-workspace sync mirrors + the renderer-mutator
 * context. This is a strongly-connected unit: the providers read from
 * the mirrors, the write-clients (under `../shared/sync`) push through
 * the mutator context, and the mirrors reflect host-storage broadcasts
 * back. It talks to the host only through `@openheaders/core/bridge`
 * and `@openheaders/core/storage` — no platform APIs.
 *
 * `ThemeContext` rides along too — it's not part of the sync SCC, but
 * it's a host-neutral renderer context now that `themes` and
 * `workbench/settings` both live in this package. `KeyboardNavContext`
 * is NOT here: it's popup-scoped (it drives the popup keyboard
 * dispatcher) and lives under `popup/shortcuts/` in the host app.
 */

export * from './EnvironmentContext';
export * from './FilesContext';
export * from './LiveVariablesContext';
export * from './LiveWorkflowsContext';
export * from './LocaleContext';
export * from './mirrors/awareness-mirror';
export * from './mirrors/collection-sync-mirror';
export * from './mirrors/eager-mirror-init';
export * from './mirrors/env-sync-mirror';
export * from './mirrors/extension-workspace-sync-mirror';
export * from './mirrors/files-sync-mirror';
// `SyncBroadcastPayload` is declared identically in both the flat- and
// singleton-entity mirrors; re-export one explicitly to disambiguate
// the two `export *` above.
export type { SyncBroadcastPayload } from './mirrors/flat-entity-mirror';
export * from './mirrors/flat-entity-mirror';
export * from './mirrors/folder-sync-mirror';
export * from './mirrors/grpc-response-example-sync-mirror';
export * from './mirrors/layout-state-sync-mirror';
export * from './mirrors/live-fallback-priority-sync-mirror';
export * from './mirrors/live-variable-sync-mirror';
export * from './mirrors/live-workflow-sync-mirror';
export * from './mirrors/pause-markers-sync-mirror';
export * from './mirrors/per-workspace-mirror-registry';
export * from './mirrors/request-collection-sync-mirror';
export * from './mirrors/request-folder-sync-mirror';
export * from './mirrors/request-sync-mirror';
export * from './mirrors/response-example-sync-mirror';
export * from './mirrors/rule-sync-mirror';
export * from './mirrors/singleton-entity-mirror';
export * from './mirrors/snapshot-rpc';
export * from './mirrors/template-collection-sync-mirror';
export * from './mirrors/template-folder-sync-mirror';
export * from './mirrors/template-sync-mirror';
export * from './mirrors/vault-sync-mirror';
export * from './mirrors/workspace-variables-sync-mirror';
export * from './OAuthBundlesContext';
export * from './PauseMarkersContext';
export * from './RequestsContext';
export * from './RuleContext';
export * from './renderer-mutator-context';
export * from './ThemeContext';
export * from './ui-theme';
export * from './VaultContext';
export * from './WorkspaceVariablesContext';
