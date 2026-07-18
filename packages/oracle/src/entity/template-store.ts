/**
 * Template Store — single source of truth for user-defined templates
 * in the active workspace.
 *
 * Mirrors `request-store.ts` post Phase B: writes route through the sync
 * oracle (catalog factory → MutationBatch → `oracle.apply`); the
 * {@link TemplateCache} / {@link TemplateCollectionCache} /
 * {@link TemplateFolderCache} own `chrome.storage.local` persistence +
 * drive the local mirrors via broadcast-driven re-projection. Reads stay
 * synchronous off the local mirror.
 *
 * Storage keys (all scoped to active workspace id):
 *   - `oh.ws.<id>.templates`            (cache-owned)
 *   - `oh.ws.<id>.templateCollections`  (cache-owned)
 *   - `oh.ws.<id>.templateFolders`      (cache-owned)
 */

import { consumedOrgIds, getIdentitySnapshot } from '@openheaders/core/identity';
import { CollectionSchema, FolderSchema, TemplateSchema } from '@openheaders/core/schemas';
import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import {
  buildDeleteTemplateCollectionBatch,
  buildRenameTemplateCollectionBatch,
} from '@openheaders/core/sync-builders/mutations/template-collection-mutations';
import {
  buildCreateTemplateFolderBatch,
  buildDeleteTemplateFolderBatch,
  buildDeleteTemplateFolderEntityBatch,
  buildRenameTemplateFolderBatch,
} from '@openheaders/core/sync-builders/mutations/template-folder-mutations';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/template-mutations';
import { seedTemplateCollection } from '@openheaders/core/sync-builders/projections/template-collection-projection';
import type { Collection, CollectionTree, RuleType, Template, TreeNode } from '@openheaders/core/types';
import { generateUid, logger, toFolderName } from '@openheaders/core/utils';
import type { LocalFolder } from '@openheaders/oracle/entity/rule-store';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import type { TemplateCache } from '@openheaders/oracle/sync/caches/template-cache';
import type { TemplateCollectionCache } from '@openheaders/oracle/sync/caches/template-collection-cache';
import type { TemplateFolderCache } from '@openheaders/oracle/sync/caches/template-folder-cache';
import {
  TEMPLATE_COLLECTION_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  TEMPLATE_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import {
  getActiveCacheForRegistration,
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  nextSwMutatorContext,
} from '@openheaders/oracle/sync/service/accessors';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';
import { getWorkspace } from '../workspace/extension-workspace-store';

// ── In-memory state (scoped to active workspace) ────────────────────

let templates: Template[] = [];
let templateCollections: Collection[] = [];
let templateFolders: LocalFolder[] = [];
let loadedWorkspaceId: string | null = null;

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const changeListeners: Set<ChangeListener> = new Set();

export function onTemplateStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

// ── Reads ───────────────────────────────────────────────────────────

export function getTemplates(): Template[] {
  return templates;
}

export function getTemplateCollections(): Collection[] {
  return templateCollections;
}

/**
 * Snapshot every template collection in an explicit workspace via its
 * {@link TemplateCollectionCache}. Returns `[]` when no service is
 * materialized for the workspace. SW-internal consumers operating on a
 * non-Active workspace (live-refresh chain executor's variable scope
 * feed) read through here instead of {@link getTemplateCollections},
 * which is Active-bound by design (renderer/popup).
 */
export function getTemplateCollectionsForWorkspace(workspaceId: string): Collection[] {
  const cache = getCacheForWorkspace<TemplateCollectionCache>(TEMPLATE_COLLECTION_REGISTRATION, workspaceId);
  return cache ? cache.getTemplateCollections() : [];
}

export function getTemplateFolders(): LocalFolder[] {
  return templateFolders;
}

export function getTemplateCollectionTrees(): CollectionTree[] {
  return templateCollections.map((collection) => {
    const tree = buildTreeForParent(TEMPLATE_COLLECTION_ENTITY_TYPE, collection.uid, collection.path);
    return { ...collection, tree };
  });
}

/**
 * Build TreeNode[] for the children of a template-collection or
 * template-folder. Folder siblings render in the order carried by the
 * parent's `folders` set (§7.2 + §23.5). Templates inside the same
 * parent keep their cache-array order — templates don't live in a
 * parent set today.
 */
function buildTreeForParent(
  parentType: typeof TEMPLATE_COLLECTION_ENTITY_TYPE | typeof TEMPLATE_FOLDER_ENTITY_TYPE,
  parentUid: string,
  parentPath: string,
): TreeNode[] {
  const nodes: TreeNode[] = [];

  const oracle = getOracleForCurrentWorkspace();
  const slots = oracle ? oracle.liveOrderedSetItems(parentType, parentUid, TEMPLATE_FOLDER_CHILDREN_PATH) : [];

  let childFolders: LocalFolder[];
  if (slots.length > 0) {
    const byUid = new Map(templateFolders.map((f) => [f.uid, f]));
    childFolders = slots.map((slot) => byUid.get(slot.itemId)).filter((f): f is LocalFolder => Boolean(f));
  } else {
    childFolders = templateFolders.filter((f) => {
      const parent = f.path.substring(0, f.path.lastIndexOf('/'));
      return parent === parentPath;
    });
  }

  for (const folder of childFolders) {
    const children = buildTreeForParent(TEMPLATE_FOLDER_ENTITY_TYPE, folder.uid, folder.path);
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children,
    });
  }

  const childTemplates = templates.filter((t) => {
    const parent = t.path.substring(0, t.path.lastIndexOf('/'));
    return parent === parentPath;
  });

  for (const template of childTemplates) {
    nodes.push({
      type: 'template',
      uid: template.uid,
      name: template.name,
      path: template.path,
      ruleType: template.ruleType as RuleType,
      icon: template.icon,
    });
  }

  return nodes;
}

