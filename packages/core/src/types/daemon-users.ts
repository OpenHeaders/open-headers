/**
 * `DaemonUserRecord` TypeScript type — derived from the valibot schema
 * in `../schemas/daemon-users`.
 */

import type * as v from 'valibot';
import type { DaemonUserRecordSchema } from '../schemas/daemon-users';

export type DaemonUserRecord = v.InferOutput<typeof DaemonUserRecordSchema>;
