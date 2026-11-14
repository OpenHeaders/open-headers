// @vitest-environment jsdom
/**
 * The Git Console as a text view: what a selection copies (the text as
 * it was — a shortened path whole, a folded options run with every
 * option, one line of the feed per line), where a selection's other
 * occurrences stand across the feed's split text, and the mounted feed
 * — it takes focus, ends in the empty line the caret stands on, a key
 * walks the selection without leaving the feed, and its right-click
 * menu copies what was selected and clears.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import ConsoleView from '@openheaders/ui/workbench/components/panels/git/ConsoleView';
import { feedCopyText } from '@openheaders/ui/workbench/components/panels/git/feed-copy-text';
import { DEFAULT_GIT_CONSOLE_PREFS } from '@openheaders/ui/workbench/components/panels/git/git-console-view-state';
import {
  feedOccurrences,
  occurrenceNeedle,
} from '@openheaders/ui/workbench/components/panels/git/use-feed-occurrences';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ROOT = '/private/tmp/john-doe/session/scratchpad/hold/repo/ws';

function row(seq: number, command: string[], output = '', code = 0): WorkspaceTreeGitConsoleRowWire {
  return {
    seq,
    at: '2026-11-14T13:08:58.905Z',
    options: ['--git-dir', `${ROOT}/.git`, '--work-tree', ROOT],
    command,
    cwd: ROOT,
    code,
    durationMs: 12,
    output,
  };
}

const ROWS = [
  row(1, ['fetch', '--quiet']),
  row(2, ['restore', '--staged', '--pathspec-from-file=-', '--pathspec-file-nul']),
  row(
    3,
    ['ls-remote', '--', 'openheaders.io', 'HEAD'],
    "'openheaders.io' does not appear to be a git repository\nCould not read from remote repository.",
    128,
  ),
  row(4, ['rm', '--pathspec-from-file=-', '--pathspec-file-nul']),
];

const writeText = vi.fn(async (_text: string) => undefined);

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  // jsdom lays nothing out: a range answers no boxes.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
});

afterEach(() => {
  cleanup();
  writeText.mockClear();
  document.getSelection()?.removeAllRanges();
});

function mount(rows = ROWS, onClear = vi.fn()): { onClear: ReturnType<typeof vi.fn> } {
  render(
    <ConsoleView
      rows={rows}
      prefs={DEFAULT_GIT_CONSOLE_PREFS}
      font={{ family: 'monospace', size: 12 }}
      expanded={new Set()}
      onToggleExpanded={() => undefined}
      onTogglePref={() => undefined}
      onClear={onClear}
    />,
  );
  return { onClear };
}

const lineOf = (seq: number): Element => {
  const found = document.querySelector(`[data-testid="git-tool-console-row"][data-seq="${seq}"] [data-line]`);
  if (found === null) throw new Error(`no line for row ${seq}`);
  return found;
};

/** The text node that holds `text`, and where it starts in it. */
function at(scope: Element, text: string): [Text, number] {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const index = (node.nodeValue ?? '').indexOf(text);
    if (index !== -1 && node instanceof Text) return [node, index];
  }
  throw new Error(`no text "${text}"`);
}

function select(from: [Text, number], to: [Text, number]): Selection {
  const selection = document.getSelection();
  if (selection === null) throw new Error('no selection');
  selection.setBaseAndExtent(from[0], from[1], to[0], to[1]);
  return selection;
}

describe('feedCopyText', () => {
  it('copies a line through its folded run and its shortened paths as the command ran', () => {
    mount();
    const line = lineOf(1);
    // As drawn the line reads with a chip and an elided path.
    expect(line.textContent).toContain('--git-dir …');
    expect(line.textContent).toContain('[/private/tmp/…/repo/ws]');
    const range = document.createRange();
    range.selectNodeContents(line);
    const text = feedCopyText(range.cloneContents());
    expect(text).toContain(`[${ROOT}] git --git-dir ${ROOT}/.git --work-tree ${ROOT} fetch --quiet`);
    expect(text).not.toContain('…');
    expect(text).not.toContain('\n');
  });

  it('a selection inside one token copies the characters it covers', () => {
    mount();
    const [node, index] = at(lineOf(2), '--pathspec-from-file=-');
    const range = document.createRange();
    range.setStart(node, index + 2);
    range.setEnd(node, index + 10);
    expect(feedCopyText(range.cloneContents())).toBe('pathspec');
  });

  it('a selection over several lines reads one per line, the output’s own lines among them', () => {
    mount();
    const range = document.createRange();
    range.setStart(...at(lineOf(3), 'ls-remote'));
    const [last, lastAt] = at(lineOf(4), 'rm');
    range.setEnd(last, lastAt + 2);
    const text = feedCopyText(range.cloneContents());
    const lines = text.split('\n');
    expect(lines[0]).toBe('ls-remote -- openheaders.io HEAD → 128');
    expect(lines[1]).toBe("'openheaders.io' does not appear to be a git repository");
    expect(lines[2]).toBe('Could not read from remote repository.');
    expect(lines[3].endsWith(`git --git-dir ${ROOT}/.git --work-tree ${ROOT} rm`)).toBe(true);
    expect(lines).toHaveLength(4);
  });
});

