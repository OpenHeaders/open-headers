/**
 * Security schemes → AuthConfig arms.
 *
 * `components.securitySchemes` builds once into a scheme table (each
 * unmappable scheme drops ONCE, at table-build time); `security`
 * requirement lists then resolve against it — the document-level list
 * becomes the collection's default auth (requests inherit, D2 spine),
 * an operation-level list overrides per request.
 *
 * Mapping: http basic/bearer/digest → native arms; apiKey
 * header/query → `api-key` (cookie drops — session state); oauth2
 * flows → the Phase G arms (authorizationCode = the plain flow riding
 * the PKCE wire flow with the pair suppressed via `grantType`;
 * clientCredentials; password; implicit = PERMANENT drop, OAuth 2.1
 * reason); openIdConnect / mutualTLS drop with notes. OpenAPI
 * documents never carry client credentials — oauth2 configs land with
 * `{{clientId}}` / `{{clientSecret}}` template placeholders and a
 * transform naming the fill-in.
 *
 * Requirement semantics: alternatives (OR, multiple requirement
 * objects) import the first mappable one with the others named in a
 * transform; combined schemes inside one requirement (AND) import the
 * first with the rest named — a request carries one auth config. An
 * authored requirement that maps to nothing lands `none`, NEVER
 * `inherit` (the D2 law — inheriting would silently substitute the
 * ancestor's auth for authored auth).
 */

import type { AuthConfig } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import { isRecord } from '../data-scan/json';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { RefResolver } from './ref';

type SchemeEntry =
  | { kind: 'auth'; build: (scopes: string[]) => AuthConfig }
  | { kind: 'dropped' }
  | { kind: 'unknown' };

export type SecuritySchemeTable = Map<string, SchemeEntry>;

export function buildSecuritySchemes(
  doc: Record<string, unknown>,
  resolver: RefResolver,
  report: ImportReport,
): SecuritySchemeTable {
  const table: SecuritySchemeTable = new Map();
  const components = isRecord(doc.components) ? doc.components : {};
  const rawSchemes = isRecord(components.securitySchemes) ? components.securitySchemes : {};
  for (const [name, rawScheme] of Object.entries(rawSchemes)) {
    const schemePath = `components.securitySchemes.${name}`;
    const resolved = resolver.resolve(rawScheme);
    if (!resolved.ok || !isRecord(resolved.value)) {
      recordDrop(report, { path: schemePath, reason: 'Security scheme is not a resolvable object — skipped.' });
      table.set(name, { kind: 'dropped' });
      continue;
    }
    table.set(name, buildScheme(resolved.value, schemePath, resolver, report));
  }
  return table;
}

function buildScheme(
  scheme: Record<string, unknown>,
  schemePath: string,
  resolver: RefResolver,
  report: ImportReport,
): SchemeEntry {
  const type = typeof scheme.type === 'string' ? scheme.type : '';
  switch (type) {
    case 'http':
      return buildHttpScheme(scheme, schemePath, report);
    case 'apiKey':
      return buildApiKeyScheme(scheme, schemePath, report);
    case 'oauth2':
      return buildOAuth2Scheme(scheme, schemePath, resolver, report);
    case 'openIdConnect':
      recordDrop(report, {
        path: schemePath,
        reason:
          "OpenID Connect scheme not imported — endpoint discovery from the issuer metadata is not supported; configure OAuth 2.0 with the provider's endpoints instead.",
        tracking: '#todo-openapi-oidc-discovery',
      });
      return { kind: 'dropped' };
    case 'mutualTLS':
      recordDrop(report, {
        path: schemePath,
        reason:
          'Mutual-TLS scheme not imported — client certificates are request settings, not an auth config; attach the certificate in the request settings after import.',
        tracking: 'PERMANENT: mTLS is a request setting',
      });
      return { kind: 'dropped' };
    default:
      recordDrop(report, {
        path: schemePath,
        reason: `Unknown security scheme type "${type}" — skipped.`,
        tracking: 'PERMANENT: auth picklist',
      });
      return { kind: 'unknown' };
  }
}

