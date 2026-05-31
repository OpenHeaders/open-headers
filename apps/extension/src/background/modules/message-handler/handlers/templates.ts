/** Template + template-collection/folder CRUD RPCs. */

import type { Template } from '@openheaders/core/types';
import {
  addTemplate,
  addTemplateToCollection,
  createTemplateCollection,
  createTemplateFolder,
  deleteTemplate,
  deleteTemplateCollection,
  deleteTemplateFolder,
  ensureDefaultTemplateCollection,
  getTemplateCollections,
  getTemplateCollectionTrees,
  getTemplateFolders,
  getTemplates,
  renameTemplateCollection,
  renameTemplateFolder,
  updateTemplate,
} from '@openheaders/oracle/entity/template-store';
import type { HandlerMap } from '../types';

export const templateHandlers: HandlerMap = {
  getTemplates: ({ respond }) => {
    respond({ templates: getTemplates() });
  },

  getTemplateCollections: ({ respond }) => {
    respond({ collections: getTemplateCollections() });
  },

  getTemplateCollectionTrees: ({ respond }) => {
    respond({ collectionTrees: getTemplateCollectionTrees() });
  },

  getTemplateFolders: ({ respond }) => {
    respond({ folders: getTemplateFolders() });
  },

  createTemplate: ({ message, respond }) => {
    const templateData = message.template as Omit<Template, 'uid' | 'path'>;
    const parentPath = message.parentPath as string | undefined;
    const collectionUid = message.collectionUid as string | undefined;

    const create = async (): Promise<Template> => {
      if (parentPath) return addTemplate(templateData, parentPath);
      const collection = collectionUid ? { uid: collectionUid } : await ensureDefaultTemplateCollection();
      return addTemplateToCollection(templateData, collection.uid);
    };
    create()
      .then((created) => respond({ success: true, template: created }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  updateTemplate: ({ message, respond }) => {
    updateTemplate(
      message.templateUid as string,
      message.updates as Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
    )
      .then((result) => respond(result))
      .catch((err: Error) => respond({ ok: false, reason: 'other', message: err.message }));
    return true;
  },

  deleteTemplate: ({ message, respond }) => {
    deleteTemplate(message.templateUid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createTemplateCollection: ({ message, respond }) => {
    createTemplateCollection(message.name as string)
      .then((collection) => respond({ success: true, collection }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  renameTemplateCollection: ({ message, respond }) => {
    renameTemplateCollection(message.collectionUid as string, message.name as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  deleteTemplateCollection: ({ message, respond }) => {
    deleteTemplateCollection(message.collectionUid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createTemplateFolder: ({ message, respond }) => {
    createTemplateFolder(message.name as string, message.parentPath as string)
      .then((folder) => respond(folder ? { success: true, folder } : { success: false }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  renameTemplateFolder: ({ message, respond }) => {
    renameTemplateFolder(message.folderUid as string, message.name as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  deleteTemplateFolder: ({ message, respond }) => {
    deleteTemplateFolder(message.folderUid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },
};
