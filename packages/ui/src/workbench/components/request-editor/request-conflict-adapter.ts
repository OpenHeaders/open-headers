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
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
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

const SCALAR_LABEL: Record<string, MessageKey> = {
  [REQUEST_PATHS.name]: 'shared.conflicts.label.request.scalar.name',
  [REQUEST_PATHS.description]: 'shared.conflicts.label.request.scalar.description',
  [REQUEST_PATHS.url]: 'shared.conflicts.label.request.scalar.url',
  [REQUEST_PATHS.method]: 'shared.conflicts.label.request.scalar.method',
  [REQUEST_PATHS.auth]: 'shared.conflicts.label.request.scalar.auth',
  [REQUEST_PATHS.body]: 'shared.conflicts.label.request.scalar.body',
  [REQUEST_PATHS.credentialsMode]: 'shared.conflicts.label.request.scalar.credentialsMode',
  [REQUEST_PATHS.followRedirects]: 'shared.conflicts.label.request.scalar.followRedirects',
  [REQUEST_PATHS.sslVerification]: 'shared.conflicts.label.request.scalar.sslVerification',
  [REQUEST_PATHS.tlsMinVersion]: 'shared.conflicts.label.request.scalar.tlsMinVersion',
  [REQUEST_PATHS.tlsMaxVersion]: 'shared.conflicts.label.request.scalar.tlsMaxVersion',
  [REQUEST_PATHS.tlsCipherSuites]: 'shared.conflicts.label.request.scalar.tlsCipherSuites',
  [REQUEST_PATHS.httpVersion]: 'shared.conflicts.label.request.scalar.httpVersion',
  [REQUEST_PATHS.resolveToAddress]: 'shared.conflicts.label.request.scalar.resolveToAddress',
  [REQUEST_PATHS.clientCertificateRef]: 'shared.conflicts.label.request.scalar.clientCertificateRef',
  [REQUEST_PATHS.proxyUrl]: 'shared.conflicts.label.request.scalar.proxyUrl',
  [REQUEST_PATHS.proxyCredentialRef]: 'shared.conflicts.label.request.scalar.proxyCredentialRef',
  [REQUEST_PATHS.unixSocketPath]: 'shared.conflicts.label.request.scalar.unixSocketPath',
  [REQUEST_PATHS.cookieJar]: 'shared.conflicts.label.request.scalar.cookieJar',
  [REQUEST_PATHS.timeoutMs]: 'shared.conflicts.label.request.scalar.timeoutMs',
  [REQUEST_PATHS.maxResponseBytes]: 'shared.conflicts.label.request.scalar.maxResponseBytes',
  [REQUEST_PATHS.maxRedirects]: 'shared.conflicts.label.request.scalar.maxRedirects',
  [REQUEST_PATHS.followOriginalHttpMethod]: 'shared.conflicts.label.request.scalar.followOriginalHttpMethod',
  [REQUEST_PATHS.followAuthorizationHeader]: 'shared.conflicts.label.request.scalar.followAuthorizationHeader',
  [REQUEST_PATHS.preRequestScript]: 'shared.conflicts.label.request.scalar.preRequestScript',
  [REQUEST_PATHS.postResponseScript]: 'shared.conflicts.label.request.scalar.postResponseScript',
};

const HEADER_LEAF_LABEL: Record<HeaderLeaf, MessageKey> = {
  key: 'shared.conflicts.label.request.headerField.key',
  value: 'shared.conflicts.label.request.headerField.value',
  description: 'shared.conflicts.label.request.headerField.description',
  enabled: 'shared.conflicts.label.request.headerField.enabled',
};
const PARAM_LEAF_LABEL: Record<ParamLeaf, MessageKey> = {
  key: 'shared.conflicts.label.request.paramField.key',
  value: 'shared.conflicts.label.request.paramField.value',
  description: 'shared.conflicts.label.request.paramField.description',
  enabled: 'shared.conflicts.label.request.paramField.enabled',
  hasEquals: 'shared.conflicts.label.request.paramField.hasEquals',
};

function findHeaderName(req: Request, uid: string): string | null {
  return req.headers?.find((h) => h.uid === uid)?.key ?? null;
}
function findParamName(req: Request, uid: string): string | null {
  return req.params?.find((p) => p.uid === uid)?.key ?? null;
}

function setPathSummary(t: Translate, setPath: string): string {
  if (setPath === REQUEST_PATHS.headerSet) return t('shared.conflicts.label.request.set.header');
  if (setPath === REQUEST_PATHS.paramSet) return t('shared.conflicts.label.request.set.queryParam');
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
  prettyPath(t, req, path) {
    if (path.startsWith('reorder:')) {
      const setPath = path.slice('reorder:'.length);
      return t('shared.conflicts.label.request.orderChanged', { set: setPathSummary(t, setPath) });
    }
    if (path.startsWith('set:')) {
      const m = /^set:(.+)\.([a-z0-9]{8})$/.exec(path);
      if (!m) return path;
      const setPath = m[1];
      const uid = m[2];
      const kind = setPathSummary(t, setPath);
      if (setPath === REQUEST_PATHS.headerSet) {
        const name = findHeaderName(req, uid);
        return name ? t('shared.conflicts.label.request.setRowNamed', { kind, name }) : kind;
      }
      if (setPath === REQUEST_PATHS.paramSet) {
        const name = findParamName(req, uid);
        return name ? t('shared.conflicts.label.request.setRowNamed', { kind, name }) : kind;
      }
      return kind;
    }
    if (path.startsWith('union:')) {
      const prefix = path.slice('union:'.length);
      if (prefix === REQUEST_PATHS.auth) return t('shared.conflicts.label.request.unionAuth');
      if (prefix === REQUEST_PATHS.body) return t('shared.conflicts.label.request.unionBody');
      return prefix;
    }
    if (SCALAR_LABEL[path]) return t(SCALAR_LABEL[path]);
    const headerMatch = HEADER_PATH_RE.exec(path);
    if (headerMatch) {
      const uid = headerMatch[1];
      const leaf = headerMatch[2] as HeaderLeaf;
      const name = findHeaderName(req, uid);
      const label = t(HEADER_LEAF_LABEL[leaf]);
      return name
        ? t('shared.conflicts.label.request.headerLeafNamed', { name, leaf: label })
        : t('shared.conflicts.label.request.headerLeaf', { leaf: label });
    }
    const paramMatch = PARAM_PATH_RE.exec(path);
    if (paramMatch) {
      const uid = paramMatch[1];
      const leaf = paramMatch[2] as ParamLeaf;
      const name = findParamName(req, uid);
      const label = t(PARAM_LEAF_LABEL[leaf]);
      return name
        ? t('shared.conflicts.label.request.queryParamLeafNamed', { name, leaf: label })
        : t('shared.conflicts.label.request.queryParamLeaf', { leaf: label });
    }
    if (path.startsWith(`${REQUEST_PATHS.auth}.`)) {
      return t('shared.conflicts.label.request.authTail', { path: path.slice(REQUEST_PATHS.auth.length + 1) });
    }
    if (path.startsWith(`${REQUEST_PATHS.body}.`)) {
      return t('shared.conflicts.label.request.bodyTail', { path: path.slice(REQUEST_PATHS.body.length + 1) });
    }
    return path;
  },
};
