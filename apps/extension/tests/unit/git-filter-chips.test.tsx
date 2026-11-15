// @vitest-environment jsdom
/**
 * The log's filter chips, mounted over a parent that feeds their filter
 * back: the chip that holds a list (User, Paths) and the Branch chip,
 * each with its menu and the Select… field. Every row is pressed — the
 * Select… row by a CLICK, which the Dropdown would close the chip on;
 * what is applied is what the parent was sent, and a chip is open while
 * its button says so (a closed popup stays in the DOM).
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { GitLogScope } from '@openheaders/ui/workbench/components/panels/git/log-scope';
import { refFavoriteKey } from '@openheaders/ui/workbench/components/panels/git/rail/ref-favorites';
import BranchFilterChip from '@openheaders/ui/workbench/components/panels/git/toolbar/BranchFilterChip';
import ValuesFilterChip from '@openheaders/ui/workbench/components/panels/git/toolbar/ValuesFilterChip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(cleanup);

const isOpen = (chip: HTMLElement): boolean => chip.classList.contains('ant-dropdown-open');

const menuKey = (row: Element): string => row.getAttribute('data-menu-id') ?? '';

/** A popup's first layer by menu key, in order — Select… always leads it. */
function layer(popup: HTMLElement): string[] {
  const ids = [...popup.querySelectorAll('[role="menuitem"]')].map(menuKey);
  const lead = (ids[0] ?? '').length - 'select'.length;
  return ids.map((id) => id.slice(lead));
}

/** A row by its menu key (keys hold `:` and `/`): in the popup's first layer, or `nested` in a submenu of it. */
function row(popup: HTMLElement, key: string, nested = false): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => menuKey(item).endsWith(`-${key}`) && popup.contains(item) !== nested,
  );
  if (found === undefined) throw new Error(`no ${nested ? 'submenu ' : ''}row ${key}`);
  return found;
}

async function openMenu(chip: HTMLElement, popupId: string): Promise<HTMLElement> {
  fireEvent.click(chip);
  const popup = await screen.findByTestId(popupId);
  await waitFor(() => expect(popup.getAttribute('data-mode')).toBe('menu'));
  expect(isOpen(chip)).toBe(true);
  return popup;
}

const chord = (field: HTMLElement): boolean => fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });

const suggested = (testid: string): (string | null)[] =>
  screen.queryAllByTestId(`${testid}-suggestion`).map((option) => option.getAttribute('data-ref'));

const LIST_CHIP = 'git-tool-chip-user';
const LIST_POPUP = `${LIST_CHIP}-popup`;
const LIST_FIELD = `${LIST_CHIP}-select-field`;

interface ListChipOptions {
  values?: readonly string[];
  recent?: readonly (readonly string[])[];
  bar?: boolean;
}

function mountListChip({ values: held = [], recent = [], bar = true }: ListChipOptions = {}) {
  const onApply = vi.fn<(values: string[]) => void>();
  const onClear = vi.fn<() => void>();
  const onPick = vi.fn<() => void>();
  const onSelectOpen = vi.fn<() => void>();
  const Parent: React.FC = () => {
    const [values, setValues] = useState(held);
    return (
      <ValuesFilterChip
        label="User"
        value={values.length === 0 ? null : values.join('|')}
        values={values}
        onApply={(next) => {
          onApply(next);
          setValues(next);
        }}
        onClear={() => {
          onClear();
          setValues([]);
        }}
        names={['Dana Reyes', 'John Doe']}
        onSelectOpen={onSelectOpen}
        bar={bar}
        rows={[{ key: 'me', label: 'me', onPick }]}
        recent={recent}
        recentText={(entry) => entry.join('|')}
        testid={LIST_CHIP}
      />
    );
  };
  render(<Parent />);
  return { onApply, onClear, onPick, onSelectOpen, chip: screen.getByTestId(LIST_CHIP) };
}

