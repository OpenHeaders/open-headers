// ── Response examples (cascade plumbing) ────────────────────────────
//
// Examples are renderer-written (see the UI's example write clients);
// the store's only job is keeping them consistent with their parent
// request's lifecycle — a deleted request must not leave orphan
// examples behind. The oracle's example index names what a request
// owns (`requestExamples`: its `examples` slots under the claim rule,
// plus the slot-less net by parent-uid field) for all four kinds; the
// request goes too, so its `examples` set goes with it and the cascade
// mints bare entity tombstones. Every request-delete path (single
// delete, collection cascade, folder cascade) routes through
// {@link deleteExamplesOf}.

import {
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MutationBatch,
  type MutatorContext,
  type ParentRefShape,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  type SideEffectIntent,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { buildDeleteGrpcResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/grpc-response-example-mutations';
import { buildDeleteMqttResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/mqtt-response-example-mutations';
import { buildDeleteResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import { buildDeleteWsResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/ws-response-example-mutations';
import { logger } from '@openheaders/core/utils';
import { getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { requestExamples } from '@openheaders/oracle/sync/tree-descendants';
import { applyRequestMutationOrThrow } from './apply';

type ExampleTombstone = (uid: string, ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] };

const EXAMPLE_TOMBSTONES: Record<string, ExampleTombstone> = {
  [RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteResponseExampleEntityBatch,
  [GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteGrpcResponseExampleEntityBatch,
  [WS_RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteWsResponseExampleEntityBatch,
  [MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteMqttResponseExampleEntityBatch,
};

/** The examples `request` owns in the active workspace, any kind. */
export function examplesOf(request: ParentRefShape): ParentRefShape[] {
  const oracle = getOracleForCurrentWorkspace();
  return oracle ? requestExamples(oracle, request) : [];
}

/** Tombstone every given example, one bare entity tombstone per batch. */
export async function deleteExamples(examples: ReadonlyArray<ParentRefShape>, op: string): Promise<void> {
  for (const example of examples) {
    const tombstone = EXAMPLE_TOMBSTONES[example.type];
    if (!tombstone) {
      logger.info('RequestStore', `${op}: ${example.type} ${example.uid} has no example catalog — left in place`);
      continue;
    }
    await applyRequestMutationOrThrow((ctx) => tombstone(example.uid, ctx), `${op}-cascade-${example.type}`);
  }
}

/** Tombstone every example owned by `request`. */
export async function deleteExamplesOf(request: ParentRefShape, op: string): Promise<void> {
  await deleteExamples(examplesOf(request), op);
}
