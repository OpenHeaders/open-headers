/**
 * The listing of a conflicted pass's files as the workbench's panels
 * list what they belong to. Pins the matching of a file to its entity
 * by path, the pruning to what holds a conflicted file, the one-file
 * row against the parts of an entity that lists several, the sections
 * and their order under each surface, the user's own files by
 * directory, and the flat reading in listing order.
 */

import type { TreeNode } from '@openheaders/core/types';
import { environmentFilePath, environmentSecretTemplateFilePath } from '@openheaders/core/workspace-tree';
import {
  CONFLICT_SURFACES,
  type ConflictNode,
  type ConflictWorkspace,
  commitConflictTree,
  conflictPartOf,
  listedConflictFiles,
} from '@openheaders/ui/shared/conflicts/commit-conflict-tree';
import { describe, expect, it } from 'vitest';

const CREATE = 'requests/orders-col00001/create-order-req00003';
const LIST = 'requests/orders-col00001/reads-fld00001/list-orders-req00004';
const STAGING = { uid: 'env00001', name: 'Staging' };

const REQUEST_TREE: TreeNode[] = [
  {
    type: 'request',
    uid: 'req00002',
    name: 'Health Check',
    path: 'requests/orders-col00001/health-req00002',
    method: 'GET',
  },
  { type: 'request', uid: 'req00003', name: 'Create Order', path: CREATE, method: 'POST' },
  {
    type: 'folder',
    uid: 'fld00001',
    name: 'Reads',
    path: 'requests/orders-col00001/reads-fld00001',
    children: [{ type: 'request', uid: 'req00004', name: 'List Orders', path: LIST, method: 'GET' }],
  },
];

const WORKSPACE: ConflictWorkspace = {
  ruleCollections: [
    {
      uid: 'col00009',
      name: 'Headers',
      path: 'rules/headers-col00009',
      tree: [
        {
          type: 'rule',
          uid: 'rul00001',
          name: 'Add Auth',
          path: 'rules/headers-col00009/add-auth-rul00001',
          ruleType: 'header',
          enabled: true,
        },
      ],
    },
  ],
  templateCollections: [],
  requestCollections: [
    { uid: 'col00001', name: 'Orders', path: 'requests/orders-col00001', tree: REQUEST_TREE },
    { uid: 'col00002', name: 'Billing', path: 'requests/billing-col00002', tree: [] },
  ],
  specs: [{ uid: 'spc00001', name: 'Orders API', path: 'specs/orders-api-spc00001' }],
  workflows: [{ uid: 'wfl00001', name: 'Token Refresh', path: 'live/workflows/token-refresh-wfl00001' }],
  liveVariables: [{ uid: 'lvr00001', name: 'token', path: 'live/variables/token-lvr00001' }],
  environments: [STAGING],
};

/** A row as `name[file]` or `name{children}` — enough to read a tree's shape at a glance. */
function shape(node: ConflictNode): string {
  const name =
    node.type === 'entity'
      ? node.entity.kind === 'node'
        ? node.entity.node.name
        : node.entity.kind === 'workspace-variables'
          ? 'workspace-variables'
          : node.entity.name
      : node.type === 'part'
        ? (node.part ?? node.name)
        : node.type === 'directory'
          ? node.path
          : node.name;
  if (node.type === 'entity' && node.file !== undefined) return `${name}[${node.file}]`;
  if (node.type === 'entity' || node.type === 'directory') return `${name}{${node.children.map(shape).join(' ')}}`;
  return `${name}[${node.file}]`;
}

const shapes = (paths: string[], workspace = WORKSPACE): string[] =>
  commitConflictTree(paths, workspace).map(
    (section) => `${section.surface}/${section.id}: ${section.nodes.map(shape).join(' ')}`,
  );

