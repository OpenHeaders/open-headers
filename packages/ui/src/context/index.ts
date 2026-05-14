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

export * from './awareness-mirror';
export * from './collection-sync-mirror';

export * from './EnvironmentContext';
export * from './eager-mirror-init';
export * from './env-sync-mirror';
export * from './extension-workspace-sync-mirror';
export * from './FilesContext';
export * from './files-sync-mirror';
// `SyncBroadcastPayload` is declared identically in both the flat- and
// singleton-entity mirrors; re-export one explicitly to disambiguate
// the two `export *` above.
export type { SyncBroadcastPayload } from './flat-entity-mirror';
export * from './flat-entity-mirror';
export * from './folder-sync-mirror';
export * from './LiveVariablesContext';
export * from './LiveWorkflowsContext';
export * from './layout-state-sync-mirror';
export * from './live-variable-sync-mirror';
export * from './live-workflow-sync-mirror';
export * from './OAuthBundlesContext';
export * from './PauseMarkersContext';
export * from './pause-markers-sync-mirror';
export * from './per-workspace-mirror-registry';
export * from './RequestsContext';
export * from './RuleContext';
export * from './renderer-mutator-context';
export * from './request-collection-sync-mirror';
export * from './request-folder-sync-mirror';
export * from './request-sync-mirror';
export * from './rule-sync-mirror';
export * from './singleton-entity-mirror';
export * from './ThemeContext';
export * from './template-collection-sync-mirror';
export * from './template-folder-sync-mirror';
export * from './template-sync-mirror';
export * from './ui-theme';
export * from './VaultContext';
export * from './vault-sync-mirror';
export * from './WorkspaceVariablesContext';
export * from './workspace-variables-sync-mirror';
