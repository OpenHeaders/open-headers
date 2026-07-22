/**
 * Protocol constants shared between all OpenHeaders components.
 */

/** WebSocket server port for desktop app ↔ extension/CLI communication */
export const WS_PORT = 8137;

/** WebSocket server URL */
export const WS_SERVER_URL = `ws://127.0.0.1:${WS_PORT}`;

/** Custom protocol scheme for deep linking */
export const PROTOCOL_NAME = 'openheaders';

/**
 * HTTP path the daemon's MCP endpoint is mounted on. Rides the same
 * bound socket as the WS server + pairing surface (`backend.bindPort`).
 */
export const MCP_HTTP_PATH = '/mcp';

/** The published Chrome Web Store extension id. */
export const CHROME_EXTENSION_ID = 'ablaikadpbfblkmhpmbbnbbfjoibeejb';

/** The published Edge Add-ons extension id. */
export const EDGE_EXTENSION_ID = 'gnbibobkkddlflknjkgcmokdlpddegpo';

/** The Firefox (Gecko) extension id from `browser_specific_settings.gecko.id`. */
export const FIREFOX_EXTENSION_ID = 'contact@tirzuman.com';

/**
 * Every Chromium-family id our extension publishes under. A
 * `chrome-extension://` origin is derived verbatim from the id, so
 * these are the only Chromium origins that can legitimately dial the
 * daemon — Gecko/Safari origins are per-install random UUIDs and stay
 * unpinnable by construction.
 */
export const CHROMIUM_EXTENSION_IDS: readonly string[] = [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID];
