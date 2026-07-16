import type { InsomniaAuthentication, InsomniaBody, InsomniaDoc, InsomniaHeader, InsomniaParameter } from './types';

// ── Resource normalization ─────────────────────────────────────────

/** Export v4 discriminators (snake_case) + raw NeDB discriminators (PascalCase). */
const KIND_BY_TYPE: Record<string, InsomniaDoc['kind']> = {
  workspace: 'workspace',
  Workspace: 'workspace',
  request_group: 'request-group',
  RequestGroup: 'request-group',
  request: 'request',
  Request: 'request',
  environment: 'environment',
  Environment: 'environment',
  api_spec: 'apispec',
  ApiSpec: 'apispec',
};

/**
 * Fold one raw resource (v4 export entry, NeDB doc line, or synthesized
 * v5 node) into the common `InsomniaDoc` shape. Returns null when the
 * value is not an object at all — the caller records the drop.
 */
export function normalizeDoc(raw: unknown, index: number): InsomniaDoc | null {
  if (!isRecord(raw)) return null;
  const rawType = typeof raw._type === 'string' ? raw._type : typeof raw.type === 'string' ? raw.type : '';
  const id = typeof raw._id === 'string' && raw._id.length > 0 ? raw._id : `resource-${index}`;
  const doc: InsomniaDoc = {
    id,
    parentId: typeof raw.parentId === 'string' && raw.parentId.length > 0 ? raw.parentId : null,
    kind: KIND_BY_TYPE[rawType] ?? 'unsupported',
    rawType,
    name:
      (typeof raw.name === 'string' ? raw.name.trim() : '') ||
      (typeof raw.fileName === 'string' ? raw.fileName.trim() : '') ||
      defaultNameFor(KIND_BY_TYPE[rawType]),
  };
  if (typeof raw.description === 'string' && raw.description.length > 0) doc.description = raw.description;
  if (typeof raw.metaSortKey === 'number') doc.sortKey = raw.metaSortKey;
  if (typeof raw.url === 'string') doc.url = raw.url;
  if (typeof raw.method === 'string') doc.method = raw.method;
  if (Array.isArray(raw.headers)) doc.headers = raw.headers.filter(isRecord).map(toHeader);
  if (Array.isArray(raw.parameters)) doc.parameters = raw.parameters.filter(isRecord).map(toParameter);
  if (isRecord(raw.body)) doc.body = toBody(raw.body);
  if (isRecord(raw.authentication)) doc.authentication = toAuthentication(raw.authentication);
  if (isRecord(raw.data)) doc.data = raw.data;
  if (typeof raw.contents === 'string') doc.contents = raw.contents;
  return doc;
}

function defaultNameFor(kind: InsomniaDoc['kind'] | undefined): string {
  switch (kind) {
    case 'workspace':
      return 'Imported Collection';
    case 'request-group':
      return 'Untitled Folder';
    case 'request':
      return 'Untitled Request';
    case 'environment':
      return 'Imported Environment';
    case 'apispec':
      return 'API Spec';
    default:
      return '';
  }
}

function toHeader(raw: Record<string, unknown>): InsomniaHeader {
  return {
    name: typeof raw.name === 'string' ? raw.name : undefined,
    value: typeof raw.value === 'string' ? raw.value : undefined,
    disabled: raw.disabled === true ? true : undefined,
    description: typeof raw.description === 'string' && raw.description ? raw.description : undefined,
  };
}

function toParameter(raw: Record<string, unknown>): InsomniaParameter {
  return {
    ...toHeader(raw),
    type: typeof raw.type === 'string' ? raw.type : undefined,
    fileName: typeof raw.fileName === 'string' ? raw.fileName : undefined,
  };
}

function toBody(raw: Record<string, unknown>): InsomniaBody {
  return {
    mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : undefined,
    text: typeof raw.text === 'string' ? raw.text : undefined,
    params: Array.isArray(raw.params) ? raw.params.filter(isRecord).map(toParameter) : undefined,
    fileName: typeof raw.fileName === 'string' ? raw.fileName : undefined,
  };
}

function toAuthentication(raw: Record<string, unknown>): InsomniaAuthentication {
  return {
    ...raw,
    type: typeof raw.type === 'string' ? raw.type : undefined,
    disabled: raw.disabled === true ? true : undefined,
    username: stringOrUndefined(raw.username),
    password: stringOrUndefined(raw.password),
    token: stringOrUndefined(raw.token),
    prefix: stringOrUndefined(raw.prefix),
    key: stringOrUndefined(raw.key),
    value: stringOrUndefined(raw.value),
    addTo: stringOrUndefined(raw.addTo),
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
