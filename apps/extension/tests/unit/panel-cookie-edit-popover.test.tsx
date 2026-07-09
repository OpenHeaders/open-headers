// @vitest-environment jsdom
/**
 * CookieEditPopover — the quick-edit popover's live edit-mode tier.
 * With a document binding the popover syncs its canonical against the
 * jar while open (clean fields silently adopt external changes, touched
 * fields keep their drafts), surfaces genuine both-sides divergence
 * through the shared conflict tier (chips), notes a cookie deleted
 * underneath (Save writes it back), and escalates to the full
 * editor-tab document via the footer's "Open in new tab" link —
 * disabled while dirty so drafts are never silently lost.
 */

import {
  CookieEditPopover,
  type CookieEditPopoverDocument,
} from '@openheaders/ui/panel/components/detail/cookies/CookieEditPopover';
import {
  deleteKeyForRow,
  emptyEditForm,
  jarCookieToEditForm,
} from '@openheaders/ui/panel/data/cookies/cookie-edit';
import { jarToRow } from '@openheaders/ui/panel/data/cookies/cookie-model';
import {
  __resetCookieJarCacheForTests,
  invalidateJarCache,
  type SiteJarCookie,
  setSiteCookieJarFetcher,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The conflict chip's resolve popover rides antd Popover →
// rc-resize-observer; jsdom doesn't ship a ResizeObserver.
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

// Same seams the cookie-document suite stubs: the form's TemplateInputs
// and the variable resolver are out of scope — a plain controlled input
// keyed by placeholder keeps the popover's own logic under test.
vi.mock('@openheaders/ui/workbench/components/template-input', () => ({
  TemplateInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (next: string) => void;
    placeholder?: string;
  }) => <input aria-label={placeholder} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />,
}));

vi.mock('@openheaders/ui/shared/hooks/variables/useVariableResolver', () => ({
  useVariableResolver: () => ({ resolveTemplate: (raw: string) => ({ result: raw }) }),
}));

const SCOPE_URL = 'https://openheaders.io/';

function makeJarCookie(over: Partial<SiteJarCookie> = {}): SiteJarCookie {
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
    // Chrome jar entries always carry a storeId — the identity match
    // must survive it on both the storage- and detail-derived keys.
    storeId: '0',
    ...over,
  };
}

const COOKIE = makeJarCookie();

function renderEditPopover(document?: CookieEditPopoverDocument, onSubmit = vi.fn().mockResolvedValue(true)) {
  render(
    <AntApp>
      <CookieEditPopover mode="edit" canonical={jarCookieToEditForm(COOKIE)} document={document} onSubmit={onSubmit}>
        <button type="button">Edit</button>
      </CookieEditPopover>
    </AntApp>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
}

function bindingFor(onOpen?: () => void): CookieEditPopoverDocument {
  // The key exactly as the request-detail Cookies tab derives it (from
  // the enriched ROW, not the jar entry) — the sync's identity match
  // must hold across that derivation (the storeId regression).
  const cookieKey = deleteKeyForRow(jarToRow(COOKIE, 'request', 'request-jar'));
  return { scopeUrl: SCOPE_URL, cookieKey, ...(onOpen ? { onOpen } : {}) };
}

function valueInput(): HTMLInputElement {
  return screen.getByLabelText('value or {{variable}}') as HTMLInputElement;
}

beforeEach(() => {
  __resetCookieJarCacheForTests();
  setSiteCookieJarFetcher(vi.fn(() => Promise.resolve<readonly SiteJarCookie[]>([COOKIE])));
});

afterEach(() => {
  cleanup();
  __resetCookieJarCacheForTests();
});

describe('Open in new tab link', () => {
  it('renders in edit mode with a document binding; clicking opens the document and closes the popover', async () => {
    const onOpen = vi.fn();
    renderEditPopover(bindingFor(onOpen));

    const link = await screen.findByRole('button', { name: 'Open in new tab →' });
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // jsdom never fires motion events, so destroyOnHidden can't unmount
    // the body here — closed shows as the leave/hidden popover classes.
    await waitFor(() => expect(document.querySelector('.ant-popover')?.className).toMatch(/-leave|-hidden/));
  });

  it('disables while the form is dirty — drafts are never silently lost', async () => {
    renderEditPopover(bindingFor(vi.fn()));

    const link = await screen.findByRole('button', { name: 'Open in new tab →' });
    expect(link.hasAttribute('disabled')).toBe(false);

    fireEvent.change(valueInput(), { target: { value: 'draft' } });
    expect(link.hasAttribute('disabled')).toBe(true);

    fireEvent.change(valueInput(), { target: { value: 'abc' } });
    expect(link.hasAttribute('disabled')).toBe(false);
  });

  it('absent without an onOpen escalation, and absent in add mode', async () => {
    renderEditPopover(bindingFor());
    await screen.findByText('Edit cookie');
    expect(screen.queryByRole('button', { name: 'Open in new tab →' })).toBeNull();
    cleanup();

    render(
      <AntApp>
        <CookieEditPopover mode="add" canonical={emptyEditForm()} onSubmit={vi.fn().mockResolvedValue(true)}>
          <button type="button">Add</button>
        </CookieEditPopover>
      </AntApp>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByText('Add cookie');
    expect(screen.queryByRole('button', { name: 'Open in new tab →' })).toBeNull();
  });
});

describe('live jar sync', () => {
  it('silently re-seeds a clean form when the jar changes underneath; Save stays disabled', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    renderEditPopover(bindingFor());

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    rows = [makeJarCookie({ value: 'rotated-elsewhere' })];
    invalidateJarCache();

    await waitFor(() => expect(valueInput().value).toBe('rotated-elsewhere'));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('catches up untouched fields under a dirty form while preserving the touched draft', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    renderEditPopover(bindingFor());

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    fireEvent.change(valueInput(), { target: { value: 'my-draft' } });
    rows = [makeJarCookie({ httpOnly: false })];
    invalidateJarCache();

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /HttpOnly/ }).getAttribute('aria-checked')).toBe('false'),
    );
    expect(valueInput().value).toBe('my-draft');
  });

  it('chips a field when BOTH sides diverged, and Use saved adopts the live value', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    renderEditPopover(bindingFor());

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    fireEvent.change(valueInput(), { target: { value: 'my-draft' } });
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();

    rows = [makeJarCookie({ value: 'theirs' })];
    invalidateJarCache();

    const chip = await screen.findByTitle('External change available — click to resolve');
    fireEvent.click(chip);
    fireEvent.click(await screen.findByRole('button', { name: 'Use saved' }));
    await waitFor(() => expect(valueInput().value).toBe('theirs'));
  });

  it('notes a cookie deleted underneath and keeps Save armed to write it back', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    renderEditPopover(bindingFor());

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    rows = [];
    invalidateJarCache();

    expect(await screen.findByText(/deleted in the browser/)).toBeTruthy();
    expect(valueInput().value).toBe('abc');
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('never syncs without a document binding — the open-time canonical stands', async () => {
    const fetcher = vi.fn(() => Promise.resolve<readonly SiteJarCookie[]>([makeJarCookie({ value: 'newer' })]));
    setSiteCookieJarFetcher(fetcher);
    renderEditPopover(undefined);

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    invalidateJarCache();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(valueInput().value).toBe('abc');
  });
});
