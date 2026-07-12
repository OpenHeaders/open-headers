/**
 * Canonical schema-aligned field-path generators for `Request`.
 *
 * Awareness publishing + per-path conflict tracking key off these
 * strings; peers must agree on the encoding for chips to render.
 *
 * Set rows (`headers`, `params`) are uid-keyed — `RequestHeaderSchema`
 * + `QueryParamSchema` persist a stable per-row uid (§7.2 LWW per
 * itemId, §7.3 moveBefore via fractional indexing on the parent's
 * order array). Index-based row paths would shift on reorder + collide
 * across surfaces; uid-based paths preserve identity across the
 * editor / sidebar / future inspector triple.
 *
 * Tab keys map to the canonical entity-root path each tab's focus
 * collapses to when no specific input inside it is focused — the
 * editor falls back to this when the active cell isn't tagged with a
 * sub-row marker.
 */

export interface RequestPathBundle {
  // Entity-root scalar leaves.
  name: string;
  description: string;
  url: string;
  method: string;
  auth: string;
  body: string;
  credentialsMode: string;
  followRedirects: string;
  sslVerification: string;
  tlsMinVersion: string;
  tlsMaxVersion: string;
  tlsCipherSuites: string;
  timeoutMs: string;
  maxResponseBytes: string;
  maxRedirects: string;
  followOriginalHttpMethod: string;
  followAuthorizationHeader: string;
  preRequestScript: string;
  postResponseScript: string;
  // Set roots (used for path-prefix presence + set-level conflict keys).
  headerSet: string;
  paramSet: string;
  // Per-row generators.
  header(uid: string, leaf: 'key' | 'value' | 'description' | 'enabled'): string;
  param(uid: string, leaf: 'key' | 'value' | 'description' | 'enabled' | 'hasEquals'): string;
}

export const REQUEST_PATHS: RequestPathBundle = {
  name: 'name',
  description: 'description',
  url: 'url',
  method: 'method',
  auth: 'auth',
  body: 'body',
  credentialsMode: 'credentialsMode',
  followRedirects: 'followRedirects',
  sslVerification: 'sslVerification',
  tlsMinVersion: 'tlsMinVersion',
  tlsMaxVersion: 'tlsMaxVersion',
  tlsCipherSuites: 'tlsCipherSuites',
  timeoutMs: 'timeoutMs',
  maxResponseBytes: 'maxResponseBytes',
  maxRedirects: 'maxRedirects',
  followOriginalHttpMethod: 'followOriginalHttpMethod',
  followAuthorizationHeader: 'followAuthorizationHeader',
  preRequestScript: 'preRequestScript',
  postResponseScript: 'postResponseScript',
  headerSet: 'headers',
  paramSet: 'params',
  header: (uid, leaf) => `headers.${uid}.${leaf}`,
  param: (uid, leaf) => `params.${uid}.${leaf}`,
};

export type RequestTabKey = 'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings';
