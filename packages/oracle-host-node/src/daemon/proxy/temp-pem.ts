/**
 * Scoped temp file for handing a PEM to `security` / `certutil` — the
 * public certificate only, never key material. Owner-only mode, always
 * unlinked, even on failure.
 */

import { randomBytes } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export async function withTempPem<T>(
  certPem: string,
  run: (pemPath: string) => Promise<T>,
  tmpdir: string = os.tmpdir(),
): Promise<T> {
  const pemPath = path.join(tmpdir, `oh-proxy-ca-${randomBytes(8).toString('hex')}.pem`);
  await writeFile(pemPath, certPem, { encoding: 'utf8', mode: 0o600 });
  try {
    return await run(pemPath);
  } finally {
    await unlink(pemPath).catch(() => undefined);
  }
}
