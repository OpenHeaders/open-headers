/**
 * Spec types — derived from the valibot schemas in `../schemas/spec.ts`
 * so the runtime validator and the TypeScript types stay locked
 * together.
 */

import type * as v from 'valibot';
import type { SpecFileSchema, SpecFormatSchema, SpecSchema } from '../schemas/spec';

/** A first-class API specification document with a file set. */
export type Spec = v.InferOutput<typeof SpecSchema>;

/** One source file in a spec's file set. */
export type SpecFile = v.InferOutput<typeof SpecFileSchema>;

/** Supported spec format vocabulary (OpenAPI 3.x, Protobuf 3). */
export type SpecFormat = v.InferOutput<typeof SpecFormatSchema>;
