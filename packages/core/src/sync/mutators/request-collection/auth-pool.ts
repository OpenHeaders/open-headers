/**
 * Auth-pool intent factories for a request collection — the shared
 * factory bound to the request-collection routing constants. See
 * `shared/auth-pool-mutators.ts` for the identity model.
 */

import { makeAuthPoolMutators } from '../shared/auth-pool-mutators';
import { mintBatch } from './envelope';
import {
  REQUEST_COLLECTION_AUTHS_PATH,
  REQUEST_COLLECTION_DEFAULT_AUTH_PATH,
  REQUEST_COLLECTION_ENTITY_TYPE,
} from './types';

export const requestCollectionAuthPool = makeAuthPoolMutators({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  authsPath: REQUEST_COLLECTION_AUTHS_PATH,
  defaultAuthPath: REQUEST_COLLECTION_DEFAULT_AUTH_PATH,
  mintBatch,
});