// ── Collections ─────────────────────────────────────────────────────

const DEFAULT_COLLECTION_NAME = 'User Templates';

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('TemplateStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

/**
 * Ensure the "User Templates" default collection exists in the loaded
 * workspace, minting it when absent.
 *
 * Initialization callers (boot, the workspace-coord swap) pass
 * `'initialization'` and get `null` instead of a mint when the
 * workspace's Org is a consumed Org: defaults in a joined backend's
 * workspace are that backend's own boot's job, and minting here races
 * the catch-up stream into a duplicate (both sides end up owning a
 * "User Templates" under different uids). The lazy edit path (first
 * template create) keeps the mint — a real user gesture, by which time
 * catch-up has landed the backend's copy and the find-by-name hits.
 */
export async function ensureDefaultTemplateCollection(): Promise<Collection>;
export async function ensureDefaultTemplateCollection(purpose: 'initialization'): Promise<Collection | null>;
export async function ensureDefaultTemplateCollection(purpose?: 'initialization'): Promise<Collection | null> {
  const existing = templateCollections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  if (purpose === 'initialization') {
    const workspace = getWorkspace(loadedWorkspaceId ?? '');
    if (workspace && consumedOrgIds(getIdentitySnapshot()).has(workspace.orgId)) {
      return null;
    }
  }

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `templates/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  // Optimistic local insert so synchronous callers see the new collection
  // immediately; the oracle's broadcast confirms the same post-commit
  // shape on the next tick.
  templateCollections = [...templateCollections, collection];
  await applyTemplateCollectionMutationOrThrow(
    (ctx) => ({ batch: seedTemplateCollection(collection, ctx), sideEffects: [] }),
    'ensureDefaultTemplateCollection',
  );
  return collection;
}

export async function createTemplateCollection(name: string): Promise<Collection> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `templates/${folderName}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  templateCollections = [...templateCollections, collection];
  await applyTemplateCollectionMutationOrThrow(
    (ctx) => ({ batch: seedTemplateCollection(collection, ctx), sideEffects: [] }),
    'createTemplateCollection',
  );
  return collection;
}

export async function renameTemplateCollection(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  const col = templateCollections.find((c) => c.uid === uid);
  if (!col) return false;
  if (col.name === DEFAULT_COLLECTION_NAME) return false; // undeletable/unrenamable
  await applyTemplateCollectionMutationOrThrow(
    (ctx) => buildRenameTemplateCollectionBatch({ collectionUid: uid, name }, ctx),
    'renameTemplateCollection',
  );
  return true;
}

export async function deleteTemplateCollection(uid: string): Promise<boolean> {
  assertLoaded();
  const collection = templateCollections.find((c) => c.uid === uid);
  if (!collection) return false;
  if (collection.name === DEFAULT_COLLECTION_NAME) return false; // undeletable

  // Cascade descendant template + template-folder deletes through the
  // oracle. The collection's tombstone covers its own parent slot for
  // top-level folders; nested folders/templates are deleted by uid.
  const cascadingTemplateUids = templates.filter((t) => t.path.startsWith(collection.path)).map((t) => t.uid);
  const cascadingFolderUids = templateFolders.filter((f) => f.path.startsWith(collection.path)).map((f) => f.uid);
  for (const templateUid of cascadingTemplateUids) {
    await applyTemplateMutationOrThrow((ctx) => buildDeleteBatch(templateUid, ctx), 'deleteTemplateCollection-cascade');
  }
  for (const folderUid of cascadingFolderUids) {
    await applyTemplateFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteTemplateFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
      'deleteTemplateCollection-cascade-folder',
    );
  }
  await applyTemplateCollectionMutationOrThrow(
    (ctx) => buildDeleteTemplateCollectionBatch(uid, ctx),
    'deleteTemplateCollection',
  );
  return true;
}

