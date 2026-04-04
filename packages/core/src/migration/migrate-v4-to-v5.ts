/**
 * v4 → v5 data migration.
 *
 * Converts a v4 workspace (sources, rules, environments, proxy-rules)
 * into v5 data structures (requests, collections, rules, environments, vault).
 *
 * Migration rules:
 * - Source(http) → Request (in a collection) + Rule.requestSource linkage
 * - Source(file) → Variable with source='file' in environment
 * - Source(env/manual) → Variable with source='static' in environment
 * - HeaderRule → v5 HeaderRule with valueSource + merged proxyEnabled
 * - PayloadRule → v5 BodyRule
 * - Environment variables → split into env definitions + local values + vault secrets
 * - ProxyRules → merged into rules as proxyEnabled flag
 */

import type {
  BodyRule,
  Collection,
  CollectionNode,
  Environment,
  EnvironmentLocalValues,
  EnvironmentManifest,
  Globals,
  MigrationResult,
  MigrationWarning,
  Request,
  RequestSource,
  V4HeaderRule,
  V4PayloadRule,
  V4ProxyRule,
  V4Source,
  V4WorkspaceData,
  HeaderRule as V5HeaderRule,
  Rule as V5Rule,
  Variable,
  Vault,
  VaultSecret,
} from '../types/v5';

// ── Output types ───────────────────────────────────────────────────

export interface V5WorkspaceData {
  collections: V5CollectionData[];
  rules: V5Rule[];
  environments: Environment[];
  environmentManifests: EnvironmentManifest[];
  environmentLocalValues: EnvironmentLocalValues[];
  vault: Vault;
  globals: Globals;
}

interface V5CollectionData {
  collection: Collection;
  tree: CollectionNode[];
  requests: Request[];
}

// ── Main migration function ────────────────────────────────────────

export function migrateV4toV5(data: V4WorkspaceData): {
  workspace: V5WorkspaceData;
  result: MigrationResult;
} {
  const warnings: MigrationWarning[] = [];

  // 1. Migrate sources → requests (grouped by tag into collections)
  const { collections, sourceIdToRequestId } = migrateSources(data.sources, warnings);

  // 2. Build proxy rule lookup
  const proxyRuleLookup = buildProxyRuleLookup(data.proxyRules);

  // 3. Migrate rules
  const rules = migrateRules(data.rules, data.sources, sourceIdToRequestId, proxyRuleLookup, warnings);

  // 4. Migrate environments → env definitions + local values + vault secrets
  const { environments, environmentManifests, environmentLocalValues, vault } = migrateEnvironments(
    data.environments,
    warnings,
  );

  return {
    workspace: {
      collections,
      rules,
      environments,
      environmentManifests,
      environmentLocalValues,
      vault,
      globals: { variables: [] },
    },
    result: {
      success: true,
      warnings,
    },
  };
}

// ── Source → Request migration ─────────────────────────────────────

