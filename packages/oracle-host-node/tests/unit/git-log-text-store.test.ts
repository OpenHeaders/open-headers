/**
 * The packed store of a history's texts (`log-text-store`): a text is
 * the number it was added under, a subject comes back as it went in, an
 * author's name is held once, the store grows past what it started
 * with, and a view of it is shared memory that what is added later
 * never moves.
 */

import { describe, expect, it } from 'vitest';
import { createLogTextStore, type LogTextView } from '../../src/git/log-text-store';

/** A view's text `text`, read as a worker would read it: off the shared bytes. */
const subjectIn = (view: LogTextView, text: number): string => {
  const starts = new Uint32Array(view.starts);
  return Buffer.from(view.subjects).toString('utf8', starts[text], starts[text + 1]);
};
const authorIn = (view: LogTextView, text: number): string => view.authors[new Uint32Array(view.authorIds)[text]];

describe('the store of a history’s texts', () => {
  it('numbers the texts in the order they are added and gives each back as it went in', () => {
    const store = createLogTextStore();
    expect(store.count).toBe(0);
    expect(store.add('John Doe', 'Add orders request')).toBe(0);
    expect(store.add('Jane Doe', '')).toBe(1);
    expect(store.add('John Doe', 'Größe ändern — naïve café 🚀')).toBe(2);
    expect(store.count).toBe(3);
    expect([0, 1, 2].map(store.subjectOf)).toEqual(['Add orders request', '', 'Größe ändern — naïve café 🚀']);
  });

  it('holds an author’s name once, a number per text', () => {
    const store = createLogTextStore();
    store.add('John Doe', 'one');
    store.add('Jane Doe', 'two');
    store.add('John Doe', 'three');
    store.add('john doe', 'four');
    expect(store.authors).toEqual(['John Doe', 'Jane Doe', 'john doe']);
    expect([0, 1, 2, 3].map(store.authorIdOf)).toEqual([0, 1, 0, 2]);
  });

  it('grows past the room it started with — in texts and in bytes — and keeps every text', () => {
    const store = createLogTextStore();
    const subjectOf = (text: number): string => `Fix №${text} — ${'ü'.repeat(text % 90)}`;
    const count = 40_000;
    for (let text = 0; text < count; text += 1) store.add(`Author ${text % 300}`, subjectOf(text));
    expect(store.count).toBe(count);
    expect(store.authors).toHaveLength(300);
    for (const text of [0, 1, 16_383, 16_384, 16_385, 32_768, count - 1]) {
      expect(store.subjectOf(text)).toBe(subjectOf(text));
      expect(store.authors[store.authorIdOf(text)]).toBe(`Author ${text % 300}`);
    }
    // One long subject alone outgrows the bytes several times over.
    const long = '長'.repeat(900_000);
    const at = store.add('John Doe', long);
    expect(store.subjectOf(at)).toBe(long);
    expect(store.subjectOf(count - 1)).toBe(subjectOf(count - 1));
  });

  it('is read through a view as shared memory — the bytes themselves, nothing copied', () => {
    const store = createLogTextStore();
    store.add('John Doe', 'Add orders request');
    store.add('Jane Doe', 'Ärger mit Größe');
    const view = store.view();
    expect(view.count).toBe(2);
    expect(view.subjects).toBeInstanceOf(SharedArrayBuffer);
    expect(view.starts).toBeInstanceOf(SharedArrayBuffer);
    expect(view.authorIds).toBeInstanceOf(SharedArrayBuffer);
    expect([0, 1].map((text) => subjectIn(view, text))).toEqual(['Add orders request', 'Ärger mit Größe']);
    expect([0, 1].map((text) => authorIn(view, text))).toEqual(['John Doe', 'Jane Doe']);
    // Two views of a store that has not grown are the same memory.
    expect(store.view().subjects).toBe(view.subjects);
  });

  it('never moves what a view holds: texts added later, and a store grown since, leave it as it was', () => {
    const store = createLogTextStore();
    store.add('John Doe', 'Add orders request');
    store.add('Jane Doe', 'Fix response panel');
    const view = store.view();
    for (let text = 0; text < 40_000; text += 1) store.add(`Author ${text}`, `Later work ${text} ${'x'.repeat(40)}`);
    expect(store.view().subjects).not.toBe(view.subjects);
    expect(view.count).toBe(2);
    expect(view.authors).toEqual(['John Doe', 'Jane Doe']);
    expect([0, 1].map((text) => subjectIn(view, text))).toEqual(['Add orders request', 'Fix response panel']);
    expect([0, 1].map((text) => authorIn(view, text))).toEqual(['John Doe', 'Jane Doe']);
    expect(store.subjectOf(1)).toBe('Fix response panel');
  });
});
