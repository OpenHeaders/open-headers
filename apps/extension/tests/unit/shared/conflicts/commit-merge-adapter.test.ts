/**
 * The git commit adapter: a conflicted pick's files as a merge session.
 * Pins the projection (the branch's text as the opening result, a file
 * with no ancestor in two panes, a removed file as an empty incoming
 * side, each file in the caller's section under the caller's name, in
 * the caller's order) and the apply contract (every file answered, a refusal about one file marks
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

/** The caller's listing: a request's files under API Requests by its name, anything else under Files by its path. */
const place = (path: string): { section: string; label: string } =>
  path.startsWith('requests/')
    ? { section: 'api-requests', label: `Ping · ${path.slice(path.lastIndexOf('/') + 1)}` }
    : { section: 'files', label: path };

function session(apply: (answers: { path: string; content: string }[]) => Promise<CommitMergeApplyResult>) {
  return buildCommitMergeSession({
    title: 'Cherry-Pick aaaaaaa: Resolve Conflicts',
    files: [MANIFEST, BODY],
    place,
    apply,
    onCancel: vi.fn(),
  });
}

describe('commitMergeFiles', () => {
  it("a file opens three panes with the branch's text as its result", () => {
    const [file] = commitMergeFiles([MANIFEST], place);
    expect(file).toEqual({
      id: MANIFEST.path,
      label: 'Ping · request.yaml',
      language: 'yaml',
      kind: 'modify',
      section: 'api-requests',
      base: 'name: Ping\n',
      theirs: 'name: Picked ping\n',
      mine: 'name: Local ping\n',
      initialResult: 'name: Local ping\n',
    });
  });

  it("the files keep the caller's order, section and name, and carry no group; each reads in its own language", () => {
    const files = commitMergeFiles(
      [BODY, { path: 'workspace-vars.yaml', theirs: 'a\n', mine: 'b\n' }, MANIFEST],
      place,
    );
    expect(files.map((file) => [file.label, file.section, file.group, file.language])).toEqual([
      ['Ping · body.json', 'api-requests', undefined, 'json'],
      ['workspace-vars.yaml', 'files', undefined, 'yaml'],
      ['Ping · request.yaml', 'api-requests', undefined, 'yaml'],
    ]);
  });

  it("the user's own files read in their language, a name with no known extension as plain text", () => {
    const files = commitMergeFiles(
      [
        { path: 'README.md', theirs: 'a\n', mine: 'b\n' },
        { path: 'scripts/ci/run.sh', theirs: 'a\n', mine: 'b\n' },
        { path: 'LICENSE', theirs: 'a\n', mine: 'b\n' },
      ],
      place,
    );
    expect(files.map((file) => [file.label, file.section, file.language])).toEqual([
      ['README.md', 'files', 'markdown'],
      ['scripts/ci/run.sh', 'files', 'shell'],
      ['LICENSE', 'files', 'plaintext'],
    ]);
  });

  it('a file with no ancestor carries no base — two panes, never a made-up one', () => {
    const [file] = commitMergeFiles(
      [{ path: 'requests/ping/pre-request.js', theirs: 'a();\n', mine: 'b();\n' }],
      place,
    );
    expect('base' in file).toBe(false);
    expect(file.language).toBe('javascript');
  });

  it('a file the change removes is an empty incoming side over the branch’s text', () => {
    const [file] = commitMergeFiles([{ path: MANIFEST.path, base: MANIFEST.base, mine: MANIFEST.mine }], place);
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

  it('a refusal about no one file is the apply’s as a whole: it rejects, and no file is marked', async () => {
    const built = session(async () => ({ ok: false, error: 'host unreachable' }));
    await expect(built.onApply(built.files, new Map())).rejects.toThrow('host unreachable');
  });

  it('asks for its files to be listed even when there is one — the title names the pass, never the file', () => {
    const built = buildCommitMergeSession({
      title: 'Pull: Resolve Conflicts',
      files: [MANIFEST],
      place,
      apply: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(built.files).toHaveLength(1);
    expect(built.alwaysListFiles).toBe(true);
  });

  it('cancel is the caller’s', () => {
    const onCancel = vi.fn();
    const built = buildCommitMergeSession({ title: 't', files: [MANIFEST], place, apply: vi.fn(), onCancel });
    built.onCancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
