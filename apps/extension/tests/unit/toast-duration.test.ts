/**
 * The error toast's stay scales with its words: a floor every error
 * gets, a ceiling past which it should be a notification, three words
 * a second between.
 */

import { errorToastDuration } from '@openheaders/ui/shared/notifications';
import { describe, expect, it } from 'vitest';

describe('errorToastDuration', () => {
  it('gives a short error the floor', () => {
    expect(errorToastDuration('Could not connect: IPC operation failed: -3')).toBe(6);
  });

  it('scales a paragraph by its words', () => {
    const words = Array.from({ length: 24 }, (_, i) => `word${i}`).join(' ');
    expect(errorToastDuration(words)).toBe(8);
  });

  it('caps a long one at the ceiling', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    expect(errorToastDuration(words)).toBe(10);
  });
});
