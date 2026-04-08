/**
 * Rule Store — single source of truth for V5 rules in the extension.
 *
 * Two rule sources coexist:
 *   1. **App rules** — from WebSocket (desktop app), authoritative when connected
 *   2. **Local rules** — created in the extension popup, always available
 *
 * getRules() returns the merged set (app rules first, then local rules).
 * Local rules have `uid` prefixed with "local-" to avoid collisions.
 *
 * Persistence:
 *   - App rules → storage.local key "v5Rules" (cache for offline restart)
 *   - Local rules → storage.local key "v5LocalRules" (user-created, permanent)
 */

import type { V5 } from '@openheaders/core/types';
import { storage } from '@utils/browser-api';
import { logger } from '@utils/logger';

const APP_STORAGE_KEY = 'v5Rules';
const LOCAL_STORAGE_KEY = 'v5LocalRules';

let appRules: V5.Rule[] = [];
let localRules: V5.Rule[] = [];

// ── Reads ────────────────────────────────────────────────────────────

/**
 * Get all rules (app + local) from memory.
 */
export function getRules(): V5.Rule[] {
  return [...appRules, ...localRules];
}

/**
 * Get only app rules (from desktop).
 */
export function getAppRules(): V5.Rule[] {
  return appRules;
}

/**
 * Get only local rules (created in extension).
 */
export function getLocalRules(): V5.Rule[] {
  return localRules;
}

/**
 * Get only enabled header rules (the subset that affects network traffic).
 */
export function getEnabledHeaderRules(): V5.HeaderRule[] {
  return getRules().filter((r): r is V5.HeaderRule => r.type === 'header' && r.enabled);
}

// ── App rules (from WebSocket) ───────────────────────────────────────

/**
 * Update rules from WebSocket. Persists to storage for offline restart.
 */
export function setRulesFromApp(incoming: V5.Rule[]): void {
  appRules = incoming;
  storage.local.set({ [APP_STORAGE_KEY]: incoming }, () => {
    logger.debug('RuleStore', `Persisted ${incoming.length} app rules to storage`);
  });
}

// ── Local rules (extension CRUD) ─────────────────────────────────────

/**
 * Generate a uid for local rules: "local-" + 4 random hex chars.
 */
function generateLocalUid(): string {
  const hex = Math.random().toString(16).slice(2, 6);
  return `local-${hex}`;
}

/**
 * Add a local rule. Returns the created rule with generated uid.
 */
export function addLocalRule(rule: Omit<V5.HeaderRule, 'uid' | 'path'>): V5.HeaderRule {
  const uid = generateLocalUid();
  const created: V5.HeaderRule = {
    ...rule,
    uid,
    path: `local/${uid}`,
  };
  localRules = [...localRules, created];
  persistLocalRules();
  return created;
}

/**
 * Update a local rule by uid. Returns true if found and updated.
 */
export function updateLocalRule(uid: string, updates: Partial<Omit<V5.HeaderRule, 'uid' | 'path'>>): boolean {
  const index = localRules.findIndex((r) => r.uid === uid);
  if (index === -1) return false;

  const existing = localRules[index] as V5.HeaderRule;
  localRules = [
    ...localRules.slice(0, index),
    { ...existing, ...updates },
    ...localRules.slice(index + 1),
  ];
  persistLocalRules();
  return true;
}

/**
 * Delete a local rule by uid. Returns true if found and deleted.
 */
export function deleteLocalRule(uid: string): boolean {
  const before = localRules.length;
  localRules = localRules.filter((r) => r.uid !== uid);
  if (localRules.length === before) return false;
  persistLocalRules();
  return true;
}

/**
 * Toggle a local rule's enabled state. Returns true if found.
 */
export function toggleLocalRule(uid: string, enabled: boolean): boolean {
  const index = localRules.findIndex((r) => r.uid === uid);
  if (index === -1) return false;
  localRules = [
    ...localRules.slice(0, index),
    { ...localRules[index], enabled },
    ...localRules.slice(index + 1),
  ];
  persistLocalRules();
  return true;
}

function persistLocalRules(): void {
  storage.local.set({ [LOCAL_STORAGE_KEY]: localRules }, () => {
    logger.debug('RuleStore', `Persisted ${localRules.length} local rules to storage`);
  });
}

// ── Hydration ────────────────────────────────────────────────────────

/**
 * Hydrate from storage on startup (before WebSocket connects).
 * Returns all restored rules (app + local).
 */
export function hydrateFromStorage(): Promise<V5.Rule[]> {
  return new Promise((resolve) => {
    storage.local.get([APP_STORAGE_KEY, LOCAL_STORAGE_KEY], (result: Record<string, unknown>) => {
      const storedApp = result[APP_STORAGE_KEY] as V5.Rule[] | undefined;
      const storedLocal = result[LOCAL_STORAGE_KEY] as V5.Rule[] | undefined;

      if (Array.isArray(storedApp) && storedApp.length > 0) {
        appRules = storedApp;
        logger.info('RuleStore', `Hydrated ${storedApp.length} app rules from storage`);
      }
      if (Array.isArray(storedLocal) && storedLocal.length > 0) {
        localRules = storedLocal;
        logger.info('RuleStore', `Hydrated ${storedLocal.length} local rules from storage`);
      }

      resolve(getRules());
    });
  });
}
