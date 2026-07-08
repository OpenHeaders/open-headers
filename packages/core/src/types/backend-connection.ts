/**
 * `BackendConnection` TypeScript type — derived from the valibot schema
 * in `../schemas/backend-connection`.
 */

import type * as v from 'valibot';
import type { BackendConnectionSchema } from '../schemas/backend-connection';

export type BackendConnection = v.InferOutput<typeof BackendConnectionSchema>;
