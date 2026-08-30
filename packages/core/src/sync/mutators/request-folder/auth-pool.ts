/**
 * Auth-pool intent factories for a request folder — the shared factory
 * bound to the request-folder routing constants. See
 * `shared/auth-pool-mutators.ts` for the identity model.
 */

import { makeAuthPoolMutators } from '../shared/auth-pool-mutators';
import { mintBatch } from './envelope';
import { REQUEST_FOLDER_AUTHS_PATH, REQUEST_FOLDER_DEFAULT_AUTH_PATH, REQUEST_FOLDER_ENTITY_TYPE } from './types';

export const requestFolderAuthPool = makeAuthPoolMutators({
  entityType: REQUEST_FOLDER_ENTITY_TYPE,
  authsPath: REQUEST_FOLDER_AUTHS_PATH,
  defaultAuthPath: REQUEST_FOLDER_DEFAULT_AUTH_PATH,
  mintBatch,
});
