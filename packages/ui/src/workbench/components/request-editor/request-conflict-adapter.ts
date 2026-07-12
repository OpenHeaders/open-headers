/**
 * `ConflictTrackingAdapter<Request>` + `ConflictResolveAdapter<Request>`
 * — declarative wiring on top of the field-tree walker.
 *
 * Tracking + entity-side resolution come from `makeConflictAdapter` over
 * `REQUEST_SCHEMA` (entity root scalars + uid-keyed `headers` / `params`
 * sets + discriminated `auth` / `body` unions with per-leaf coverage).
 * The form-side resolver is a no-op — RequestEditor uses controlled
 * state, not antd Form, so resolution writes go through
 * `applyResolutionToEntity` against a request clone and the editor
 * projects back into its draft shape.
 *
 * `prettyPath` keeps a hand-rolled label table for entity-root scalars
 * + per-row leaves; auth + body sub-leaves fall through to a tail-based
 * default until a richer label set is needed.
 */

import type { Request } from '@openheaders/core/types';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
} from '@openheaders/ui/shared/conflicts/conflict-adapters';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';
import { REQUEST_SCHEMA } from '@openheaders/ui/shared/conflicts/field-tree/request-schema';

const HEADER_PATH_RE = /^headers\.([a-z0-9]{8})\.(key|value|description|enabled)$/;
const PARAM_PATH_RE = /^params\.([a-z0-9]{8})\.(key|value|description|enabled|hasEquals)$/;

type HeaderLeaf = 'key' | 'value' | 'description' | 'enabled';
type ParamLeaf = HeaderLeaf | 'hasEquals';

const SCALAR_LABEL: Record<string, string> = {
  [REQUEST_PATHS.name]: 'Name',
  [REQUEST_PATHS.description]: 'Description',
  [REQUEST_PATHS.url]: 'URL',
  [REQUEST_PATHS.method]: 'Method',
  [REQUEST_PATHS.auth]: 'Authorization',
  [REQUEST_PATHS.body]: 'Body',
  [REQUEST_PATHS.credentialsMode]: 'Credentials mode',
  [REQUEST_PATHS.followRedirects]: 'Follow redirects',
  [REQUEST_PATHS.sslVerification]: 'SSL verification',
  [REQUEST_PATHS.tlsMinVersion]: 'TLS version minimum',
  [REQUEST_PATHS.tlsMaxVersion]: 'TLS version maximum',
  [REQUEST_PATHS.tlsCipherSuites]: 'TLS cipher suites',
  [REQUEST_PATHS.allowHttp2]: 'Allow HTTP/2',
  [REQUEST_PATHS.resolveToAddress]: 'Resolve to address',
  [REQUEST_PATHS.timeoutMs]: 'Request timeout',
  [REQUEST_PATHS.maxResponseBytes]: 'Response size limit',
  [REQUEST_PATHS.maxRedirects]: 'Maximum redirects',
  [REQUEST_PATHS.followOriginalHttpMethod]: 'Follow original HTTP method',
  [REQUEST_PATHS.followAuthorizationHeader]: 'Follow Authorization header',
  [REQUEST_PATHS.preRequestScript]: 'Pre-request script',
  [REQUEST_PATHS.postResponseScript]: 'Post-response script',
};

const HEADER_LEAF_LABEL: Record<HeaderLeaf, string> = {
  key: 'name',
  value: 'value',
  description: 'description',
  enabled: 'enabled',
};
const PARAM_LEAF_LABEL: Record<ParamLeaf, string> = {
  key: 'name',
  value: 'value',
  description: 'description',
  enabled: 'enabled',
  hasEquals: 'separator',
};

function findHeaderName(req: Request, uid: string): string | null {
  return req.headers?.find((h) => h.uid === uid)?.key ?? null;
}
function findParamName(req: Request, uid: string): string | null {
  return req.params?.find((p) => p.uid === uid)?.key ?? null;
}

function setPathSummary(setPath: string): string {
  if (setPath === REQUEST_PATHS.headerSet) return 'Header';
  if (setPath === REQUEST_PATHS.paramSet) return 'Query param';
  return setPath;
}

const walker = makeConflictAdapter<Request>({
  schema: REQUEST_SCHEMA,
  signature: (r) => r.uid,
});

export const requestConflictAdapter: ConflictTrackingAdapter<Request> = walker.tracking;

export const requestResolveAdapter: ConflictResolveAdapter<Request> = {
  applyResolutionToForm: () => false,
  applyResolutionToEntity: (req, path, conflict) => walker.resolve.applyResolutionToEntity(req, path, conflict),
  prettyPath(req, path) {
    if (path.startsWith('reorder:')) {
      const setPath = path.slice('reorder:'.length);
      return `${setPathSummary(setPath)}s — order changed`;
    }
    if (path.startsWith('set:')) {
      const m = /^set:(.+)\.([a-z0-9]{8})$/.exec(path);
      if (!m) return path;
      const setPath = m[1];
      const uid = m[2];
      const kind = setPathSummary(setPath);
      if (setPath === REQUEST_PATHS.headerSet) {
        const name = findHeaderName(req, uid);
        return name ? `${kind} ${name}` : kind;
      }
      if (setPath === REQUEST_PATHS.paramSet) {
        const name = findParamName(req, uid);
        return name ? `${kind} ${name}` : kind;
      }
      return kind;
    }
    if (path.startsWith('union:')) {
      const prefix = path.slice('union:'.length);
      if (prefix === REQUEST_PATHS.auth) return 'Authorization type';
      if (prefix === REQUEST_PATHS.body) return 'Body type';
      return prefix;
    }
    if (SCALAR_LABEL[path]) return SCALAR_LABEL[path];
    const headerMatch = HEADER_PATH_RE.exec(path);
    if (headerMatch) {
      const uid = headerMatch[1];
      const leaf = headerMatch[2] as HeaderLeaf;
      const name = findHeaderName(req, uid);
      const label = HEADER_LEAF_LABEL[leaf];
      return name ? `Header ${name} (${label})` : `Header (${label})`;
    }
    const paramMatch = PARAM_PATH_RE.exec(path);
    if (paramMatch) {
      const uid = paramMatch[1];
      const leaf = paramMatch[2] as ParamLeaf;
      const name = findParamName(req, uid);
      const label = PARAM_LEAF_LABEL[leaf];
      return name ? `Query param ${name} (${label})` : `Query param (${label})`;
    }
    if (path.startsWith(`${REQUEST_PATHS.auth}.`)) {
      return `Authorization · ${path.slice(REQUEST_PATHS.auth.length + 1)}`;
    }
    if (path.startsWith(`${REQUEST_PATHS.body}.`)) {
      return `Body · ${path.slice(REQUEST_PATHS.body.length + 1)}`;
    }
    return path;
  },
};
