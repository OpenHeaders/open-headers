import type { MigrationTool } from '../install-detect';

export type DataScanStore = 'postman-backup' | 'insomnia-nedb';

export interface DataScanTarget {
  tool: MigrationTool;
  store: DataScanStore;
  /** The one directory whose entry names the host may list. */
  dir: string;
}

/** A matched store file the host read for interpretation. */
export interface ScannedFile {
  path: string;
  mtimeMs: number;
  text: string;
}

export interface PostmanBackupFinding {
  tool: 'postman';
  store: 'postman-backup';
  path: string;
  mtimeMs: number;
  counts: { collections: number; environments: number; globals: number; headerPresets: number };
}

export interface InsomniaNedbFinding {
  tool: 'insomnia';
  store: 'insomnia-nedb';
  dir: string;
  files: string[];
  counts: { collections: number; environments: number; requests: number };
}

export type ToolDataFinding = PostmanBackupFinding | InsomniaNedbFinding;

/** A store candidate that yielded no finding — always with the reason. */
export interface DataScanSkip {
  path: string;
  reason: string;
}

export interface DataScanInterpretation {
  findings: ToolDataFinding[];
  skipped: DataScanSkip[];
}