// ── Folders ─────────────────────────────────────────────────────────

/**
 * Resolve `parentPath` to a {@link TemplateFolderParentRef} via the local
 * mirrors. `parentPath` matches a template collection root or a template
 * folder path.
 */
function resolveTemplateFolderParent(parentPath: string): TemplateFolderParentRef | null {
  const collection = templateCollections.find((c) => c.path === parentPath);
  if (collection) return { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: collection.uid };
  const folder = templateFolders.find((f) => f.path === parentPath);
  if (folder) return { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: folder.uid };
  return null;
}

export async function createTemplateFolder(name: string, parentPath: string): Promise<LocalFolder | null> {
  assertLoaded();
  const parent = resolveTemplateFolderParent(parentPath);
  if (!parent) return null;
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  await applyTemplateFolderMutationOrThrow(
    (ctx) =>
      buildCreateTemplateFolderBatch(
        { folderUid: uid, parent, name, pathSegment: folderName },
        { ...ctx, batchId: ctx.batchId ?? `template-folder-create-${uid}` },
      ),
    'createTemplateFolder',
  );
  return { schemaVersion: 5, uid, path: `${parentPath}/${folderName}`, name };
}

export async function renameTemplateFolder(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!templateFolders.some((f) => f.uid === uid)) return false;
  await applyTemplateFolderMutationOrThrow(
    (ctx) => buildRenameTemplateFolderBatch({ folderUid: uid, name }, ctx),
    'renameTemplateFolder',
  );
  return true;
}

export async function deleteTemplateFolder(uid: string): Promise<boolean> {
  assertLoaded();
  const folder = templateFolders.find((f) => f.uid === uid);
  if (!folder) return false;
  const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
  const parent = resolveTemplateFolderParent(parentPath);

  // Cascade descendant template + template-folder deletes through the
  // oracle.
  const cascadingTemplateUids = templates.filter((t) => t.path.startsWith(`${folder.path}/`)).map((t) => t.uid);
  const cascadingNestedFolderUids = templateFolders
    .filter((f) => f.uid !== uid && f.path.startsWith(`${folder.path}/`))
    .map((f) => f.uid);
  for (const templateUid of cascadingTemplateUids) {
    await applyTemplateMutationOrThrow(
      (ctx) => buildDeleteBatch(templateUid, ctx),
      'deleteTemplateFolder-cascade-template',
    );
  }
  for (const nestedUid of cascadingNestedFolderUids) {
    await applyTemplateFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteTemplateFolderEntityBatch(nestedUid, ctx), sideEffects: [] }),
      'deleteTemplateFolder-cascade-folder',
    );
  }
  if (parent) {
    await applyTemplateFolderMutationOrThrow(
      (ctx) => buildDeleteTemplateFolderBatch({ folderUid: uid, parent }, ctx),
      'deleteTemplateFolder',
    );
  } else {
    await applyTemplateFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteTemplateFolderEntityBatch(uid, ctx), sideEffects: [] }),
      'deleteTemplateFolder',
    );
  }
  return true;
}

