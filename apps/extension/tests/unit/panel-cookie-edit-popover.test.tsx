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
import type { CookiePasteBatchHost } from '@openheaders/ui/panel/components/detail/cookies/useCookiePasteBatch';
import { deleteKeyForRow, emptyEditForm, jarCookieToEditForm } from '@openheaders/ui/panel/data/cookies/cookie-edit';
import {
  __resetCookieJarCacheForTests,
  invalidateJarCache,
  type SiteJarCookie,
  setSiteCookieJarFetcher,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { jarToRow } from '@openheaders/ui/panel/data/cookies/cookie-model';
// The popover's save chord reads `keyboard.save` from the settings
// registry — import the schema barrel for its side effects.
import '@openheaders/ui/workbench/settings/schema';
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

describe('paste row (add mode)', () => {
  const PASTE_LABEL = 'Paste a Set-Cookie or Cookie header to fill the form';

  function renderAddPopover(onSubmit = vi.fn().mockResolvedValue(true)) {
    render(
      <AntApp>
        <CookieEditPopover
          mode="add"
          canonical={emptyEditForm({ domain: 'openheaders.io', secure: true })}
          onSubmit={onSubmit}
        >
          <button type="button">Add</button>
        </CookieEditPopover>
      </AntApp>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    return onSubmit;
  }

  function paste(text: string): void {
    fireEvent.paste(screen.getByLabelText(PASTE_LABEL), { clipboardData: { getData: () => text } });
  }

  function nameInput(): HTMLInputElement {
    return screen.getByLabelText('cookie name') as HTMLInputElement;
  }

  function flag(name: RegExp): string | null {
    return screen.getByRole('switch', { name }).getAttribute('aria-checked');
  }

  it('fills every field from a pasted Set-Cookie line and saves what it stated', async () => {
    const onSubmit = renderAddPopover();
    await screen.findByText('Add cookie');

    paste('session=abc123; Domain=.openheaders.io; Path=/account; HttpOnly; SameSite=Strict');

    expect(nameInput().value).toBe('session');
    expect(valueInput().value).toBe('abc123');
    expect((screen.getByLabelText('/') as HTMLInputElement).value).toBe('/account');
    expect(flag(/HttpOnly/)).toBe('true');
    expect(flag(/Secure/)).toBe('false');
    expect(flag(/Host-only/)).toBe('false');
    expect(screen.getByText('Filled from a Set-Cookie header')).toBeTruthy();
    expect((screen.getByLabelText(PASTE_LABEL) as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'session',
      value: 'abc123',
      domain: 'openheaders.io',
      path: '/account',
      hostOnly: false,
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
    });
  });

  it('a pasted pair fills Name and Value only', async () => {
    renderAddPopover();
    await screen.findByText('Add cookie');

    paste('session=abc123');

    expect(nameInput().value).toBe('session');
    expect(valueInput().value).toBe('abc123');
    expect(flag(/Secure/)).toBe('true');
    expect(flag(/Host-only/)).toBe('true');
    expect(screen.getByText('Filled Name and Value')).toBeTruthy();
  });

  it('Undo restores the form as it stood before the paste', async () => {
    renderAddPopover();
    await screen.findByText('Add cookie');
    fireEvent.change(nameInput(), { target: { value: 'draft' } });

    paste('session=abc123; Path=/account; Secure');
    expect(nameInput().value).toBe('session');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(nameInput().value).toBe('draft');
    expect(valueInput().value).toBe('');
    expect((screen.getByLabelText('/') as HTMLInputElement).value).toBe('/');
    expect(screen.queryByText('Filled from a Set-Cookie header')).toBeNull();
  });

  it('the first edit after a paste accepts the fill — the status line and its Undo go', async () => {
    renderAddPopover();
    await screen.findByText('Add cookie');

    paste('session=abc123');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();

    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByText('Filled Name and Value')).toBeNull();
  });

  it('names what a Set-Cookie line carried that the form ignores, and an expiry already past', async () => {
    renderAddPopover();
    await screen.findByText('Add cookie');

    paste('session=abc123; Max-Age=0; Priority=High');

    expect(screen.getByText('Filled from a Set-Cookie header · ignored: Priority=High · already expired')).toBeTruthy();
  });

  it('leaves the fields alone on a Cookie header of several cookies and says how many', async () => {
    renderAddPopover();
    await screen.findByText('Add cookie');
    fireEvent.change(nameInput(), { target: { value: 'draft' } });

    paste('user=john.doe; tz=Europe%2FMadrid; logged_in=yes');

    expect(nameInput().value).toBe('draft');
    expect(screen.getByText('Several cookies in this text (3) — paste one at a time.')).toBeTruthy();
    expect((screen.getByLabelText(PASTE_LABEL) as HTMLInputElement).value).toBe(
      'user=john.doe; tz=Europe%2FMadrid; logged_in=yes',
    );
  });

  it('leaves the fields alone on unreadable text, and clears the note once the text changes', async () => {
    renderAddPopover();
    await screen.findByText('Add cookie');

    paste('just some words');
    expect(nameInput().value).toBe('');
    expect(screen.getByText('No cookie could be read from this text.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(PASTE_LABEL), { target: { value: 'session=abc123' } });
    expect(screen.queryByText('No cookie could be read from this text.')).toBeNull();

    fireEvent.keyDown(screen.getByLabelText(PASTE_LABEL), { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(nameInput().value).toBe('session');
    expect(valueInput().value).toBe('abc123');
  });

  it('is absent in edit mode — an edit never renames by paste', async () => {
    renderEditPopover(bindingFor());
    await screen.findByText('Edit cookie');
    expect(screen.queryByLabelText(PASTE_LABEL)).toBeNull();
  });
});

describe('paste checklist (add mode, several cookies)', () => {
  const PASTE_LABEL = 'Paste a Set-Cookie or Cookie header to fill the form';
  type BatchSubmit = CookiePasteBatchHost['onSubmit'];

  const saveAll: BatchSubmit = async (edits) => edits.map((edit) => ({ cookie: makeJarCookie({ name: edit.name }) }));

  function renderBatchPopover(onSubmit: BatchSubmit = saveAll) {
    const submit = vi.fn(onSubmit);
    render(
      <AntApp>
        <CookieEditPopover
          mode="add"
          canonical={emptyEditForm({ domain: 'openheaders.io', secure: true })}
          batch={{ scopeUrl: SCOPE_URL, onSubmit: submit }}
          onSubmit={vi.fn().mockResolvedValue(true)}
        >
          <button type="button">Add</button>
        </CookieEditPopover>
      </AntApp>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    return submit;
  }

  function paste(text: string): void {
    fireEvent.paste(screen.getByLabelText(PASTE_LABEL), { clipboardData: { getData: () => text } });
  }

  it('lists every cookie, tags what the jar already holds, and stands Name and Value down', async () => {
    renderBatchPopover();
    await screen.findByText('Add cookie');

    paste('sid=rotated; user=john.doe; tz=Europe%2FMadrid');

    expect(await screen.findByText('Replaces')).toBeTruthy();
    expect(screen.getAllByText('New')).toHaveLength(2);
    expect(screen.getByText('Cookies read: 3')).toBeTruthy();
    expect(screen.getByText('Selected: 3 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('cookie name')).toBeNull();
    expect(screen.queryByLabelText('value or {{variable}}')).toBeNull();
    expect(screen.getByRole('button', { name: /Save \(3\)$/ })).toBeTruthy();
  });

  it('saves the batch — a held cookie keeps its own attributes, a new one takes the shared fields', async () => {
    const submit = renderBatchPopover();
    await screen.findByText('Add cookie');
    paste('sid=rotated; user=john.doe');
    await screen.findByText('Replaces');

    fireEvent.click(screen.getByRole('button', { name: /Save \(2\)$/ }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const [held, fresh] = submit.mock.calls[0][0];
    expect(held).toMatchObject({ name: 'sid', value: 'rotated', httpOnly: true, hostOnly: true, storeId: '0' });
    expect(fresh).toMatchObject({
      name: 'user',
      value: 'john.doe',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: true,
    });
    await waitFor(() => expect(document.querySelector('.ant-popover')?.className).toMatch(/-leave|-hidden/));
  });

  it('writes only the checked rows', async () => {
    const submit = renderBatchPopover();
    await screen.findByText('Add cookie');
    paste('sid=rotated; user=john.doe; tz=Europe%2FMadrid');
    await screen.findByText('Replaces');

    fireEvent.click(screen.getByRole('checkbox', { name: 'user' }));
    expect(screen.getByText('Selected: 2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Save \(2\)$/ }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].map((edit) => edit.name)).toEqual(['sid', 'tz']);
  });

  it('stays open on a failed row, says why, and leaves only that row to retry', async () => {
    const submit = renderBatchPopover(async (edits) =>
      edits.map((edit) =>
        edit.name === 'user'
          ? { cookie: null, error: 'Invalid domain' }
          : { cookie: makeJarCookie({ name: edit.name }) },
      ),
    );
    await screen.findByText('Add cookie');
    paste('sid=rotated; user=john.doe');
    await screen.findByText('Replaces');

    fireEvent.click(screen.getByRole('button', { name: /Save \(2\)$/ }));

    expect(await screen.findByText('Not saved — Invalid domain')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'sid' }) as HTMLInputElement).disabled).toBe(true);
    expect(document.querySelector('.ant-popover')?.className).not.toMatch(/-leave|-hidden/);

    fireEvent.click(screen.getByRole('button', { name: /Save \(1\)$/ }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls[1][0].map((edit) => edit.name)).toEqual(['user']);
  });

  it('blocks a row the shared fields make unwritable, and frees it once they are fixed', async () => {
    renderBatchPopover();
    await screen.findByText('Add cookie');
    paste('__Host-token=abc123; user=john.doe');
    await waitFor(() => expect(screen.getAllByText('New')).toHaveLength(2));

    fireEvent.click(screen.getByRole('switch', { name: /Secure/ }));
    expect(screen.getByText('__Host- cookies must have the Secure flag on.')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: '__Host-token' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /Save \(1\)$/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: /Secure/ }));
    expect(screen.queryByText('__Host- cookies must have the Secure flag on.')).toBeNull();
    expect(screen.getByRole('button', { name: /Save \(2\)$/ })).toBeTruthy();
  });

  it('the header checkbox clears and restores every row', async () => {
    renderBatchPopover();
    await screen.findByText('Add cookie');
    paste('sid=rotated; user=john.doe');
    await screen.findByText('Replaces');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selected: 2 of 2' }));
    expect(screen.getByText('Selected: 0 of 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save \(0\)$/ }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selected: 0 of 2' }));
    expect(screen.getByText('Selected: 2 of 2')).toBeTruthy();
  });

  it('Undo leaves the checklist for the form as it stood; a single-cookie paste does too', async () => {
    renderBatchPopover();
    await screen.findByText('Add cookie');
    fireEvent.change(screen.getByLabelText('cookie name'), { target: { value: 'draft' } });

    paste('sid=rotated; user=john.doe');
    await screen.findByText('Replaces');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('cookie name') as HTMLInputElement).value).toBe('draft');
    expect(screen.queryByText('Cookies read: 2')).toBeNull();

    paste('sid=rotated; user=john.doe');
    await screen.findByText('Replaces');
    paste('session=abc123');
    expect((screen.getByLabelText('cookie name') as HTMLInputElement).value).toBe('session');
    expect(screen.queryByText('Cookies read: 2')).toBeNull();
  });
});

describe('save chord', () => {
  it('saves via Cmd/Ctrl+S while savable — and the chord is inert while clean', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderEditPopover(bindingFor(), onSubmit);

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: 'sid', value: 'rotated' });
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
    expect(screen.getByRole('button', { name: /Save$/ }).hasAttribute('disabled')).toBe(true);
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
    expect(screen.getByRole('button', { name: /Save$/ }).hasAttribute('disabled')).toBe(false);
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
