/**
 * Seeded entity generators for the canonical-YAML property harness.
 *
 * Same idiom as `tests/sync/harness/random.ts` (mulberry32, no
 * fast-check): every generator is a pure function of the Rng, so a
 * failing seed reproduces exactly. Generators produce schema-valid
 * entities across the whole persisted catalogue, exercising variants,
 * optional fields, records (with deliberately unsorted insertion
 * order), tuples, and nested rows.
 *
 * Each case tells the property tests how to build a fresh write, how
 * to serialize its manifest, how to parse it back (with fixed sibling
 * contents where the entity fans out), and how to make a known-field
 * edit. Workspace generates the committed manifest shape (no `orgId` —
 * host-local tenancy never enters committed YAML, GIT_PLAN.md §5).
 */

import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseGrpcRequest,
  parseLiveVariable,
  parseLiveWorkflow,
  parseRequest,
  parseRule,
  parseSpec,
  parseTemplate,
  parseVault,
  parseWebSocketRequest,
  parseWorkspace,
  parseWorkspaceVariables,
  serializeCollection,
  serializeEnvironment,
  serializeFolder,
  serializeGrpcRequest,
  serializeLiveVariable,
  serializeLiveWorkflow,
  serializeRequest,
  serializeRule,
  serializeSpec,
  serializeTemplate,
  serializeVault,
  serializeWebSocketRequest,
  serializeWorkspace,
  serializeWorkspaceVariables,
} from '../../../src/codec/yaml';
import { CollectionSchema, FolderSchema } from '../../../src/schemas/collection';
import { freshDocument, type ParsedDocument, type WriteableDocument } from '../../../src/schemas/document';
import { GrpcRequestSchema } from '../../../src/schemas/grpc-request';
import { LiveVariableSchema, LiveWorkflowSchema } from '../../../src/schemas/live';
import { RequestSchema } from '../../../src/schemas/request';
import { RuleSchema } from '../../../src/schemas/rule';
import { SpecSchema } from '../../../src/schemas/spec';
import { TemplateSchema } from '../../../src/schemas/template';
import { EnvironmentSchema, VaultSchema, WorkspaceVariablesSchema } from '../../../src/schemas/variable';
import { WebSocketRequestSchema } from '../../../src/schemas/websocket-request';
import { WorkspaceManifestSchema } from '../../../src/schemas/workspace';
import type { Collection, Folder } from '../../../src/types/collection';
import type { GrpcRequest } from '../../../src/types/grpc-request';
import type { LiveVariable, LiveWorkflow } from '../../../src/types/live';
import type { Request } from '../../../src/types/request';
import type { Rule } from '../../../src/types/rule';
import type { Spec } from '../../../src/types/spec';
import type { Template } from '../../../src/types/template';
import type { Environment, Vault, WorkspaceVariables } from '../../../src/types/variable';
import type { WebSocketRequest } from '../../../src/types/websocket-request';
import type { WorkspaceManifest } from '../../../src/types/workspace';
import type { Rng } from '../../sync/harness/random';

type GeneratedEntity = Record<string, unknown>;

export interface EntityCase {
  readonly name: string;
  /** The entity's valibot schema — the injection walker's map/record oracle. */
  readonly schema: unknown;
  generate(rng: Rng): GeneratedEntity;
  /** Fresh write for the generated value. Default: `freshDocument`. */
  fresh(value: GeneratedEntity): WriteableDocument<unknown>;
  serialize(write: WriteableDocument<unknown>): string;
  parse(yaml: string): ParsedDocument<unknown>;
  mutate(draft: GeneratedEntity): void;
}

const SPEC_FILE_CONTENT = 'openapi: 3.0.3\ninfo:\n  title: Probe\n  version: 1.0.0\npaths: {}\n';

const UID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const HEX = '0123456789abcdef';
const WORDS = ['auth', 'token', 'probe', 'staging', 'gateway', 'session', 'billing', 'search'];

function uid(rng: Rng): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) out += UID_ALPHABET[rng.int(UID_ALPHABET.length)];
  return out;
}

function word(rng: Rng): string {
  return `${rng.pick(WORDS)}-${rng.int(10_000)}`;
}

function hex(rng: Rng, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += HEX[rng.int(HEX.length)];
  return out;
}

function maybe<T>(rng: Rng, chance: number, make: () => T): T | undefined {
  return rng.next() < chance ? make() : undefined;
}

