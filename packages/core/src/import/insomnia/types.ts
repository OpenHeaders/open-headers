import type { CurlRequest } from '../curl';
import type { ImportReport } from '../report';

// ── Types we read ──────────────────────────────────────────────────
//
// One resource vocabulary covers all three entry shapes: export v4
// (`_type: 'request'` snake_case), raw NeDB docs (`type: 'Request'`
// PascalCase), and v5 documents (converted to the same shape during
// envelope handling). `normalizeDoc` folds them into `InsomniaDoc`.

export interface InsomniaHeader {
  name?: string;
  value?: string;
  disabled?: boolean;
  description?: string;
}

export interface InsomniaParameter {
  name?: string;
  value?: string;
  disabled?: boolean;
  description?: string;
  type?: string;
  fileName?: string;
}

export interface InsomniaBody {
  mimeType?: string;
  text?: string;
  params?: InsomniaParameter[];
  fileName?: string;
}

export interface InsomniaAuthentication {
  type?: string;
  disabled?: boolean;
  username?: string;
  password?: string;
  token?: string;
  prefix?: string;
  key?: string;
  value?: string;
  addTo?: string;
  [k: string]: unknown;
}

/** Normalized resource — the common denominator of v4 / v5 / NeDB shapes. */
export interface InsomniaDoc {
  id: string;
  parentId: string | null;
  kind: 'workspace' | 'request-group' | 'request' | 'environment' | 'unsupported';
  /** The source discriminator verbatim (`request_group`, `Request`, …) for report reasons. */
  rawType: string;
  name: string;
  description?: string;
  sortKey?: number;
  url?: string;
  method?: string;
  headers?: InsomniaHeader[];
  parameters?: InsomniaParameter[];
  body?: InsomniaBody;
  authentication?: InsomniaAuthentication;
  data?: Record<string, unknown>;
}

// ── Output ─────────────────────────────────────────────────────────

/** Mirrors `PostmanParsedRequest` — same `CurlRequest` write path downstream. */
export interface InsomniaParsedRequest {
  folderPath: string[];
  request: CurlRequest;
}

export interface InsomniaParsedFolder {
  path: string[];
  description?: string;
}

export interface InsomniaParsedEnvironmentVariable {
  name: string;
  value: string;
  type: 'default';
}

export interface InsomniaParsedEnvironment {
  name: string;
  variables: InsomniaParsedEnvironmentVariable[];
}

/** One workspace from the export — maps onto one destination collection. */
export interface InsomniaParsedCollection {
  name: string;
  description: string;
  folders: InsomniaParsedFolder[];
  requests: InsomniaParsedRequest[];
}

export interface InsomniaParseResult {
  collections: InsomniaParsedCollection[];
  environments: InsomniaParsedEnvironment[];
  report: ImportReport;
}

export class InsomniaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsomniaParseError';
  }
}
