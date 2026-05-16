export { ActivityEntryKindSchema, ActivityEntrySchema } from './schema';
export { activityEntryId } from './types';
export type { ActivityEntry, ActivityEntryKind } from './types';
export { computeInverseSpec } from './inverse';
export type {
  InverseAddToSet,
  InverseCreate,
  InverseEnvelopeContext,
  InverseMoveBefore,
  InverseRemoveFromSet,
  InverseSetField,
  InverseSpec,
  InverseSpecPriorAccess,
  InverseUnavailable,
  InverseUnsetField,
} from './inverse';
export { activityMuteKey } from './mute';
export type { ActivityMuteEntry } from './mute';
export {
  detectSensitiveRotation,
  isSensitiveHeaderName,
  isSensitiveLeafPath,
  isSensitiveSetMember,
} from './sensitive-paths';
export { widensScope } from './scope-expansion';
