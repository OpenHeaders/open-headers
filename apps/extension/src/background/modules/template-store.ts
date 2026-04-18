/**
 * Template Store — per-workspace persistence for user-defined rule
 * templates.
 *
 * Mirrors rule-store.ts:
 *   - Flat storage with path-based hierarchy
 *   - Separate collections and folders (independent from rule
 *     collections)
 *   - Tree derived at read time from flat data
 *   - In-memory state scoped to the active workspace; `switchToWorkspace`
 *     reloads from the target workspace's keys
 *
 * Storage keys (all scoped to active workspace id):
 *   - `oh.ws.<id>.templates`
 *   - `oh.ws.<id>.templateCollections`
 *   - `oh.ws.<id>.templateFolders`
 */

import { CollectionSchema, FolderSchema, TemplateSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
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

const DEFAULT_COLLECTION_NAME = 'Default Templates';

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('TemplateStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export function ensureDefaultTemplateCollection(): V5.Collection {
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
  };
  templateCollections = [...templateCollections, collection];
  void persistTemplateCollections();
  return collection;
}

export function createTemplateCollection(name: string): V5.Collection {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
    schemaVersion: 5,
    uid,
    path: `templates/${folderName}`,
    name,
    variables: [],
  };
  templateCollections = [...templateCollections, collection];
  void persistTemplateCollections();
  return collection;
}

export function renameTemplateCollection(uid: string, name: string): boolean {
  const col = templateCollections.find((c) => c.uid === uid);
  if (!col) return false;
  if (col.name === DEFAULT_COLLECTION_NAME) return false; // undeletable/unrenamable
  const index = templateCollections.indexOf(col);
  templateCollections = [
    ...templateCollections.slice(0, index),
    { ...col, name },
    ...templateCollections.slice(index + 1),
  ];
  void persistTemplateCollections();
  return true;
}

export function deleteTemplateCollection(uid: string): boolean {
  const col = templateCollections.find((c) => c.uid === uid);
  if (!col) return false;
  if (col.name === DEFAULT_COLLECTION_NAME) return false; // undeletable

  templateCollections = templateCollections.filter((c) => c.uid !== uid);
  templates = templates.filter((t) => !t.path.startsWith(col.path));
  templateFolders = templateFolders.filter((f) => !f.path.startsWith(col.path));
  void persistTemplateCollections();
  void persistTemplates();
  void persistTemplateFolders();
  return true;
}

// ── Folders ─────────────────────────────────────────────────────────

export function createTemplateFolder(name: string, parentPath: string): LocalFolder {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const folder: LocalFolder = {
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${folderName}`,
    name,
  };
  templateFolders = [...templateFolders, folder];
  void persistTemplateFolders();
  return folder;
}

export function renameTemplateFolder(uid: string, name: string): boolean {
  const index = templateFolders.findIndex((f) => f.uid === uid);
  if (index === -1) return false;
  templateFolders = [
    ...templateFolders.slice(0, index),
    { ...templateFolders[index], name },
    ...templateFolders.slice(index + 1),
  ];
  void persistTemplateFolders();
  return true;
}

export function deleteTemplateFolder(uid: string): boolean {
  const folder = templateFolders.find((f) => f.uid === uid);
  if (!folder) return false;

  templateFolders = templateFolders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
  templates = templates.filter((t) => !t.path.startsWith(`${folder.path}/`));
  void persistTemplateFolders();
  void persistTemplates();
  return true;
}

// ── Templates (CRUD) ────────────────────────────────────────────────

export function addTemplate(
  template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion'>,
  parentPath: string,
): V5.Template {
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
  templates = [...templates, created];
  void persistTemplates();
  return created;
}

export function addTemplateToCollection(
  template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion'>,
  collectionUid: string,
): V5.Template {
  const collection = templateCollections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `templates/${collectionUid}`;
  return addTemplate(template, parentPath);
}

export function updateTemplate(uid: string, updates: Partial<Omit<V5.Template, 'uid' | 'path'>>): boolean {
  const index = templates.findIndex((t) => t.uid === uid);
  if (index === -1) return false;

  const existing = templates[index];
  const updated: V5.Template = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  templates = [...templates.slice(0, index), updated, ...templates.slice(index + 1)];
  void persistTemplates();
  return true;
}

export function deleteTemplate(uid: string): boolean {
  const before = templates.length;
  templates = templates.filter((t) => t.uid !== uid);
  if (templates.length === before) return false;
  void persistTemplates();
  return true;
}

// ── Persistence ─────────────────────────────────────────────────────

async function persistTemplateCollections(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).templateCollections, templateCollections);
  logger.debug('TemplateStore', `Persisted ${templateCollections.length} template collections (ws=${workspaceId})`);
  notifyChange();
}

async function persistTemplateFolders(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).templateFolders, templateFolders);
  logger.debug('TemplateStore', `Persisted ${templateFolders.length} template folders (ws=${workspaceId})`);
  notifyChange();
}

async function persistTemplates(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).templates, templates);
  logger.debug('TemplateStore', `Persisted ${templates.length} templates (ws=${workspaceId})`);
  notifyChange();
}

// ── Hydration / workspace switch ────────────────────────────────────

interface WorkspaceSnapshot {
  templates: V5.Template[];
  templateCollections: V5.Collection[];
  templateFolders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const [templates, templateCollections, templateFolders] = await Promise.all([
    extensionStorage.getValidatedArray(keys.templates, TemplateSchema, {
      onError: driftRecorder({ subsystem: 'rule-engine', storageKey: keys.templates.key, workspaceId }),
    }),
    extensionStorage.getValidatedArray(keys.templateCollections, CollectionSchema, {
      onError: driftRecorder({ subsystem: 'rule-engine', storageKey: keys.templateCollections.key, workspaceId }),
    }),
    extensionStorage.getValidatedArray(keys.templateFolders, FolderSchema, {
      onError: driftRecorder({ subsystem: 'rule-engine', storageKey: keys.templateFolders.key, workspaceId }),
    }),
  ]);
  return { templates, templateCollections, templateFolders };
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

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  templates = [];
  templateCollections = [];
  templateFolders = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
}
