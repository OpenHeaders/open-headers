/**
 * `REQUEST_SCHEMA` — declarative field-tree descriptor for `Request`.
 *
 * Closes the field-tree epic by replacing the hand-rolled
 * tracking + resolve adapters in `request-conflict-adapter.ts` with a
 * single descriptor. Auth + Body on Request used to track as opaque
 * stable-stringified scalars at `auth` / `body`; declaring them as
 * discriminated unions surfaces per-leaf conflicts inside the active
 * branch (oauth2 token endpoint, json content, multipart parts) the
 * same way every other entity tracks per-leaf data through the walker.
 *
 * Entity-root scalars + uid-keyed `headers` / `params` sets pass
 * through the walker unchanged. Auth + Body each emit a `union:auth` /
 * `union:body` divergence marker so kind transitions (e.g. `none` →
 * `oauth2`) collapse to one structural conflict instead of N noisy
 * per-leaf entries that don't apply to the new branch.
 */

import { enumLeaf, type FieldNode, leaf, obj, setByUid, union } from './descriptor';

const summarizeKv =
  (label: 'header' | 'param' | 'extra' | 'form' | 'multipart-text') =>
  (row: unknown): string => {
    const r = row as { key?: string; value?: string; name?: string };
    if (label === 'header') return `${r.key ?? ''}: ${r.value ?? ''}`;
    if (label === 'param') return `${r.key ?? ''}=${r.value ?? ''}`;
    if (label === 'form') return `${r.key ?? ''}=${r.value ?? ''}`;
    if (label === 'extra') return `${r.key ?? ''}=${r.value ?? ''}`;
    // multipart text
    return `${r.name ?? ''}=${r.value ?? ''}`;
  };

const HEADER_ROW: FieldNode = obj({
  key: leaf('string'),
  value: leaf('string'),
  description: leaf('string', { coercion: 'optional-string' }),
  enabled: leaf('boolean', { coercion: 'enabled-default-true' }),
});

const PARAM_ROW: FieldNode = obj({
  key: leaf('string'),
  value: leaf('string'),
  description: leaf('string', { coercion: 'optional-string' }),
  enabled: leaf('boolean', { coercion: 'enabled-default-true' }),
  hasEquals: leaf('boolean', { coercion: 'boolean-strict', baseline: 'skip' }),
});

const EXTRA_PARAM_ROW: FieldNode = obj({
  key: leaf('string'),
  value: leaf('string'),
});

const extraParamSet: FieldNode = setByUid({
  summary: summarizeKv('extra'),
  child: EXTRA_PARAM_ROW,
});

const AUTH_UNION: FieldNode = union({
  discriminator: 'type',
  kindTransitionUnsafe: true,
  divergenceLabel: 'Authorization type',
  emitDivergenceKey: true,
  branches: {
    none: obj({}),
    inherit: obj({}),
    basic: obj({
      username: leaf('string'),
      password: leaf('string'),
    }),
    bearer: obj({
      token: leaf('string'),
    }),
    'api-key': obj({
      key: leaf('string'),
      value: leaf('string'),
      in: enumLeaf(['header', 'query']),
    }),
    oauth2: obj({
      credentialRef: leaf('string'),
      providerPresetId: leaf('string', { coercion: 'optional-string' }),
      flow: enumLeaf(['authorization-code-pkce', 'client-credentials', 'device-code']),
      grantType: leaf('string', { coercion: 'optional-string' }),
      authorizationEndpoint: leaf('string', { coercion: 'optional-string' }),
      tokenEndpoint: leaf('string'),
      deviceAuthorizationEndpoint: leaf('string', { coercion: 'optional-string' }),
      clientId: leaf('string'),
      clientSecret: leaf('string', { coercion: 'optional-string' }),
      scopes: leaf('string', { coercion: 'array-comma-space-join' }),
      label: leaf('string', { coercion: 'optional-string' }),
      refreshEndpoint: leaf('string', { coercion: 'optional-string' }),
      clientAuthentication: leaf('string', { coercion: 'optional-string' }),
      sendAs: leaf('string', { coercion: 'optional-string' }),
      extraAuthParams: extraParamSet,
      extraTokenParams: extraParamSet,
      extraRefreshParams: extraParamSet,
    }),
  },
});

const FORM_FIELD_ROW: FieldNode = obj({
  key: leaf('string'),
  value: leaf('string'),
  description: leaf('string', { coercion: 'optional-string' }),
  enabled: leaf('boolean', { coercion: 'enabled-default-true' }),
});

const MULTIPART_PART_ROW: FieldNode = union({
  discriminator: 'kind',
  kindTransitionUnsafe: false,
  branches: {
    text: obj({
      name: leaf('string'),
      value: leaf('string'),
      description: leaf('string', { coercion: 'optional-string' }),
      enabled: leaf('boolean', { coercion: 'enabled-default-true' }),
    }),
    file: obj({
      name: leaf('string'),
      description: leaf('string', { coercion: 'optional-string' }),
      enabled: leaf('boolean', { coercion: 'enabled-default-true' }),
    }),
  },
});

const BODY_UNION: FieldNode = union({
  discriminator: 'type',
  kindTransitionUnsafe: true,
  divergenceLabel: 'Body type',
  emitDivergenceKey: true,
  branches: {
    none: obj({}),
    json: obj({ content: leaf('string') }),
    xml: obj({ content: leaf('string') }),
    text: obj({
      content: leaf('string'),
      rawFormat: leaf('string', { coercion: 'optional-string' }),
    }),
    form: obj({
      formParts: setByUid({ summary: summarizeKv('form'), child: FORM_FIELD_ROW }),
    }),
    multipart: obj({
      multipartParts: setByUid({ summary: summarizeKv('multipart-text'), child: MULTIPART_PART_ROW }),
    }),
    graphql: obj({
      content: leaf('string'),
      graphqlVariables: leaf('string', { coercion: 'optional-string' }),
    }),
  },
});

export const REQUEST_SCHEMA: FieldNode = obj({
  name: leaf('string'),
  description: leaf('string', { coercion: 'optional-string' }),
  url: leaf('string'),
  method: leaf('string'),
  credentialsMode: leaf('string', { coercion: 'optional-string' }),
  followRedirects: leaf('boolean', { coercion: 'boolean-strict' }),
  sslVerification: leaf('boolean', { coercion: 'boolean-strict' }),
  timeoutMs: leaf('number', { coercion: 'optional-number' }),
  maxResponseBytes: leaf('number', { coercion: 'optional-number' }),
  preRequestScript: leaf('string', { coercion: 'optional-string' }),
  postResponseScript: leaf('string', { coercion: 'optional-string' }),
  headers: setByUid({ summary: summarizeKv('header'), child: HEADER_ROW }),
  params: setByUid({ summary: summarizeKv('param'), child: PARAM_ROW }),
  auth: AUTH_UNION,
  body: BODY_UNION,
});
