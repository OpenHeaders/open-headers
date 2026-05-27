export { bootSyncEngine, type BootSyncEngineResult } from './boot-sync-engine';
export { reseedAllPerWorkspaceBridges, type ReseedOptions } from './reseed-bridges';

// Node-only host-runtime pieces live in `@openheaders/oracle-host-node`:
//   - `ws-server` (depends on `ws`, `node:http`, `node:crypto`)
//   - `pairing-http` (depends on `node:http` types)
// The browser extension imports this barrel for `bootSyncEngine` and
// must not transitively pull Node-only deps into its Vite build.