// ── Templates (CRUD) ────────────────────────────────────────────────

export async function addTemplate(
  template: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
  parentPath: string,
): Promise<Template> {
  const uid = generateUid();
  const folderName = toFolderName(template.name, uid);
  const now = new Date().toISOString();
  const created: Template = {
    schemaVersion: 5,
    ...template,
    uid,
    path: `${parentPath}/${folderName}`,
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now,
  };
  await applyTemplateMutationOrThrow((ctx) => buildAddBatch(created, ctx), 'addTemplate');
  return created;
}

export async function addTemplateToCollection(
  template: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
  collectionUid: string,
): Promise<Template> {
  const collection = templateCollections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `templates/${collectionUid}`;
  return addTemplate(template, parentPath);
}

/**
 * Outcome of a template write. The legacy stale-draft branch is retired
 * in Phase B — convergence is per-(field) LWW at the oracle, not a
 * versioned compare-and-set.
 */
export type TemplateWriteResult =
  | { ok: true; template: Template }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateTemplate(
  uid: string,
  updates: Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<TemplateWriteResult> {
  assertLoaded();
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }
  const existing = templates.find((t) => t.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  // Stamp updatedAt on every update unless the caller explicitly set it.
  const stamped = updates.updatedAt ? updates : { ...updates, updatedAt: new Date().toISOString() };
  // SW-side oracle exposes `(itemId, item, key)`; adapt to the
  // `LiveSetEntries` shape (`orderKey` rename) so the synthesizer can
  // detect content edits + reorders against fractional keys.
  const payload = buildUpdateBatch(uid, stamped, ctx, (templateUid, setPath) =>
    oracle
      .liveOrderedSetItems(TEMPLATE_ENTITY_TYPE, templateUid, setPath)
      .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
  );
  if (payload.batch.mutations.length === 0) {
    return { ok: true, template: existing };
  }
  const result = await oracle.apply(payload.batch, payload.sideEffects);
  if (!result.ok) {
    return {
      ok: false,
      reason: 'other',
      message: result.failure?.detail ?? 'oracle rejected template batch',
    };
  }
  return { ok: true, template: { ...existing, ...stamped } as Template };
}

export async function deleteTemplate(uid: string): Promise<boolean> {
  assertLoaded();
  if (!templates.some((t) => t.uid === uid)) return false;
  await applyTemplateMutationOrThrow((ctx) => buildDeleteBatch(uid, ctx), 'deleteTemplate');
  return true;
}

// ── Sync engine plumbing ────────────────────────────────────────────

async function applyTemplateMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`TemplateStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `TemplateStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

async function applyTemplateCollectionMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`TemplateStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `TemplateStore.${op}: oracle rejected template-collection batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

async function applyTemplateFolderMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`TemplateStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `TemplateStore.${op}: oracle rejected template-folder batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Hydration / workspace switch ────────────────────────────────────

interface WorkspaceSnapshot {
  templates: Template[];
  templateCollections: Collection[];
  templateFolders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const [readTemplates, readCollections, readFolders] = await Promise.all([
    hostStorage.getValidatedArray(keys.templates, TemplateSchema, {
      onError: driftRecorder({ subsystem: 'rule-engine', storageKey: keys.templates.key, workspaceId }),
    }),
    hostStorage.getValidatedArray(keys.templateCollections, CollectionSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        storageKey: keys.templateCollections.key,
        workspaceId,
      }),
    }),
    hostStorage.getValidatedArray(keys.templateFolders, FolderSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        storageKey: keys.templateFolders.key,
        workspaceId,
      }),
    }),
  ]);
  return {
    templates: readTemplates,
    templateCollections: readCollections,
    templateFolders: readFolders,
  };
}

export async function hydrateTemplatesFromStorage(): Promise<void> {
  const workspaceId = requireActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  templates = snapshot.templates;
  templateCollections = snapshot.templateCollections;
  templateFolders = snapshot.templateFolders;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'TemplateStore',
    `Hydrated ws=${workspaceId}: ${templates.length} templates, ${templateCollections.length} collections, ${templateFolders.length} folders`,
  );
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  templates = snapshot.templates;
  templateCollections = snapshot.templateCollections;
  templateFolders = snapshot.templateFolders;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'TemplateStore',
    `Switched to ws=${workspaceId}: ${templates.length} templates, ${templateCollections.length} collections, ${templateFolders.length} folders`,
  );
  notifyChange();
}

