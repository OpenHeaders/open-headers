/**
 * Sync service — Active-bound runner attach/detach: the DNR-intent and
 * resolver-invalidate subscriptions only the Active workspace drives.
 */

import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  PAUSE_MARKERS_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { createDnrIntentRunner } from '../dnr-intent-runner';
import { createResolverInvalidateRunner } from '../resolver-invalidate-runner';
import type { WorkspaceServiceState } from './types';

/**
 * Entity types that drive DNR recompile via the dnr-intent runner.
 * Module-level so the singleton-in-spirit constraint is structural —
 * one set definition, one consumer site (`attachActiveBoundRunners`).
 */
const DNR_INTENT_ENTITY_TYPES: ReadonlySet<string> = new Set([RULE_ENTITY_TYPE, PAUSE_MARKERS_ENTITY_TYPE]);

/**
 * Entity types that invalidate the variables resolver — every variable-
 * scope envelope. Same singleton-in-spirit framing as
 * {@link DNR_INTENT_ENTITY_TYPES}.
 */
const RESOLVER_INVALIDATE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  ENVIRONMENT_ENTITY_TYPE,
  COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
]);

export function attachActiveBoundRunners(svc: WorkspaceServiceState): void {
  if (svc.dnrSubscription !== null || svc.resolverInvalidateSubscription !== null) {
    // Idempotent: already attached.
    return;
  }
  svc.dnrSubscription = createDnrIntentRunner({
    broadcast: svc.broadcast,
    intents: svc.intents,
    entityTypes: DNR_INTENT_ENTITY_TYPES,
    recompile: svc.recompile,
  });
  svc.resolverInvalidateSubscription = createResolverInvalidateRunner({
    broadcast: svc.broadcast,
    intents: svc.intents,
    entityTypes: RESOLVER_INVALIDATE_ENTITY_TYPES,
    recompile: svc.recompile,
  });
}

export function detachActiveBoundRunners(svc: WorkspaceServiceState): void {
  svc.dnrSubscription?.dispose();
  svc.dnrSubscription = null;
  svc.resolverInvalidateSubscription?.dispose();
  svc.resolverInvalidateSubscription = null;
}
