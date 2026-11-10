/**
 * Commit secret rows: a commit's tree never carries an environment's
 * secret file, so its secret rows are read from the committed template
 * and completed from the branch's own rows. Pins the completion (value
 * and row flags from the branch, the name from the template, a row the
 * branch lacks blank), the three-way reading (a template the commit's
 * side did not touch leaves the branch's rows alone), and the safe
 * sides (no template, an unreadable one, a uid already among the
 * committed rows).
 */

import { describe, expect, it } from 'vitest';
import type { Environment, Variable } from '../../src/types';
import { environmentSecretTemplateFilePath, type TreeFile, withCommitSecretRows } from '../../src/workspace-tree';

const host: Variable = { uid: 'varaaaa1', name: 'host', value: 'staging.openheaders.io', type: 'default' };
const token: Variable = { uid: 'varaaaa2', name: 'token', value: 's3cret', type: 'secret' };
const apiKey: Variable = { uid: 'varaaaa3', name: 'apiKey', value: 'k-123', type: 'secret', enabled: false };

function environment(variables: Variable[]): Environment {
  return { schemaVersion: 5, uid: 'envaaaaa', name: 'Staging', variables };
}

const TEMPLATE = environmentSecretTemplateFilePath(environment([]));

function template(rows: Array<Pick<Variable, 'uid' | 'name'>>): TreeFile {
  const lines = rows.flatMap((row) => [
    `  - uid: ${row.uid}`,
    `    name: ${row.name}`,
    '    value: ""',
    '    type: secret',
  ]);
  return { path: TEMPLATE, content: ['schemaVersion: 5', 'variables:', ...lines, ''].join('\n') };
}

function rows(args: {
  committed: Variable[];
  files: TreeFile[];
  local: Variable[] | null;
  touched?: string[];
}): Variable[] {
  const touched = args.touched;
  const out = withCommitSecretRows({
    state: { environments: [environment(args.committed)] },
    files: args.files,
    local: args.local === null ? [] : [environment(args.local)],
    ...(touched !== undefined ? { touched: (path: string) => touched.includes(path) } : {}),
  });
  return out.environments[0].variables;
}

describe('withCommitSecretRows — the template speaks for the secret file', () => {
  it("a row the template names takes the branch's value and flags, and the template's name", () => {
    const out = rows({
      committed: [host],
      files: [
        template([
          { uid: 'varaaaa2', name: 'accessToken' },
          { uid: 'varaaaa3', name: 'apiKey' },
        ]),
      ],
      local: [host, token, apiKey],
    });
    expect(out).toEqual([host, { ...token, name: 'accessToken' }, apiKey]);
  });

  it('a row the branch does not have lands blank; a row the template dropped is not read', () => {
    const out = rows({
      committed: [host],
      files: [template([{ uid: 'varaaaa9', name: 'webhookSecret' }])],
      local: [host, token],
    });
    expect(out).toEqual([host, { uid: 'varaaaa9', name: 'webhookSecret', value: '', type: 'secret' }]);
  });

  it('an environment the branch does not have reads its template blank', () => {
    const out = rows({ committed: [host], files: [template([{ uid: 'varaaaa2', name: 'token' }])], local: null });
    expect(out).toEqual([host, { ...token, value: '' }]);
  });

  it('a commit without a template holds no secret rows', () => {
    expect(rows({ committed: [host], files: [], local: [host, token] })).toEqual([host]);
  });

  it('a branch row that was a plain variable becomes the secret the template names, value kept', () => {
    const out = rows({
      committed: [],
      files: [template([{ uid: 'varaaaa1', name: 'host' }])],
      local: [host],
    });
    expect(out).toEqual([{ ...host, type: 'secret' }]);
  });
});

describe('withCommitSecretRows — a three-way integration', () => {
  it("a template the commit's side did not touch leaves the branch's secret rows as they are", () => {
    const out = rows({
      committed: [{ ...host, value: 'staging-eu.openheaders.io' }],
      files: [template([{ uid: 'varaaaa2', name: 'token' }])],
      local: [host, token, apiKey],
      touched: ['environments/staging-envaaaaa.yaml'],
    });
    expect(out).toEqual([{ ...host, value: 'staging-eu.openheaders.io' }, token, apiKey]);
  });

  it('the same holds when neither side ever committed a template', () => {
    expect(rows({ committed: [host], files: [], local: [host, token], touched: [] })).toEqual([host, token]);
  });

  it('a template the commit changed names the rows — one it no longer lists leaves', () => {
    const out = rows({
      committed: [host],
      files: [template([{ uid: 'varaaaa3', name: 'apiKey' }])],
      local: [host, token, apiKey],
      touched: [TEMPLATE],
    });
    expect(out).toEqual([host, apiKey]);
  });

  it('a template the commit removed leaves no secret rows', () => {
    expect(rows({ committed: [host], files: [], local: [host, token], touched: [TEMPLATE] })).toEqual([host]);
  });
});

describe('withCommitSecretRows — the safe sides', () => {
  it("an unreadable template names nothing — the branch's rows stand", () => {
    const out = rows({
      committed: [host],
      files: [{ path: TEMPLATE, content: 'schemaVersion: 5\nvariables: nope\n' }],
      local: [host, token],
    });
    expect(out).toEqual([host, token]);
  });

  it('a uid the committed rows already hold is not doubled', () => {
    const committed = [host, { ...token, value: 'committed-by-hand' }];
    const out = rows({ committed, files: [template([{ uid: 'varaaaa2', name: 'token' }])], local: [host, token] });
    expect(out).toEqual(committed);
  });

  it('an environment with nothing to add is the same object', () => {
    const state = { environments: [environment([host])] };
    const out = withCommitSecretRows({ state, files: [], local: [environment([host])] });
    expect(out.environments[0]).toBe(state.environments[0]);
  });
});
