/**
 * Suggestions list and "Don't show again" mutes in the notifications
 * store.
 *
 * Pins the panel's new contracts:
 *   - suggestions are a separate list with push/dismiss/clear-all and
 *     dedupe-key drops, and never feed the unseen (bell dot) count;
 *   - muting a key drops it from both lists and gates future pushes,
 *     persisted across store resets via localStorage;
 *   - sticky entries ignore mutes — only their producer retires them;
 *   - unmuting lifts the push-time gate again.
 */

import {
  __resetNotificationsForTests,
  clearAllSuggestions,
  dismissSuggestion,
  muteNotificationKey,
  pushNotification,
  pushSuggestion,
  unmuteNotificationKey,
  useNotifications,
  useSuggestions,
  useUnseenNotificationCount,
} from '@openheaders/ui/shared/notifications';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  __resetNotificationsForTests();
  window.localStorage.clear();
});

describe('suggestions list', () => {
  it('pushes newest-first, dedupes by key, and never lights the bell dot', () => {
    const suggestions = renderHook(() => useSuggestions());
    const unseen = renderHook(() => useUnseenNotificationCount());
    act(() => {
      pushSuggestion({ title: 'Enable request capture', dedupeKey: 'enable-capture' });
      pushSuggestion({ title: 'Connect the desktop app', dedupeKey: 'connect-desktop' });
      pushSuggestion({ title: 'Enable request capture', dedupeKey: 'enable-capture' });
    });
    expect(suggestions.result.current.map((s) => s.title)).toEqual([
      'Connect the desktop app',
      'Enable request capture',
    ]);
    expect(unseen.result.current).toBe(0);
  });

  it('dismisses one suggestion and clears the rest at once', () => {
    const suggestions = renderHook(() => useSuggestions());
    act(() => {
      pushSuggestion({ title: 'Enable request capture' });
      pushSuggestion({ title: 'Connect the desktop app' });
    });
    act(() => dismissSuggestion(suggestions.result.current[1].id));
    expect(suggestions.result.current.map((s) => s.title)).toEqual(['Connect the desktop app']);
    act(() => clearAllSuggestions());
    expect(suggestions.result.current).toHaveLength(0);
  });
});

describe('mute ("Don\'t show again")', () => {
  it('drops the key from both lists and gates future pushes', () => {
    const entries = renderHook(() => useNotifications());
    const suggestions = renderHook(() => useSuggestions());
    act(() => {
      pushNotification({ title: 'Desktop app update available', dedupeKey: 'desktop-update' });
      pushSuggestion({ title: 'Desktop app update available', dedupeKey: 'desktop-update' });
    });
    act(() => muteNotificationKey('desktop-update'));
    expect(entries.result.current).toHaveLength(0);
    expect(suggestions.result.current).toHaveLength(0);

    act(() => {
      pushNotification({ title: 'Desktop app update available', dedupeKey: 'desktop-update' });
      pushSuggestion({ title: 'Desktop app update available', dedupeKey: 'desktop-update' });
    });
    expect(entries.result.current).toHaveLength(0);
    expect(suggestions.result.current).toHaveLength(0);
  });

  it('persists across store resets and lifts on unmute', () => {
    act(() => muteNotificationKey('desktop-update'));
    __resetNotificationsForTests();
    const entries = renderHook(() => useNotifications());
    act(() => pushNotification({ title: 'Desktop app update available', dedupeKey: 'desktop-update' }));
    expect(entries.result.current).toHaveLength(0);

    act(() => {
      unmuteNotificationKey('desktop-update');
      pushNotification({ title: 'Desktop app update available', dedupeKey: 'desktop-update' });
    });
    expect(entries.result.current).toHaveLength(1);
  });

  it('never gates sticky entries — their producer actions retire them', () => {
    const entries = renderHook(() => useNotifications());
    act(() => muteNotificationKey('help-us-grow'));
    act(() => pushNotification({ title: 'Help Us Grow', dedupeKey: 'help-us-grow', sticky: true }));
    expect(entries.result.current).toHaveLength(1);
  });
});
