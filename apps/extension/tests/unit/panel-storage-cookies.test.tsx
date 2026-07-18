// @vitest-environment jsdom
/**
 * Storage tool window — Cookies section. The thin jar-only rows
 * (name · value · domain·path · expires · sec + edit/delete lane), the
 * writability gate on every affordance, the not-sent badge on site-jar
 * rows the browser wouldn't attach to the scope, and the sticky jar
 * hooks the panel polls through: an invalidation tick must NOT blank
 * the section (last resolved list stays rendered through the refetch),
 * and a refetch returning structurally identical data must keep the
 * ARRAY IDENTITY stable — same poll-loop discipline the DOM grid
 * learned the hard way (see panel-storage-hook.test.tsx).
 *
 * Value affordance parity with the cookies TAB rows: a detected value
 * carries the hint glyph and the read-only view icon (present even on
 * a non-writable jar — viewing writes nothing); plain values stay bare.
 */

import { CookiesSection } from '@openheaders/ui/panel/components/storage/CookiesSection';
import {
  __resetCookieJarCacheForTests,
  __seedCookieJarForTests,
  __seedSiteCookieJarForTests,
  clearSiteJarCookies,
  getSiteJarCookiesForUrl,
  invalidateJarCache,
  isCookieJarSiteClearable,
  type JarCookie,
  type SiteJarCookie,
  setCookieJarFetcher,
  setCookieJarWriter,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { useCookieJarSticky, useSiteCookieJarSticky } from '@openheaders/ui/panel/data/cookies/use-cookie-jar';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The view icon's lazy modal pulls in the shared Monaco CodeEditor —
// mocked to a textarea; the contract here is the affordance, not Monaco.
vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, readOnly }: { value?: string; readOnly?: boolean }) => (
    <textarea data-testid="code-editor" value={value} readOnly={readOnly} onChange={() => {}} />
  ),
}));

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const URL_MAIN = 'https://openheaders.io/';

