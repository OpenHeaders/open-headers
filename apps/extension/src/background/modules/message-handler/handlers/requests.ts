/** API-request CRUD + execution RPCs (active workspace). */

import { GraphqlRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedRequestSnapshot, GraphqlRequest, Request } from '@openheaders/core/types';
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
import { compileGraphqlRequest } from '@openheaders/oracle/live/graphql-exec/execute';
import { errorSnapshot } from '@openheaders/oracle/live/request-exec/execute';
import { handleResolveRequestWireRpc } from '@openheaders/oracle/live/request-exec/resolve-wire-rpc';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { wsRequest } from '../../../ws-request';
import { executeRequest, executeRequestDraft } from '../../request-executor';
import { stopActiveSend } from '../../request-executor/send-stream';
import { getActiveWorkspaceId } from '../../workspace/workspace-store';
import type { HandlerMap } from '../types';

/**
 * `executeGraphqlRequest` — the SW twin of the node host's route: the
 * entity (the storage slot's, or the editor's live draft) compiles ONCE
 * into its HTTP send and rides `executeRequestDraft` — the same
 * resolve → scripts → fetch pipeline, so the result IS an HTTP
 * snapshot with the attribution the response surface already renders.
 * Result discipline verbatim from `executeRequest`.
 */
async function executeGraphqlRequestRpc(
  message: Record<string, unknown>,
): Promise<{ success: boolean; snapshot?: ExecutedRequestSnapshot; error?: string }> {
  const graphqlRequestUid = typeof message.graphqlRequestUid === 'string' ? message.graphqlRequestUid : undefined;
  const draft = message.draft as GraphqlRequest | undefined;
  const operationName = typeof message.operationName === 'string' ? message.operationName : undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;

  let entity: GraphqlRequest | undefined;
  if (graphqlRequestUid) {
    const all = await hostStorage.getValidatedArray(
      wsKeys(getActiveWorkspaceId()).graphqlRequests,
      GraphqlRequestSchema,
    );
    const loaded = all.find((r) => r.uid === graphqlRequestUid);
    if (!loaded) return { success: true, snapshot: errorSnapshot(`GraphQL request ${graphqlRequestUid} not found`) };
    entity = loaded;
  } else {
    entity = draft;
  }
  if (!entity) return { success: false, error: 'No GraphQL request or draft provided' };
  const compiled = compileGraphqlRequest(entity, operationName !== undefined ? { operationName } : {});
  const snapshot = await executeRequestDraft(compiled, { environmentId, sendId });
  return { success: true, snapshot };
}

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

  executeGraphqlRequest: ({ message, respond }) => {
    executeGraphqlRequestRpc(message)
      .then((result) => respond(result))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  resolveRequestWire: ({ message, respond }) => {
    handleResolveRequestWireRpc(message)
      .then((result) => respond(result))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  abortRequestSend: ({ message, respond }) => {
    const sendId = message.sendId as string | undefined;
    if (sendId === undefined) {
      respond({ success: false });
      return;
    }
    // Local sends first (HTTP runs in this SW). A miss may be a
    // forwarded gRPC invoke whose exchange lives on the companion —
    // the sendId-authorized stop rides the backend wire; a dead wire
    // or unknown id answers the same honest `false`.
    if (stopActiveSend(sendId)) {
      respond({ success: true });
      return;
    }
    wsRequest<{ success: boolean }>({ type: 'abortRequestSend', sendId })
      .then((result) => respond(result))
      .catch(() => respond({ success: false }));
    return true;
  },
};
