/**
 * @openheaders/oracle — entity-agnostic sync engine, workspace state,
 * conflict resolution.
 *
 * The pure per-entity projection + mutation-batch builders this engine
 * runs on live in `@openheaders/core/sync-builders` — shared domain
 * logic depended on by both the engine and the UI write path.
 *
 * Subpath exports (canonical):
 *   - `@openheaders/oracle/sync`         — runtime sync engine (oracle, caches, post-state, broadcast, log, intents)
 *   - `@openheaders/oracle/storage`      — storage façade re-exporting the
 *                                          `HostStorage` contract + typed-key
 *                                          registry from `@openheaders/core/storage`;
 *                                          oracle owns no concrete adapter — each
 *                                          host installs its own
 *   - `@openheaders/oracle/tracking/*`   — per-tab tracked-resource state mirror
 *   - `@openheaders/oracle/files`        — IndexedDB blob store for file payloads
 *   - `@openheaders/oracle/coordination` — entity-locking serializer
 *
 * The bare-package import (`@openheaders/oracle`) is intentionally empty
 * for now; consumers should import the specific subpath they need.
 */

export {};
