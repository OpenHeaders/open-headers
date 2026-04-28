import { generateUid } from '../../utils/workspace';

/** Idempotency key for a single mutation envelope (§7.1). */
export const newMutationId = (): string => generateUid();

/** Group key for a single user gesture's mutation batch (§11.2). */
export const newBatchId = (): string => generateUid();