describe('feed occurrences', () => {
  it('finds a text that runs across several of a line’s tokens, on every line that holds it', () => {
    mount();
    const lines = screen.getByTestId('git-tool-console-lines');
    const found = feedOccurrences(lines, '--pathspec-from-file=- --pathspec-file-nul');
    expect(found.map((range) => range.toString())).toEqual([
      '--pathspec-from-file=- --pathspec-file-nul',
      '--pathspec-from-file=- --pathspec-file-nul',
    ]);
    expect(lineOf(2).contains(found[0].startContainer)).toBe(true);
    expect(lineOf(4).contains(found[1].endContainer)).toBe(true);
    // Twice on a line that holds it twice; never across two lines.
    expect(feedOccurrences(lines, '--pathspec')).toHaveLength(4);
    expect(feedOccurrences(lines, 'repository.\nCould')).toHaveLength(0);
    expect(feedOccurrences(lines, '')).toHaveLength(0);
  });

  it('looks a selection up only when it sits on one line and holds more than a character', () => {
    mount();
    const lines = screen.getByTestId('git-tool-console-lines');
    const [node, index] = at(lineOf(2), '--pathspec-from-file=-');
    expect(occurrenceNeedle(select([node, index], [node, index + 10]), lines)).toBe('--pathspec');
    expect(occurrenceNeedle(select([node, index], [node, index + 1]), lines)).toBeNull();
    expect(occurrenceNeedle(select([node, index], [node, index]), lines)).toBeNull();
    const [other, otherAt] = at(lineOf(4), 'rm');
    expect(occurrenceNeedle(select([node, index], [other, otherAt + 2]), lines)).toBeNull();
  });
});

describe('ConsoleView (mounted)', () => {
  it('is a text view: it takes focus, ends in the empty line, and draws its caret there', () => {
    mount();
    const feed = screen.getByTestId('git-tool-console');
    expect(feed.getAttribute('tabindex')).toBe('0');
    const tail = screen.getByTestId('git-tool-console-tail');
    expect(tail.textContent).toBe('');
    expect(screen.getByTestId('git-tool-console-lines').lastElementChild).toBe(tail);
    const caret = screen.getByTestId('git-tool-console-caret');
    // Still until the feed holds the keyboard.
    expect(caret.hasAttribute('data-blink')).toBe(false);
    fireEvent.focus(feed);
    expect(screen.getByTestId('git-tool-console-caret').hasAttribute('data-blink')).toBe(true);
    // Focus with no place in the feed starts at its end.
    const selection = document.getSelection();
    expect(selection?.isCollapsed).toBe(true);
    expect(selection?.focusNode).toBe(tail);
  });

  it('an empty feed has no line and no caret', () => {
    mount([]);
    expect(screen.queryByTestId('git-tool-console-tail')).toBeNull();
    expect(screen.queryByTestId('git-tool-console-caret')).toBeNull();
  });

  it('the feed’s ends are where a walk stops: Select All takes its lines, the start and the end collapse inside it', () => {
    mount();
    const feed = screen.getByTestId('git-tool-console');
    const lines = screen.getByTestId('git-tool-console-lines');
    fireEvent.focus(feed);
    const selection = document.getSelection();
    fireEvent.keyDown(feed, { key: 'a', metaKey: true, ctrlKey: true });
    // Neither platform's chord: both command keys at once.
    expect(selection?.isCollapsed).toBe(true);
    // Select All runs from the first line's start to the tail — the caret ends at the feed's end.
    fireEvent.keyDown(feed, { key: 'a', ctrlKey: true });
    expect(selection?.anchorNode).toBe(lines);
    expect(selection?.anchorOffset).toBe(0);
    expect(selection?.focusNode).toBe(screen.getByTestId('git-tool-console-tail'));
    fireEvent.keyDown(feed, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyDown(feed, { key: 'Home', ctrlKey: true });
    expect(selection?.isCollapsed).toBe(true);
    expect(selection?.focusNode).toBe(lines);
    expect(selection?.focusOffset).toBe(0);
    fireEvent.keyDown(feed, { key: 'ArrowDown', metaKey: true, shiftKey: true });
    fireEvent.keyDown(feed, { key: 'End', ctrlKey: true, shiftKey: true });
    expect(selection?.isCollapsed).toBe(false);
    expect(selection?.focusNode).toBe(screen.getByTestId('git-tool-console-tail'));
    expect(lines.contains(selection?.anchorNode ?? null)).toBe(true);
  });

  it('the menu: Copy is held with nothing selected; with a selection it copies the text as it was; Clear All clears', async () => {
    const { onClear } = mount();
    const feed = screen.getByTestId('git-tool-console');
    fireEvent.contextMenu(feed);
    const copy = await screen.findByTestId('git-tool-console-menu-copy');
    expect(copy.closest('[role="menuitem"]')?.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('git-tool-console-menu-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);

    const line = lineOf(1);
    const [from, fromAt] = at(line, '[');
    const [to, toAt] = at(line, 'fetch');
    select([from, fromAt], [to, toAt + 5]);
    fireEvent.contextMenu(feed);
    await waitFor(() =>
      expect(
        screen.getByTestId('git-tool-console-menu-copy').closest('[role="menuitem"]')?.getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    fireEvent.click(screen.getByTestId('git-tool-console-menu-copy'));
    expect(writeText).toHaveBeenCalledWith(`[${ROOT}] git --git-dir ${ROOT}/.git --work-tree ${ROOT} fetch`);
  });

  it('the copy chord puts the text as it was on the clipboard', () => {
    mount();
    const feed = screen.getByTestId('git-tool-console');
    const line = lineOf(1);
    const [from, fromAt] = at(line, 'git');
    const [to, toAt] = at(line, 'fetch');
    select([from, fromAt], [to, toAt + 5]);
    const setData = vi.fn();
    fireEvent.copy(feed, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', `git --git-dir ${ROOT}/.git --work-tree ${ROOT} fetch`);
  });
});