/** Spread-safe optional: `{...opt('k', v)}` adds the key only when defined. */
function opt(key: string, value: unknown): GeneratedEntity {
  return value === undefined ? {} : { [key]: value };
}

function variableRow(rng: Rng): GeneratedEntity {
  return {
    uid: uid(rng),
    name: word(rng).toUpperCase().replace(/-/g, '_'),
    value: `https://api.openheaders.io/${word(rng)}`,
    type: 'default',
    ...opt(
      'enabled',
      maybe(rng, 0.25, () => false),
    ),
  };
}

function conditionRow(rng: Rng): GeneratedEntity {
  const type = rng.pick(['url-filter', 'request-domains', 'resource-types', 'response-header'] as const);
  return {
    uid: uid(rng),
    type,
    values: [rng.pick(['api.openheaders.io', 'app.openheaders.io', '*.openheaders.io'] as const)],
    ...opt('headerName', type === 'response-header' ? `x-${word(rng)}` : undefined),
  };
}

function headerModRow(rng: Rng): GeneratedEntity {
  const operation = rng.pick(['override', 'add', 'remove', 'merge'] as const);
  return {
    uid: uid(rng),
    operation,
    headerName: `X-${word(rng)}`,
    ...opt('value', operation === 'remove' ? undefined : `v-${word(rng)}`),
    ...opt('mergeSeparator', operation === 'merge' ? ', ' : undefined),
  };
}

function keyValueRow(rng: Rng): GeneratedEntity {
  return {
    uid: uid(rng),
    key: `X-${word(rng)}`,
    value: word(rng),
    ...opt(
      'description',
      maybe(rng, 0.3, () => `note ${word(rng)}`),
    ),
    ...opt(
      'enabled',
      maybe(rng, 0.3, () => rng.next() < 0.5),
    ),
  };
}

/** Record with deliberately unsorted insertion order — sorting is the codec's job. */
function unsortedRecord(rng: Rng): Record<string, string> {
  const out: Record<string, string> = {};
  const count = 1 + rng.int(3);
  for (let i = 0; i < count; i += 1) out[`${rng.pick(['zeta', 'alpha', 'mid'] as const)}-${rng.int(100)}`] = word(rng);
  return out;
}

function ruleAction(rng: Rng, type: string): GeneratedEntity {
  switch (type) {
    case 'header':
      return {
        requestHeaders: Array.from({ length: 1 + rng.int(2) }, () => headerModRow(rng)),
        responseHeaders: rng.next() < 0.5 ? [] : [headerModRow(rng)],
      };
    case 'redirect':
      return { redirectTo: `https://app.openheaders.io/${word(rng)}` };
    case 'request-body':
      return {
        bodyType: rng.pick(['static', 'dynamic'] as const),
        requestBody: `{"probe":"${word(rng)}"}`,
        resourceType: rng.pick(['rest', 'graphql'] as const),
        ...opt(
          'graphqlFilter',
          maybe(rng, 0.4, () => ({
            key: 'operationName',
            operator: rng.pick(['Equals', 'Contains'] as const),
            value: word(rng),
          })),
        ),
      };
    case 'inject':
      return {
        injectType: rng.pick(['script', 'css'] as const),
        code: `console.log("${word(rng)}");`,
        source: 'code',
        position: rng.pick(['head', 'body-end'] as const),
        ...opt(
          'bypassCSP',
          maybe(rng, 0.3, () => true),
        ),
      };
    case 'block':
      return {};
    case 'delay':
      return { delayMs: 100 + rng.int(5000) };
    case 'response':
      return {
        responseSource: rng.pick(['mock', 'network'] as const),
        bodyType: rng.pick(['static', 'dynamic'] as const),
        responseBody: `{"ok":${rng.next() < 0.5}}`,
        statusCode: rng.pick([200, 201, 404, 503] as const),
        contentType: 'application/json',
        responseHeaders: unsortedRecord(rng),
      };
    case 'query-param': {
      const operation = rng.pick(['add', 'override', 'remove', 'remove-all'] as const);
      return {
        params: [
          {
            uid: uid(rng),
            param: word(rng),
            operation,
            ...opt('value', operation === 'remove' || operation === 'remove-all' ? undefined : word(rng)),
          },
        ],
      };
    }
    case 'ws':
      return {
        operation: rng.pick(['modify', 'inject', 'drop'] as const),
        direction: rng.pick(['send', 'receive'] as const),
        ...opt(
          'messageFilter',
          maybe(rng, 0.5, () => ({ matchType: rng.pick(['contains', 'regex'] as const), value: word(rng) })),
        ),
        ...opt(
          'payload',
          maybe(rng, 0.5, () => `{"frame":"${word(rng)}"}`),
        ),
      };
    case 'sse':
      return {
        operation: rng.pick(['modify', 'inject', 'drop'] as const),
        ...opt(
          'eventName',
          maybe(rng, 0.5, () => word(rng)),
        ),
        ...opt(
          'payload',
          maybe(rng, 0.5, () => word(rng)),
        ),
      };
    default:
      return { username: word(rng), password: `{{vault.${word(rng).replace(/-/g, '_')}}}` };
  }
}

