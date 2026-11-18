/**
 * What a failed filesystem call says, by the system's code — the same
 * on every platform: gone is `ENOENT` (and `ENOTDIR`, a path through a
 * file); a file another program holds without sharing it — Windows'
 * sharing violation — is `EBUSY`, and passes by itself; denied is
 * `EACCES`, on Windows `EPERM`.
 */

/** The system's code of a failed filesystem call, where it gave one. */
export function failureCode(err: unknown): string | undefined {
  return err instanceof Error && 'code' in err && typeof err.code === 'string' ? err.code : undefined;
}

/** Whether a failure's code says the path is not there. */
export function isGone(code: string | undefined): boolean {
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** Whether a failure's code says another program holds the file for now. */
export function isBusy(code: string | undefined): boolean {
  return code === 'EBUSY';
}
