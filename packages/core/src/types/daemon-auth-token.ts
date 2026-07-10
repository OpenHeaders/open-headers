/**
 * `DaemonAuthToken` TypeScript type — derived from the valibot schema in
 * `../schemas/daemon-auth-token`.
 */

import type * as v from 'valibot';
import type { DaemonAuthTokenKindSchema, DaemonAuthTokenSchema } from '../schemas/daemon-auth-token';

export type DaemonAuthToken = v.InferOutput<typeof DaemonAuthTokenSchema>;
export type DaemonAuthTokenKind = v.InferOutput<typeof DaemonAuthTokenKindSchema>;
