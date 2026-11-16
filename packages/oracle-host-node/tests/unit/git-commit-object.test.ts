/**
 * A commit read off its own object (`git/commit-object`): its parents,
 * its author, the author's date in the author's offset, its subject and
 * the co-authors its body names — exactly as `git log` prints them, or
 * not at all. Objects written out by hand for each rule, then every
 * commit of a scratch repo held against git's own print of it.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseCommitObject } from '../../src/git/commit-object';
import { listCommitsBySha } from '../../src/git/log-rows';
import type { CommitLogHead } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import { EVERY_REF, objects, openScratchRepo, run, type ScratchRepo, seedHistory } from './_log-history-repo';

const SHA = 'a'.repeat(40);
const TREE = `tree ${'b'.repeat(40)}`;
const P1 = 'c'.repeat(40);
const P2 = 'd'.repeat(40);
const AUTHOR = 'author John Doe <john.doe@openheaders.io> 1700000000 +0100';
const COMMITTER = 'committer Jane Doe <jane.doe@openheaders.io> 1700000060 +0000';

/** A commit object: its header lines, a blank line, its message. */
const object = (headers: string[], message: string): Buffer =>
  Buffer.from(`${headers.join('\n')}\n\n${message}`, 'utf8');
const parse = (headers: string[], message: string): CommitLogHead | null =>
  parseCommitObject(SHA, object(headers, message));

describe('parseCommitObject — what a commit says of itself', () => {
  it('reads the parents in order, the author, the date in the author’s offset and the subject', () => {
    expect(parse([TREE, `parent ${P1}`, `parent ${P2}`, AUTHOR, COMMITTER], 'Add orders request\n')).toEqual({
      sha: SHA,
      parents: [P1, P2],
      authorName: 'John Doe',
      authorEmail: 'john.doe@openheaders.io',
      authoredAt: '2023-11-14T23:13:20+01:00',
      subject: 'Add orders request',
      coAuthors: [],
    });
  });

  it('reads a first commit as one with no parent, and a commit with no message as one with no subject', () => {
    expect(parse([TREE, AUTHOR, COMMITTER], '')).toMatchObject({ parents: [], subject: '', coAuthors: [] });
  });

  it('spells the date in the author’s own offset — behind, ahead by a half hour, and none as Z', () => {
    const at = (offset: string): string | undefined =>
      parse([TREE, `author John Doe <john.doe@openheaders.io> 1700000000 ${offset}`, COMMITTER], 'x')?.authoredAt;
    expect(at('-0800')).toBe('2023-11-14T14:13:20-08:00');
    expect(at('+0530')).toBe('2023-11-15T03:43:20+05:30');
    expect(at('+0000')).toBe('2023-11-14T22:13:20Z');
    expect(at('-0000')).toBe('2023-11-14T22:13:20Z');
  });

  it('joins the lines of the first paragraph into the subject, each without the blanks at its end', () => {
    expect(parse([TREE, AUTHOR, COMMITTER], 'Rename the request   \n  and its folder\t\n\nBody\n')?.subject).toBe(
      'Rename the request   and its folder',
    );
    // Lines ended the other way: the carriage return is a blank.
    expect(parse([TREE, AUTHOR, COMMITTER], 'Rename the request\r\nand its folder\r\n\r\nBody\r\n')?.subject).toBe(
      'Rename the request and its folder',
    );
  });

  it('starts the subject past the blank lines before it, and ends it on a line of blanks', () => {
    expect(parse([TREE, AUTHOR, COMMITTER], '\n \t\n\nTidy the docs\n \t \nBody')?.subject).toBe('Tidy the docs');
  });

  it('names the co-authors of the body, each once — never one written in the subject’s paragraph', () => {
    const message = [
      'Bump version',
      'Co-authored-by: In The Subject <subject@openheaders.io>',
      '',
      '',
      'Body',
      '',
      'Co-authored-by: Jane Doe <jane.doe@openheaders.io>',
      'co-authored-by:   Jane Roe <jane.roe@openheaders.io>  ',
      'Co-authored-by: Jane Doe <jane.doe@openheaders.io>',
    ].join('\n');
    const read = parse([TREE, AUTHOR, COMMITTER], message);
    expect(read?.subject).toBe('Bump version Co-authored-by: In The Subject <subject@openheaders.io>');
    expect(read?.coAuthors).toEqual(['Jane Doe <jane.doe@openheaders.io>', 'Jane Roe <jane.roe@openheaders.io>']);
  });

  it('reads past a header that runs on — a signature’s lines are no header of their own', () => {
    const signed = [
      TREE,
      `parent ${P1}`,
      AUTHOR,
      COMMITTER,
      'gpgsig -----BEGIN PGP SIGNATURE-----',
      ' ',
      ' author Someone Else <else@openheaders.io> 1 +0000',
      ` parent ${P2}`,
      ' -----END PGP SIGNATURE-----',
    ];
    expect(parse(signed, 'Signed work\n')).toMatchObject({
      parents: [P1],
      authorName: 'John Doe',
      subject: 'Signed work',
    });
  });

  it('ends the author’s name before the blanks that precede the address, and takes an address with none', () => {
    expect(parse([TREE, 'author John Doe \t <> 1700000000 +0000', COMMITTER], 'x')).toMatchObject({
      authorName: 'John Doe',
      authorEmail: '',
    });
    expect(parse([TREE, 'author <john.doe@openheaders.io> 1700000000 +0000', COMMITTER], 'x')?.authorName).toBe('');
  });

  it('says UTF-8 by name is the rule too', () => {
    expect(parse([TREE, AUTHOR, COMMITTER, 'encoding UTF-8'], 'Añadir pedido\n')?.subject).toBe('Añadir pedido');
    expect(parse([TREE, AUTHOR, COMMITTER, 'encoding utf8'], 'x')).not.toBeNull();
  });
});

