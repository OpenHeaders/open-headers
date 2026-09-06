/**
 * "Convert to GraphQL request" — ONE explicit, user-initiated tree
 * operation (the GraphQL-client plan fork 5): an HTTP request whose
 * body is the graphql body mode becomes a GraphqlRequest in the SAME
 * slot, and the HTTP entity goes. The content crosses through the
 * core reverse bridge (`fromHttpRequest`: headers, auth, docs,
 * specLink, the script pair, the settings knobs verbatim; the query
 * rows folded into the URL honestly, the notes returned for the
 * caller's confirmation); the new leaf takes an order key strictly
 * before the HTTP leaf's under the same parent so it inherits the
 * place once the HTTP leaf is gone; the saved responses re-mint under
 * the new request marked `requestKind: 'graphql'` (the capture IS an
 * HTTP exchange) before the HTTP delete cascades the originals. Never
 * automatic — the affordances ask first.
 *
 * Failure after the create leaves BOTH entities and says so: nothing
 * is lost, the user sees two rows and the message.
 */

import { type ConvertNote, fromHttpRequest } from '@openheaders/core/graphql';
import { GRAPHQL_REQUEST_ENTITY_TYPE, keyBetween } from '@openheaders/core/sync';
import type { GraphqlRequest } from '@openheaders/core/types';
import { generateUid, parentPathOf, toFolderName } from '@openheaders/core/utils';
import { getRequestSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/request-sync-mirror';
import { getResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/response-example-sync-mirror';
import type { BaseSyncWriteOptions } from './apply-payload';
import { applyGraphqlRequestCreate } from './graphql-request-write-client';
import { applyRequestDelete } from './request-write-client';
import { applyResponseExampleCreate } from './response-example-write-client';
import { applyTreeLeafMove } from './tree-move-write-client';
import { requestTreeMirrors, resolveLeafParent } from './tree-placement';

export type ConvertRequestToGraphqlResult =
  | { ok: true; graphqlRequest: GraphqlRequest; notes: readonly ConvertNote[]; examplesCarried: number }
  | { ok: false; reason: 'not-found' | 'not-convertible' | 'other'; message?: string };

export async function applyConvertRequestToGraphql(
  requestUid: string,
  opts: BaseSyncWriteOptions,
): Promise<ConvertRequestToGraphqlResult> {
  const requestMirror = getRequestSyncMirrorForWorkspace(opts.workspaceId);
  await requestMirror.hydrated;
  const entry = requestMirror.getRequestMirror(requestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const source = entry.request;
  const converted = fromHttpRequest(source);
  if (converted === null) return { ok: false, reason: 'not-convertible' };

  const uid = generateUid();
  const parentPath = parentPathOf(source.path) ?? '';
  const graphqlRequest: GraphqlRequest = {
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${toFolderName(source.name, uid)}`,
    name: source.name,
    ...converted.content,
  };
  const created = await applyGraphqlRequestCreate(graphqlRequest, opts);
  if (!created.ok)
    return { ok: false, reason: 'other', message: created.reason === 'other' ? created.message : created.reason };

  // The same slot: a key strictly before the HTTP leaf's own, so the
  // new row sits right above it now and in its place after the delete.
  const tree = requestTreeMirrors(opts.workspaceId, {});
  const parent = await resolveLeafParent(tree, source.path);
  if (parent) {
    const mirror = parent.type === tree.kinds.collectionType ? tree.collectionMirror : tree.folderMirror;
    const items = mirror.liveOrderedSetItems(parent.uid, tree.itemsPath);
    const index = items.findIndex((slot) => slot.itemId === requestUid);
    if (index >= 0) {
      const moved = await applyTreeLeafMove(
        {
          entityType: GRAPHQL_REQUEST_ENTITY_TYPE,
          uid,
          newParent: parent,
          orderKey: keyBetween(items[index - 1]?.orderKey ?? null, items[index]?.orderKey ?? null),
        },
        opts,
      );
      if (!moved.ok)
        return { ok: false, reason: 'other', message: moved.reason === 'other' ? moved.message : moved.reason };
    }
  }

  // The saved responses follow — re-minted under the new request; the
  // HTTP delete below cascades the originals.
  const exampleMirror = getResponseExampleSyncMirrorForWorkspace(opts.workspaceId);
  await exampleMirror.hydrated;
  let examplesCarried = 0;
  for (const example of exampleMirror.listResponseExamplesForRequest(requestUid)) {
    const carried = await applyResponseExampleCreate(
      {
        requestPath: graphqlRequest.path,
        example: {
          requestUid: uid,
          requestKind: 'graphql',
          name: example.name,
          capturedAt: example.capturedAt,
          request: example.request,
          response: example.response,
        },
      },
      opts,
    );
    if (!carried.ok) {
      return {
        ok: false,
        reason: 'other',
        message: carried.reason === 'other' ? carried.message : carried.reason,
      };
    }
    examplesCarried += 1;
  }

  const deleted = await applyRequestDelete(requestUid, opts);
  if (!deleted.ok)
    return { ok: false, reason: 'other', message: deleted.reason === 'other' ? deleted.message : deleted.reason };
  return { ok: true, graphqlRequest, notes: converted.notes, examplesCarried };
}
