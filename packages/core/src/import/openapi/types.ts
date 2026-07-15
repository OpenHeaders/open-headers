import type { CurlRequest } from '../curl';
import type { ImportReport } from '../report';

// ── Types we read (subset of OpenAPI 3.x) ──────────────────────────
//
// Any node in an OpenAPI document may be a `$ref`, so these shapes
// describe nodes AFTER resolution (`ref.ts`); readers still guard
// every field — a document that validates nowhere else must still
// produce a report, never a throw past the entry gate.

export interface OpenApiServerVariable {
  default?: string;
  enum?: unknown[];
  description?: string;
  [k: string]: unknown;
}

export interface OpenApiServer {
  url?: string;
  description?: string;
  variables?: Record<string, OpenApiServerVariable>;
  [k: string]: unknown;
}

export interface OpenApiParameter {
  name?: string;
  in?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  examples?: Record<string, unknown>;
  schema?: unknown;
  content?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: unknown[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: unknown[];
  servers?: unknown[];
  callbacks?: Record<string, unknown>;
  [k: string]: unknown;
}

// ── Output ─────────────────────────────────────────────────────────

/** Mirrors `PostmanParsedRequest` — same `CurlRequest` write path downstream. */
export interface OpenApiParsedRequest {
  folderPath: string[];
  request: CurlRequest;
}

export interface OpenApiParsedFolder {
  path: string[];
  description?: string;
}

/**
 * Normalized collection variable. OpenAPI has no secret/default split;
 * the type is pinned to `'default'` here (matching the Postman
 * importer) — callers promoting to secret do so via UI.
 */
export interface OpenApiCollectionVariable {
  name: string;
  value: string;
  type: 'default';
  description?: string;
}

/** One OpenAPI document — maps onto one destination collection. */
export interface OpenApiParseResult {
  collectionName: string;
  collectionDescription: string;
  collectionVariables: OpenApiCollectionVariable[];
  folders: OpenApiParsedFolder[];
  requests: OpenApiParsedRequest[];
  report: ImportReport;
}

export class OpenApiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenApiParseError';
  }
}
