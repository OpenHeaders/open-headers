/**
 * Diff renderer — row-diff writes, one flush per frame, stale-row
 * clearing, resize invalidation — and the ANSI-aware truncation
 * helpers behind the truncate-not-wrap law.
 */

import { describe, expect, it } from 'vitest';
import { createScreenRenderer, truncateToWidth, visibleWidth } from '../../../src/tui/screen';
import { makeFakeTty } from './fake-tty';

function rowAt(line: number, content: string): string {
  return `\x1b[${line};1H\x1b[2K${content}`;
}

describe('createScreenRenderer', () => {
  it('first render paints every frame row and clears the rest of the screen in one write', () => {
    const tty = makeFakeTty({ rows: 4 });
    const renderer = createScreenRenderer(tty.output, { columns: 80, rows: 4 });

    renderer.render(['alpha', 'beta']);

    expect(tty.output.writes).toHaveLength(1);
    expect(tty.output.written()).toBe(`${rowAt(1, 'alpha')}${rowAt(2, 'beta')}${rowAt(3, '')}${rowAt(4, '')}`);
  });

  it('rewrites only the rows that changed', () => {
    const tty = makeFakeTty({ rows: 4 });
    const renderer = createScreenRenderer(tty.output, { columns: 80, rows: 4 });
    renderer.render(['alpha', 'beta', 'gamma']);
    tty.output.clear();

    renderer.render(['alpha', 'BETA', 'gamma']);

    expect(tty.output.writes).toHaveLength(1);
    expect(tty.output.written()).toBe(rowAt(2, 'BETA'));
  });

  it('writes nothing for an identical frame', () => {
    const tty = makeFakeTty({ rows: 4 });
    const renderer = createScreenRenderer(tty.output, { columns: 80, rows: 4 });
    renderer.render(['alpha', 'beta']);
    tty.output.clear();

    renderer.render(['alpha', 'beta']);

    expect(tty.output.writes).toHaveLength(0);
  });

  it('clears rows a shrinking frame no longer covers', () => {
    const tty = makeFakeTty({ rows: 4 });
    const renderer = createScreenRenderer(tty.output, { columns: 80, rows: 4 });
    renderer.render(['alpha', 'beta', 'gamma']);
    tty.output.clear();

    renderer.render(['alpha']);

    expect(tty.output.written()).toBe(`${rowAt(2, '')}${rowAt(3, '')}`);
  });

  it('drops frame rows beyond the terminal height', () => {
    const tty = makeFakeTty({ rows: 2 });
    const renderer = createScreenRenderer(tty.output, { columns: 80, rows: 2 });

    renderer.render(['one', 'two', 'three', 'four']);

    expect(tty.output.written()).toBe(`${rowAt(1, 'one')}${rowAt(2, 'two')}`);
  });

  it('resize invalidates the buffer and the next render repaints everything', () => {
    const tty = makeFakeTty({ rows: 4 });
    const renderer = createScreenRenderer(tty.output, { columns: 80, rows: 4 });
    renderer.render(['alpha', 'beta']);
    tty.output.clear();

    renderer.resize({ columns: 60, rows: 3 });
    renderer.render(['alpha', 'beta']);

    expect(renderer.size).toEqual({ columns: 60, rows: 3 });
    expect(tty.output.written()).toBe(`${rowAt(1, 'alpha')}${rowAt(2, 'beta')}${rowAt(3, '')}`);
  });
});

describe('visibleWidth', () => {
  it('counts plain characters', () => {
    expect(visibleWidth('rules')).toBe(5);
  });

  it('does not count SGR sequences', () => {
    expect(visibleWidth('\x1b[32m● on\x1b[0m')).toBe(4);
  });

  it('counts astral code points once', () => {
    expect(visibleWidth('a\u{1f600}b')).toBe(3);
  });
});

describe('truncateToWidth', () => {
  it('passes short strings through untouched', () => {
    expect(truncateToWidth('auth-header', 20)).toBe('auth-header');
  });

  it('clips at the cell edge with the ellipsis', () => {
    expect(truncateToWidth('auth-header-inject', 10)).toBe('auth-head…');
  });

  it('supports the ASCII ellipsis', () => {
    expect(truncateToWidth('auth-header-inject', 10, '..')).toBe('auth-hea..');
  });

  it('ignores SGR sequences when measuring and closes styling after the cut', () => {
    const styled = '\x1b[32m● on\x1b[0m auth-header-inject';
    expect(truncateToWidth(styled, 8)).toBe('\x1b[32m● on\x1b[0m au…\x1b[0m');
  });

  it('keeps a styled string that fits, styling intact', () => {
    const styled = '\x1b[32m● on\x1b[0m';
    expect(truncateToWidth(styled, 4)).toBe(styled);
  });

  it('hard-cuts when the ellipsis itself does not fit', () => {
    expect(truncateToWidth('abc', 1, '..')).toBe('a');
  });

  it('returns empty for zero width', () => {
    expect(truncateToWidth('abc', 0)).toBe('');
  });
});
