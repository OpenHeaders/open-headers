/**
 * The listing of the workspace tree's files as the workbench's panels
 * list what they belong to. Pins the matching of a file to its entity
 * by path and, where the entity has moved or an environment has been
 * renamed, by the uid in the name; the pruning to what holds a listed
 * file, the one-file row against the parts of an entity that lists
 * several, the sections and their order under each surface, the user's
 * own files by directory, every file listed once, and the flat reading
 * in listing order.
 */

import type { TreeNode } from '@openheaders/core/types';
import { environmentFilePath, environmentSecretTemplateFilePath } from '@openheaders/core/workspace-tree';
import {
  type ListedWorkspace,
  listedWorkspaceFiles,
  WORKSPACE_FILE_SURFACES,
  type WorkspaceFileNode,
  workspaceFilePartOf,
  workspaceFileTree,
} from '@openheaders/ui/shared/workspace-files';
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

const WORKSPACE: ListedWorkspace = {
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
  workflows: [{ uid: 'wfl00001', name: 'Token Refresh', path: 'live-workflows/token-refresh-wfl00001' }],
  liveVariables: [{ uid: 'lvr00001', name: 'token', path: 'live-variables/token-lvr00001' }],
  environments: [STAGING],
};

/** A row as `name[file]` or `name{children}` — enough to read a tree's shape at a glance. */
function shape(node: WorkspaceFileNode): string {
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
  workspaceFileTree(paths, workspace).map(
    (section) => `${section.surface}/${section.id}: ${section.nodes.map(shape).join(' ')}`,
  );

describe('workspaceFileTree', () => {
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
    const [section] = workspaceFileTree([`${LIST}/request.yaml`, `${CREATE}/request.yaml`], WORKSPACE);
    expect(listedWorkspaceFiles([section]).map((file) => file.path)).toEqual([
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
        'live-variables/token-lvr00001/variable.yaml',
        'live-workflows/token-refresh-wfl00001/workflow.yaml',
        'specs/orders-api-spc00001/spec.yaml',
        `${CREATE}/request.yaml`,
        'rules/headers-col00009/add-auth-rul00001/rule.yaml',
      ]),
    ).toEqual([
      'http-rules/rules: Headers{Add Auth[rules/headers-col00009/add-auth-rul00001/rule.yaml]}',
      `api-requests/requests: Orders{Create Order[${CREATE}/request.yaml]}`,
      'api-requests/specs: Orders API[specs/orders-api-spc00001/spec.yaml]',
      'workflows/workflows: Token Refresh[live-workflows/token-refresh-wfl00001/workflow.yaml]',
      'variables/workspace-variables: workspace-variables[workspace-vars.yaml]',
      'variables/live-variables: token[live-variables/token-lvr00001/variable.yaml]',
      `variables/environments: Staging[${env}]`,
      'files/files: notes{orders.md[notes/orders.md]}',
    ]);
    expect(WORKSPACE_FILE_SURFACES).toEqual(['http-rules', 'api-requests', 'workflows', 'variables', 'files']);
  });

  it('a file under a directory its entity has moved out of is still the entity’s, listed where the entity is now', () => {
    const before = 'requests/orders-col00001/reads-fld00001/create-order-req00003';
    expect(shapes([`${before}/request.yaml`])).toEqual([
      `api-requests/requests: Orders{Create Order[${before}/request.yaml]}`,
    ]);
    expect(shapes([`${before}/request.yaml`, `${CREATE}/request.yaml`, `${CREATE}/body.json`])).toEqual([
      `api-requests/requests: Orders{Create Order{details[${CREATE}/request.yaml] details[${before}/request.yaml] body[${CREATE}/body.json]}}`,
    ]);
  });

  it('a uid in a name claims nothing outside its entity’s tree, and a name that only ends like one claims nothing', () => {
    expect(shapes(['rules/headers-col00009/create-order-req00003/rule.yaml', 'docs/payments-services/a.md'])).toEqual([
      'files/files: docs/payments-services{a.md[docs/payments-services/a.md]} rules/headers-col00009/create-order-req00003{rule.yaml[rules/headers-col00009/create-order-req00003/rule.yaml]}',
    ]);
  });

  it('an environment is matched by the uid in its file’s name, whatever it was called then', () => {
    expect(shapes(['environments/stage-env00001.yaml', 'environments/other-env00002.yaml'])).toEqual([
      'variables/environments: Staging[environments/stage-env00001.yaml]',
      'files/files: environments{other-env00002.yaml[environments/other-env00002.yaml]}',
    ]);
  });

  it('every file is listed exactly once, whatever claims it', () => {
    const paths = [
      `${CREATE}/request.yaml`,
      `${CREATE}/body.json`,
      'requests/orders-col00001/reads-fld00001/create-order-req00003/request.yaml',
      'requests/orders-col00001/_collection.yaml',
      `${LIST}/request.yaml`,
      'environments/stage-env00001.yaml',
      environmentFilePath(STAGING),
      environmentSecretTemplateFilePath(STAGING),
      'environments/staging-env00001.secret.yaml',
      'workspace-vars.yaml',
      'workspace.yaml',
      'requests/gone-col00007/ping/request.yaml',
      'notes/orders.md',
      'README.md',
    ];
    const listed = listedWorkspaceFiles(workspaceFileTree([...paths, `${CREATE}/request.yaml`], WORKSPACE));
    expect(listed.map((file) => file.path).sort()).toEqual([...paths].sort());
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

describe('listedWorkspaceFiles', () => {
  it('reads every file once, in listing order, with its entity and — where the entity lists several — its part', () => {
    const sections = workspaceFileTree(
      ['notes/orders.md', `${CREATE}/body.json`, `${CREATE}/request.yaml`, `${LIST}/request.yaml`],
      WORKSPACE,
    );
    expect(
      listedWorkspaceFiles(sections).map((file) => [
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

describe('workspaceFilePartOf', () => {
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
      ].map(workspaceFilePartOf),
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
