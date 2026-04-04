/**
 * Migration types for v4 → v5 conversion.
 *
 * These types represent the v4 data shapes as read from disk,
 * used as input to the migration function.
 */

// ── v4 Source (from sources.json) ──────────────────────────────────

export interface V4SourceHeader {
  key: string;
  value: string;
}

export interface V4SourceQueryParam {
  key: string;
  value: string;
}

export interface V4SourceRequestOptions {
  contentType?: string;
  body?: string;
  headers?: V4SourceHeader[];
  queryParams?: V4SourceQueryParam[];
  totpSecret?: string;
}

export interface V4JsonFilter {
  enabled: boolean;
  path?: string;
}

export interface V4RefreshOptions {
  enabled: boolean;
  type?: 'custom' | 'cron' | 'manual';
  interval?: number;
  lastRefresh?: number | null;
  nextRefresh?: number | null;
}

export interface V4Source {
  sourceId: string;
  sourceType: 'http' | 'file' | 'manual' | 'env';
  sourcePath?: string;
  sourceMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  sourceName?: string;
  sourceTag?: string;
  sourceContent?: string | null;
  requestOptions?: V4SourceRequestOptions;
  jsonFilter?: V4JsonFilter;
  refreshOptions?: V4RefreshOptions;
  activationState?: string;
  missingDependencies?: string[];
  createdAt?: string;
  updatedAt?: string;
  originalResponse?: string | null;
  responseHeaders?: Record<string, string> | null;
}

// ── v4 Rules (from rules.json) ─────────────────────────────────────

export interface V4HeaderRule {
  id: string;
  type: 'header';
  name: string;
  description: string;
  isEnabled: boolean;
  domains: string[];
  createdAt: string;
  updatedAt: string;
  headerName: string;
  headerValue: string;
  tag: string;
  isResponse: boolean;
  isDynamic: boolean;
  sourceId: string | number | null;
  prefix: string;
  suffix: string;
  hasEnvVars: boolean;
  envVars: string[];
  cookieName?: string;
}

export interface V4PayloadRule {
  id: string;
  type: 'payload';
  name: string;
  description: string;
  isEnabled: boolean;
  domains: string[];
  createdAt: string;
  updatedAt: string;
  matchPattern: string;
  matchType: 'contains' | 'regex' | 'exact';
  replaceWith: string;
  isRequest: boolean;
  isResponse: boolean;
  contentType: 'any' | 'json' | 'xml' | 'text' | 'form';
}

export interface V4RulesStorage {
  version: string;
  rules: {
    header: V4HeaderRule[];
    request: V4PayloadRule[];
    response: Array<V4HeaderRule | V4PayloadRule>;
  };
  metadata: {
    totalRules: number;
    lastUpdated: string;
  };
}

// ── v4 Environments (from environments.json) ───────────────────────

export interface V4EnvironmentVariable {
  value: string;
  isSecret: boolean;
  updatedAt?: string;
}

export interface V4EnvironmentsFile {
  environments: Record<string, Record<string, V4EnvironmentVariable>>;
  activeEnvironment: string;
}

// ── v4 Proxy rules (from proxy-rules.json) ─────────────────────────

export interface V4ProxyRule {
  id: string;
  name: string;
  enabled: boolean;
  headerRuleId: string;
  isDynamic: boolean;
}

// ── v4 Workspace data (everything loaded from one workspace dir) ───

export interface V4WorkspaceData {
  sources: V4Source[];
  rules: V4RulesStorage;
  environments: V4EnvironmentsFile;
  proxyRules: V4ProxyRule[];
}

// ── Migration result ───────────────────────────────────────────────

export interface MigrationWarning {
  entity: string;
  field: string;
  message: string;
}

export interface MigrationResult {
  success: boolean;
  warnings: MigrationWarning[];
}
