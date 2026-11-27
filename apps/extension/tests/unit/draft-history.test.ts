import {
  amendEdit,
  DRAFT_HISTORY_LIMIT,
  historyOf,
  pushEdit,
  redoEdit,
  restateEntries,
  undoEdit,
} from '@openheaders/ui/workbench/components/live/draft-history';
import { describe, expect, it } from 'vitest';

interface Draft {
  name: string;
}

const draft = (name: string): Draft => ({ name });

describe('the undo history of a draft', () => {
  it('starts with nothing to undo and nothing to redo', () => {
    const start = draft('a');
    const history = historyOf(start);

    expect(history).toEqual({ past: [], present: start, future: [] });
    expect(undoEdit(history)).toBe(history);
    expect(redoEdit(history)).toBe(history);
  });

  it('an edit is an entry: undo returns the very draft that was there, redo the edit', () => {
    const a = draft('a');
    const b = draft('b');
    const edited = pushEdit(historyOf(a), b);

    const undone = undoEdit(edited);
    expect(undone.present).toBe(a);
    expect(undone.future).toEqual([b]);

    const redone = redoEdit(undone);
    expect(redone.present).toBe(b);
    expect(redone.past).toEqual([a]);
    expect(redone.future).toEqual([]);
  });

  it('undo and redo walk the edits in order', () => {
    const [a, b, c] = [draft('a'), draft('b'), draft('c')];
    const edited = pushEdit(pushEdit(historyOf(a), b), c);

    const back = undoEdit(undoEdit(edited));
    expect(back.present).toBe(a);
    expect(back.future).toEqual([b, c]);
    expect(redoEdit(back).present).toBe(b);
    expect(redoEdit(redoEdit(back)).present).toBe(c);
  });

  it('an edit after an undo drops what the undo took back', () => {
    const [a, b, c] = [draft('a'), draft('b'), draft('c')];
    const branched = pushEdit(undoEdit(pushEdit(historyOf(a), b)), c);

    expect(branched).toEqual({ past: [a], present: c, future: [] });
  });

  it('an edit that hands back the same draft is no entry', () => {
    const history = pushEdit(historyOf(draft('a')), draft('b'));

    expect(pushEdit(history, history.present)).toBe(history);
    expect(amendEdit(history, history.present)).toBe(history);
  });

  it('an edit that continues the last one keeps one entry: undo returns to before the run', () => {
    const a = draft('a');
    const typed = amendEdit(amendEdit(pushEdit(historyOf(a), draft('ab')), draft('abc')), draft('abcd'));

    expect(typed.past).toEqual([a]);
    expect(typed.present).toEqual(draft('abcd'));
    expect(undoEdit(typed).present).toBe(a);
  });

  it('an edit that continues the last one drops what an undo took back', () => {
    const undone = undoEdit(pushEdit(pushEdit(historyOf(draft('a')), draft('b')), draft('c')));

    expect(amendEdit(undone, draft('d')).future).toEqual([]);
  });

  it('every entry can be rewritten with none added: what an undo and a redo return is rewritten too', () => {
    const undone = undoEdit(pushEdit(pushEdit(historyOf(draft('a')), draft('b')), draft('c')));

    const restated = restateEntries(undone, (entry) => draft(`${entry.name}!`));

    expect(restated).toEqual({ past: [draft('a!')], present: draft('b!'), future: [draft('c!')] });
  });

  it(`keeps ${DRAFT_HISTORY_LIMIT} edits, and the oldest goes first`, () => {
    let history = historyOf(draft('0'));
    for (let i = 1; i <= DRAFT_HISTORY_LIMIT + 5; i += 1) history = pushEdit(history, draft(String(i)));

    expect(history.past).toHaveLength(DRAFT_HISTORY_LIMIT);
    expect(history.past[0]).toEqual(draft('5'));
    expect(history.present).toEqual(draft(String(DRAFT_HISTORY_LIMIT + 5)));
  });
});
