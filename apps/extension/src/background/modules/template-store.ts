/**
 * Template Store — persistence for user-defined templates.
 *
 * Mirrors rule-store.ts patterns exactly:
 *   - Flat storage with path-based hierarchy
 *   - Separate collections and folders (independent from rule collections)
 *   - Tree derived at read time from flat data
 *   - Change listeners for broadcasting updates
 *
 * Storage keys:
 *   - v5LocalTemplates — template items
 *   - v5LocalTemplateCollections — template collections
 *   - v5LocalTemplateFolders — template folders
 */

import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { storage } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { LocalFolder } from './rule-store';

const TEMPLATES_KEY = 'v5LocalTemplates';
const TEMPLATE_COLLECTIONS_KEY = 'v5LocalTemplateCollections';
const TEMPLATE_FOLDERS_KEY = 'v5LocalTemplateFolders';

let localTemplates: V5.Template[] = [];
let templateCollections: V5.Collection[] = [];
let templateFolders: LocalFolder[] = [];

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

// ── UID generation ──────────────────────────────────────────────────

function generateLocalUid(): string {
  return `local-${generateUid()}`;
}

// ── Reads ───────────────────────────────────────────────────────────

export function getTemplates(): V5.Template[] {
  return localTemplates;
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
    const parentOfFolder = f.path.substring(0, f.path.lastIndexOf('/'));
    return parentOfFolder === parentPath;
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

  const childTemplates = localTemplates.filter((t) => {
    const parentOfTemplate = t.path.substring(0, t.path.lastIndexOf('/'));
    return parentOfTemplate === parentPath;
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

export function ensureDefaultTemplateCollection(): V5.Collection {
  const existing = templateCollections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateLocalUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: V5.Collection = {
    uid,
    path: `templates/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
  };
  templateCollections = [...templateCollections, collection];
  persistTemplateCollections();
  return collection;
}

export function createTemplateCollection(name: string): V5.Collection {
  const uid = generateLocalUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
    uid,
    path: `templates/${folderName}`,
    name,
    variables: [],
  };
  templateCollections = [...templateCollections, collection];
  persistTemplateCollections();
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
  persistTemplateCollections();
  return true;
}

export function deleteTemplateCollection(uid: string): boolean {
  const col = templateCollections.find((c) => c.uid === uid);
  if (!col) return false;
  if (col.name === DEFAULT_COLLECTION_NAME) return false; // undeletable

  templateCollections = templateCollections.filter((c) => c.uid !== uid);
  localTemplates = localTemplates.filter((t) => !t.path.startsWith(col.path));
  templateFolders = templateFolders.filter((f) => !f.path.startsWith(col.path));
  persistTemplateCollections();
  persistTemplates();
  persistTemplateFolders();
  return true;
}

function persistTemplateCollections(): void {
  storage.local.set({ [TEMPLATE_COLLECTIONS_KEY]: templateCollections }, () => {
    logger.debug('TemplateStore', `Persisted ${templateCollections.length} template collections`);
  });
  notifyChange();
}

// ── Folders ─────────────────────────────────────────────────────────

export function createTemplateFolder(name: string, parentPath: string): LocalFolder {
  const uid = generateLocalUid();
  const folderName = toFolderName(name, uid);
  const folder: LocalFolder = {
    uid,
    path: `${parentPath}/${folderName}`,
    name,
  };
  templateFolders = [...templateFolders, folder];
  persistTemplateFolders();
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
  persistTemplateFolders();
  return true;
}

export function deleteTemplateFolder(uid: string): boolean {
  const folder = templateFolders.find((f) => f.uid === uid);
  if (!folder) return false;

  templateFolders = templateFolders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
  localTemplates = localTemplates.filter((t) => !t.path.startsWith(`${folder.path}/`));
  persistTemplateFolders();
  persistTemplates();
  return true;
}

function persistTemplateFolders(): void {
  storage.local.set({ [TEMPLATE_FOLDERS_KEY]: templateFolders }, () => {
    logger.debug('TemplateStore', `Persisted ${templateFolders.length} template folders`);
  });
  notifyChange();
}

// ── Templates (CRUD) ────────────────────────────────────────────────

export function addTemplate(template: Omit<V5.Template, 'uid' | 'path'>, parentPath: string): V5.Template {
  const uid = generateLocalUid();
  const folderName = toFolderName(template.name, uid);
  const now = new Date().toISOString();
  const created: V5.Template = {
    ...template,
    uid,
    path: `${parentPath}/${folderName}`,
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now,
  };
  localTemplates = [...localTemplates, created];
  persistTemplates();
  return created;
}

export function addTemplateToCollection(
  template: Omit<V5.Template, 'uid' | 'path'>,
  collectionUid: string,
): V5.Template {
  const collection = templateCollections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `templates/${collectionUid}`;
  return addTemplate(template, parentPath);
}

export function updateTemplate(uid: string, updates: Partial<Omit<V5.Template, 'uid' | 'path'>>): boolean {
  const index = localTemplates.findIndex((t) => t.uid === uid);
  if (index === -1) return false;

  const existing = localTemplates[index];
  const updated: V5.Template = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  localTemplates = [...localTemplates.slice(0, index), updated, ...localTemplates.slice(index + 1)];
  persistTemplates();
  return true;
}

export function deleteTemplate(uid: string): boolean {
  const before = localTemplates.length;
  localTemplates = localTemplates.filter((t) => t.uid !== uid);
  if (localTemplates.length === before) return false;
  persistTemplates();
  return true;
}

function persistTemplates(): void {
  storage.local.set({ [TEMPLATES_KEY]: localTemplates }, () => {
    logger.debug('TemplateStore', `Persisted ${localTemplates.length} templates`);
  });
  notifyChange();
}

// ── Hydration ───────────────────────────────────────────────────────

export function hydrateTemplatesFromStorage(): Promise<void> {
  return new Promise((resolve) => {
    storage.local.get(
      [TEMPLATES_KEY, TEMPLATE_COLLECTIONS_KEY, TEMPLATE_FOLDERS_KEY],
      (result: Record<string, unknown>) => {
        const storedTemplates = result[TEMPLATES_KEY] as V5.Template[] | undefined;
        const storedCollections = result[TEMPLATE_COLLECTIONS_KEY] as V5.Collection[] | undefined;
        const storedFolders = result[TEMPLATE_FOLDERS_KEY] as LocalFolder[] | undefined;

        if (Array.isArray(storedTemplates) && storedTemplates.length > 0) {
          localTemplates = storedTemplates;
          logger.info('TemplateStore', `Hydrated ${storedTemplates.length} templates`);
        }
        if (Array.isArray(storedCollections) && storedCollections.length > 0) {
          templateCollections = storedCollections;
          logger.info('TemplateStore', `Hydrated ${storedCollections.length} template collections`);
        }
        if (Array.isArray(storedFolders) && storedFolders.length > 0) {
          templateFolders = storedFolders;
          logger.info('TemplateStore', `Hydrated ${storedFolders.length} template folders`);
        }

        resolve();
      },
    );
  });
}