// ── Sync engine bridge ──────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;
let collectionCacheUnsubscribe: (() => void) | null = null;
let folderCacheUnsubscribe: (() => void) | null = null;

function subscribeTemplateMirror(cache: TemplateCache): void {
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    templates = cache.getTemplates();
    notifyChange();
  });
}

function subscribeTemplateCollectionMirror(cache: TemplateCollectionCache): void {
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    collectionCacheUnsubscribe = null;
  }
  collectionCacheUnsubscribe = cache.onChange(() => {
    templateCollections = cache.getTemplateCollections();
    notifyChange();
  });
}

function subscribeTemplateFolderMirror(cache: TemplateFolderCache): void {
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    folderCacheUnsubscribe = null;
  }
  folderCacheUnsubscribe = cache.onChange(() => {
    templateFolders = cache.getTemplateFolders();
    notifyChange();
  });
}

/**
 * Wire the local `templates` array to the active workspace's
 * {@link TemplateCache} without seeding — the workspace service's
 * `hydrated` gate already seeded the cache from the same storage keys.
 * Idempotent — the prior subscription is dropped first.
 */
export function wireTemplateSyncEngine(): void {
  const cache = getActiveCacheForRegistration<TemplateCache>(TEMPLATE_REGISTRATION);
  if (!cache) return;
  subscribeTemplateMirror(cache);
  templates = cache.getTemplates();
}

/**
 * Wire the local `templates` array to the active workspace's
 * {@link TemplateCache} AND seed the oracle. Idempotent — the prior
 * subscription is dropped first.
 */
export async function bridgeTemplateSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<TemplateCache>(TEMPLATE_REGISTRATION);
  if (!cache) return;
  subscribeTemplateMirror(cache);
  await cache.seedFromPersistedTemplates(templates);
  templates = cache.getTemplates();
}

/**
 * Wire the local `templateCollections` array to the active workspace's
 * template-collection cache without seeding.
 */
export function wireTemplateCollectionSyncEngine(): void {
  const cache = getActiveCacheForRegistration<TemplateCollectionCache>(TEMPLATE_COLLECTION_REGISTRATION);
  if (!cache) return;
  subscribeTemplateCollectionMirror(cache);
  templateCollections = cache.getTemplateCollections();
}

/**
 * Wire the local `templateCollections` array to the active workspace's
 * template-collection cache AND seed the oracle.
 */
export async function bridgeTemplateCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<TemplateCollectionCache>(TEMPLATE_COLLECTION_REGISTRATION);
  if (!cache) return;
  subscribeTemplateCollectionMirror(cache);
  await cache.seedFromPersistedTemplateCollections(templateCollections);
  templateCollections = cache.getTemplateCollections();
}

/**
 * Wire the local `templateFolders` array to the active workspace's
 * template-folder cache without seeding.
 */
export function wireTemplateFolderSyncEngine(): void {
  const cache = getActiveCacheForRegistration<TemplateFolderCache>(TEMPLATE_FOLDER_REGISTRATION);
  if (!cache) return;
  subscribeTemplateFolderMirror(cache);
  templateFolders = cache.getTemplateFolders();
}

/**
 * Wire the local `templateFolders` array to the active workspace's
 * template-folder cache AND seed the oracle. Call AFTER
 * {@link bridgeTemplateCollectionSyncEngine} so the parent collection
 * slots already exist in the oracle when each folder seeds.
 */
export async function bridgeTemplateFolderSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<TemplateFolderCache>(TEMPLATE_FOLDER_REGISTRATION);
  if (!cache) return;
  subscribeTemplateFolderMirror(cache);
  await cache.seedFromPersistedTemplateFolders(templateFolders, templateCollections);
  templateFolders = cache.getTemplateFolders();
}

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  templates = [];
  templateCollections = [];
  templateFolders = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    collectionCacheUnsubscribe = null;
  }
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    folderCacheUnsubscribe = null;
  }
}