describe('commitConflictTree', () => {
  it('an entity with one conflicted file is the row that opens it, under the containers above it alone', () => {
    expect(shapes([`${LIST}/request.yaml`])).toEqual([
      `api-requests/requests: Orders{Reads{List Orders[${LIST}/request.yaml]}}`,
    ]);
  });

  it('an entity with several lists them by part — the details first, a part with no name of its own by its file', () => {
    expect(
      shapes([`${CREATE}/pre-request.js`, `${CREATE}/body.json`, `${CREATE}/request.yaml`, `${CREATE}/notes.txt`]),
    ).toEqual([
      `api-requests/requests: Orders{Create Order{details[${CREATE}/request.yaml] body[${CREATE}/body.json] notes.txt[${CREATE}/notes.txt] pre-request[${CREATE}/pre-request.js]}}`,
    ]);
  });

  it('a container lists its own parts ahead of what it holds; alone, it is the row that opens its file', () => {
    const own = 'requests/orders-col00001/_collection.yaml';
    expect(shapes([`${CREATE}/request.yaml`, own])).toEqual([
      `api-requests/requests: Orders{details[${own}] Create Order[${CREATE}/request.yaml]}`,
    ]);
    expect(shapes([own])).toEqual([`api-requests/requests: Orders[${own}]`]);
  });

  it("the rows follow the panel's order, not the order the files came in", () => {
    const [section] = commitConflictTree([`${LIST}/request.yaml`, `${CREATE}/request.yaml`], WORKSPACE);
    expect(listedConflictFiles([section]).map((file) => file.path)).toEqual([
      `${CREATE}/request.yaml`,
      `${LIST}/request.yaml`,
    ]);
  });

  it('every section sits under the surface whose panel shows it, in the surfaces’ order', () => {
    const env = environmentFilePath(STAGING);
    expect(
      shapes([
        'notes/orders.md',
        env,
        'workspace-vars.yaml',
        'live/variables/token-lvr00001/variable.yaml',
        'live/workflows/token-refresh-wfl00001/workflow.yaml',
        'specs/orders-api-spc00001/spec.yaml',
        `${CREATE}/request.yaml`,
        'rules/headers-col00009/add-auth-rul00001/rule.yaml',
      ]),
    ).toEqual([
      'http-rules/rules: Headers{Add Auth[rules/headers-col00009/add-auth-rul00001/rule.yaml]}',
      `api-requests/requests: Orders{Create Order[${CREATE}/request.yaml]}`,
      'api-requests/specs: Orders API[specs/orders-api-spc00001/spec.yaml]',
      'workflows/workflows: Token Refresh[live/workflows/token-refresh-wfl00001/workflow.yaml]',
      'variables/workspace-variables: workspace-variables[workspace-vars.yaml]',
      'variables/live-variables: token[live/variables/token-lvr00001/variable.yaml]',
      `variables/environments: Staging[${env}]`,
      'files/files: notes{orders.md[notes/orders.md]}',
    ]);
    expect(CONFLICT_SURFACES).toEqual(['http-rules', 'api-requests', 'workflows', 'variables', 'files']);
  });

  it("an environment's secret template is the environment's second file", () => {
    const env = environmentFilePath(STAGING);
    const template = environmentSecretTemplateFilePath(STAGING);
    expect(shapes([template, env])).toEqual([
      `variables/environments: Staging{details[${env}] ${template.slice(template.lastIndexOf('/') + 1)}[${template}]}`,
    ]);
  });

  it('a file no entity owns is listed under Files — by its directory, or bare at the root', () => {
    expect(
      shapes(['scripts/ci/run.sh', 'README.md', 'scripts/ci/lint.sh', 'requests/gone-col00007/ping/request.yaml']),
    ).toEqual([
      'files/files: README.md[README.md] requests/gone-col00007/ping{request.yaml[requests/gone-col00007/ping/request.yaml]} scripts/ci{lint.sh[scripts/ci/lint.sh] run.sh[scripts/ci/run.sh]}',
    ]);
  });
});

describe('listedConflictFiles', () => {
  it('reads every file once, in listing order, with its entity and — where the entity lists several — its part', () => {
    const sections = commitConflictTree(
      ['notes/orders.md', `${CREATE}/body.json`, `${CREATE}/request.yaml`, `${LIST}/request.yaml`],
      WORKSPACE,
    );
    expect(
      listedConflictFiles(sections).map((file) => [
        file.path,
        file.surface,
        file.entity?.kind === 'node' ? file.entity.node.name : undefined,
        file.part,
      ]),
    ).toEqual([
      [`${CREATE}/request.yaml`, 'api-requests', 'Create Order', 'details'],
      [`${CREATE}/body.json`, 'api-requests', 'Create Order', 'body'],
      [`${LIST}/request.yaml`, 'api-requests', 'List Orders', undefined],
      ['notes/orders.md', 'files', undefined, undefined],
    ]);
  });
});

describe('conflictPartOf', () => {
  it('names a file by the part of the entity its codec writes there', () => {
    expect(
      [
        'request.yaml',
        '_collection.yaml',
        'body.json',
        'body.xml',
        'variables.json',
        'query.graphql',
        'message.txt',
        'payload.json',
        'pre-request.js',
        'ws-before-connect.js',
        'openapi.yaml',
      ].map(conflictPartOf),
    ).toEqual([
      'details',
      'details',
      'body',
      'body',
      'variables',
      'query',
      'message',
      'message',
      'pre-request',
      'ws-before-connect',
      null,
    ]);
  });
});
