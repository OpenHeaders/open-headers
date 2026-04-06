/**
 * V5DataAdapter — converts v5 data structures to v4 shapes.
 *
 * This adapter allows the existing renderer and services (which speak v4)
 * to work with data stored in v5 format. It's a temporary bridge that will
 * be removed once the renderer is rewritten to speak v5 natively.
 *
 * Conversion direction: v5 → v4 (for reading only)
 */

import type { HeaderRule, RulesCollection, Source } from '@openheaders/core';
import type { V5 } from '@openheaders/core/types';
import type { EnvironmentMap } from '@/types/environment';
import type { ProxyRule } from '@/types/proxy';

// ── Rule → HeaderRule ──────────────────────────────────────────────

/**
 * Convert a v5 HeaderRule to a v4 HeaderRule shape.
 */
function headerRuleToV4(rule: V5.HeaderRule, sourceId: string | null): HeaderRule {
  // Determine if it's dynamic (linked to a source/request)
  const isDynamic = rule.valueSource === 'request' && sourceId !== null;

  // For static rules, the headerValue is the template. For dynamic, it's empty.
  const headerValue = isDynamic ? '' : (rule.staticValue ?? '');

  // Extract prefix/suffix from valueTemplate
  const { prefix, suffix } =
    isDynamic && rule.requestSource?.valueTemplate
      ? parseValueTemplate(rule.requestSource.valueTemplate)
      : { prefix: '', suffix: '' };

  // Extract env var references
  const allText = `${headerValue} ${rule.domains.join(' ')}`;
  const envVars = extractEnvVarNames(allText);

  return {
    id: rule.id,
    type: 'header',
    name: rule.name,
    description: '',
    isEnabled: rule.enabled,
    domains: rule.domains,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    headerName: rule.action.headerName,
    headerValue,
    tag: rule.tags[0] ?? '',
    isResponse: rule.action.isResponse,
    isDynamic,
    sourceId: sourceId,
    prefix,
    suffix,
    hasEnvVars: envVars.length > 0,
    envVars,
  };
}

// ── Rule → ProxyRule ───────────────────────────────────────────────

function headerRuleToProxyRule(rule: V5.HeaderRule): ProxyRule | null {
  if (!rule.proxyEnabled) return null;

  return {
    id: `proxy-${rule.id}`,
    name: rule.name || rule.action.headerName,
    enabled: rule.enabled,
    headerRuleId: rule.id,
    isDynamic: rule.valueSource === 'request',
  };
}

// ── Environment → EnvironmentMap ───────────────────────────────────

function environmentsToV4(environments: V5.Environment[]): {
  environmentMap: EnvironmentMap;
  activeEnvironment: string;
} {
  const environmentMap: EnvironmentMap = {};
  let activeEnvironment = 'Default';

  for (const env of environments) {
    const vars: Record<string, { value: string; isSensitive: boolean; updatedAt?: string }> = {};
    for (const v of env.variables) {
      vars[v.name] = {
        value: v.value,
        isSensitive: v.type === 'secret',
        updatedAt: v.updatedAt,
      };
    }
    environmentMap[env.name] = vars;
    if (env.isActive) {
      activeEnvironment = env.name;
    }
  }

  // Ensure at least a Default environment exists
  if (!environmentMap[activeEnvironment]) {
    environmentMap.Default = {};
    activeEnvironment = 'Default';
  }

  return { environmentMap, activeEnvironment };
}

// ── Full workspace conversion ──────────────────────────────────────

export interface V4WorkspaceShape {
  sources: Source[];
  rules: RulesCollection;
  proxyRules: ProxyRule[];
  environments: EnvironmentMap;
  activeEnvironment: string;
}

/**
 * Convert a full set of v5 workspace data into v4 shapes
 * that the existing renderer and services understand.
 */
