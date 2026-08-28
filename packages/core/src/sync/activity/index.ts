export type {
  InverseAddToSet,
  InverseCreate,
  InverseEnvelopeContext,
  InverseMoveBefore,
  InverseRemoveFromSet,
  InverseSetField,
  InverseSlotTarget,
  InverseSlotTransfer,
  InverseSpec,
  InverseSpecPriorAccess,
  InverseUnavailable,
  InverseUnsetField,
} from './inverse';
export { computeInverseSpec } from './inverse';
export type { ActivityMuteEntry } from './mute';
export { activityMuteKey } from './mute';
export { ActivityEntryKindSchema, ActivityEntrySchema } from './schema';
export { widensScope } from './scope-expansion';
export {
  detectSensitiveRotation,
  isSensitiveHeaderName,
  isSensitiveLeafPath,
  isSensitiveSetMember,
} from './sensitive-paths';
export type { ActivityEntry, ActivityEntryKind } from './types';
export { activityEntryId } from './types';
