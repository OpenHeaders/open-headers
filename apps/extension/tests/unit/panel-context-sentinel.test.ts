/**
 * Panel context sentinel — polls `chrome.runtime.id` and swaps the
 * document body for a static "reopen DevTools" notice the moment an
 * extension reload/update orphans the panel document. Past the trigger
 * it must not touch any `chrome.*` surface.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn(() => 'en'),
}));

import { startContextSentinel } from '@/panel/context-sentinel';

const POLL_MS = 3_000;

let stop: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  (chrome.runtime as { id?: string }).id = 'test-id';
  document.body.innerHTML = '<div id="root">panel content</div>';
});

afterEach(() => {
  stop?.();
  stop = null;
  (chrome.runtime as { id?: string }).id = 'test-id';
  vi.useRealTimers();
});

describe('startContextSentinel', () => {
  it('leaves the document alone while the context is alive', () => {
    stop = startContextSentinel();

    vi.advanceTimersByTime(POLL_MS * 5);
    expect(document.getElementById('root')?.textContent).toBe('panel content');
  });

  it('renders the invalidated notice when chrome.runtime.id disappears', () => {
    stop = startContextSentinel();

    (chrome.runtime as { id?: string }).id = undefined;
    vi.advanceTimersByTime(POLL_MS);

    expect(document.getElementById('root')).toBeNull();
    expect(document.body.textContent).toContain('Open Headers was updated or reloaded');
    expect(document.body.textContent).toContain('Close and reopen DevTools to continue.');
  });

  it('stops polling after the notice renders', () => {
    stop = startContextSentinel();

    (chrome.runtime as { id?: string }).id = undefined;
    vi.advanceTimersByTime(POLL_MS);
    const rendered = document.body.innerHTML;

    // Re-add content; a dead sentinel must not replace it again.
    const marker = document.createElement('span');
    marker.id = 'after-notice';
    document.body.appendChild(marker);
    vi.advanceTimersByTime(POLL_MS * 5);

    expect(document.getElementById('after-notice')).not.toBeNull();
    expect(document.body.innerHTML).toContain(rendered);
  });

  it('the stop handle cancels the watch', () => {
    stop = startContextSentinel();
    stop();
    stop = null;

    (chrome.runtime as { id?: string }).id = undefined;
    vi.advanceTimersByTime(POLL_MS * 5);
    expect(document.getElementById('root')?.textContent).toBe('panel content');
  });
});