describe('parseCommitObject — a commit it does not read', () => {
  it('leaves a commit of another encoding to git', () => {
    expect(parse([TREE, AUTHOR, COMMITTER, 'encoding ISO-8859-1'], 'x')).toBeNull();
  });

  it('leaves an author line of another shape to git', () => {
    const odd = (author: string): CommitLogHead | null => parse([TREE, author, COMMITTER], 'x');
    expect(odd('author John Doe <john.doe@openheaders.io> 1700000000')).toBeNull();
    expect(odd('author John Doe <john.doe@openheaders.io>> 1700000000 +0000')).toBeNull();
    expect(odd('author John Doe john.doe@openheaders.io 1700000000 +0000')).toBeNull();
    expect(odd('author John Doe <john.doe@openheaders.io> -5 +0000')).toBeNull();
    expect(parse([TREE, COMMITTER], 'x')).toBeNull();
  });

  it('leaves a date no calendar holds to git', () => {
    const at = (when: string): CommitLogHead | null =>
      parse([TREE, `author John Doe <john.doe@openheaders.io> ${when}`, COMMITTER], 'x');
    expect(at('253402300800 +0000')).toBeNull();
    expect(at('1700000000 +1500')).toBeNull();
    expect(at('1700000000 +0060')).toBeNull();
    expect(at('253402300799 +0000')).not.toBeNull();
    expect(at('1700000000 +1400')).not.toBeNull();
  });

  it('leaves a message with a NUL in it, and an object with no blank line, to git', () => {
    expect(parse([TREE, AUTHOR, COMMITTER], 'Bump\0version')).toBeNull();
    expect(parseCommitObject(SHA, Buffer.from(`${TREE}\n${AUTHOR}\n${COMMITTER}\n`, 'utf8'))).toBeNull();
  });
});

describe('parseCommitObject — held against git’s own print', () => {
  let repo: ScratchRepo;

  /** A commit with exactly this message, kept as written, at this author's date. */
  const commit = async (message: string, date = '1700100000 +0000'): Promise<void> => {
    const file = path.join(repo.rootDir, '..', `${path.basename(repo.rootDir)}.msg`);
    await fs.writeFile(file, message, 'utf8');
    const result = await run(
      [
        ...repoArgs(repo.rootDir),
        'commit',
        '-q',
        '--allow-empty',
        '--allow-empty-message',
        '--cleanup=verbatim',
        '-F',
        file,
      ],
      {
        cwd: repo.rootDir,
        env: {
          GIT_AUTHOR_NAME: 'John Doe',
          GIT_AUTHOR_EMAIL: 'john.doe@openheaders.io',
          GIT_COMMITTER_NAME: 'Jane Doe',
          GIT_COMMITTER_EMAIL: 'jane.doe@openheaders.io',
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: '1700100000 +0000',
        },
      },
    );
    await fs.rm(file, { force: true });
    if (result.code !== 0) throw new Error(result.stderr);
  };

  beforeAll(async () => {
    repo = await openScratchRepo('oh-commit-object-');
    await seedHistory(repo);
    await commit('Two lines\nof a subject   \n\n\nBody first\n\nCo-authored-by: Jane Doe <jane.doe@openheaders.io>\n');
    await commit('\n\n  \nBlank lines first\n\nbody\n', '1700100000 +0530');
    await commit('Lines ended the other way\r\nsecond\r\n\r\nbody\r\n', '1700100000 -0800');
    await commit('No line end at all', '1700100000 +1400');
    await commit('', '1700100000 -1200');
    await commit(
      'Co-authored-by: In Subject <subject@openheaders.io>\nstill the subject\n\nCo-authored-by: Real <real@openheaders.io>',
    );
    await commit('Tabs\tinside \t\n\t\n\nbody under a line of blanks\n');
    await commit('Ünïcødé — subject ✓\n\n日本語の本文\n', '946684800 +0900');
    await commit('   Leading blanks kept\n\n\n\n   body\n\n\n');
  });

  afterAll(async () => {
    await repo.remove();
  });

  it('reads every commit of a repo as git prints it — merges, a first commit, messages of every shape', async () => {
    const shas = await repo.shas(...EVERY_REF);
    expect(shas.length).toBe(23);
    const batch = objects({ cwd: repo.rootDir });
    try {
      const bytes = await batch.readCommits(shas);
      const printed = await listCommitsBySha(run, repo.rootDir, shas, false);
      if (bytes === null || printed === null) throw new Error('git did not read the commits');
      const read = bytes.map((object, at) => (object === null ? null : parseCommitObject(shas[at], object)));
      // An older git spells no offset `+00:00`; the instant is the same.
      const asGitPrints = printed.map(({ files: _unread, ...head }) => ({
        ...head,
        authoredAt: head.authoredAt.replace(/\+00:00$/, 'Z'),
      }));
      expect(read).toEqual(asGitPrints);
      expect(new Set(read.map((head) => head?.subject)).size).toBeGreaterThan(20);
    } finally {
      batch.close();
    }
  });
});
