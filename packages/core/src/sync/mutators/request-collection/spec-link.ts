/**
 * `setRequestCollectionSpecLink` — set or clear the collection's spec
 * generation bookkeeping (`specLink`). Written once when a collection
 * is generated from a spec document; `undefined` clears the link
 * (field absent ↔ not spec-generated). The whole object writes as one
 * `setField` — the two members always change together (a new
 * generation mints both), so per-leaf granularity has nothing to
 * converge. No resolver side effects — bookkeeping doesn't feed
 * variable resolution.
 */

import type { SpecLink } from '../../../types/collection';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './types';

export const REQUEST_COLLECTION_SPEC_LINK_PATH = 'specLink';

export interface SetRequestCollectionSpecLinkArgs {
  collectionUid: string;
  /** New link; `undefined` clears the field. */
  specLink: SpecLink | undefined;
}

export function setRequestCollectionSpecLink(
  ctx: MutatorContext,
  args: SetRequestCollectionSpecLinkArgs,
): MutatorIntent {
  const body: MutationBody =
    args.specLink === undefined
      ? {
          kind: 'unsetField',
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          id: args.collectionUid,
          path: REQUEST_COLLECTION_SPEC_LINK_PATH,
        }
      : {
          kind: 'setField',
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          id: args.collectionUid,
          path: REQUEST_COLLECTION_SPEC_LINK_PATH,
          value: args.specLink,
        };
  return { batch: mintBatch(ctx, [body]), sideEffects: [] };
}
