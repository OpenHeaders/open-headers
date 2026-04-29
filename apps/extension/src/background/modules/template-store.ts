/**
 * Template Store — single source of truth for V5 user-defined templates
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

import { CollectionSchema, FolderSchema, TemplateSchema } from '@openheaders/core/schemas';
import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  buildDeleteTemplateCollectionBatch,
  buildRenameTemplateCollectionBatch,
} from '@/shared/sync/template-collection-mutations';
import { seedTemplateCollection } from '@/shared/sync/template-collection-projection';
import {
  buildCreateTemplateFolderBatch,
  buildDeleteTemplateFolderBatch,
  buildDeleteTemplateFolderEntityBatch,
  buildRenameTemplateFolderBatch,
} from '@/shared/sync/template-folder-mutations';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildUpdateBatch,
} from '@/shared/sync/template-mutations';
import { getActiveTemplateCache } from '../sync/template-cache';
import { getActiveTemplateCollectionCache } from '../sync/template-collection-cache';
import { getActiveTemplateFolderCache } from '../sync/template-folder-cache';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
import type { LocalFolder } from './rule-store';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state (scoped to active workspace) ────────────────────

let templates: V5.Template[] = [];
let templateCollections: V5.Collection[] = [];
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

export function getTemplates(): V5.Template[] {
  return templates;
}

export function getTemplateCollections(): V5.Collection[] {
  return templateCollections;
}

export function getTemplateFolders(): LocalFolder[] {
  return templateFolders;
}

export function getTemplateCollectionTrees(): V5.CollectionTree[] {
  return templateCollections.map((collection) => {
    const tree = buildTreeForPath(collection.path);
    return { ...collection, tree };
  });
}

function buildTreeForPath(parentPath: string): V5.TreeNode[] {
  const nodes: V5.TreeNode[] = [];

  const childFolders = templateFolders.filter((f) => {
    const parent = f.path.substring(0, f.path.lastIndexOf('/'));
    return parent === parentPath;
  });

  for (const folder of childFolders) {
    const children = buildTreeForPath(folder.path);
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
      ruleType: template.ruleType as V5.RuleType,
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

export async function ensureDefaultTemplateCollection(): Promise<V5.Collection> {
  const existing = templateCollections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: V5.Collection = {
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

export async function createTemplateCollection(name: string): Promise<V5.Collection> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
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
  const cascadingTemplateUids = templates
    .filter((t) => t.path.startsWith(collection.path))
    .map((t) => t.uid);
  const cascadingFolderUids = templateFolders
    .filter((f) => f.path.startsWith(collection.path))
    .map((f) => f.uid);
  for (const templateUid of cascadingTemplateUids) {
    await applyTemplateMutationOrThrow(
      (ctx) => buildDeleteBatch(templateUid, ctx),
      'deleteTemplateCollection-cascade',
    );
  }
  for (const folderUid of cascadingFolderUids) {
    await applyTemplateFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteTemplateFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
      'deleteTemplateCollection-cascade-folder',
    );
  }
  await applyTemplateCollectionMutationOrThrow(
    (ctx) => ({ batch: buildDeleteTemplateCollectionBatch(uid, ctx), sideEffects: [] }),
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

export async function createTemplateFolder(
  name: string,
  parentPath: string,
): Promise<LocalFolder | null> {
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
  const cascadingTemplateUids = templates
    .filter((t) => t.path.startsWith(`${folder.path}/`))
    .map((t) => t.uid);
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
  template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
  parentPath: string,
): Promise<V5.Template> {
  const uid = generateUid();
  const folderName = toFolderName(template.name, uid);
  const now = new Date().toISOString();
  const created: V5.Template = {
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
  template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>,
  collectionUid: string,
): Promise<V5.Template> {
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
  | { ok: true; template: V5.Template }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateTemplate(
  uid: string,
  updates: Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
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
  const payload = buildUpdateBatch(uid, stamped, ctx, (templateUid, setPath) =>
    oracle.liveSetItems(TEMPLATE_ENTITY_TYPE, templateUid, setPath).map((entry) => entry.itemId),
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
  return { ok: true, template: { ...existing, ...stamped } as V5.Template };
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
  templates: V5.Template[];
  templateCollections: V5.Collection[];
  templateFolders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const [readTemplates, readCollections, readFolders] = await Promise.all([
    extensionStorage.getValidatedArray(keys.templates, TemplateSchema, {
      onError: driftRecorder({ subsystem: 'rule-engine', storageKey: keys.templates.key, workspaceId }),
    }),
    extensionStorage.getValidatedArray(keys.templateCollections, CollectionSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        storageKey: keys.templateCollections.key,
        workspaceId,
      }),
    }),
    extensionStorage.getValidatedArray(keys.templateFolders, FolderSchema, {
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
  const workspaceId = getActiveWorkspaceId();
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

/**
 * Wire the local `templates` array to the active workspace's
 * {@link TemplateCache}. Idempotent — the prior subscription is dropped
 * first.
 */
export async function bridgeTemplateSyncEngine(): Promise<void> {
  const cache = getActiveTemplateCache();
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    templates = cache.getTemplates();
    notifyChange();
  });
  await cache.seedFromPersistedTemplates(templates);
  templates = cache.getTemplates();
}

/**
 * Wire the local `templateCollections` array to the active workspace's
 * template-collection cache.
 */
export async function bridgeTemplateCollectionSyncEngine(): Promise<void> {
  const cache = getActiveTemplateCollectionCache();
  if (!cache) return;
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    collectionCacheUnsubscribe = null;
  }
  collectionCacheUnsubscribe = cache.onChange(() => {
    templateCollections = cache.getTemplateCollections();
    notifyChange();
  });
  await cache.seedFromPersistedTemplateCollections(templateCollections);
  templateCollections = cache.getTemplateCollections();
}

/**
 * Wire the local `templateFolders` array to the active workspace's
 * template-folder cache. Call AFTER {@link bridgeTemplateCollectionSyncEngine}
 * so the parent collection slots already exist in the oracle when each
 * folder seeds.
 */
export async function bridgeTemplateFolderSyncEngine(): Promise<void> {
  const cache = getActiveTemplateFolderCache();
  if (!cache) return;
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    folderCacheUnsubscribe = null;
  }
  folderCacheUnsubscribe = cache.onChange(() => {
    templateFolders = cache.getTemplateFolders();
    notifyChange();
  });
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
