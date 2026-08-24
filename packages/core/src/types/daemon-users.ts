/**
 * `DaemonUserRecord` TypeScript type — derived from the valibot schema
 * in `../schemas/daemon-users`.
 */

import type * as v from 'valibot';
import type { DaemonPrincipalKindSchema, DaemonUserRecordSchema } from '../schemas/daemon-users';

export type DaemonUserRecord = v.InferOutput<typeof DaemonUserRecordSchema>;
export type DaemonPrincipalKind = v.InferOutput<typeof DaemonPrincipalKindSchema>;
