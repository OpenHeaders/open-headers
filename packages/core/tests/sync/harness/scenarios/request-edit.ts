/**
 * Request entity under contention.
 *
 * Two surfaces edit the same request concurrently:
 *   - Surface A adds a header at one position, edits the URL scalar,
 *     and reorders an existing header.
 *   - Surface B adds a param, removes another header, and replaces
 *     `name` at a near-equal HLC.
 *
 * Plus a third surface that swaps `body` (variant scalar) — the
 * scalar setField on `body` competes with header / param mutations
 * on the same entity but at a different path, so per-(setPath, item)
 * LWW isolates the body churn from the row churn. Convergence
 * follows from per-path / per-itemId LWW + the lock-protected
 * interleaver.
 *
 * Two seeded headers and one seeded param give the moveBefore +
 * removeFromSet leaves something to bind to. Order keys are
 * envelope-resident; itemId tie-breaks accidental equality.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const TYPE = 'request';
const HEADERS = 'headers';
const PARAMS = 'params';

export function genRequestEdit(rng: Rng): Scenario {
  const requestId = rng.uid('rq');
  const ws = 'ws-1';
  const seedNode = `node-${rng.int(0xffff).toString(16)}-s`;
  const surfaceA = `node-${rng.int(0xffff).toString(16)}-a`;
  const surfaceB = `node-${rng.int(0xffff).toString(16)}-b`;
  const surfaceC = `node-${rng.int(0xffff).toString(16)}-c`;

  const hdrAlpha = rng.uid('h');
  const hdrBeta = rng.uid('h');
  const hdrGamma = rng.uid('h');
  const paramAlpha = rng.uid('p');
  const paramBeta = rng.uid('p');

  const tBase = 1_000 + rng.int(1_000);

  const seedHeaderAlpha = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase, 0, seedNode),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: TYPE,
      id: requestId,
      path: HEADERS,
      itemId: hdrAlpha,
      item: { key: 'X-Alpha', value: 'a' },
      orderKey: 'm',
    },
  });
  const seedHeaderBeta = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase + 1, 0, seedNode),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: TYPE,
      id: requestId,
      path: HEADERS,
      itemId: hdrBeta,
      item: { key: 'X-Beta', value: 'b' },
      orderKey: 'q',
    },
  });
  const seedParamAlpha = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase + 2, 0, seedNode),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: TYPE,
      id: requestId,
      path: PARAMS,
      itemId: paramAlpha,
      item: { key: 'q', value: '1' },
      orderKey: 'h',
    },
  });

  const tEdit = tBase + 50 + rng.int(50);

  // Surface A: add a third header, set url, reorder beta to the front.
  const addHeaderGamma = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit, 0, surfaceA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: TYPE,
      id: requestId,
      path: HEADERS,
      itemId: hdrGamma,
      item: { key: 'X-Gamma', value: 'g' },
      orderKey: 'u',
    },
  });
  const setUrl = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit + 1, 0, surfaceA),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: TYPE, id: requestId, path: 'url', value: 'https://api.openheaders.io/v2' },
  });
  const reorderBeta = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit + 2, 0, surfaceA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'moveBefore',
      type: TYPE,
      id: requestId,
      path: HEADERS,
      itemId: hdrBeta,
      orderKey: 'a',
    },
  });

  // Surface B: add a param, remove the alpha header, set name. Near-
  // equal HLCs to A so total-order interleaving has work to do.
  const addParamBeta = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit + (rng.int(2) === 0 ? -3 : 3), 0, surfaceB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: TYPE,
      id: requestId,
      path: PARAMS,
      itemId: paramBeta,
      item: { key: 'page', value: '2' },
      orderKey: 'k',
    },
  });
  const removeAlpha = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit + 4, 0, surfaceB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'removeFromSet',
      type: TYPE,
      id: requestId,
      path: HEADERS,
      itemId: hdrAlpha,
    },
  });
  const setName = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit + 5, 0, surfaceB),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: TYPE, id: requestId, path: 'name', value: 'list users' },
  });

  // Surface C: swap body to a JSON variant. Scalar — a single setField
  // at `body` competes with the header / param churn on path-disjoint
  // leaves. LWW per-(path) means this lands or is superseded
  // independently of every set-leaf decision.
  const setBody = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tEdit + 6, 0, surfaceC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: TYPE,
      id: requestId,
      path: 'body',
      value: { type: 'json', content: '{"q":1}' },
    },
  });

  return {
    name: `request-edit(${requestId})`,
    envelopes: [
      seedHeaderAlpha,
      seedHeaderBeta,
      seedParamAlpha,
      addHeaderGamma,
      setUrl,
      reorderBeta,
      addParamBeta,
      removeAlpha,
      setName,
      setBody,
    ],
  };
}
