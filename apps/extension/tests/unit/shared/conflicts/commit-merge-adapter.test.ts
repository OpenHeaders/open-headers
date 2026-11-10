/**
 * The git commit adapter: a conflicted pick's files as a merge session.
 * Pins the projection (the branch's text as the opening result, a file
 * with no ancestor in two panes, a removed file as an empty incoming
 * side, the files of one document grouped by their directory) and the
 * apply contract (every file answered, a refusal about one file marks
 * that file alone).
 */

import {
  buildCommitMergeSession,
  type CommitMergeApplyResult,
  commitMergeFiles,
} from '@openheaders/ui/shared/conflicts/commit-merge-adapter';
import { describe, expect, it, vi } from 'vitest';

const MANIFEST = {
  path: 'requests/api-rco0000a/ping-req00001/request.yaml',
  base: 'name: Ping\n',
  theirs: 'name: Picked ping\n',
  mine: 'name: Local ping\n',
};
const BODY = {
  path: 'requests/api-rco0000a/ping-req00001/body.json',
  base: '{"probe":true}\n',
  theirs: '{"probe":false}\n',
  mine: '{"probe":true}\n',
};

function session(apply: (answers: { path: string; content: string }[]) => Promise<CommitMergeApplyResult>) {
  return buildCommitMergeSession({
    title: 'Cherry-Pick aaaaaaa: Resolve Conflicts',
    files: [MANIFEST, BODY],
    apply,
    onCancel: vi.fn(),
  });
}

describe('commitMergeFiles', () => {
  it("a file opens three panes with the branch's text as its result", () => {
    const [file] = commitMergeFiles([MANIFEST]);
    expect(file).toEqual({
      id: MANIFEST.path,
      label: 'request.yaml',
      language: 'yaml',
      kind: 'modify',
      group: 'requests/api-rco0000a/ping-req00001',
      base: 'name: Ping\n',
      theirs: 'name: Picked ping\n',
      mine: 'name: Local ping\n',
      initialResult: 'name: Local ping\n',
    });
  });

  it('the files of one document share a group; each reads in its own language', () => {
    const files = commitMergeFiles([MANIFEST, BODY, { path: 'workspace-vars.yaml', theirs: 'a\n', mine: 'b\n' }]);
    expect(files.map((file) => [file.label, file.group, file.language])).toEqual([
      ['request.yaml', 'requests/api-rco0000a/ping-req00001', 'yaml'],
      ['body.json', 'requests/api-rco0000a/ping-req00001', 'json'],
      ['workspace-vars.yaml', undefined, 'yaml'],
    ]);
  });

  it('a file with no ancestor carries no base — two panes, never a made-up one', () => {
    const [file] = commitMergeFiles([{ path: 'requests/ping/pre-request.js', theirs: 'a();\n', mine: 'b();\n' }]);
    expect('base' in file).toBe(false);
    expect(file.language).toBe('javascript');
  });

  it('a file the change removes is an empty incoming side over the branch’s text', () => {
    const [file] = commitMergeFiles([{ path: MANIFEST.path, base: MANIFEST.base, mine: MANIFEST.mine }]);
    expect(file).toMatchObject({ kind: 'modify', base: MANIFEST.base, theirs: '', mine: MANIFEST.mine });
    expect(file.initialResult).toBe(MANIFEST.mine);
  });
});

describe('buildCommitMergeSession', () => {
  it('apply hands every file’s result over once — an untouched file answers with its opening text', async () => {
    const apply = vi.fn(async (): Promise<CommitMergeApplyResult> => ({ ok: true }));
    const built = session(apply);
    const outcomes = await built.onApply(built.files, new Map([[MANIFEST.path, 'name: Agreed ping\n']]));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([
      { path: MANIFEST.path, content: 'name: Agreed ping\n' },
      { path: BODY.path, content: BODY.mine },
    ]);
    expect(outcomes).toEqual([
      { fileId: MANIFEST.path, ok: true, status: 'resolved' },
      { fileId: BODY.path, ok: true, status: 'resolved' },
    ]);
  });

  it('a refusal about one file marks that file alone', async () => {
    const built = session(async () => ({ ok: false, error: 'bad yaml', path: BODY.path }));
    expect(await built.onApply(built.files, new Map())).toEqual([
      { fileId: MANIFEST.path, ok: true, status: 'resolved' },
      { fileId: BODY.path, ok: false, status: 'resolved', error: 'bad yaml' },
    ]);
  });

  it('a refusal about none marks them all', async () => {
    const built = session(async () => ({ ok: false, error: 'host unreachable' }));
    const outcomes = await built.onApply(built.files, new Map());
    expect(outcomes.every((outcome) => !outcome.ok && outcome.error === 'host unreachable')).toBe(true);
  });

  it('cancel is the caller’s', () => {
    const onCancel = vi.fn();
    const built = buildCommitMergeSession({ title: 't', files: [MANIFEST], apply: vi.fn(), onCancel });
    built.onCancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
