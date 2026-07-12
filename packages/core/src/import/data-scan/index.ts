/**
 * Local data scan — migration ladder rung 2 (MIGRATION_PLAN.md §3.2).
 *
 * Same pure/impure split as install detection: core owns the target
 * allowlist (`targets.ts`), the store readers/interpreters
 * (`postman-backup.ts`, `nedb.ts` + `insomnia.ts`), and the findings
 * shape (`types.ts`) — the host adapter only lists the allowlisted
 * directories and reads the matched files.
 *
 * Thunder Client's globalStorage shape is not forensically verified
 * yet — deliberately absent rather than invented (status worklist).
 */

import { interpretInsomniaStores } from './insomnia';
import { interpretPostmanBackups } from './postman-backup';
import type { DataScanInterpretation, DataScanTarget, ScannedFile } from './types';

export { interpretInsomniaStores } from './insomnia';
export { parseNedbLines } from './nedb';
export { interpretPostmanBackups } from './postman-backup';
export { listDataScanTargets, matchesDataScanFile } from './targets';
export type {
  DataScanInterpretation,
  DataScanSkip,
  DataScanStore,
  DataScanTarget,
  InsomniaNedbFinding,
  PostmanBackupFinding,
  ScannedFile,
  ToolDataFinding,
} from './types';

/** Route one target's matched files to its store interpreter. */
export function interpretDataScanFiles(target: DataScanTarget, files: readonly ScannedFile[]): DataScanInterpretation {
  return target.store === 'postman-backup'
    ? interpretPostmanBackups(files)
    : interpretInsomniaStores(target.dir, files);
}
