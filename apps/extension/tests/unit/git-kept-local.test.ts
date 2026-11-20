/**
 * kept-local pins: a pull or merge that named no kept file raises no
 * line; a named one reads its paths, the first three and an ellipsis
 * past that. A refusal reads its own detail, except a repository
 * another git process is writing, which says so.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  fetchFailureLine,
  integrationRefusalDetail,
  keptLocalNotice,
  refusalDetail,
} from '@openheaders/ui/workbench/components/panels/git/kept-local';
import { describe, expect, it } from 'vitest';

const t: Translate = (key, args) => `${key}|${String(args?.files)}`;

describe('keptLocalNotice', () => {
  it('nothing kept raises nothing', () => {
    expect(keptLocalNotice(undefined, t)).toBeNull();
    expect(keptLocalNotice([], t)).toBeNull();
  });

  it('the kept paths are named in order', () => {
    expect(keptLocalNotice(['docs/README.md'], t)).toBe('workbench.gitLog.keptLocal|docs/README.md');
    expect(keptLocalNotice(['.gitignore', 'README.md', 'scripts/run.sh'], t)).toBe(
      'workbench.gitLog.keptLocal|.gitignore, README.md, scripts/run.sh',
    );
  });

  it('past three the line trails off', () => {
    expect(keptLocalNotice(['a.md', 'b.md', 'c.md', 'd.md', 'e.md'], t)).toBe(
      'workbench.gitLog.keptLocal|a.md, b.md, c.md, …',
    );
  });
});

describe('refusalDetail', () => {
  it('a busy index says so in words, whatever detail the host sent', () => {
    const busy = { reason: 'index-locked', detail: '/repo/.git/index.lock is held by another git process' };
    expect(refusalDetail(busy, t)).toBe('workbench.gitLog.indexLocked|undefined');
    expect(integrationRefusalDetail(busy, t)).toBe('workbench.gitLog.indexLocked|undefined');
  });

  it('a pull of a branch with no upstream says so in words, never the reason’s code', () => {
    expect(integrationRefusalDetail({ reason: 'no-upstream' }, t)).toBe('workbench.gitLog.pull.noUpstream|undefined');
  });

  it('a failed fetch reads the first line of git’s answer, on either line ending', () => {
    const answer = [
      "fatal: '/srv/git/big.git' does not appear to be a git repository",
      'fatal: Could not read from remote repository.',
      '',
      'Please make sure you have the correct access rights',
      'and the repository exists.',
      'error: could not fetch origin',
    ];
    const first = "fatal: '/srv/git/big.git' does not appear to be a git repository";
    expect(fetchFailureLine({ reason: 'fetch-failed', detail: answer.join('\n') })).toBe(first);
    expect(fetchFailureLine({ reason: 'fetch-failed', detail: `\r\n${answer.join('\r\n')}` })).toBe(first);
    expect(integrationRefusalDetail({ reason: 'fetch-failed', detail: answer.join('\n') }, t)).toBe(first);
  });

  it('a failed fetch git said nothing of reads its reason', () => {
    expect(fetchFailureLine({ reason: 'fetch-failed' })).toBe('fetch-failed');
    expect(fetchFailureLine({ reason: 'fetch-failed', detail: ' \n' })).toBe('fetch-failed');
  });

  it('any other refusal reads its detail, or its reason when it has none', () => {
    expect(refusalDetail({ reason: 'commit-failed', detail: 'hook says no' }, t)).toBe('hook says no');
    expect(refusalDetail({ reason: 'commit-failed' }, t)).toBe('commit-failed');
  });
});