function buildHttpScheme(scheme: Record<string, unknown>, schemePath: string, report: ImportReport): SchemeEntry {
  const httpScheme = typeof scheme.scheme === 'string' ? scheme.scheme.toLowerCase() : '';
  if (httpScheme === 'basic') {
    return { kind: 'auth', build: () => ({ type: 'basic', username: '', password: '' }) };
  }
  if (httpScheme === 'bearer') {
    return { kind: 'auth', build: () => ({ type: 'bearer', token: '' }) };
  }
  if (httpScheme === 'digest') {
    return { kind: 'auth', build: () => ({ type: 'digest', username: '', password: '' }) };
  }
  recordDrop(report, {
    path: schemePath,
    reason: `HTTP auth scheme "${httpScheme || '(unset)'}" has no counterpart — skipped.`,
    tracking: 'PERMANENT: auth picklist',
  });
  return { kind: 'dropped' };
}

function buildApiKeyScheme(scheme: Record<string, unknown>, schemePath: string, report: ImportReport): SchemeEntry {
  const keyName = typeof scheme.name === 'string' ? scheme.name : '';
  const location = typeof scheme.in === 'string' ? scheme.in : '';
  if (location === 'header' || location === 'query') {
    return { kind: 'auth', build: () => ({ type: 'api-key', key: keyName, value: '', in: location }) };
  }
  recordDrop(report, {
    path: schemePath,
    reason:
      location === 'cookie'
        ? 'API key in a cookie not imported — cookies are session state the browser manages, not request authoring data.'
        : `API key location "${location || '(unset)'}" has no counterpart — skipped.`,
    tracking: location === 'cookie' ? 'PERMANENT: cookies out of scope' : 'PERMANENT: auth picklist',
  });
  return { kind: 'dropped' };
}

/** Flow preference when a scheme declares several. */
const OAUTH2_FLOW_ORDER = ['authorizationCode', 'clientCredentials', 'password'] as const;