function authConfig(rng: Rng): GeneratedEntity {
  switch (rng.int(4)) {
    case 0:
      return { type: 'none' };
    case 1:
      return { type: 'basic', username: word(rng), password: '{{vault.pw}}' };
    case 2:
      return {
        type: 'bearer',
        token: '{{vault.token}}',
        ...opt(
          'disabled',
          maybe(rng, 0.3, () => true),
        ),
      };
    default:
      return { type: 'api-key', key: 'X-Api-Key', value: '{{vault.key}}', in: rng.pick(['header', 'query'] as const) };
  }
}

function workflowStep(rng: Rng, id: string, dependsOn?: readonly string[]): GeneratedEntity {
  return {
    uid: uid(rng),
    id,
    requestUid: uid(rng),
    captures: [
      {
        uid: uid(rng),
        name: `cap_${rng.int(1000)}`,
        extractor:
          rng.next() < 0.5
            ? { kind: 'json-path', path: '$.access_token' }
            : {
                kind: 'body-regex',
                pattern: 'token=(\\w+)',
                ...opt(
                  'group',
                  maybe(rng, 0.5, () => 1),
                ),
              },
      },
    ],
    ...opt('dependsOn', dependsOn),
    ...opt(
      'runIf',
      maybe(rng, 0.4, () => ({
        all: [
          {
            kind: 'status',
            uid: uid(rng),
            stepId: dependsOn?.[0] ?? id,
            match: rng.next() < 0.5 ? '2xx' : ['eq', 200],
          },
        ],
      })),
    ),
    ...opt(
      'retry',
      maybe(rng, 0.3, () => ({
        maxAttempts: 2 + rng.int(3),
        ...opt(
          'backoff',
          maybe(rng, 0.5, () => 'exponential' as const),
        ),
      })),
    ),
    ...opt(
      'runScripts',
      maybe(rng, 0.2, () => true),
    ),
  };
}

function editName(draft: GeneratedEntity): void {
  draft.name = `${draft.name as string}-edited`;
}

