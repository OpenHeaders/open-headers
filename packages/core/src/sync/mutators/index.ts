export {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  ENVIRONMENT_MUTATOR_VERSION,
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
