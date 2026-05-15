export { bootSyncEngine, type BootSyncEngineResult } from './boot-sync-engine';
export { reseedAllPerWorkspaceBridges, type ReseedOptions } from './reseed-bridges';

// NOTE: `ws-server` is intentionally NOT re-exported here. It depends
// on the Node-only `ws` package; the browser extension imports this
// barrel for `bootSyncEngine` and would transitively pull `ws` into
// its Vite build. Server-side hosts (desktop main, headless daemons)
// deep-import via `@openheaders/oracle/host-runtime/ws-server` instead.
