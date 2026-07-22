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
export const FIREFOX_EXTENSION_ID = '{2c14f276-673b-4078-a575-8acf9d0579fa}';

/**
 * The Firefox (Gecko) beta-channel extension id — beta builds swap it
 * into `browser_specific_settings.gecko.id` so the beta add-on carries
 * its own AMO identity beside the stable one.
 */
export const FIREFOX_BETA_EXTENSION_ID = '{e21fed2a-70f9-43a2-aadd-9504c1a5ca9e}';

/**
 * Every Gecko id our extension publishes under. Gecko NM manifests
 * allowlist by id (`allowed_extensions`), so both channels belong
 * there — Gecko WS origins stay unpinnable (per-install random UUIDs).
 */
export const GECKO_EXTENSION_IDS: readonly string[] = [FIREFOX_EXTENSION_ID, FIREFOX_BETA_EXTENSION_ID];

/**
 * Every Chromium-family id our extension publishes under. A
 * `chrome-extension://` origin is derived verbatim from the id, so
 * these are the only Chromium origins that can legitimately dial the
 * daemon — Gecko/Safari origins are per-install random UUIDs and stay
 * unpinnable by construction.
 */
export const CHROMIUM_EXTENSION_IDS: readonly string[] = [CHROME_EXTENSION_ID, EDGE_EXTENSION_ID];
