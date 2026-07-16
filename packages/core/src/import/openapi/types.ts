import type { AuthConfig } from '../../types/request';
import type { CapturedRequest, CapturedResponse } from '../../types/response-example';
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
  /**
   * Concrete response examples converted to Response Example payloads
   * — emitted only under `OpenApiParseOptions.responseExamples`, and
   * only when the operation documents any. OpenAPI carries no capture
   * moment, so entries never carry `capturedAt`; the caller supplies
   * its import timestamp at mint time (core parsers are clock-free).
   */
  examples?: OpenApiParsedExample[];
}

/**
 * One documented response as an importable Response Example: the
 * request shape the operation imported as (auth excluded per the
 * ResponseExample schema) plus the response block built from the
 * documented status, headers, and example body.
 */
export interface OpenApiParsedExample {
  name: string;
  request: CapturedRequest;
  response: CapturedResponse;
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

export interface OpenApiParseOptions {
  /**
   * Emit documented responses as `examples` on each parsed request.
   * Off by default: consumers that cannot mint Response Examples yet
   * keep the honest aggregate drop note instead of silently
   * discarding emitted examples (the Postman precedent).
   */
  responseExamples?: boolean;
}

/**
 * Spec-entity format value for a parsed document — the `Spec.format`
 * vocabulary subset an OpenAPI 3.x source can carry. 3.0.x maps to
 * `openapi-3.0`; every later 3.x minor reads as `openapi-3.1`.
 */
export type OpenApiSpecFormat = 'openapi-3.0' | 'openapi-3.1';

/** One OpenAPI document — maps onto one destination collection. */
export interface OpenApiParseResult {
  collectionName: string;
  collectionDescription: string;
  /** Format vocabulary value derived from the `openapi` version field. */
  specFormat: OpenApiSpecFormat;
  collectionVariables: OpenApiCollectionVariable[];
  /** Document-level `security` mapped onto the collection's ancestor
   *  auth slot — requests without their own security import as
   *  `inherit` and resolve it at send time. Absent when the document
   *  declares none. */
  collectionAuth?: AuthConfig;
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