export const ENTITY_CASES: readonly EntityCase[] = [
  {
    name: 'workspace',
    schema: WorkspaceManifestSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      name: word(rng),
      ...opt(
        'description',
        maybe(rng, 0.5, () => `Workspace ${word(rng)}.`),
      ),
      ...opt(
        'defaultEnvironmentId',
        maybe(rng, 0.5, () => uid(rng)),
      ),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeWorkspace(write as WriteableDocument<WorkspaceManifest>),
    parse: (yaml) => parseWorkspace(yaml),
    mutate: editName,
  },
  {
    name: 'collection',
    schema: CollectionSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'requests/gen-c0ll0000',
      name: word(rng),
      ...opt(
        'description',
        maybe(rng, 0.5, () => `Collection ${word(rng)}.`),
      ),
      variables: Array.from({ length: rng.int(3) }, () => variableRow(rng)),
      ...opt(
        'order',
        maybe(rng, 0.5, () => [`login-${uid(rng)}`, `refresh-${uid(rng)}`]),
      ),
      ...opt(
        'pinnedEnvironmentIds',
        maybe(rng, 0.4, () => [uid(rng)]),
      ),
      ...opt(
        'auth',
        maybe(rng, 0.5, () => authConfig(rng)),
      ),
      ...opt(
        'specLink',
        maybe(rng, 0.3, () => ({ specUid: uid(rng), sourceHash: `sha256:${hex(rng, 8)}` })),
      ),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeCollection(write as WriteableDocument<Collection>).collectionYaml,
    parse: (yaml) => parseCollection(yaml, { path: 'requests/gen-c0ll0000' }),
    mutate: editName,
  },
  {
    name: 'folder',
    schema: FolderSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'requests/gen-c0ll0000/gen-f0ld0000',
      name: word(rng),
      ...opt(
        'order',
        maybe(rng, 0.5, () => [`introspect-${uid(rng)}`]),
      ),
      ...opt(
        'auth',
        maybe(rng, 0.5, () => authConfig(rng)),
      ),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeFolder(write as WriteableDocument<Folder>).folderYaml,
    parse: (yaml) => parseFolder(yaml, { path: 'requests/gen-c0ll0000/gen-f0ld0000' }),
    mutate: editName,
  },
  {
    name: 'rule',
    schema: RuleSchema,
    generate: (rng) => {
      const type = rng.pick([
        'header',
        'redirect',
        'request-body',
        'inject',
        'block',
        'delay',
        'response',
        'query-param',
        'ws',
        'sse',
        'auth',
      ] as const);
      return {
        schemaVersion: 5,
        uid: uid(rng),
        path: 'rules/gen-rule0000',
        name: `Rule ${word(rng)}`,
        type,
        enabled: rng.next() < 0.5,
        ...opt(
          'published',
          maybe(rng, 0.5, () => rng.next() < 0.5),
        ),
        conditions: Array.from({ length: rng.int(3) }, () => conditionRow(rng)),
        action: ruleAction(rng, type),
      };
    },
    fresh: freshDocument,
    serialize: (write) => serializeRule(write as WriteableDocument<Rule>),
    parse: (yaml) => parseRule(yaml, { path: 'rules/gen-rule0000' }),
    mutate: editName,
  },
  {
    name: 'template',
    schema: TemplateSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'templates/gen-tmpl0000',
      name: `Template ${word(rng)}`,
      ruleType: rng.pick(['header', 'query-param'] as const),
      icon: rng.pick(['🔐', '⚡', 'star'] as const),
      description: `Template ${word(rng)}.`,
      includes: { conditions: rng.next() < 0.5, formValues: true },
      conditions: Array.from({ length: rng.int(2) }, () => conditionRow(rng)),
      formValues: unsortedRecord(rng),
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-19T00:00:00.000Z',
    }),
    fresh: freshDocument,
    serialize: (write) => serializeTemplate(write as WriteableDocument<Template>),
    parse: (yaml) => parseTemplate(yaml, { path: 'templates/gen-tmpl0000' }),
    mutate: editName,
  },
  {
    name: 'workspace-variables',
    schema: WorkspaceVariablesSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      variables: Array.from({ length: 1 + rng.int(3) }, () => variableRow(rng)),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeWorkspaceVariables(write as WriteableDocument<WorkspaceVariables>),
    parse: (yaml) => parseWorkspaceVariables(yaml),
    mutate: (draft) => {
      const rows = draft.variables as Array<Record<string, unknown>>;
      rows[0].value = `${rows[0].value as string}/edited`;
    },
  },
  {
    name: 'vault',
    schema: VaultSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      secrets: Array.from({ length: 1 + rng.int(2) }, () => {
        switch (rng.int(3)) {
          case 0:
            return { uid: uid(rng), kind: 'string', name: word(rng), value: `secret-${word(rng)}` };
          case 1:
            return {
              uid: uid(rng),
              kind: 'totp',
              name: word(rng),
              seed: 'JBSWY3DPEHPK3PXP',
              algorithm: rng.pick(['SHA1', 'SHA256'] as const),
              digits: 6,
              period: 30,
              ...opt(
                'issuer',
                maybe(rng, 0.5, () => 'openheaders.io'),
              ),
            };
          default:
            return {
              uid: uid(rng),
              kind: 'client-certificate',
              name: word(rng),
              cert: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n',
              key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
            };
        }
      }),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeVault(write as WriteableDocument<Vault>),
    parse: (yaml) => parseVault(yaml),
    mutate: (draft) => {
      const rows = draft.secrets as Array<Record<string, unknown>>;
      rows[0].name = `${rows[0].name as string}-edited`;
    },
  },
  {
    name: 'environment',
    schema: EnvironmentSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      name: rng.pick(['dev', 'staging', 'production'] as const),
      variables: Array.from({ length: rng.int(3) }, () => variableRow(rng)),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeEnvironment(write as WriteableDocument<Environment>).default,
    parse: (yaml) => parseEnvironment({ default: yaml }),
    mutate: editName,
  },
  {
    name: 'request',
    schema: RequestSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'requests/gen-c0ll0000/gen-req00000',
      name: `Request ${word(rng)}`,
      ...opt(
        'description',
        maybe(rng, 0.4, () => `Docs for ${word(rng)}.`),
      ),
      method: rng.pick(['GET', 'POST', 'PUT', 'DELETE'] as const),
      url: `https://api.openheaders.io/${word(rng)}`,
      headers: Array.from({ length: rng.int(3) }, () => keyValueRow(rng)),
      params: Array.from({ length: rng.int(2) }, () => ({
        ...keyValueRow(rng),
        ...opt(
          'hasEquals',
          maybe(rng, 0.3, () => true),
        ),
      })),
      auth: authConfig(rng),
      ...opt(
        'credentialsMode',
        maybe(rng, 0.3, () => rng.pick(['omit', 'include'] as const)),
      ),
      ...opt(
        'followRedirects',
        maybe(rng, 0.3, () => false),
      ),
      ...opt(
        'sslVerification',
        maybe(rng, 0.3, () => false),
      ),
      ...opt(
        'tlsMinVersion',
        maybe(rng, 0.2, () => rng.pick(['1.0', '1.2'] as const)),
      ),
      ...opt(
        'timeoutMs',
        maybe(rng, 0.3, () => 1_000 + rng.int(60_000)),
      ),
      ...opt(
        'maxRedirects',
        maybe(rng, 0.2, () => rng.int(20)),
      ),
      body:
        rng.next() < 0.5
          ? { type: 'none' }
          : { type: 'form', formParts: Array.from({ length: 1 + rng.int(2) }, () => keyValueRow(rng)) },
    }),
    fresh: freshDocument,
    serialize: (write) => serializeRequest(write as WriteableDocument<Request>).requestYaml,
    parse: (yaml) => parseRequest(yaml, { path: 'requests/gen-c0ll0000/gen-req00000' }),
    mutate: editName,
  },
  {
    name: 'websocket-request',
    schema: WebSocketRequestSchema,
    generate: (rng) => {
      const flavor = rng.pick(['raw', 'socketio'] as const);
      return {
        schemaVersion: 5,
        uid: uid(rng),
        path: 'requests/gen-c0ll0000/gen-ws000000',
        name: `WS ${word(rng)}`,
        url: `wss://stream.openheaders.io/${word(rng)}`,
        flavor,
        ...opt('namespace', flavor === 'socketio' ? maybe(rng, 0.5, () => '/live') : undefined),
        subprotocols: rng.next() < 0.3 ? ['graphql-ws'] : [],
        headers: Array.from({ length: rng.int(2) }, () => keyValueRow(rng)),
        params: Array.from({ length: rng.int(2) }, () => keyValueRow(rng)),
        ...opt(
          'auth',
          maybe(rng, 0.4, () => ({ type: 'bearer', token: '{{token}}' })),
        ),
        ...opt(
          'events',
          flavor === 'socketio'
            ? maybe(rng, 0.6, () =>
                Array.from({ length: 1 + rng.int(2) }, () => ({
                  uid: uid(rng),
                  name: word(rng),
                  ...opt(
                    'listen',
                    maybe(rng, 0.5, () => false),
                  ),
                })),
              )
            : undefined,
        ),
        message: '',
        ...opt('eventName', flavor === 'socketio' ? maybe(rng, 0.5, () => word(rng)) : undefined),
        ...opt(
          'messageFormat',
          maybe(rng, 0.4, () => rng.pick(['text', 'json'] as const)),
        ),
        ...opt(
          'timeoutMs',
          maybe(rng, 0.3, () => 1_000 + rng.int(30_000)),
        ),
      };
    },
    fresh: freshDocument,
    serialize: (write) => serializeWebSocketRequest(write as WriteableDocument<WebSocketRequest>).websocketYaml,
    parse: (yaml) => parseWebSocketRequest(yaml, { path: 'requests/gen-c0ll0000/gen-ws000000' }),
    mutate: editName,
  },
  {
    name: 'grpc-request',
    schema: GrpcRequestSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'requests/gen-c0ll0000/gen-grpc0000',
      name: `Grpc ${word(rng)}`,
      url: 'grpc.openheaders.io:443',
      ...opt(
        'tls',
        maybe(rng, 0.4, () => false),
      ),
      ...opt(
        'method',
        maybe(rng, 0.7, () => ({ service: 'library.v1.Library', rpc: 'ListBooks' })),
      ),
      message: '',
      metadata: Array.from({ length: rng.int(2) }, () => keyValueRow(rng)),
      ...opt(
        'auth',
        maybe(rng, 0.4, () => ({ type: 'bearer', token: '{{token}}' })),
      ),
      ...opt(
        'specLink',
        maybe(rng, 0.3, () => ({ specUid: uid(rng) })),
      ),
      ...opt(
        'timeoutMs',
        maybe(rng, 0.3, () => 1_000 + rng.int(30_000)),
      ),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeGrpcRequest(write as WriteableDocument<GrpcRequest>).grpcYaml,
    parse: (yaml) => parseGrpcRequest(yaml, { path: 'requests/gen-c0ll0000/gen-grpc0000' }),
    mutate: editName,
  },
  {
    name: 'spec',
    schema: SpecSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'specs/gen-spec0000',
      name: `Spec ${word(rng)}`,
      ...opt(
        'description',
        maybe(rng, 0.5, () => `Spec ${word(rng)}.`),
      ),
      format: rng.pick(['openapi-3.0', 'openapi-3.1', 'protobuf', 'asyncapi'] as const),
      rootFileUid: 'root0001',
      files: [{ uid: 'root0001', fileName: 'index.yaml', content: SPEC_FILE_CONTENT }],
    }),
    fresh: freshDocument,
    serialize: (write) => serializeSpec(write as WriteableDocument<Spec>).specYaml,
    parse: (yaml) =>
      parseSpec(yaml, {
        path: 'specs/gen-spec0000',
        siblings: [{ fileName: 'index.yaml', content: SPEC_FILE_CONTENT }],
      }),
    mutate: editName,
  },
  {
    name: 'live-workflow',
    schema: LiveWorkflowSchema,
    generate: (rng) => {
      const steps =
        rng.next() < 0.5
          ? [workflowStep(rng, 'only')]
          : [workflowStep(rng, 'login'), workflowStep(rng, 'finalize', ['login'])];
      return {
        schemaVersion: 5,
        uid: uid(rng),
        path: 'live-workflows/gen-wflow000',
        name: `wf_${rng.int(1000)}`,
        ...opt(
          'description',
          maybe(rng, 0.4, () => `Workflow ${word(rng)}.`),
        ),
        steps,
        refresh: rng.next() < 0.5 ? { kind: 'interval', seconds: 30 + rng.int(3600) } : { kind: 'manual' },
        enabled: rng.next() < 0.5,
        ...opt(
          'published',
          maybe(rng, 0.5, () => true),
        ),
      };
    },
    fresh: freshDocument,
    serialize: (write) => serializeLiveWorkflow(write as WriteableDocument<LiveWorkflow>),
    parse: (yaml) => parseLiveWorkflow(yaml, { path: 'live-workflows/gen-wflow000' }),
    mutate: (draft) => {
      draft.name = `${draft.name as string}x`;
    },
  },
  {
    name: 'live-variable',
    schema: LiveVariableSchema,
    generate: (rng) => ({
      schemaVersion: 5,
      uid: uid(rng),
      path: 'live-variables/gen-livvar00',
      name: `lv_${rng.int(1000)}`,
      workflowUid: uid(rng),
      stepId: 'only',
      captureName: `cap_${rng.int(1000)}`,
      ...opt(
        'requireFreshOnRuleBuild',
        maybe(rng, 0.4, () => true),
      ),
      ...opt(
        'manualOverride',
        maybe(rng, 0.3, () => ({
          value: word(rng),
          ...opt(
            'until',
            maybe(rng, 0.5, () => 1_780_272_000_000),
          ),
        })),
      ),
      enabled: rng.next() < 0.5,
      ...opt(
        'published',
        maybe(rng, 0.5, () => true),
      ),
    }),
    fresh: freshDocument,
    serialize: (write) => serializeLiveVariable(write as WriteableDocument<LiveVariable>),
    parse: (yaml) => parseLiveVariable(yaml, { path: 'live-variables/gen-livvar00' }),
    mutate: (draft) => {
      draft.name = `${draft.name as string}x`;
    },
  },
];
