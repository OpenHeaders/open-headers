/**
 * GraphQL request editor draft — the form-local shape plus the
 * draft ⇄ entity projections. Mirrors the MQTT editor's `draft.ts`
 * anatomy: `draftFromGraphqlRequest` populates the form,
 * `buildGraphqlRequestUpdates` emits the save patch, and
 * `canonicalGraphqlRequestProjection` projects the live entity into
 * the same shape so the dirty fingerprint compares apples-to-apples
 * (derived dirty — never setDirty).
 *
 * The HTTP settings knobs are TRI-STATE on the form (`undefined` = the
 * chain's value or the runtime default, an explicit value = the
 * request's own — the settings-inheritance law): the form carries the
 * entity's value as it is, the save patch writes an explicit value
 * only while the form holds one and clears the leaf when it does not
 * (the update builder tombstones a stored slot on an explicit
 * `undefined`). The HTTP script pair follows the HTTP editor: a blank
 * slot saves as absent, so the sibling file goes with it.
 */

import { HTTP_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type { GraphqlAuth, GraphqlRequest, RequestHeader, RequestSpecLink } from '@openheaders/core/types';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';
import type { RequestSettingsDraft } from '../request-editor/SettingsTab';

export interface GraphqlDraft extends RequestSettingsDraft {
  /** Docs-tab markdown; always concrete in the form (`''` = no docs). */
  description: string;
  url: string;
  /** The document — the Query tab's editor text. */
  query: string;
  /** The Variables drawer's JSON text; `''` = no variables (absent on the entity). */
  variables: string;
  /** The operation pick; `''` = the document's only operation (absent on the entity). */
  operationName: string;
  /** Header rows ride the shared KeyValueTable shape (a trailing ghost
   *  row trims away in the save projection). */
  headers: KeyValueRow[];
  auth: GraphqlAuth;
  specLink: RequestSpecLink | undefined;
  preRequestScript: string;
  postResponseScript: string;
}

export interface GraphqlRequestUpdates extends RequestSettingsDraft {
  description: string;
  url: string;
  query: string;
  variables: string | undefined;
  operationName: string | undefined;
  headers: RequestHeader[];
  auth: GraphqlAuth;
  specLink: RequestSpecLink | undefined;
  preRequestScript: string | undefined;
  postResponseScript: string | undefined;
}

export function headersToRows(rows: readonly RequestHeader[]): KeyValueRow[] {
  return rows.map((row) =>
    makeKvRow({
      uid: row.uid,
      key: row.key,
      value: row.value,
      description: row.description ?? '',
      enabled: row.enabled ?? true,
    }),
  );
}

export function rowsToHeaders(rows: KeyValueRow[]): RequestHeader[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      ...(r.description?.trim() ? { description: r.description } : {}),
      enabled: r.enabled,
    }));
}

/** The settings knobs off the entity or the draft — the same optional
 *  scalars, verbatim (explicit wins on the ancestor plane). */
export function graphqlSettingsSlice(source: RequestSettingsDraft): RequestSettingsDraft {
  const out: RequestSettingsDraft = {};
  for (const key of HTTP_INHERITABLE_SETTING_KEYS) {
    const value = source[key];
    if (value !== undefined) Object.assign(out, { [key]: value });
  }
  return out;
}

export function emptyGraphqlDraft(): GraphqlDraft {
  return {
    description: '',
    url: '',
    query: '',
    variables: '',
    operationName: '',
    headers: [],
    auth: { type: 'inherit' },
    specLink: undefined,
    preRequestScript: '',
    postResponseScript: '',
  };
}

export function draftFromGraphqlRequest(req: GraphqlRequest): GraphqlDraft {
  return {
    ...graphqlSettingsSlice(req),
    description: req.description ?? '',
    url: req.url,
    query: req.query,
    variables: req.variables ?? '',
    operationName: req.operationName ?? '',
    headers: headersToRows(req.headers),
    auth: req.auth,
    specLink: req.specLink,
    preRequestScript: req.preRequestScript ?? '',
    postResponseScript: req.postResponseScript ?? '',
  };
}

