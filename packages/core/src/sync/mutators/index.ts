export {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_MUTATOR_VERSION,
  COLLECTION_VARS_PATH,
  invalidateResolverIntent as collectionInvalidateResolverIntent,
  type RemoveCollectionVarArgs,
  removeCollectionVar,
  type RenameCollectionArgs,
  renameCollection,
  type RenameCollectionVarArgs,
  renameCollectionVar,
  type SetCollectionVarArgs,
  setCollectionVar,
  type SetCollectionVarTypeArgs,
  setCollectionVarType,
  type SetDefaultEnvironmentIdArgs,
  setDefaultEnvironmentId,
  type SetPinnedAndDefaultArgs,
  setPinnedAndDefault,
  type SetPinnedEnvironmentsArgs,
  setPinnedEnvironments,
} from './collection';
export {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  ENVIRONMENT_MUTATOR_VERSION,
  INVALIDATE_RESOLVER,
  invalidateResolverIntent,
  type RemoveEnvVarArgs,
  removeEnvVar,
  type RenameEnvironmentArgs,
  renameEnvironment,
  type RenameEnvVarArgs,
  renameEnvVar,
  type SetEnvVarArgs,
  setEnvVar,
  type SetEnvVarTypeArgs,
  setEnvVarType,
  type VariableType,
} from './environment';
export { flattenToLeaves, type Leaf, unflattenLeaves } from './flatten';
export { applyMutation } from './generic';
export * from './rule';
export { liveOrderedItemsAt, newEntityState, writeSetOrderIfNewer } from './state';
export type {
  EntityState,
  MutatorContext,
  MutatorIntent,
  MutatorOutcome,
  MutatorStatus,
  SideEffectIntent,
} from './types';
