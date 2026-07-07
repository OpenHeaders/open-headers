// @vitest-environment jsdom
/**
 * Storage tool window — Cookies section. The thin jar-only rows
 * (name · value · domain·path · expires · sec + edit/delete lane), the
 * writability gate on every affordance, and the sticky jar hook the
 * panel polls through: an invalidation tick must NOT blank the section
 * (last resolved list stays rendered through the refetch), and a
 * refetch returning structurally identical data must keep the ARRAY
 * IDENTITY stable — same poll-loop discipline the DOM grid learned the
 * hard way (see panel-storage-hook.test.tsx).
 */

import { CookiesSection } from '@openheaders/ui/panel/components/storage/CookiesSection';
import {
  __resetCookieJarCacheForTests,
  __seedCookieJarForTests,
  invalidateJarCache,
  type JarCookie,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { useCookieJarSticky } from '@openheaders/ui/panel/data/cookies/use-cookie-jar';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const URL_MAIN = 'https://openheaders.io/';

function makeCookie(over: Partial<JarCookie> = {}): JarCookie {
  return {
    name: 'sid',
    value: 'abc',
    domain: 'openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    session: true,
    ...over,
  };
}

beforeEach(() => {
  __resetCookieJarCacheForTests();
});

afterEach(() => {
  cleanup();
  __resetCookieJarCacheForTests();
});

describe('CookiesSection rows', () => {
  it('renders one jar row per cookie with scope and expires cells', () => {
    render(
      <CookiesSection
        cookies={[
          makeCookie(),
          makeCookie({ name: 'theme', value: 'dark', domain: '.openheaders.io', path: '/account', session: true }),
        ]}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 cookies
    expect(screen.getByText('sid')).toBeTruthy();
    expect(screen.getByText('abc')).toBeTruthy();
    expect(screen.getByText('.openheaders.io /account')).toBeTruthy();
    expect(screen.getAllByText('Session')).toHaveLength(2);
  });

  it('hides every write affordance when the jar is not writable', () => {
    render(
      <CookiesSection
        cookies={[makeCookie()]}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Edit cookie sid')).toBeNull();
    expect(screen.queryByLabelText('Delete cookie sid')).toBeNull();
  });

  it('shows the edit/delete lane when writable and deletes with the row cookie', () => {
    const onDelete = vi.fn();
    const cookie = makeCookie();
    render(
      <CookiesSection
        cookies={[cookie]}
        writable={true}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByLabelText('Edit cookie sid')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Delete cookie sid'));
    expect(onDelete).toHaveBeenCalledWith(cookie);
  });
});

describe('useCookieJarSticky', () => {
  it('holds the last resolved list through an invalidation instead of blanking', () => {
    const cookies = [makeCookie()];
    __seedCookieJarForTests(URL_MAIN, cookies);
    const { result } = renderHook(() => useCookieJarSticky(URL_MAIN));
    expect(result.current).toEqual(cookies);

    // Poll-tick invalidation: the raw lookup goes null for the refetch
    // round-trip; the sticky value must stay rendered.
    act(() => {
      invalidateJarCache(URL_MAIN);
    });
    expect(result.current).toEqual(cookies);
  });

  it('keeps the array identity stable when a refetch returns structurally identical data', () => {
    __seedCookieJarForTests(URL_MAIN, [makeCookie()]);
    const { result, rerender } = renderHook(() => useCookieJarSticky(URL_MAIN));
    const first = result.current;
    expect(first).not.toBeNull();

    // Fresh array + fresh objects, same content — what every poll refetch
    // produces. The hook must return the SAME array.
    __seedCookieJarForTests(URL_MAIN, [makeCookie()]);
    rerender();
    expect(result.current).toBe(first);
  });

  it('adopts genuinely changed data and drops the hold on a URL change', () => {
    __seedCookieJarForTests(URL_MAIN, [makeCookie()]);
    const { result, rerender } = renderHook(({ url }: { url: string }) => useCookieJarSticky(url), {
      initialProps: { url: URL_MAIN },
    });
    const first = result.current;

    __seedCookieJarForTests(URL_MAIN, [makeCookie({ value: 'rotated' })]);
    rerender({ url: URL_MAIN });
    expect(result.current).not.toBe(first);
    expect(result.current?.[0]?.value).toBe('rotated');

    // A different scope must not show the previous scope's cookies.
    rerender({ url: 'https://app.openheaders.io/' });
    expect(result.current).toBeNull();
  });
});
