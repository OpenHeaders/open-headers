/**
 * Browser API helper types
 */

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

/** Pending request info tracked by the request monitor */
export interface PendingRequest {
  tabId: number;
  url: string;
  headersApplied: boolean;
  method: string;
}

/** Chrome resource type strings used for tracking. */
export type TrackedResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'xmlhttprequest'
  | 'script'
  | 'stylesheet'
  | 'image'
  | 'font'
  | 'media'
  | 'websocket'
  | 'ping'
  | 'other';

/** Tracked resource stored per-tab — URL + metadata. */
export interface TrackedResource {
  timestamp: number;
  resourceType: TrackedResourceType;
}

/**
 * Applicable rule returned by `getActiveRulesForTab`. "Applicable" means the
 * rule's URL conditions would match either the current tab URL or a
 * previously-tracked sub-resource URL. Per-request firings live in
 * tab-telemetry (keyed by rule uid) and are joined in the popup — not
 * attached here.
 */
export interface ActiveRule {
  id: string;
  key: string;
  name: string;
  ruleType: string;
  summary: string;
  actionLabel: string;
  actionOperation?: string;
  actionTooltip: string;
  actionDirection?: string;
  actionValue: string;
  actionItems?: string[];
  isEnabled: boolean;
  domains: string[];
  /** Rule's path within the workspace (for collection/folder pause checks). */
  path: string;
}

/** Context object passed to handleGeneralMessage */
export interface MessageHandlerContext {
  isWebSocketConnected: () => boolean;
  sendViaWebSocket: (data: Record<string, unknown>) => boolean;
  scheduleUpdate: (reason: string, options?: { immediate?: boolean }) => void;
  revalidateTrackedRequests: () => Promise<void>;
  updateBadgeCallback: () => void;
}

/** Hotkey command stored in local storage */
export interface HotkeyCommand {
  type: 'TOGGLE_RECORDING';
  timestamp: number;
}
