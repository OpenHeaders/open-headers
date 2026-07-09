/**
 * Response Example types — derived from the valibot schemas in
 * `../schemas/response-example.ts` so the runtime validator and the
 * TypeScript types stay locked together.
 */

import type * as v from 'valibot';
import type { CapturedRequestSchema, CapturedResponseSchema, ResponseExampleSchema } from '../schemas/response-example';

/** Request shape as sent — authored values, variable refs unresolved. */
export type CapturedRequest = v.InferOutput<typeof CapturedRequestSchema>;

/** Response side of the captured exchange. */
export type CapturedResponse = v.InferOutput<typeof CapturedResponseSchema>;

/** A frozen snapshot of one executed exchange, saved under a request. */
export type ResponseExample = v.InferOutput<typeof ResponseExampleSchema>;