/** A blank script slot is absent — no file, no slot (the HTTP editor's law). */
const presentScript = (source: string): string | undefined => (source.trim() === '' ? undefined : source);

export function buildGraphqlRequestUpdates(draft: GraphqlDraft): GraphqlRequestUpdates {
  const settings = graphqlSettingsSlice(draft);
  const explicit = (key: keyof RequestSettingsDraft): boolean => settings[key] !== undefined;
  return {
    // Every knob is present on the patch: an explicit value writes the
    // request's own, `undefined` clears a stored one (the tri-state).
    credentialsMode: settings.credentialsMode,
    followRedirects: settings.followRedirects,
    sslVerification: settings.sslVerification,
    tlsMinVersion: settings.tlsMinVersion,
    tlsMaxVersion: settings.tlsMaxVersion,
    tlsCipherSuites: settings.tlsCipherSuites,
    sniServerName: settings.sniServerName,
    httpVersion: settings.httpVersion,
    resolveToAddress: settings.resolveToAddress,
    clientCertificateRef: settings.clientCertificateRef,
    proxyMode: settings.proxyMode,
    proxyUrl: explicit('proxyMode') ? settings.proxyUrl : undefined,
    proxyCredentialRef: explicit('proxyMode') ? settings.proxyCredentialRef : undefined,
    unixSocketPath: settings.unixSocketPath,
    cookieJar: settings.cookieJar,
    timeoutMs: settings.timeoutMs,
    maxResponseBytes: settings.maxResponseBytes,
    maxRedirects: settings.maxRedirects,
    followOriginalHttpMethod: settings.followOriginalHttpMethod,
    followAuthorizationHeader: settings.followAuthorizationHeader,
    description: draft.description,
    url: draft.url,
    query: draft.query,
    variables: draft.variables === '' ? undefined : draft.variables,
    operationName: draft.operationName === '' ? undefined : draft.operationName,
    headers: rowsToHeaders(draft.headers),
    auth: draft.auth,
    specLink: draft.specLink,
    preRequestScript: presentScript(draft.preRequestScript),
    postResponseScript: presentScript(draft.postResponseScript),
  };
}

/** Project a live `GraphqlRequest` into the same shape
 *  `buildGraphqlRequestUpdates` emits — fingerprint comparison stays
 *  apples-to-apples. */
export function canonicalGraphqlRequestProjection(req: GraphqlRequest): GraphqlRequestUpdates {
  return buildGraphqlRequestUpdates(draftFromGraphqlRequest(req));
}

/**
 * The full-fidelity entity the executor channel consumes, off the LIVE
 * draft — Query (and introspection) test-fire without persisting,
 * exactly like the HTTP editor's Send. The identity is the saved
 * entity's (the SAME uid + path, so the ancestor chain resolves off the
 * tree unchanged); an absent leaf stays absent (the save projection's
 * `undefined` never lands on the wire shape).
 */
export function draftEntity(entity: GraphqlRequest, draft: GraphqlDraft): GraphqlRequest {
  const updates = buildGraphqlRequestUpdates(draft);
  return {
    schemaVersion: entity.schemaVersion,
    uid: entity.uid,
    path: entity.path,
    ...(entity.pathSegment !== undefined ? { pathSegment: entity.pathSegment } : {}),
    name: entity.name,
    ...(updates.description !== '' ? { description: updates.description } : {}),
    url: updates.url,
    query: updates.query,
    ...(updates.variables !== undefined ? { variables: updates.variables } : {}),
    ...(updates.operationName !== undefined ? { operationName: updates.operationName } : {}),
    headers: updates.headers,
    auth: updates.auth,
    ...(updates.specLink !== undefined ? { specLink: updates.specLink } : {}),
    ...graphqlSettingsSlice(updates),
    ...(updates.preRequestScript !== undefined ? { preRequestScript: updates.preRequestScript } : {}),
    ...(updates.postResponseScript !== undefined ? { postResponseScript: updates.postResponseScript } : {}),
  };
}
