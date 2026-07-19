/**
 * `CliProvisionRecord` TypeScript type — derived from
 * `../schemas/cli-provision.ts`. The daemon host's memory of the last
 * CLI token it provisioned; re-provisioning rotates that token instead
 * of accumulating rows in the devices ledger.
 */

import type * as v from 'valibot';
import type { CliProvisionRecordSchema } from '../schemas/cli-provision';

export type CliProvisionRecord = v.InferOutput<typeof CliProvisionRecordSchema>;
