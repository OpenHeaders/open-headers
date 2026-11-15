/**
 * The linear runs a log tab folds (`panels/git/log-folds`): the fold a
 * press on a run makes, each run named by the first commit it hides,
 * and what Collapse / Expand Linear Branches have left to do.
 */

import {
  ALL_LOG_FOLDS,
  canFoldAll,
  canUnfoldAll,
  NO_LOG_FOLDS,
  toggleLogFold,
} from '@openheaders/ui/workbench/components/panels/git/log-folds';
import { describe, expect, it } from 'vitest';

const sha = (row: number): string => row.toString(16).padStart(40, '0');

describe('the fold a press on a run makes', () => {
  it('folds an open run by naming it and opens a folded one by taking its name out', () => {
    const folded = toggleLogFold(NO_LOG_FOLDS, sha(4), false);
    expect(folded).toEqual({ all: false, runs: [sha(4)] });
    expect(toggleLogFold(folded, sha(8), false)).toEqual({ all: false, runs: [sha(4), sha(8)] });
    expect(toggleLogFold(folded, sha(4), true)).toEqual(NO_LOG_FOLDS);
  });

  it('with every run folded, opens one by naming it and folds it again by taking its name out', () => {
    const opened = toggleLogFold(ALL_LOG_FOLDS, sha(4), true);
    expect(opened).toEqual({ all: true, runs: [sha(4)] });
    expect(toggleLogFold(opened, sha(4), false)).toEqual(ALL_LOG_FOLDS);
  });

  it('names a run once however often it is pressed the same way', () => {
    const once = toggleLogFold(NO_LOG_FOLDS, sha(4), false);
    expect(toggleLogFold(once, sha(4), false)).toEqual(once);
  });
});

describe('Collapse and Expand Linear Branches', () => {
  it('folds every run with none opened again, and opens every one by naming none', () => {
    expect(ALL_LOG_FOLDS).toEqual({ all: true, runs: [] });
    expect(NO_LOG_FOLDS).toEqual({ all: false, runs: [] });
  });

  it('has a run left to fold until every one is, and again once one of them was opened', () => {
    expect(canFoldAll(NO_LOG_FOLDS)).toBe(true);
    expect(canFoldAll({ all: false, runs: [sha(4)] })).toBe(true);
    expect(canFoldAll(ALL_LOG_FOLDS)).toBe(false);
    expect(canFoldAll({ all: true, runs: [sha(4)] })).toBe(true);
  });

  it('has a run to open once one is named folded or every one is', () => {
    expect(canUnfoldAll(NO_LOG_FOLDS)).toBe(false);
    expect(canUnfoldAll({ all: false, runs: [sha(4)] })).toBe(true);
    expect(canUnfoldAll(ALL_LOG_FOLDS)).toBe(true);
    expect(canUnfoldAll({ all: true, runs: [sha(4)] })).toBe(true);
  });
});
