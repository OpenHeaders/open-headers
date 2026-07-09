// @vitest-environment jsdom
/**
 * CookieEditorTab — one browser-jar cookie opened as a full editor-tab
 * document. Canonical = the live jar row re-fetched one-shot through
 * the site-jar plane and matched by identity; dirty derives across the
 * whole attribute form; a same-identity save overwrites in place, an
 * identity change rides set-new-then-remove-old behind a collision
 * check (reasoned inline notes, never a silent overwrite) and re-keys
 * the tab via onRekeyed; hosts without a jar writer render read-only.
 */

import { CookieEditorTab } from '@openheaders/ui/panel/components/storage/CookieEditorTab';
import { jarCookieToKey } from '@openheaders/ui/panel/data/cookies/cookie-edit';
import {
  __resetCookieJarCacheForTests,
  invalidateJarCache,
  type JarCookie,
  type JarCookieEdit,
  type JarCookieKey,
  type SiteJarCookie,
  setCookieJarWriter,
  setSiteCookieJarFetcher,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { buildCookieTab } from '@openheaders/ui/panel/data/inspector-tab';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The document form renders TemplateInputs (suggestion popovers, caret
// mirrors) and the variable resolver (store subscriptions) — both are
// out of scope here; a plain controlled input keyed by placeholder and
// a pass-through resolver keep the form's own logic under test.
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
    ...over,
  };
}

const COOKIE = makeJarCookie();

const TAB = buildCookieTab({
  cookieKey: jarCookieToKey(COOKIE),
  scopeUrl: SCOPE_URL,
  timestamp: 1_770_000_000_000,
});

function installJar(
  cookies: readonly SiteJarCookie[] | null,
  writer?: {
    set?: (edit: JarCookieEdit) => Promise<JarCookie | null>;
    remove?: (key: JarCookieKey) => Promise<boolean>;
  },
) {
  setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(cookies)));
  if (writer) {
    setCookieJarWriter({
      set: writer.set ?? vi.fn(() => Promise.resolve(null)),
      remove: writer.remove ?? vi.fn(() => Promise.resolve(false)),
    });
  }
}

function nameInput(): HTMLInputElement {
  return screen.getByLabelText('cookie name') as HTMLInputElement;
}

function valueInput(): HTMLInputElement {
  return screen.getByLabelText('value or {{variable}}') as HTMLInputElement;
}

beforeEach(() => {
  __resetCookieJarCacheForTests();
});

afterEach(() => {
  cleanup();
  __resetCookieJarCacheForTests();
});

