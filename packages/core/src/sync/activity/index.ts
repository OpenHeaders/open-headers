export { ActivityEntryKindSchema, ActivityEntrySchema } from './schema';
export { activityEntryId } from './types';
export type { ActivityEntry, ActivityEntryKind } from './types';
export { activityMuteKey } from './mute';
export type { ActivityMuteEntry } from './mute';
export {
  detectSensitiveRotation,
  isSensitiveHeaderName,
  isSensitiveLeafPath,
  isSensitiveSetMember,
} from './sensitive-paths';
export { widensScope } from './scope-expansion';
