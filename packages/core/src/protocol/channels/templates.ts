/**
 * Template-domain bridge RPCs — template CRUD plus the collection /
 * folder management that organizes them.
 */

import type { Collection, CollectionTree, Template } from '../../types';
import type { FolderDescriptor } from './common';

export interface TemplateRpc {
  getTemplates: {
    req: Record<string, never>;
    res: { templates: Template[] };
  };
  getTemplateCollections: {
    req: Record<string, never>;
    res: { collections: Collection[] };
  };
  getTemplateCollectionTrees: {
    req: Record<string, never>;
    res: { collectionTrees: CollectionTree[] };
  };
  getTemplateFolders: {
    req: Record<string, never>;
    res: { folders: unknown[] };
  };
  createTemplate: {
    req: {
      template: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>;
      collectionUid?: string;
      parentPath?: string;
    };
    res: { success: boolean; template?: Template };
  };
  updateTemplate: {
    req: {
      templateUid: string;
      updates: Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion'>>;
    };
    res:
      | { ok: true; template: Template }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteTemplate: {
    req: { templateUid: string };
    res: { success: boolean };
  };
  createTemplateCollection: {
    req: { name: string };
    res: { success: boolean; collection?: Collection };
  };
  renameTemplateCollection: {
    req: { collectionUid: string; name: string };
    res: { success: boolean };
  };
  deleteTemplateCollection: {
    req: { collectionUid: string };
    res: { success: boolean };
  };
  createTemplateFolder: {
    req: { name: string; parentPath: string };
    res: { success: boolean; folder?: FolderDescriptor };
  };
  renameTemplateFolder: {
    req: { folderUid: string; name: string };
    res: { success: boolean };
  };
  deleteTemplateFolder: {
    req: { folderUid: string };
    res: { success: boolean };
  };
}