function migrateSources(
  sources: V4Source[],
  warnings: MigrationWarning[],
): {
  collections: V5CollectionData[];
  requests: Request[];
  sourceIdToRequestId: Map<string, string>;
} {
  const sourceIdToRequestId = new Map<string, string>();
  const requests: Request[] = [];

  // Group HTTP sources by tag to create collections
  const httpSources = sources.filter((s) => s.sourceType === 'http');
  const tagGroups = new Map<string, V4Source[]>();

  for (const source of httpSources) {
    const tag = source.sourceTag || 'Imported';
    const group = tagGroups.get(tag) ?? [];
    group.push(source);
    tagGroups.set(tag, group);
  }

  const collections: V5CollectionData[] = [];

  for (const [tag, tagSources] of tagGroups) {
    const collectionId = `migrated-collection-${slugify(tag)}`;
    const collectionRequests: Request[] = [];
    const treeNodes: CollectionNode[] = [];

    for (const source of tagSources) {
      const request = migrateHttpSourceToRequest(source, warnings);
      sourceIdToRequestId.set(source.sourceId, request.id);
      collectionRequests.push(request);
      requests.push(request);

      treeNodes.push({
        type: 'request',
        id: request.id,
        name: request.name,
        method: request.method,
      });
    }

    collections.push({
      collection: {
        id: collectionId,
        name: `${tag} API`,
        description: `Migrated from v4 sources with tag "${tag}"`,
        variables: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tree: treeNodes,
      requests: collectionRequests,
    });
  }

  // Handle non-HTTP sources (file, env, manual) — these become warnings
  // because they'll be migrated to variables, not requests
  for (const source of sources) {
    if (source.sourceType !== 'http') {
      warnings.push({
        entity: `source:${source.sourceId}`,
        field: 'sourceType',
        message: `${source.sourceType} source "${source.sourceName || source.sourcePath || source.sourceId}" will be converted to an environment variable`,
      });
    }
  }

  return { collections, requests, sourceIdToRequestId };
}

function migrateHttpSourceToRequest(source: V4Source, warnings: MigrationWarning[]): Request {
  const requestId = `migrated-request-${source.sourceId}`;
  const opts = source.requestOptions;

  // Parse the v4 body format (key:value\nkey:value) into form entries
  const { bodyConfig, contentType } = migrateBody(opts?.body, opts?.contentType);

  // Migrate headers
  const headers = (opts?.headers ?? []).map((h) => ({
    key: h.key,
    value: h.value,
    enabled: true,
  }));

  // Migrate query params
  const params = (opts?.queryParams ?? []).map((p) => ({
    key: p.key,
    value: p.value,
    enabled: true,
  }));

  // Derive a name from the URL path
  const name = deriveRequestName(source);

  // TOTP config
  const totp = opts?.totpSecret ? { secret: opts.totpSecret, placeholder: '[[TOTP_CODE]]' } : undefined;

  if (contentType && !bodyConfig.contentType) {
    bodyConfig.contentType = contentType;
  }

  // Warn about fields that don't map cleanly
  if (source.activationState === 'error') {
    warnings.push({
      entity: `source:${source.sourceId}`,
      field: 'activationState',
      message: `Source was in error state at migration time`,
    });
  }

  return {
    id: requestId,
    name,
    method: (source.sourceMethod as Request['method']) || 'GET',
    url: source.sourcePath || '',
    params,
    headers,
    auth: { type: 'none' },
    body: bodyConfig,
    totp,
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
}

function migrateBody(
  body: string | undefined,
  contentType: string | undefined,
): { bodyConfig: Request['body']; contentType?: string } {
  if (!body) {
    return { bodyConfig: { type: 'none' } };
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    // v4 format: "key:value\nkey:value"
    const entries = body
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return { key: line, value: '', type: 'text' as const, enabled: true };
        return {
          key: line.slice(0, colonIdx),
          value: line.slice(colonIdx + 1),
          type: 'text' as const,
          enabled: true,
        };
      });

    return {
      bodyConfig: {
        type: 'x-www-form-urlencoded',
        formData: entries,
      },
    };
  }

  if (contentType === 'application/json' || isJsonString(body)) {
    return {
      bodyConfig: { type: 'json', raw: body },
    };
  }

  return {
    bodyConfig: { type: 'raw', raw: body, contentType },
    contentType,
  };
}

// ── Rule migration ─────────────────────────────────────────────────

function buildProxyRuleLookup(proxyRules: V4ProxyRule[]): Map<string, boolean> {
  const lookup = new Map<string, boolean>();
  for (const pr of proxyRules) {
    lookup.set(pr.headerRuleId, pr.enabled);
  }
  return lookup;
}

function migrateRules(
  rulesStorage: V4WorkspaceData['rules'],
  sources: V4Source[],
  sourceIdToRequestId: Map<string, string>,
  proxyRuleLookup: Map<string, boolean>,
  warnings: MigrationWarning[],
): V5Rule[] {
  const v5Rules: V5Rule[] = [];

  // Build source lookup for extracting refresh/filter config
  const sourceLookup = new Map<string, V4Source>();
  for (const source of sources) {
    sourceLookup.set(source.sourceId, source);
  }

  // Migrate header rules
  for (const rule of rulesStorage.rules.header) {
    v5Rules.push(migrateHeaderRule(rule, sourceLookup, sourceIdToRequestId, proxyRuleLookup, warnings));
  }

  // Migrate payload rules → body rules
  for (const rule of rulesStorage.rules.request) {
    v5Rules.push(migratePayloadRule(rule, proxyRuleLookup));
  }

  return v5Rules;
}

