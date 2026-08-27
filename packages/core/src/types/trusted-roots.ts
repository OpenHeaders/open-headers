import type * as v from 'valibot';
import type { TrustedRootSchema, TrustedRootsSchema } from '../schemas/trusted-roots';

export type TrustedRoot = v.InferOutput<typeof TrustedRootSchema>;

export type TrustedRoots = v.InferOutput<typeof TrustedRootsSchema>;

export const EMPTY_TRUSTED_ROOTS: TrustedRoots = { schemaVersion: 5, roots: [] };
