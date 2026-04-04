/**
 * Request types for v5.
 *
 * A Request is a standalone HTTP call that replaces v4 HTTP Sources.
 * Requests live inside Collections and can be both:
 * - Sent manually (API client)
 * - Linked to Rules as a value source (auto-refresh + extraction)
 */

// ── HTTP method ────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// ── Query parameters ─────���─────────────────────────────────────────

export interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

// ── Request headers ────���───────────────────────────────────────────

export interface RequestHeader {
  key: string;
  value: string;
  enabled: boolean;
}

// ── Authentication ─────────────────────────────────────────────────

export type AuthType = 'none' | 'inherit' | 'basic' | 'bearer' | 'api-key';

export interface BasicAuth {
  username: string;
  password: string;
}

export interface BearerAuth {
  token: string;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

export interface AuthConfig {
  type: AuthType;
  basic?: BasicAuth;
  bearer?: BearerAuth;
  apiKey?: ApiKeyAuth;
}

// ── Request body ───────────────────────────────────────────────────

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'graphql';

export interface FormDataEntry {
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
}

export interface GraphQLBody {
  query: string;
  variables?: string;
}

export interface BodyConfig {
  type: BodyType;
  raw?: string;
  contentType?: string;
  formData?: FormDataEntry[];
  graphql?: GraphQLBody;
}

// ── TOTP auto-generation ───���───────────────────────────────────────

/**
 * OpenHeaders-specific: auto-generates TOTP codes from a secret
 * and substitutes a placeholder in the request body before sending.
 *
 * Migrated from v4 Source.requestOptions.totpSecret + [[TOTP_CODE]].
 */
export interface TotpConfig {
  /** TOTP secret (may reference {{VAR}}). */
  secret: string;
  /** Placeholder in body to replace with generated code, e.g. "[[TOTP_CODE]]". */
  placeholder: string;
}

// ── Request ───────���────────────────────────────────────────────────

export interface Request {
  id: string;
  name: string;
  method: HttpMethod;
  /** URL template — supports {{VAR}} interpolation. */
  url: string;
  params: QueryParam[];
  headers: RequestHeader[];
  auth: AuthConfig;
  body: BodyConfig;
  totp?: TotpConfig;
  /** Per-request Markdown documentation. */
  docs?: string;
  /** Pre-request JavaScript (Phase 2 — placeholder). */
  preRequestScript?: string;
  /** Post-response test JavaScript (Phase 2 — placeholder). */
  testScript?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Response (cached after execution) ──────────────────────────────

export interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  size: number;
  receivedAt: string;
}
