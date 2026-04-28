export {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  ENVIRONMENT_MUTATOR_VERSION,
  type EnvironmentIntent,
  type EnvironmentMutatorContext,
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
} from './environment';
export { flattenToLeaves, type Leaf, unflattenLeaves } from './flatten';
export { applyMutation } from './generic';
export * from './rule';
export { liveOrderedItemsAt, newEntityState, writeSetOrderIfNewer } from './state';
export type { EntityState, MutatorContext, MutatorOutcome, MutatorStatus, SideEffectIntent } from './types';
