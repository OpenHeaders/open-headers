/**
 * The reconnect-across-checkout toast's copy (`git-head-notice.ts`): a
 * branch stamp names the branch, a detached stamp names the short sha,
 * the empty stamp has nothing to name and stays silent.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { gitHeadNoticeText } from '@openheaders/ui/workbench/git-head-notice';
import { describe, expect, it } from 'vitest';

const t: Translate = (key, vars) =>
  [key, ...Object.entries(vars ?? {}).map(([name, value]) => `${name}=${String(value)}`)].join(' ');

describe('gitHeadNoticeText', () => {
  it('names the workspace and the branch', () => {
    expect(gitHeadNoticeText(t, 'Payments', 'feature/auth-headers')).toBe(
      'workbench.shell.toast.gitHeadBranch workspace=Payments branch=feature/auth-headers',
    );
  });

  it('names a detached HEAD by its first eight characters', () => {
    expect(gitHeadNoticeText(t, 'Payments', '@{0123456789abcdef0123456789abcdef01234567}')).toBe(
      'workbench.shell.toast.gitHeadDetached workspace=Payments sha=01234567',
    );
  });

  it('says nothing for the empty stamp', () => {
    expect(gitHeadNoticeText(t, 'Payments', '')).toBeNull();
  });
});