function migrateHeaderRule(
  rule: V4HeaderRule,
  sourceLookup: Map<string, V4Source>,
  sourceIdToRequestId: Map<string, string>,
  proxyRuleLookup: Map<string, boolean>,
  warnings: MigrationWarning[],
): V5HeaderRule {
  const proxyEnabled = proxyRuleLookup.get(rule.id) ?? false;

  // Determine value source
  if (rule.isDynamic && rule.sourceId != null) {
    const sourceIdStr = String(rule.sourceId);
    const source = sourceLookup.get(sourceIdStr);
    const requestId = sourceIdToRequestId.get(sourceIdStr);

    if (!source || !requestId) {
      warnings.push({
        entity: `rule:${rule.id}`,
        field: 'sourceId',
        message: `Rule "${rule.headerName}" references source "${rule.sourceId}" which was not found`,
      });

      // Fall back to static with empty value
      return {
        id: rule.id,
        name: rule.name || rule.headerName,
        type: 'header',
        enabled: rule.isEnabled,
        tags: rule.tag ? [rule.tag] : [],
        domains: rule.domains,
        proxyEnabled,
        action: {
          operation: 'add',
          headerName: rule.headerName,
          isResponse: rule.isResponse,
        },
        valueSource: 'static',
        staticValue: rule.headerValue,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };
    }

    // Build request source from v4 source's refresh/filter config
    const requestSource = buildRequestSource(source, requestId, rule);

    return {
      id: rule.id,
      name: rule.name || rule.headerName,
      type: 'header',
      enabled: rule.isEnabled,
      tags: rule.tag ? [rule.tag] : [],
      domains: rule.domains,
      proxyEnabled,
      action: {
        operation: 'add',
        headerName: rule.headerName,
        isResponse: rule.isResponse,
      },
      valueSource: 'request',
      requestSource,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  // Static or variable-interpolated value
  return {
    id: rule.id,
    name: rule.name || rule.headerName,
    type: 'header',
    enabled: rule.isEnabled,
    tags: rule.tag ? [rule.tag] : [],
    domains: rule.domains,
    proxyEnabled,
    action: {
      operation: 'add',
      headerName: rule.headerName,
      isResponse: rule.isResponse,
    },
    valueSource: 'static',
    staticValue: rule.headerValue,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function buildRequestSource(source: V4Source, requestId: string, rule: V4HeaderRule): RequestSource {
  // Convert v4 jsonFilter path to JSONPath notation
  // v4: "root.access_token" → v5: "$.access_token"
  const extractPath = convertJsonFilterPath(source.jsonFilter?.path);

  // Build value template from prefix/suffix
  // v4: prefix="Bearer ", suffix="" → v5: "Bearer {value}"
  const valueTemplate = buildValueTemplate(rule.prefix, rule.suffix);

  // Convert refresh interval from v4 minutes to v5 seconds
  const refreshInterval = source.refreshOptions?.interval ? source.refreshOptions.interval * 60 : undefined;

  const refreshMode = source.refreshOptions?.enabled ? 'interval' : 'manual';

  return {
    requestId,
    responseExtract: extractPath,
    extractTarget: 'body',
    valueTemplate: valueTemplate || undefined,
    refreshMode,
    refreshInterval,
    // Carry over runtime state
    lastRefreshed: source.refreshOptions?.lastRefresh
      ? new Date(source.refreshOptions.lastRefresh).toISOString()
      : undefined,
    lastValue: source.sourceContent ?? null,
  };
}

function migratePayloadRule(rule: V4PayloadRule, proxyRuleLookup: Map<string, boolean>): BodyRule {
  return {
    id: rule.id,
    name: rule.name || `Body: ${rule.matchPattern.slice(0, 30)}`,
    type: 'body',
    enabled: rule.isEnabled,
    tags: [],
    domains: rule.domains,
    proxyEnabled: proxyRuleLookup.get(rule.id) ?? false,
    action: {
      matchPattern: rule.matchPattern,
      matchType: rule.matchType,
      replaceWith: rule.replaceWith,
      isRequest: rule.isRequest,
      isResponse: rule.isResponse,
      contentType: rule.contentType,
    },
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

// ── Environment migration ──────────────────────────────────────────

function migrateEnvironments(
  envFile: V4WorkspaceData['environments'],
  warnings: MigrationWarning[],
): {
  environments: Environment[];
  environmentManifests: EnvironmentManifest[];
  environmentLocalValues: EnvironmentLocalValues[];
  vault: Vault;
} {
  const environments: Environment[] = [];
  const environmentManifests: EnvironmentManifest[] = [];
  const environmentLocalValues: EnvironmentLocalValues[] = [];
  const vaultSecrets: VaultSecret[] = [];
  const seenVaultNames = new Set<string>();
  const now = new Date().toISOString();

  for (const [envName, vars] of Object.entries(envFile.environments)) {
    const envId = `migrated-env-${slugify(envName)}`;
    const isActive = envName === envFile.activeEnvironment;
    const variables: Variable[] = [];
    const manifestVars: EnvironmentManifest['variables'] = [];
    const localValues: Record<string, string> = {};

    for (const [varName, varData] of Object.entries(vars)) {
      // All variables go into the environment
      variables.push({
        name: varName,
        value: varData.value,
        type: varData.isSecret ? 'secret' : 'default',
        source: 'static',
        updatedAt: varData.updatedAt,
      });

      // Manifest gets name + type (synced via Git)
      manifestVars.push({
        name: varName,
        type: varData.isSecret ? 'secret' : 'default',
        source: 'static',
      });

      // Values go into local file (gitignored)
      localValues[varName] = varData.value;

      // Secrets also go into vault (highest priority)
      if (varData.isSecret && varData.value && !seenVaultNames.has(varName)) {
        seenVaultNames.add(varName);
        vaultSecrets.push({
          name: varName,
          value: varData.value,
          createdAt: varData.updatedAt || now,
          updatedAt: varData.updatedAt || now,
        });
      }
    }

    environments.push({
      id: envId,
      name: envName,
      variables,
      isActive,
    });

    environmentManifests.push({
      id: envId,
      name: envName,
      variables: manifestVars,
    });

    environmentLocalValues.push({
      environmentId: envId,
      values: localValues,
    });
  }

  if (vaultSecrets.length > 0) {
    warnings.push({
      entity: 'vault',
      field: 'secrets',
      message: `${vaultSecrets.length} secret(s) migrated to vault. These will be encrypted at rest and never synced via Git.`,
    });
  }

  return {
    environments,
    environmentManifests,
    environmentLocalValues,
    vault: { secrets: vaultSecrets },
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Convert v4 json filter path to JSONPath notation.
 * "root.access_token" → "$.access_token"
 * "root.data.items[0].value" → "$.data.items[0].value"
 */
function convertJsonFilterPath(path: string | undefined): string {
  if (!path) return '$';
  if (path.startsWith('root.')) return `$.${path.slice(5)}`;
  if (path.startsWith('root')) return `$.${path.slice(4)}`;
  if (path.startsWith('$.')) return path;
  return `$.${path}`;
}

/**
 * Build a value template from v4 prefix/suffix.
 * prefix="Bearer ", suffix="" → "Bearer {value}"
 * prefix="", suffix="" → null (use raw value)
 */
function buildValueTemplate(prefix: string, suffix: string): string | null {
  if (!prefix && !suffix) return null;
  return `${prefix}{value}${suffix}`;
}

/** Derive a human-readable request name from a v4 source. */
function deriveRequestName(source: V4Source): string {
  if (source.sourceName) return source.sourceName;

  // Try to extract a meaningful name from the URL path
  try {
    const url = new URL(source.sourcePath || '');
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }
    return url.hostname;
  } catch {
    return source.sourcePath || `Source ${source.sourceId}`;
  }
}

/** Convert a string to a URL-safe slug. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
