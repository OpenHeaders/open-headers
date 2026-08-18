/**
 * The scan allowlist — which directories may be listed and which entry
 * names count as a data store. Directory listing never recurses and
 * only matched files are ever opened, so credential/session stores
 * stay unreachable (the migration plan §7).
 */

import type { InstallProbeRoots } from '../install-detect';
import type { DataScanStore, DataScanTarget } from './types';

function scanDirs(platform: string, roots: InstallProbeRoots): { postman: string; insomnia: string } | null {
  switch (platform) {
    case 'darwin': {
      const support = `${roots.home}/Library/Application Support`;
      return { postman: `${support}/Postman`, insomnia: `${support}/Insomnia` };
    }
    case 'win32': {
      if (roots.appData === undefined) return null;
      return { postman: `${roots.appData}\\Postman`, insomnia: `${roots.appData}\\Insomnia` };
    }
    case 'linux':
      return { postman: `${roots.home}/.config/Postman`, insomnia: `${roots.home}/.config/Insomnia` };
    default:
      return null;
  }
}

/** The complete list of directories the scan may enumerate. */
export function listDataScanTargets(platform: string, roots: InstallProbeRoots): DataScanTarget[] {
  const dirs = scanDirs(platform, roots);
  if (dirs === null) return [];
  return [
    { tool: 'postman', store: 'postman-backup', dir: dirs.postman },
    { tool: 'insomnia', store: 'insomnia-nedb', dir: dirs.insomnia },
  ];
}

const STORE_FILE_PATTERNS: Record<DataScanStore, RegExp> = {
  'postman-backup': /^backup-.*\.json$/i,
  'insomnia-nedb': /^insomnia\..+\.db$/i,
};

/** Whether a directory entry name is a store file the host may read. */
export function matchesDataScanFile(store: DataScanStore, name: string): boolean {
  return STORE_FILE_PATTERNS[store].test(name);
}
