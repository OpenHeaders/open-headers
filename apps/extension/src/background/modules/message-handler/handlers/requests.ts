/** API-request CRUD + execution RPCs (active workspace). */

import type { Request } from '@openheaders/core/types';
import { createRequestDraft, takeRequestDraft } from '@openheaders/oracle/entity/request-draft-store';
import {
  addRequest,
  addRequestToCollection,
  createRequestCollection,
  createRequestFolder,
  deleteRequest,
  deleteRequestCollection,
  deleteRequestFolder,
  ensureDefaultRequestCollection,
  getRequest as getRequestById,
  getRequestCollections,
  getRequestCollectionTrees,
  getRequestFolders,
  getRequests,
  renameRequestCollection,
  renameRequestFolder,
  updateRequest,
} from '@openheaders/oracle/entity/request-store';
import { executeRequest, executeRequestDraft } from '../../request-executor';
import { stopActiveSend } from '../../request-executor/send-stream';
import type { HandlerMap } from '../types';

export const requestHandlers: HandlerMap = {
  getLocalRequests: ({ respond }) => {
    respond({ requests: getRequests() });
  },

  getLocalRequest: ({ message, respond }) => {
    const request = getRequestById(message.requestUid as string);
    respond({ success: request !== null, request: request ?? undefined });
  },

  getLocalRequestCollections: ({ respond }) => {
    respond({ collections: getRequestCollections() });
  },

  getLocalRequestCollectionTrees: ({ respond }) => {
    respond({ collectionTrees: getRequestCollectionTrees() });
  },

  getLocalRequestFolders: ({ respond }) => {
    respond({ folders: getRequestFolders() });
  },

  createLocalRequest: ({ message, respond }) => {
    const name = (message.name as string | undefined) ?? 'New Request';
    const collectionUid = message.collectionUid as string | undefined;
    const parentPath = message.parentPath as string | undefined;
    const seed = message.seed as Partial<Request> | undefined;

    // Resolve the target collection, falling back to the default if
    // the caller's preferred collection was deleted between when the
    // draft opened and when the user clicked Save. Without the
    // existence check, `addRequestToCollection` would fabricate a
    // `requests/<deleted-uid>/...` path and orphan the request —
    // stored but not rendered by any tree.
    const knownCollections = getRequestCollections();
    const resolveTargetUid = async (): Promise<string> => {
      if (collectionUid && knownCollections.some((c) => c.uid === collectionUid)) {
        return collectionUid;
      }
      const fallback = await ensureDefaultRequestCollection();
      return fallback.uid;
    };

    // Folder parent takes precedence over collection root — if the
    // caller gave us an explicit `parentPath`, drop the request
    // directly there; otherwise use the collection's root path.
    (async () => {
      const targetCollectionUid = parentPath ? '' : await resolveTargetUid();
      const created = parentPath
        ? await addRequest(name, parentPath, seed)
        : await addRequestToCollection(name, targetCollectionUid, seed);
      return created;
    })()
      .then((created) => respond({ success: true, request: created }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createRequestDraft: ({ message, respond }) => {
    try {
      const nonce = createRequestDraft(message.seed);
      respond({ success: true, nonce });
    } catch (err) {
      respond({ success: false, error: (err as Error).message });
    }
  },

  takeRequestDraft: ({ message, respond }) => {
    const nonce = message.nonce as string;
    const seed = takeRequestDraft(nonce);
    respond({ success: true, seed });
  },

  updateLocalRequest: ({ message, respond }) => {
    updateRequest(
      message.requestUid as string,
      message.updates as Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
    )
      .then((result) => respond(result))
      .catch((err: Error) => respond({ ok: false, reason: 'other', message: err.message }));
    return true;
  },

  deleteLocalRequest: ({ message, respond }) => {
    deleteRequest(message.requestUid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createLocalRequestCollection: ({ message, respond }) => {
    createRequestCollection(message.name as string)
      .then((collection) => respond({ success: true, collection }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  renameLocalRequestCollection: ({ message, respond }) => {
    renameRequestCollection(message.collectionUid as string, message.name as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  deleteLocalRequestCollection: ({ message, respond }) => {
    deleteRequestCollection(message.collectionUid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createLocalRequestFolder: ({ message, respond }) => {
    createRequestFolder(message.name as string, message.parentPath as string)
      .then((folder) =>
        folder ? respond({ success: true, folder }) : respond({ success: false, error: 'parent path not resolvable' }),
      )
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  renameLocalRequestFolder: ({ message, respond }) => {
    renameRequestFolder(message.folderUid as string, message.name as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  deleteLocalRequestFolder: ({ message, respond }) => {
    deleteRequestFolder(message.folderUid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  executeRequest: ({ message, respond }) => {
    const requestUid = message.requestUid as string | undefined;
    const draft = message.draft as Request | undefined;
    const environmentId = message.environmentId as string | null | undefined;
    const sendId = message.sendId as string | undefined;
    const exec = requestUid
      ? executeRequest(requestUid, { environmentId, sendId })
      : draft
        ? executeRequestDraft(draft, { environmentId, sendId })
        : Promise.resolve(null);
    exec
      .then((snapshot) => {
        if (!snapshot) {
          respond({ success: false, error: 'No request or draft provided' });
        } else {
          respond({ success: true, snapshot });
        }
      })
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  abortRequestSend: ({ message, respond }) => {
    const sendId = message.sendId as string | undefined;
    respond({ success: sendId !== undefined && stopActiveSend(sendId) });
  },
};
