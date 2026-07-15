import type { CurlRequest } from '../curl';
import type { ImportReport } from '../report';

// ── Input ──────────────────────────────────────────────────────────

/**
 * One file handed over by the folder picker (or the Phase 4 scanner).
 * `path` is collection-relative (`auth/login.bru`, `folder.bru`,
 * `environments/staging.bru`); the parser never touches the
 * filesystem itself.
 */
export interface BrunoFile {
  path: string;
  content: string;
}

// ── Output ─────────────────────────────────────────────────────────

/** Mirrors `PostmanParsedRequest` / `InsomniaParsedRequest` — same `CurlRequest` write path downstream. */
export interface BrunoParsedRequest {
  folderPath: string[];
  request: CurlRequest;
}

export interface BrunoParsedFolder {
  path: string[];
}

export interface BrunoParsedEnvironmentVariable {
  name: string;
  value: string;
  type: 'default';
  /** Present (as `false`) only for source-disabled rows — they import
   *  as disabled variables; absent means enabled. */
  enabled?: boolean;
}

export interface BrunoParsedEnvironment {
  name: string;
  variables: BrunoParsedEnvironmentVariable[];
}

/**
 * One Bruno collection — a folder of `.bru` files maps onto exactly
 * one destination collection (unlike Insomnia exports, which can
 * carry several workspaces).
 */
export interface BrunoParseResult {
  collectionName: string;
  folders: BrunoParsedFolder[];
  requests: BrunoParsedRequest[];
  environments: BrunoParsedEnvironment[];
  report: ImportReport;
}

export class BrunoParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrunoParseError';
  }
}