function buildOAuth2Scheme(
  scheme: Record<string, unknown>,
  schemePath: string,
  resolver: RefResolver,
  report: ImportReport,
): SchemeEntry {
  const resolvedFlows = resolver.resolve(scheme.flows);
  const flows = resolvedFlows.ok && isRecord(resolvedFlows.value) ? resolvedFlows.value : {};

  if (isRecord(flows.implicit) && !OAUTH2_FLOW_ORDER.some((name) => isRecord(flows[name]))) {
    recordDrop(report, {
      path: schemePath,
      reason:
        'OAuth 2.0 "implicit" flow not imported — removed by OAuth 2.1 (fragment-delivered tokens, no refresh). Migrate the provider config to Authorization Code with PKCE.',
      tracking: 'PERMANENT: OAuth 2.0 implicit grant',
    });
    return { kind: 'dropped' };
  }

  const flowName = OAUTH2_FLOW_ORDER.find((name) => isRecord(flows[name]));
  if (flowName === undefined) {
    recordDrop(report, {
      path: schemePath,
      reason: 'OAuth 2.0 scheme declares no mappable flow — skipped.',
      tracking: '#todo-oauth-grants',
    });
    return { kind: 'dropped' };
  }
  const flow = flows[flowName] as Record<string, unknown>;

  const skipped = Object.keys(flows).filter((name) => name !== flowName && isRecord(flows[name]));
  if (skipped.length > 0) {
    recordTransform(report, {
      path: schemePath,
      from: `${skipped.length + 1} OAuth 2.0 flows`,
      to: flowName,
      reason: `One flow imports per scheme — ${flowName} was chosen; also declared: ${skipped.join(', ')}${skipped.includes('implicit') ? ' (implicit is removed by OAuth 2.1)' : ''}.`,
    });
  }

  const tokenUrl = typeof flow.tokenUrl === 'string' && flow.tokenUrl !== '' ? flow.tokenUrl : undefined;
  if (tokenUrl === undefined) {
    recordDrop(report, {
      path: schemePath,
      reason: `OAuth 2.0 ${flowName} flow not imported — the token URL is missing, and the flow cannot run without it.`,
      tracking: 'PERMANENT: OAuth 2.0 config completeness',
    });
    return { kind: 'dropped' };
  }
  const authorizationUrl =
    typeof flow.authorizationUrl === 'string' && flow.authorizationUrl !== '' ? flow.authorizationUrl : undefined;
  const refreshUrl = typeof flow.refreshUrl === 'string' && flow.refreshUrl !== '' ? flow.refreshUrl : undefined;
  const declaredScopes = isRecord(flow.scopes) ? Object.keys(flow.scopes) : [];

  recordTransform(report, {
    path: schemePath,
    from: 'oauth2 scheme without client credentials',
    to: '{{clientId}} / {{clientSecret}} placeholders',
    reason:
      'OpenAPI documents describe the provider, not your registration — fill the client id (and secret, if confidential) before the first token exchange.',
  });

  return {
    kind: 'auth',
    build: (requirementScopes) => ({
      type: 'oauth2',
      credentialRef: generateUid(),
      ...(flowName === 'authorizationCode'
        ? { flow: 'authorization-code-pkce' as const, grantType: 'authorization-code' as const }
        : flowName === 'clientCredentials'
          ? { flow: 'client-credentials' as const }
          : { flow: 'password-credentials' as const }),
      ...(authorizationUrl !== undefined ? { authorizationEndpoint: authorizationUrl } : {}),
      tokenEndpoint: tokenUrl,
      ...(refreshUrl !== undefined && refreshUrl !== tokenUrl ? { refreshEndpoint: refreshUrl } : {}),
      clientId: '{{clientId}}',
      clientSecret: '{{clientSecret}}',
      scopes: requirementScopes.length > 0 ? requirementScopes : declaredScopes,
    }),
  };
}

/**
 * Resolve a `security` requirement list to one auth config.
 * `undefined` = the list itself was absent/unusable (caller decides
 * inherit/none); an authored-but-unmappable list resolves to `none`.
 */
export function resolveSecurityRequirements(
  rawRequirements: unknown[],
  table: SecuritySchemeTable,
  jsonPath: string,
  report: ImportReport,
): AuthConfig | undefined {
  const requirements = rawRequirements.filter(isRecord);
  if (requirements.length === 0) return undefined;

  if (requirements.length > 1) {
    const alternatives = requirements
      .slice(1)
      .map((req) => Object.keys(req).join(' + ') || '(empty)')
      .join(', ');
    recordTransform(report, {
      path: jsonPath,
      from: `${requirements.length} alternative security requirements`,
      to: 'first requirement',
      reason: `A request carries one auth config — the first requirement was imported; alternatives: ${alternatives}.`,
    });
  }

  const requirement = requirements[0];
  const names = Object.keys(requirement);
  // The empty requirement object `{}` means "optional auth" — nothing
  // to configure, an honest none.
  if (names.length === 0) return { type: 'none' };

  const mappableName = names.find((name) => table.get(name)?.kind === 'auth');
  if (mappableName === undefined) {
    // Every named scheme already dropped (with its reason) at
    // table-build time; authored security still never inherits.
    return { type: 'none' };
  }
  if (names.length > 1) {
    recordTransform(report, {
      path: jsonPath,
      from: `combined schemes ${names.join(' + ')}`,
      to: mappableName,
      reason: `A request carries one auth config — "${mappableName}" was imported; combine the others via headers if the API requires them together.`,
    });
  }
  const entry = table.get(mappableName) as Extract<SchemeEntry, { kind: 'auth' }>;
  const scopes = Array.isArray(requirement[mappableName])
    ? (requirement[mappableName] as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  return entry.build(scopes);
}
