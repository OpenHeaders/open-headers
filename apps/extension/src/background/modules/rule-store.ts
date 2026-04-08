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
 * Local rules belong to **local collections** — same V5.Collection structure
 * as the desktop, so data can be synced when the desktop app connects.
 *
 * Persistence:
 *   - App rules → storage.local key "v5Rules" (cache for offline restart)
 *   - Local rules → storage.local key "v5LocalRules" (user-created, permanent)
 *   - Local collections → storage.local key "v5LocalCollections"
 */

import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { storage } from '@utils/browser-api';
import { logger } from '@utils/logger';

const APP_STORAGE_KEY = 'v5Rules';
const LOCAL_RULES_KEY = 'v5LocalRules';
const LOCAL_COLLECTIONS_KEY = 'v5LocalCollections';

let appRules: V5.Rule[] = [];
let localRules: V5.Rule[] = [];
let localCollections: V5.Collection[] = [];

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
 * Get local collections.
 */
export function getLocalCollections(): V5.Collection[] {
  return localCollections;
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

// ── Local collections ────────────────────────────────────────────────

const DEFAULT_COLLECTION_NAME = 'My Rules';

/**
 * Generate a uid prefixed with "local-" to distinguish from app-created entities.
 * Uses the shared 4-char alphanumeric generator from core.
 */
function generateLocalUid(): string {
  return `local-${generateUid()}`;
}

/**
 * Ensure the default collection exists. Returns it.
 */
export function ensureDefaultCollection(): V5.Collection {
  const existing = localCollections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateLocalUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: V5.Collection = {
    uid,
    path: `rules/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
  };
  localCollections = [...localCollections, collection];
  persistLocalCollections();
  return collection;
}

/**
 * Create a local collection. Returns the created collection.
 */
export function createLocalCollection(name: string): V5.Collection {
  const uid = generateLocalUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
    uid,
    path: `rules/${folderName}`,
    name,
    variables: [],
  };
  localCollections = [...localCollections, collection];
  persistLocalCollections();
  return collection;
}

/**
 * Rename a local collection. Returns true if found and renamed.
 */
export function renameLocalCollection(uid: string, name: string): boolean {
  const index = localCollections.findIndex((c) => c.uid === uid);
  if (index === -1) return false;
  localCollections = [
    ...localCollections.slice(0, index),
    { ...localCollections[index], name },
    ...localCollections.slice(index + 1),
  ];
  persistLocalCollections();
  return true;
}

/**
 * Delete a local collection and all its rules. Returns true if found.
 */
export function deleteLocalCollection(uid: string): boolean {
  const collection = localCollections.find((c) => c.uid === uid);
  if (!collection) return false;

  localCollections = localCollections.filter((c) => c.uid !== uid);

  // Delete all rules whose path starts with this collection's path
  localRules = localRules.filter((r) => !r.path.startsWith(collection.path));
  persistLocalCollections();
  persistLocalRules();
  return true;
}

function persistLocalCollections(): void {
  storage.local.set({ [LOCAL_COLLECTIONS_KEY]: localCollections }, () => {
    logger.debug('RuleStore', `Persisted ${localCollections.length} local collections to storage`);
  });
}

// ── Local rules (extension CRUD) ─────────────────────────────────────

/**
 * Add a local rule within a collection. Returns the created rule.
 */
export function addLocalRule(rule: Omit<V5.HeaderRule, 'uid' | 'path'>, collectionUid: string): V5.HeaderRule {
  const collection = localCollections.find((c) => c.uid === collectionUid);
  const collectionPath = collection?.path ?? `rules/${collectionUid}`;

  const uid = generateLocalUid();
  const folderName = toFolderName(rule.name, uid);
  const created: V5.HeaderRule = {
    ...rule,
    uid,
    path: `${collectionPath}/${folderName}`,
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
  storage.local.set({ [LOCAL_RULES_KEY]: localRules }, () => {
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
    storage.local.get([APP_STORAGE_KEY, LOCAL_RULES_KEY, LOCAL_COLLECTIONS_KEY], (result: Record<string, unknown>) => {
      const storedApp = result[APP_STORAGE_KEY] as V5.Rule[] | undefined;
      const storedLocal = result[LOCAL_RULES_KEY] as V5.Rule[] | undefined;
      const storedCollections = result[LOCAL_COLLECTIONS_KEY] as V5.Collection[] | undefined;

      if (Array.isArray(storedApp) && storedApp.length > 0) {
        appRules = storedApp;
        logger.info('RuleStore', `Hydrated ${storedApp.length} app rules from storage`);
      }
      if (Array.isArray(storedLocal) && storedLocal.length > 0) {
        localRules = storedLocal;
        logger.info('RuleStore', `Hydrated ${storedLocal.length} local rules from storage`);
      }
      if (Array.isArray(storedCollections) && storedCollections.length > 0) {
        localCollections = storedCollections;
        logger.info('RuleStore', `Hydrated ${storedCollections.length} local collections from storage`);
      }

      resolve(getRules());
    });
  });
}
