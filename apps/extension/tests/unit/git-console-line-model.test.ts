/**
 * Git console line model: a path elides its middle by components and
 * keeps its head and tail (never when fewer than two components would
 * hide); `--opt=/path` values elide behind their option; non-paths
 * stay words; the pinned options run folds to one chip, lays open on
 * the row's click, and reads plain when folding is off.
 */

import {
  consoleCommandLine,
  consoleToken,
  elidePath,
  optionsRunLines,
} from '@openheaders/ui/workbench/components/panels/git/git-console-line-model';
import { describe, expect, it } from 'vitest';

const ROOT = '/private/tmp/claude/session/scratchpad/hold/repo/ws';

describe('elidePath', () => {
  it('keeps the root and two components at each end', () => {
    expect(elidePath(ROOT)).toEqual({ head: '/private/tmp/', tail: '/repo/ws' });
    expect(elidePath(`${ROOT}/.git`)).toEqual({ head: '/private/tmp/', tail: '/ws/.git' });
  });

  it('leaves a path alone when fewer than two components would hide', () => {
    expect(elidePath('/a/b/c/d')).toBeNull();
    expect(elidePath('/a/b/c/d/e')).toBeNull();
    expect(elidePath('/a/b/c/d/e/f')).toEqual({ head: '/a/b/', tail: '/e/f' });
  });

  it('rides a drive letter with the head on a backslash path', () => {
    expect(elidePath('C:\\Users\\dana\\dev\\repos\\open\\ws')).toEqual({
      head: 'C:\\Users\\dana\\',
      tail: '\\open\\ws',
    });
  });
});

describe('consoleToken', () => {
  it('shortens an absolute path and keeps the full token beside it', () => {
    expect(consoleToken(ROOT, true)).toEqual({ kind: 'path', head: '/private/tmp/', tail: '/repo/ws', full: ROOT });
  });

  it('shortens the value of a valued option behind its prefix', () => {
    expect(consoleToken(`--pathspec-from-file=${ROOT}/list`, true)).toEqual({
      kind: 'path',
      head: '--pathspec-from-file=/private/tmp/',
      tail: '/ws/list',
      full: `--pathspec-from-file=${ROOT}/list`,
    });
  });

  it('leaves words, relative paths and short paths as words', () => {
    expect(consoleToken('fetch', true)).toEqual({ kind: 'word', text: 'fetch' });
    expect(consoleToken('docs/guides/setup.md', true)).toEqual({ kind: 'word', text: 'docs/guides/setup.md' });
    expect(consoleToken('/usr/bin', true)).toEqual({ kind: 'word', text: '/usr/bin' });
  });

  it('leaves every path whole with the toggle off', () => {
    expect(consoleToken(ROOT, false)).toEqual({ kind: 'word', text: ROOT });
  });
});

describe('optionsRunLines', () => {
  it('pairs every option with the values that follow it, flags and inline values alone', () => {
    expect(optionsRunLines(['--git-dir', '/r/.git', '--work-tree', '/r'])).toEqual([
      '--git-dir /r/.git',
      '--work-tree /r',
    ]);
    expect(optionsRunLines(['--no-pager', '-c', 'core.quotepath=false', '--git-dir=/r/.git'])).toEqual([
      '--no-pager',
      '-c core.quotepath=false',
      '--git-dir=/r/.git',
    ]);
    expect(optionsRunLines([])).toEqual([]);
  });
});

describe('consoleCommandLine', () => {
  const row = {
    options: ['--git-dir', `${ROOT}/.git`, '--work-tree', ROOT],
    command: ['commit', '-F', '/var/folders/jd/tg/T/git-commit-msg.txt', '--'],
  };

  it('folds the pinned options to one chip that carries the run', () => {
    const line = consoleCommandLine(row, { foldOptions: true, shortenPaths: true, expanded: false });
    expect(line.options).toEqual({
      state: 'folded',
      text: '--git-dir …',
      full: `--git-dir ${ROOT}/.git\n--work-tree ${ROOT}`,
    });
    expect(line.command).toEqual([
      { kind: 'word', text: 'commit' },
      { kind: 'word', text: '-F' },
      {
        kind: 'path',
        head: '/var/folders/',
        tail: '/T/git-commit-msg.txt',
        full: '/var/folders/jd/tg/T/git-commit-msg.txt',
      },
      { kind: 'word', text: '--' },
    ]);
  });

  it('lays the run open in full on the row that was clicked, still collapsible', () => {
    const line = consoleCommandLine(row, { foldOptions: true, shortenPaths: true, expanded: true });
    expect(line.options).toEqual({
      state: 'open',
      collapsible: true,
      tokens: [
        { kind: 'word', text: '--git-dir' },
        { kind: 'word', text: `${ROOT}/.git` },
        { kind: 'word', text: '--work-tree' },
        { kind: 'word', text: ROOT },
      ],
    });
  });

  it('reads plain with folding off, shortening its paths like the rest of the line', () => {
    const line = consoleCommandLine(row, { foldOptions: false, shortenPaths: true, expanded: false });
    expect(line.options).toEqual({
      state: 'open',
      collapsible: false,
      tokens: [
        { kind: 'word', text: '--git-dir' },
        { kind: 'path', head: '/private/tmp/', tail: '/ws/.git', full: `${ROOT}/.git` },
        { kind: 'word', text: '--work-tree' },
        { kind: 'path', head: '/private/tmp/', tail: '/repo/ws', full: ROOT },
      ],
    });
  });

  it('an invocation without global options has no run', () => {
    expect(
      consoleCommandLine(
        { options: [], command: ['version'] },
        { foldOptions: true, shortenPaths: true, expanded: false },
      ),
    ).toEqual({
      options: null,
      command: [{ kind: 'word', text: 'version' }],
    });
  });
});
