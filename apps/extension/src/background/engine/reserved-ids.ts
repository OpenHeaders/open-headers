/**
 * Reserved DNR rule-ID ranges owned by the engine.
 *
 * The engine's apply layer is the single point that calls
 * `chrome.declarativeNetRequest.updateSessionRules`. Anything else that
 * installs session rules (today: per-tab cache-bypass rules) needs to
 * pick an ID range the engine's apply will leave alone — otherwise the
 * next user-rule rebuild would nuke them.
 *
 * Reserved ranges below; everything else is fair game for the engine's
 * own compilation output (which starts at 1 for dynamic and 1_000_000
 * for test-run session rules).
 */

/**
 * Base ID for per-tab cache-bypass session rules. Each cache-bypass
 * rule's ID is `CACHE_BYPASS_ID_BASE + tabId`, well above test-run IDs
 * (`>= 1_000_000`) so the two ranges don't collide. The engine's
 * session-apply preserves any existing session rule whose ID is at or
 * above this base.
 */
export const CACHE_BYPASS_ID_BASE = 9_000_000;