describe('ValuesFilterChip (mounted)', () => {
  it('the menu: Select…, the chip’s own rows, Recent with the standing list marked, the last line', async () => {
    const { chip } = mountListChip({ values: ['John Doe'], recent: [['John Doe'], ['Dana Reyes', 'John Doe']] });
    expect(chip.textContent).toBe('User:John Doe');
    const popup = await openMenu(chip, LIST_POPUP);
    expect(layer(popup)).toEqual(['select', 'row:me', 'recent:0', 'recent:1']);
    expect(row(popup, 'recent:0').querySelector('.anticon-check')).not.toBeNull();
    expect(row(popup, 'recent:1').querySelector('.anticon-check')).toBeNull();
    expect(screen.getAllByTestId(`${LIST_CHIP}-recent`).map((entry) => entry.getAttribute('title'))).toEqual([
      null,
      'Dana Reyes\nJohn Doe',
    ]);
    expect(screen.getByTestId(`${LIST_CHIP}-hint`).textContent).not.toBe('');
  });

  it('with nothing applied lately the menu has no Recent', async () => {
    const { chip } = mountListChip();
    expect(chip.textContent).toBe('User');
    expect(layer(await openMenu(chip, LIST_POPUP))).toEqual(['select', 'row:me']);
  });

  it('Select… by a click opens the field and the chip stays open; the chord applies what the field holds', async () => {
    const { chip, onApply, onSelectOpen } = mountListChip({ values: ['John Doe'] });
    const popup = await openMenu(chip, LIST_POPUP);
    fireEvent.click(row(popup, 'select'));
    expect(isOpen(chip)).toBe(true);
    expect(popup.getAttribute('data-mode')).toBe('select');
    expect(onSelectOpen).toHaveBeenCalledTimes(1);

    // It opens on the list it holds, a value a line, the caret after it.
    const field = screen.getByTestId<HTMLTextAreaElement>(LIST_FIELD);
    expect(field.value).toBe('John Doe\n');
    expect(field.selectionStart).toBe(field.value.length);
    expect(document.activeElement).toBe(field);

    // A typed word lists the names that hold it — never one the text already names.
    fireEvent.change(field, { target: { value: 'John Doe\no' } });
    expect(suggested(`${LIST_CHIP}-select`)).toEqual([]);
    fireEvent.change(field, { target: { value: 'John Doe\nda' } });
    expect(suggested(`${LIST_CHIP}-select`)).toEqual(['Dana Reyes']);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field.value).toBe('John Doe\nDana Reyes\n');
    expect(onApply).not.toHaveBeenCalled();

    chord(field);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenLastCalledWith(['John Doe', 'Dana Reyes']);
    expect(isOpen(chip)).toBe(false);
    expect(chip.textContent).toBe('User:John Doe|Dana Reyes');

    // Opened again it is the menu, not the field it was left on.
    expect(layer(await openMenu(chip, LIST_POPUP))[0]).toBe('select');
  });

  it('a click on a suggestion writes it; the field takes a text that is no name', async () => {
    const { chip, onApply } = mountListChip();
    fireEvent.click(row(await openMenu(chip, LIST_POPUP), 'select'));
    const field = screen.getByTestId<HTMLTextAreaElement>(LIST_FIELD);
    fireEvent.change(field, { target: { value: 'jo' } });
    fireEvent.click(screen.getByTestId(`${LIST_CHIP}-select-suggestion`));
    expect(field.value).toBe('John Doe\n');
    fireEvent.change(field, { target: { value: 'John Doe\nsomeone else' } });
    chord(field);
    expect(onApply).toHaveBeenLastCalledWith(['John Doe', 'someone else']);
    expect(screen.queryByTestId(`${LIST_CHIP}-select-unknown`)).toBeNull();
  });

  it('where only a line break separates, a bar is part of the value; an emptied field clears', async () => {
    const { chip, onApply } = mountListChip({ values: ['notes/'], bar: false });
    fireEvent.click(row(await openMenu(chip, LIST_POPUP), 'select'));
    fireEvent.change(screen.getByTestId(LIST_FIELD), { target: { value: 'notes/a|b.md\ndocs/' } });
    chord(screen.getByTestId(LIST_FIELD));
    expect(onApply).toHaveBeenLastCalledWith(['notes/a|b.md', 'docs/']);

    fireEvent.click(row(await openMenu(chip, LIST_POPUP), 'select'));
    fireEvent.change(screen.getByTestId(LIST_FIELD), { target: { value: '' } });
    chord(screen.getByTestId(LIST_FIELD));
    expect(onApply).toHaveBeenLastCalledWith([]);
    expect(chip.textContent).toBe('User');
  });

  it('a row of the chip’s own picks and closes; a recent row applies its list again', async () => {
    const { chip, onApply, onPick } = mountListChip({ recent: [['Dana Reyes', 'John Doe']] });
    fireEvent.click(row(await openMenu(chip, LIST_POPUP), 'row:me'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(isOpen(chip)).toBe(false);

    fireEvent.click(row(await openMenu(chip, LIST_POPUP), 'recent:0'));
    expect(onApply).toHaveBeenLastCalledWith(['Dana Reyes', 'John Doe']);
    expect(isOpen(chip)).toBe(false);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('the delete key clears a held filter while the menu is open — not the field’s, and not with none held', async () => {
    const held = mountListChip({ values: ['John Doe'] });
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(held.onClear).not.toHaveBeenCalled();

    const popup = await openMenu(held.chip, LIST_POPUP);
    fireEvent.click(row(popup, 'select'));
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(held.onClear).not.toHaveBeenCalled();
    fireEvent.click(held.chip);
    expect(isOpen(held.chip)).toBe(false);

    await openMenu(held.chip, LIST_POPUP);
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(held.onClear).toHaveBeenCalledTimes(1);
    expect(isOpen(held.chip)).toBe(false);
    expect(held.chip.textContent).toBe('User');

    await openMenu(held.chip, LIST_POPUP);
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(held.onClear).toHaveBeenCalledTimes(1);
    expect(isOpen(held.chip)).toBe(true);
  });

  it('the × clears without opening the menu', () => {
    const { chip, onClear } = mountListChip({ values: ['John Doe'] });
    fireEvent.click(screen.getByTestId(`${LIST_CHIP}-clear`));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(isOpen(chip)).toBe(false);
    expect(screen.queryByTestId(LIST_POPUP)).toBeNull();
  });
});

const BRANCH_CHIP = 'git-tool-scope-chip';
const BRANCH_POPUP = 'git-tool-chip-branch-popup';
const BRANCH_FIELD = 'git-tool-chip-branch-select-field';

const REFS: WorkspaceTreeRefWire[] = [
  { name: 'main', kind: 'local', sha: 'a'.repeat(40) },
  { name: 'feature/orders-v2', kind: 'local', sha: 'b'.repeat(40) },
  { name: 'origin/main', kind: 'remote', sha: 'a'.repeat(40) },
  { name: 'origin/feature/orders-v2', kind: 'remote', sha: 'b'.repeat(40) },
  { name: 'v2026.10.3', kind: 'tag', sha: 'c'.repeat(40) },
];

interface BranchChipOptions {
  scope?: GitLogScope;
  recent?: readonly GitLogScope[];
}

function mountBranchChip({ scope: held = [], recent = [] }: BranchChipOptions = {}) {
  const onScopeChange = vi.fn<(scope: GitLogScope) => void>();
  const onToggleFavorite = vi.fn<(kind: WorkspaceTreeRefWire['kind'], name: string) => void>();
  const Parent: React.FC = () => {
    const [scope, setScope] = useState(held);
    const [favorites, setFavorites] = useState<ReadonlySet<string>>(
      () => new Set([refFavoriteKey('local', 'main'), refFavoriteKey('remote', 'origin/main')]),
    );
    return (
      <BranchFilterChip
        refs={REFS}
        favorites={favorites}
        onToggleFavorite={(kind, name) => {
          onToggleFavorite(kind, name);
          setFavorites((starred) => {
            const next = new Set(starred);
            const key = refFavoriteKey(kind, name);
            if (!next.delete(key)) next.add(key);
            return next;
          });
        }}
        recent={recent}
        scope={scope}
        onScopeChange={(next) => {
          onScopeChange(next);
          setScope(next);
        }}
      />
    );
  };
  render(<Parent />);
  return { onScopeChange, onToggleFavorite, chip: screen.getByTestId(BRANCH_CHIP) };
}

const starOf = (item: HTMLElement): HTMLElement => {
  const star = item.querySelector<HTMLElement>('[data-testid="git-tool-chip-branch-star"]');
  if (star === null) throw new Error('no star to toggle on the row');
  return star;
};

describe('BranchFilterChip (mounted)', () => {
  it('the first layer: Select…, Recent, Favorites, HEAD, the favorites, then a submenu per namespace', async () => {
    const { chip } = mountBranchChip({ recent: [['HEAD', 'main']] });
    expect(chip.textContent).toBe('Branch');
    const popup = await openMenu(chip, BRANCH_POPUP);
    expect(layer(popup)).toEqual([
      'select',
      'group-recent',
      'favorites',
      'head',
      'ref:local:main',
      'ref:remote:origin/main',
      'group-local',
      'group-remote-origin',
      'group-tags',
    ]);
    // HEAD's star is fixed; a favorite's can be clicked.
    expect(row(popup, 'head').querySelector('[data-testid="git-tool-chip-branch-star"]')).toBeNull();
    expect(starOf(row(popup, 'ref:local:main')).getAttribute('data-on')).toBe('true');
    expect(screen.getByTestId('git-tool-chip-branch-hint').textContent).not.toBe('');
  });

  it('with no scope applied lately the menu has no Recent', async () => {
    const { chip } = mountBranchChip();
    expect(layer(await openMenu(chip, BRANCH_POPUP))).not.toContain('group-recent');
  });

  it('Select… by a click: the field takes several refs, names a value that is none and stays open', async () => {
    const { chip, onScopeChange } = mountBranchChip({ scope: ['main'] });
    const popup = await openMenu(chip, BRANCH_POPUP);
    fireEvent.click(row(popup, 'select'));
    expect(isOpen(chip)).toBe(true);
    expect(popup.getAttribute('data-mode')).toBe('select');
    const field = screen.getByTestId<HTMLTextAreaElement>(BRANCH_FIELD);
    expect(field.value).toBe('main\n');

    // The names that begin with the word lead; the one the text holds is left out.
    fireEvent.change(field, { target: { value: 'main\nfea' } });
    expect(suggested('git-tool-chip-branch-select')).toEqual(['feature/orders-v2', 'origin/feature/orders-v2']);

    fireEvent.change(field, { target: { value: 'main|nope\nhead' } });
    chord(field);
    expect(screen.getByTestId('git-tool-chip-branch-select-unknown').textContent).toContain('nope, head');
    expect(onScopeChange).not.toHaveBeenCalled();
    expect(isOpen(chip)).toBe(true);

    fireEvent.change(field, { target: { value: 'main|HEAD\nv2026.10.3' } });
    expect(screen.queryByTestId('git-tool-chip-branch-select-unknown')).toBeNull();
    chord(field);
    expect(onScopeChange).toHaveBeenCalledTimes(1);
    expect(onScopeChange).toHaveBeenLastCalledWith(['main', 'HEAD', 'v2026.10.3']);
    expect(isOpen(chip)).toBe(false);
    expect(chip.textContent).toBe('Branch:main|HEAD|v2026.10.3');
  });

  it('Favorites scopes to HEAD and every favorite; HEAD and a favorite’s row to that one', async () => {
    const { chip, onScopeChange } = mountBranchChip();
    fireEvent.click(row(await openMenu(chip, BRANCH_POPUP), 'favorites'));
    expect(onScopeChange).toHaveBeenLastCalledWith(['HEAD', 'main', 'origin/main']);
    expect(isOpen(chip)).toBe(false);
    expect(chip.textContent).toBe('Branch:HEAD|main|origin/main');

    fireEvent.click(row(await openMenu(chip, BRANCH_POPUP), 'head'));
    expect(onScopeChange).toHaveBeenLastCalledWith(['HEAD']);
    expect(isOpen(chip)).toBe(false);

    fireEvent.click(row(await openMenu(chip, BRANCH_POPUP), 'ref:remote:origin/main'));
    expect(onScopeChange).toHaveBeenLastCalledWith(['origin/main']);
    expect(isOpen(chip)).toBe(false);
    expect(onScopeChange).toHaveBeenCalledTimes(3);
  });

  it('a star toggles the favorite, picks nothing and keeps the menu open; un-starred, the row stays until the menu closes', async () => {
    const { chip, onScopeChange, onToggleFavorite } = mountBranchChip();
    const popup = await openMenu(chip, BRANCH_POPUP);
    fireEvent.click(starOf(row(popup, 'ref:local:main')));
    expect(onToggleFavorite).toHaveBeenLastCalledWith('local', 'main');
    expect(onScopeChange).not.toHaveBeenCalled();
    expect(isOpen(chip)).toBe(true);
    expect(starOf(row(popup, 'ref:local:main')).getAttribute('data-on')).toBe('false');

    // Put back where it was taken.
    fireEvent.click(starOf(row(popup, 'ref:local:main')));
    expect(starOf(row(popup, 'ref:local:main')).getAttribute('data-on')).toBe('true');
    fireEvent.click(starOf(row(popup, 'ref:remote:origin/main')));
    expect(layer(popup)).toContain('ref:remote:origin/main');

    fireEvent.click(chip);
    expect(isOpen(chip)).toBe(false);
    const again = layer(await openMenu(chip, BRANCH_POPUP));
    expect(again).toContain('ref:local:main');
    expect(again).not.toContain('ref:remote:origin/main');
    expect(onToggleFavorite).toHaveBeenCalledTimes(3);
  });

  it('a namespace’s submenu: a ref scopes to it, its star makes it a favorite', async () => {
    const { chip, onScopeChange, onToggleFavorite } = mountBranchChip();
    const popup = await openMenu(chip, BRANCH_POPUP);
    fireEvent.mouseEnter(row(popup, 'group-local'));
    const nested = await waitFor(() => row(popup, 'ref:local:feature/orders-v2', true));
    expect(starOf(nested).getAttribute('data-on')).toBe('false');
    fireEvent.click(starOf(nested));
    expect(onToggleFavorite).toHaveBeenLastCalledWith('local', 'feature/orders-v2');
    expect(onScopeChange).not.toHaveBeenCalled();
    expect(isOpen(chip)).toBe(true);

    fireEvent.click(row(popup, 'ref:local:feature/orders-v2', true));
    expect(onScopeChange).toHaveBeenLastCalledWith(['feature/orders-v2']);
    expect(isOpen(chip)).toBe(false);
  });

  it('a recent scope applies again', async () => {
    const { chip, onScopeChange } = mountBranchChip({ recent: [['HEAD', 'main'], ['origin/main']] });
    const popup = await openMenu(chip, BRANCH_POPUP);
    fireEvent.mouseEnter(row(popup, 'group-recent'));
    fireEvent.click(await waitFor(() => row(popup, 'recent:0', true)));
    expect(onScopeChange).toHaveBeenLastCalledWith(['HEAD', 'main']);
    expect(isOpen(chip)).toBe(false);
  });

  it('typing in the open menu searches one ref; emptied, the menu is back with its first row under the keys', async () => {
    const { chip, onScopeChange } = mountBranchChip();
    const popup = await openMenu(chip, BRANCH_POPUP);
    fireEvent.keyDown(document, { key: 'o' });
    expect(popup.getAttribute('data-mode')).toBe('search');
    const search = screen.getByTestId<HTMLInputElement>('git-tool-chip-branch-search');
    expect(search.value).toBe('o');
    fireEvent.change(search, { target: { value: 'orders' } });
    expect(screen.getAllByTestId('git-tool-chip-branch-row').map((found) => found.getAttribute('data-ref'))).toEqual([
      'feature/orders-v2',
      'origin/feature/orders-v2',
    ]);
    expect(screen.getAllByTestId('git-tool-chip-branch-section')).toHaveLength(2);

    fireEvent.change(search, { target: { value: '' } });
    expect(popup.getAttribute('data-mode')).toBe('menu');
    expect(document.activeElement).toBe(row(popup, 'select'));
    expect(isOpen(chip)).toBe(true);

    fireEvent.keyDown(document, { key: 'v' });
    fireEvent.change(screen.getByTestId('git-tool-chip-branch-search'), { target: { value: 'v2026' } });
    fireEvent.click(screen.getByTestId('git-tool-chip-branch-row'));
    expect(onScopeChange).toHaveBeenCalledTimes(1);
    expect(onScopeChange).toHaveBeenLastCalledWith(['v2026.10.3']);
    expect(isOpen(chip)).toBe(false);
    // One scoped ref that is a tag names the chip.
    expect(chip.textContent).toBe('Tag:v2026.10.3');
  });

  it('the delete key clears a held scope while the menu is open; with none held it does nothing', async () => {
    const { chip, onScopeChange } = mountBranchChip({ scope: ['HEAD', 'main'] });
    expect(chip.textContent).toBe('Branch:HEAD|main');
    await openMenu(chip, BRANCH_POPUP);
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(onScopeChange).toHaveBeenLastCalledWith([]);
    expect(isOpen(chip)).toBe(false);
    expect(chip.textContent).toBe('Branch');

    await openMenu(chip, BRANCH_POPUP);
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(onScopeChange).toHaveBeenCalledTimes(1);
    expect(isOpen(chip)).toBe(true);
  });

  it('the × clears the scope without opening the menu', () => {
    const { chip, onScopeChange } = mountBranchChip({ scope: ['main'] });
    fireEvent.click(screen.getByTestId(`${BRANCH_CHIP}-clear`));
    expect(onScopeChange).toHaveBeenLastCalledWith([]);
    expect(isOpen(chip)).toBe(false);
    expect(screen.queryByTestId(BRANCH_POPUP)).toBeNull();
  });
});
