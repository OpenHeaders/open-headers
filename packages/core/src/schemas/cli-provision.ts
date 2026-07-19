/**
 * `CliProvisionRecord` — the daemon host's memory of the CLI token it
 * last provisioned into `openheaders/cli.json` (the Settings
 * "Command-line access" flow). Re-provisioning rotates: mint the
 * replacement, write the file, revoke the id remembered here — so the
 * devices ledger never accumulates orphan CLI rows. Holds only the
 * token id (the ledger row), never secret material.
 */

import * as v from 'valibot';

export const CliProvisionRecordSchema = v.object({
  tokenId: v.pipe(v.string(), v.minLength(1)),
  provisionedAt: v.number(),
});