export function convertV5toV4(
  _collections: V5.CollectionWithTree[],
  v5Rules: V5.Rule[],
  environments: V5.Environment[],
  requests?: V5.Request[],
): V4WorkspaceShape {
  const headerRules = v5Rules.filter((r): r is V5.HeaderRule => r.type === 'header');

  // Build request lookup for source creation
  const requestLookup = new Map<string, V5.Request>();
  for (const req of requests ?? []) {
    requestLookup.set(req.id, req);
  }

  // Convert rules → v4 HeaderRules + Sources
  const sources: Source[] = [];
  const v4HeaderRules: HeaderRule[] = [];
  const proxyRules: ProxyRule[] = [];

  for (const rule of headerRules) {
    let sourceId: string | null = null;

    if (rule.valueSource === 'request' && rule.requestSource) {
      sourceId = rule.requestSource.requestId;

      // Create a source if we haven't already for this requestId
      if (!sources.some((s) => s.sourceId === sourceId)) {
        const linkedRequest = requestLookup.get(sourceId!);
        sources.push(createSourceFromRequestSource(rule, linkedRequest));
      }
    }

    v4HeaderRules.push(headerRuleToV4(rule, sourceId));

    const proxyRule = headerRuleToProxyRule(rule);
    if (proxyRule) proxyRules.push(proxyRule);
  }

  // Convert body rules (v5) back to payload rules (v4)
  const bodyRules = v5Rules.filter((r): r is V5.BodyRule => r.type === 'body');
  const v4PayloadRules = bodyRules.map((rule) => ({
    id: rule.id,
    type: 'payload' as const,
    name: rule.name,
    description: '',
    isEnabled: rule.enabled,
    domains: rule.domains,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    matchPattern: rule.action.matchPattern,
    matchType: rule.action.matchType,
    replaceWith: rule.action.replaceWith,
    isRequest: rule.action.isRequest,
    isResponse: rule.action.isResponse,
    contentType: rule.action.contentType,
  }));

  const { environmentMap, activeEnvironment } = environmentsToV4(environments);

  return {
    sources,
    rules: {
      header: v4HeaderRules,
      request: v4PayloadRules,
      response: [],
    },
    proxyRules,
    environments: environmentMap,
    activeEnvironment,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Create a v4 Source from a v5 Rule's requestSource config,
 * enriched with the linked Request's URL/method/body when available.
 */
function createSourceFromRequestSource(rule: V5.HeaderRule, request?: V5.Request): Source {
  const rs = rule.requestSource!;
  return {
    sourceId: rs.requestId,
    sourceType: 'http',
    sourcePath: request?.url ?? '',
    sourceMethod: request?.method === 'HEAD' || request?.method === 'OPTIONS' ? 'GET' : (request?.method ?? 'GET'),
    sourceName: request?.name,
    sourceTag: rule.tags[0] ?? '',
    requestOptions: request
      ? {
          contentType:
            request.body.type === 'x-www-form-urlencoded'
              ? 'application/x-www-form-urlencoded'
              : request.body.type === 'json'
                ? 'application/json'
                : undefined,
          body:
            request.body.type === 'x-www-form-urlencoded'
              ? request.body.formData?.map((e) => `${e.key}:${e.value}`).join('\n')
              : request.body.raw,
          headers: request.headers.filter((h) => h.enabled).map((h) => ({ key: h.key, value: h.value })),
          queryParams: request.params.filter((p) => p.enabled).map((p) => ({ key: p.key, value: p.value })),
          totpSecret: request.totp?.secret,
        }
      : undefined,
    jsonFilter: {
      enabled: true,
      path: jsonPathToV4FilterPath(rs.responseExtract),
    },
    refreshOptions: {
      enabled: rs.refreshMode !== 'manual',
      type: 'custom',
      interval: rs.refreshInterval ? Math.round(rs.refreshInterval / 60) : undefined,
      lastRefresh: rs.lastRefreshed ? new Date(rs.lastRefreshed).getTime() : null,
    },
    activationState: 'active',
    missingDependencies: [],
    sourceContent: rs.lastValue ?? null,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * Convert v5 JSONPath back to v4 filter path.
 * "$.access_token" → "root.access_token"
 */
function jsonPathToV4FilterPath(jsonPath: string): string {
  if (jsonPath.startsWith('$.')) return `root.${jsonPath.slice(2)}`;
  if (jsonPath === '$') return 'root';
  return jsonPath;
}

/**
 * Parse a v5 value template into v4 prefix/suffix.
 * "Bearer {value}" → { prefix: "Bearer ", suffix: "" }
 */
function parseValueTemplate(template: string): { prefix: string; suffix: string } {
  const idx = template.indexOf('{value}');
  if (idx === -1) return { prefix: template, suffix: '' };
  return {
    prefix: template.slice(0, idx),
    suffix: template.slice(idx + '{value}'.length),
  };
}

/**
 * Extract {{VAR}} names from a string.
 */
function extractEnvVarNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    const name = match[1].trim();
    if (!names.includes(name)) names.push(name);
  }
  return names;
}
