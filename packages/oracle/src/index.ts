/**
 * @openheaders/oracle — entity-agnostic sync engine, projections, mutation
 * builders, workspace state, conflict resolution.
 *
 * Subpath exports (canonical):
 *   - `@openheaders/oracle/sync`         — runtime sync engine (oracle, caches, post-state, broadcast, log, intents)
 *   - `@openheaders/oracle/sync-builders` — pure per-entity projections + mutation batch builders
 *   - `@openheaders/oracle/storage`      — chrome.storage adapter implementing
 *                                          `HostStorage` from `@openheaders/core/storage`
 *                                          (the typed key registry + contract live in core)
 *   - `@openheaders/oracle/test-run/*`   — workspace-scoped test-run state + store
 *   - `@openheaders/oracle/tracking/*`   — per-tab tracked-resource state mirror
 *   - `@openheaders/oracle/files`        — IndexedDB blob store for file payloads
 *   - `@openheaders/oracle/coordination` — entity-locking serializer
 *
 * The bare-package import (`@openheaders/oracle`) is intentionally empty
 * for now; consumers should import the specific subpath they need.
 */

export {};
