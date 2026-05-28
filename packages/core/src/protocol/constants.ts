/**
 * Protocol constants shared between all OpenHeaders components.
 */

/** WebSocket server port for desktop app ↔ extension/CLI communication */
export const WS_PORT = 8137;

/** WebSocket server URL */
export const WS_SERVER_URL = `ws://127.0.0.1:${WS_PORT}`;

/** Custom protocol scheme for deep linking */
export const PROTOCOL_NAME = 'openheaders';