function makeCookie(over: Partial<SiteJarCookie> = {}): SiteJarCookie {
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
    sendable: true,
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
        scopeUrl={URL_MAIN}
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
        scopeUrl={URL_MAIN}
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
        scopeUrl={URL_MAIN}
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

describe('CookiesSection value affordance', () => {
  function buildJWT(header: object, payload: object): string {
    const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `${encode(header)}.${encode(payload)}.origsig`;
  }

  it('shows the hint glyph and the view icon on detected values, even when not writable', () => {
    render(
      <CookiesSection
        cookies={[
          makeCookie({ name: 'auth', value: buildJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user@openheaders.io' }) }),
          makeCookie({ name: 'blob', value: btoa('user@openheaders.io:hunter2!!') }),
          makeCookie({ name: 'plain', value: 'just-an-opaque-id' }),
        ]}
        scopeUrl={URL_MAIN}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('JWT')).toBeTruthy();
    expect(screen.getByText('b64')).toBeTruthy();
    expect(screen.getByLabelText('View JWT')).toBeTruthy();
    expect(screen.getByLabelText('View decoded — Base64 value')).toBeTruthy();
    // The write affordances stay gated on writability.
    expect(screen.queryByLabelText('Edit cookie auth')).toBeNull();
    expect(screen.queryByLabelText('Delete cookie auth')).toBeNull();
  });

  it('gives a plain value neither glyph nor icon', () => {
    render(
      <CookiesSection
        cookies={[makeCookie({ name: 'plain', value: 'just-an-opaque-id' })]}
        scopeUrl={URL_MAIN}
        writable={true}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText('JWT')).toBeNull();
    expect(screen.queryByLabelText(/View /)).toBeNull();
  });

  it('surfaces generic registry kinds through the icon (no glyph) — full-registry parity', () => {
    render(
      <CookiesSection
        cookies={[makeCookie({ name: 'ts', value: '1720000000' })]}
        scopeUrl={URL_MAIN}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('View decoded — Unix timestamp')).toBeTruthy();
    expect(screen.queryByText('JWT')).toBeNull();
  });

  it('the view icon rides the stop-propagation lane — clicking it never opens the document', () => {
    const onOpen = vi.fn();
    render(
      <CookiesSection
        cookies={[makeCookie({ name: 'ts', value: '1720000000' })]}
        scopeUrl={URL_MAIN}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
        onOpen={onOpen}
        isActive={() => false}
      />,
    );
    fireEvent.click(screen.getByLabelText('View decoded — Unix timestamp'));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('CookiesSection editor-tab gestures', () => {
  it('opens a cookie document on a row click; the action lane never opens', () => {
    const onOpen = vi.fn();
    const cookie = makeCookie();
    render(
      <CookiesSection
        cookies={[cookie]}
        scopeUrl={URL_MAIN}
        writable={true}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
        onOpen={onOpen}
        isActive={() => false}
      />,
    );

    fireEvent.click(screen.getByText('sid'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(cookie);

    fireEvent.click(screen.getByLabelText('Delete cookie sid'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('highlights exactly the active document row', () => {
    render(
      <CookiesSection
        cookies={[makeCookie(), makeCookie({ name: 'theme' })]}
        scopeUrl={URL_MAIN}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        isActive={(c) => c.name === 'theme'}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1); // drop the header
    expect(rows[0].className).not.toContain('dt-storage-row--active');
    expect(rows[1].className).toContain('dt-storage-row--active');
  });
});

describe('CookiesSection not-sent badge', () => {
  it('badges a non-sendable row with the heuristic reason, sendable rows stay clean', () => {
    render(
      <CookiesSection
        cookies={[
          makeCookie(),
          makeCookie({ name: 'scoped', path: '/account', sendable: false }),
          makeCookie({ name: 'sub', domain: 'app.openheaders.io', sendable: false }),
        ]}
        scopeUrl={URL_MAIN}
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/Cookie sid is not sent/)).toBeNull();
    expect(
      screen.getByLabelText('Cookie scoped is not sent to this page: path mismatch (cookie path /account)'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Cookie sub is not sent to this page: domain mismatch (cookie domain app.openheaders.io)'),
    ).toBeTruthy();
  });

  it('explains a Secure-only cookie on an http scope', () => {
    render(
      <CookiesSection
        cookies={[makeCookie({ name: 'sec', secure: true, sendable: false })]}
        scopeUrl="http://openheaders.io/"
        writable={false}
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Cookie sec is not sent to this page: Secure cookie on http')).toBeTruthy();
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

describe('useSiteCookieJarSticky', () => {
  it('holds through invalidation and keeps identity on structurally equal refetches', () => {
    __seedSiteCookieJarForTests(URL_MAIN, [makeCookie()]);
    const { result, rerender } = renderHook(() => useSiteCookieJarSticky(URL_MAIN));
    const first = result.current;
    expect(first?.[0]?.sendable).toBe(true);

    act(() => {
      invalidateJarCache(URL_MAIN);
    });
    expect(result.current).toBe(first);

    __seedSiteCookieJarForTests(URL_MAIN, [makeCookie()]);
    rerender();
    expect(result.current).toBe(first);
  });

  it('adopts a sendability flip as a genuine change', () => {
    __seedSiteCookieJarForTests(URL_MAIN, [makeCookie()]);
    const { result, rerender } = renderHook(() => useSiteCookieJarSticky(URL_MAIN));
    const first = result.current;

    __seedSiteCookieJarForTests(URL_MAIN, [makeCookie({ sendable: false })]);
    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current?.[0]?.sendable).toBe(false);
  });
});

describe('site jar cache', () => {
  it('falls back to the URL fetcher (all rows sendable) when no site fetcher is installed', async () => {
    const plain: JarCookie = { ...makeCookie() };
    setCookieJarFetcher(async () => [plain]);

    expect(getSiteJarCookiesForUrl(URL_MAIN)).toBeNull(); // kicks off the fetch
    await waitFor(() => {
      expect(getSiteJarCookiesForUrl(URL_MAIN)).toEqual([{ ...plain, sendable: true }]);
    });
  });

  it('clearSiteJarCookies rides the writer clearSite leg and invalidates the caches', async () => {
    const clearSite = vi.fn().mockResolvedValue(true);
    setCookieJarWriter({
      set: vi.fn().mockResolvedValue({ cookie: null }),
      remove: vi.fn().mockResolvedValue(false),
      clearSite,
    });
    __seedSiteCookieJarForTests(URL_MAIN, [makeCookie()]);

    expect(isCookieJarSiteClearable()).toBe(true);
    await expect(clearSiteJarCookies(URL_MAIN)).resolves.toBe(true);
    expect(clearSite).toHaveBeenCalledWith(URL_MAIN);
    // Cache invalidated — the next read is a fresh (null → fetch) cycle.
    expect(getSiteJarCookiesForUrl(URL_MAIN)).toBeNull();
  });

  it('is not clearable (and clear reports failure) without the writer leg', async () => {
    setCookieJarWriter({
      set: vi.fn().mockResolvedValue({ cookie: null }),
      remove: vi.fn().mockResolvedValue(false),
    });
    expect(isCookieJarSiteClearable()).toBe(false);
    await expect(clearSiteJarCookies(URL_MAIN)).resolves.toBe(false);
  });
});
