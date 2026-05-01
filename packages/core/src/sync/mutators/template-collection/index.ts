export { mintBatch, mintEnvelope, TEMPLATE_COLLECTION_MUTATOR_VERSION } from './envelope';
export { renameTemplateCollection, type RenameTemplateCollectionArgs } from './name';
export { INVALIDATE_RESOLVER, invalidateResolverIntent } from './side-effects';
export { TEMPLATE_COLLECTION_ENTITY_TYPE, TEMPLATE_COLLECTION_VARS_PATH } from './types';
export {
  removeTemplateCollectionVar,
  type RemoveTemplateCollectionVarArgs,
  renameTemplateCollectionVar,
  type RenameTemplateCollectionVarArgs,
  setTemplateCollectionVar,
  type SetTemplateCollectionVarArgs,
  setTemplateCollectionVarType,
  type SetTemplateCollectionVarTypeArgs,
  type VariableType,
} from './variable';
