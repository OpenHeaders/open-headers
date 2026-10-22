/**
 * Pure collector for every templatable string in an auth config — the
 * one auth walk the HTTP scan and the session-kind scans (WebSocket,
 * gRPC, MQTT, GraphQL) share: each kind's own auth type is a checked
 * subset of `AuthConfig` (`requestAuthSchemaFor`), so one exhaustive
 * switch serves them all and the kinds can never drift on which
 * credential fields the executors feed through `resolveTemplate`.
 *
 * `inherit` carries no strings of its own — the ancestor pool's entry
 * resolves at the executor against the chain, never here.
 */

import type { AuthConfig } from '../types';

export function collectAuthTemplateStrings(auth: AuthConfig, out: string[]): void {
  switch (auth.type) {
    case 'none':
    case 'inherit':
      break;
    case 'basic':
      if (auth.username) out.push(auth.username);
      if (auth.password) out.push(auth.password);
      break;
    case 'bearer':
      if (auth.token) out.push(auth.token);
      break;
    case 'api-key':
      if (auth.key) out.push(auth.key);
      if (auth.value) out.push(auth.value);
      break;
    case 'oauth2':
      // OAuth2 config fields are not user-templated — the credential
      // ref is an opaque handle; the tokens are fetched, not templated.
      break;
    case 'aws-sigv4':
      // Every SigV4 field is templatable — `{{vault.aws_secret}}` is
      // the expected idiom for the key material.
      if (auth.accessKeyId) out.push(auth.accessKeyId);
      if (auth.secretAccessKey) out.push(auth.secretAccessKey);
      if (auth.sessionToken) out.push(auth.sessionToken);
      if (auth.service) out.push(auth.service);
      if (auth.region) out.push(auth.region);
      break;
    case 'digest':
      if (auth.username) out.push(auth.username);
      if (auth.password) out.push(auth.password);
      break;
    case 'oauth1':
      // Credential fields are templatable — `{{vault.consumer_secret}}`
      // is the expected idiom for the key material.
      if (auth.consumerKey) out.push(auth.consumerKey);
      if (auth.consumerSecret) out.push(auth.consumerSecret);
      if (auth.token) out.push(auth.token);
      if (auth.tokenSecret) out.push(auth.tokenSecret);
      if (auth.privateKey) out.push(auth.privateKey);
      if (auth.realm) out.push(auth.realm);
      break;
    case 'edgegrid':
      // Credential fields are templatable — `{{vault.akamai_secret}}`
      // is the expected idiom; the header list too.
      if (auth.clientToken) out.push(auth.clientToken);
      if (auth.accessToken) out.push(auth.accessToken);
      if (auth.clientSecret) out.push(auth.clientSecret);
      if (auth.headersToSign) out.push(auth.headersToSign);
      break;
    case 'asap':
      // Every string field is templatable — `{{vault.asap_key}}` for
      // the key material, a templated claims JSON for the rest.
      if (auth.issuer) out.push(auth.issuer);
      if (auth.audience) out.push(auth.audience);
      if (auth.keyId) out.push(auth.keyId);
      if (auth.privateKey) out.push(auth.privateKey);
      if (auth.subject) out.push(auth.subject);
      if (auth.claims) out.push(auth.claims);
      break;
    case 'hawk':
      // Credential fields are templatable — `{{vault.hawk_key}}` is
      // the expected idiom for the key material.
      if (auth.authId) out.push(auth.authId);
      if (auth.authKey) out.push(auth.authKey);
      if (auth.ext) out.push(auth.ext);
      if (auth.app) out.push(auth.app);
      if (auth.dlg) out.push(auth.dlg);
      break;
    case 'jwt':
      // Key material, claims, and headers are all templatable —
      // `{{vault.private_key}}` and a `{{dynamic.timestamp}}` claim
      // are the expected idioms.
      if (auth.secret) out.push(auth.secret);
      if (auth.privateKey) out.push(auth.privateKey);
      if (auth.payload) out.push(auth.payload);
      if (auth.headers) out.push(auth.headers);
      if (auth.headerPrefix) out.push(auth.headerPrefix);
      break;
    case 'http-signature':
      // Key material and the identifiers are templatable —
      // `{{vault.signing_key}}` is the expected idiom; the covered
      // list and the label are configuration text, templatable too.
      if (auth.secret) out.push(auth.secret);
      if (auth.privateKey) out.push(auth.privateKey);
      if (auth.keyId) out.push(auth.keyId);
      if (auth.components) out.push(auth.components);
      if (auth.label) out.push(auth.label);
      if (auth.tag) out.push(auth.tag);
      break;
  }
}

/** A key / value row with the shared enabled switch — header, query,
 *  metadata and user-property rows all wear this shape. */
export interface TemplatePairRow {
  key: string;
  value: string;
  enabled?: boolean;
}

/**
 * The key and value templates of every row the wire carries — a row
 * switched off never hits it, so its templates never resolve and must
 * not count (the executors' shared filter).
 */
export function collectPairTemplateStrings(rows: readonly TemplatePairRow[], out: string[]): void {
  for (const row of rows) {
    if (row.enabled === false) continue;
    if (row.key) out.push(row.key);
    if (row.value) out.push(row.value);
  }
}
