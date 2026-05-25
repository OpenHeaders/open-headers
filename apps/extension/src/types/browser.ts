/**
 * Browser API helper types
 */

// Rule-verdict + tracked-resource types are host-bridge wire payloads
// and shared domain shapes — they now live in `@openheaders/core`.
// Re-exported here so the historical `@/types/browser` path keeps
// working until the E.3 codemod sweep repoints consumers at core.
export type {
  ActiveRule,
  ObservationSource,
  RuleVerdict,
  SilentMatchRecord,
  TrackedResource,
  TrackedResourceType,
} from '@openheaders/core/types';

declare const browser: typeof chrome | undefined;

/** The cross-browser API object (Firefox `browser` or Chrome `chrome`) */
export type BrowserAPI = typeof chrome;

/**
 * Get the appropriate browser API object.
 * In Firefox, `browser` is defined globally; everywhere else we fall back to `chrome`.
 */
export function getBrowserAPI(): BrowserAPI {
  return typeof browser !== 'undefined' ? browser : chrome;
}

/** Callback used to send a response back through runtime.onMessage */
export type SendResponse = (response: unknown) => void;

/** Badge states used by the badge manager */
export type BadgeState = 'none' | 'active' | 'disconnected' | 'paused';

/** Context object passed to handleGeneralMessage */
export interface MessageHandlerContext {
  isWebSocketConnected: () => boolean;
  sendViaWebSocket: (data: Record<string, unknown>) => boolean;
  scheduleUpdate: (reason: string, options?: { immediate?: boolean }) => void;
  revalidateTrackedRequests: () => Promise<void>;
  updateBadgeCallback: () => void;
}