describe('CookieEditorTab', () => {
  it('fetches the cookie by identity from the site jar and seeds the form', async () => {
    installJar([makeJarCookie({ name: 'other', value: 'nope' }), COOKIE], {});
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    expect(valueInput().value).toBe('abc');
    expect((screen.getByLabelText('openheaders.io') as HTMLInputElement).value).toBe('openheaders.io');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('derives dirty across the form and gates Save on it', async () => {
    installJar([COOKIE], {});
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    expect(save.hasAttribute('disabled')).toBe(false);

    fireEvent.change(valueInput(), { target: { value: 'abc' } });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('an emptied name keeps Save disabled (invalid form)', async () => {
    installJar([COOKIE], {});
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(nameInput(), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('saves a same-identity edit as an in-place overwrite and re-fetches', async () => {
    const set = vi.fn((edit: JarCookieEdit) => Promise.resolve<JarCookie | null>({ ...COOKIE, value: edit.value }));
    installJar([COOKIE], { set });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    expect(set.mock.calls[0][0]).toMatchObject({ name: 'sid', value: 'rotated', domain: 'openheaders.io', path: '/' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true));
  });

  it('commits an identity change as set-new-then-remove-old and re-keys via onRekeyed', async () => {
    const renamed = makeJarCookie({ name: 'sid2' });
    const set = vi.fn(() => Promise.resolve<JarCookie | null>(renamed));
    const remove = vi.fn(() => Promise.resolve(true));
    const onRekeyed = vi.fn();
    installJar([COOKIE], { set, remove });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} onRekeyed={onRekeyed} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(nameInput(), { target: { value: 'sid2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onRekeyed).toHaveBeenCalledWith(jarCookieToKey(renamed)));
    expect(set).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(jarCookieToKey(COOKIE));
  });

  it('rejects an identity change onto a DIFFERENT existing cookie with the collision note', async () => {
    const set = vi.fn(() => Promise.resolve<JarCookie | null>(null));
    installJar([COOKIE, makeJarCookie({ name: 'taken' })], { set });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(nameInput(), { target: { value: 'taken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/already exists/)).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
    // The drafts survive and the note clears on the next edit.
    expect(nameInput().value).toBe('taken');
    fireEvent.change(nameInput(), { target: { value: 'taken2' } });
    expect(screen.queryByText(/already exists/)).toBeNull();
  });

  it('notes a remove failure after a committed set (both cookies exist) without re-keying', async () => {
    const renamed = makeJarCookie({ name: 'sid2' });
    const set = vi.fn(() => Promise.resolve<JarCookie | null>(renamed));
    const remove = vi.fn(() => Promise.resolve(false));
    const onRekeyed = vi.fn();
    installJar([COOKIE], { set, remove });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} onRekeyed={onRekeyed} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(nameInput(), { target: { value: 'sid2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/couldn’t be removed/)).toBeTruthy();
    expect(onRekeyed).not.toHaveBeenCalled();
  });

  it('notes an unreasoned write failure and keeps the drafts', async () => {
    const set = vi.fn(() => Promise.resolve<JarCookie | null>(null));
    installJar([COOKIE], { set });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/rejected the write/)).toBeTruthy();
    expect(valueInput().value).toBe('rotated');
  });

  it('degrades to the honest empty state when the cookie is gone, and Refresh retries', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([COOKIE] as readonly SiteJarCookie[] | null);
    setSiteCookieJarFetcher(fetcher);
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    expect(await screen.findByText('Cookie no longer in the jar')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Refresh cookie'));
    await waitFor(() => expect(nameInput().value).toBe('sid'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('renders read-only (no Save, static fields, honest note) when the host has no jar writer', async () => {
    installJar([COOKIE]);
    const { container } = render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    expect(await screen.findByText(/read-only/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByLabelText('cookie name')).toBeNull();
    const statics = [...container.querySelectorAll('.dt-cookie-edit-static')].map((el) => el.textContent);
    expect(statics).toContain('sid');
    expect(statics).toContain('abc');
  });

  it('arms Refresh while dirty — only the confirm discards the drafts', async () => {
    const fetcher = vi.fn(() => Promise.resolve([COOKIE] as readonly SiteJarCookie[] | null));
    setSiteCookieJarFetcher(fetcher);
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(valueInput(), { target: { value: 'rotated' } });

    fireEvent.click(screen.getByLabelText('Refresh cookie'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(valueInput().value).toBe('rotated');

    fireEvent.click(screen.getByLabelText('Refresh cookie — click again to confirm'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(valueInput().value).toBe('abc'));
  });

  it('mirrors dirty up through onDirtyChange and registers its save action', async () => {
    const set = vi.fn((edit: JarCookieEdit) => Promise.resolve<JarCookie | null>({ ...COOKIE, value: edit.value }));
    installJar([COOKIE], { set });
    const onDirtyChange = vi.fn();
    const saves = new Map<string, () => Promise<boolean>>();
    render(
      <CookieEditorTab
        tab={TAB}
        onRevealInStorage={vi.fn()}
        onDirtyChange={onDirtyChange}
        registerSave={(save) => {
          if (save) saves.set(TAB.id, save);
          else saves.delete(TAB.id);
        }}
      />,
    );

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    const save = saves.get(TAB.id);
    expect(save).toBeDefined();
    const ok = save ? await save() : false;
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('silently re-seeds a clean form when the jar changes underneath (live canonical)', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    rows = [makeJarCookie({ value: 'rotated-elsewhere' })];
    invalidateJarCache();

    await waitFor(() => expect(valueInput().value).toBe('rotated-elsewhere'));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('catches up untouched fields under a dirty form while preserving the touched draft', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.change(nameInput(), { target: { value: 'sid-draft' } });
    rows = [makeJarCookie({ value: 'xyz' })];
    invalidateJarCache();

    await waitFor(() => expect(valueInput().value).toBe('xyz'));
    expect(nameInput().value).toBe('sid-draft');
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('never overwrites a touched leaf even when the same field changed in the jar', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    fireEvent.change(valueInput(), { target: { value: 'my-draft' } });
    rows = [makeJarCookie({ value: 'theirs', httpOnly: false })];
    invalidateJarCache();

    // The untouched HttpOnly toggle catching up proves the sync ran…
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /HttpOnly/ }).getAttribute('aria-checked')).toBe('false'),
    );
    // …while the touched value keeps the draft (the conflict stays pending).
    expect(valueInput().value).toBe('my-draft');
  });

  it('keeps a dirty form with an honest note when the cookie is deleted underneath', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    fireEvent.change(valueInput(), { target: { value: 'my-draft' } });
    rows = [];
    invalidateJarCache();

    expect(await screen.findByText(/deleted in the browser/)).toBeTruthy();
    expect(valueInput().value).toBe('my-draft');
    expect(screen.queryByText('Cookie no longer in the jar')).toBeNull();
  });

  it('re-seeds a clean form to the honest empty state when the cookie is deleted underneath', async () => {
    let rows: readonly SiteJarCookie[] = [COOKIE];
    setSiteCookieJarFetcher(vi.fn(() => Promise.resolve(rows)));
    setCookieJarWriter({ set: vi.fn(() => Promise.resolve(null)), remove: vi.fn(() => Promise.resolve(false)) });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(valueInput().value).toBe('abc'));
    rows = [];
    invalidateJarCache();

    expect(await screen.findByText('Cookie no longer in the jar')).toBeTruthy();
  });

  it('saves via the keyboard chord — and the chord is inert while clean', async () => {
    const set = vi.fn((edit: JarCookieEdit) => Promise.resolve<JarCookie | null>({ ...COOKIE, value: edit.value }));
    installJar([COOKIE], { set });
    render(<CookieEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(set).not.toHaveBeenCalled();

    fireEvent.change(valueInput(), { target: { value: 'rotated' } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    expect(set.mock.calls[0][0]).toMatchObject({ name: 'sid', value: 'rotated' });
  });

  it('routes Reveal in Storage back to the Cookies section', async () => {
    installJar([COOKIE], {});
    const onReveal = vi.fn();
    render(<CookieEditorTab tab={TAB} onRevealInStorage={onReveal} />);

    await waitFor(() => expect(nameInput().value).toBe('sid'));
    fireEvent.click(screen.getByText('Reveal in Storage'));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});
