export { ActivityEntryKindSchema, ActivityEntrySchema } from './schema';
export { activityEntryId } from './types';
export type { ActivityEntry, ActivityEntryKind } from './types';
export {
  detectSensitiveRotation,
  isSensitiveHeaderName,
  isSensitiveLeafPath,
  isSensitiveSetMember,
} from './sensitive-paths';
export { widensScope } from './scope-expansion';
