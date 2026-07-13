// @vitest-environment jsdom
/**
 * Cookies section keyboard navigation — StorageGrid's model on the jar
 * grid: the section is a focusable `role="grid"`, ArrowUp/ArrowDown walk
 * the cookies' display order and OPEN the cookie document like a click
 * (the row highlight follows via the active-editor-tab derivation — no
 * grid-local selection state), Home/End jump. Deltas from the DOM grid:
 * Enter has no gesture (edits ride the pencil's CookieEditPopover), and
 * the nav stands down while that popover is open or for presses on
 * interactive children (the row action lane, the popover's fields).
 *
 * The harness mirrors the production wiring: opening a cookie makes it
 * the ACTIVE document, exactly one row reads active at a time.
 */

import { CookiesSection } from '@openheaders/ui/panel/components/storage/CookiesSection';
import type { SiteJarCookie } from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
// The edit popover's save chord reads `keyboard.save` from the settings
// registry — import the schema barrel for its side effects.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The pencil's popover rides antd Popover → rc-resize-observer; jsdom
// ships neither ResizeObserver nor scrollIntoView (no layout).
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
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

// Same seams the popover suite stubs: the form's TemplateInputs and the
// variable resolver are out of scope — the nav's stand-down while the
// popover is open is what's under test.
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

afterEach(cleanup);

const SCOPE_URL = 'https://openheaders.io/';

function cookie(name: string, over: Partial<SiteJarCookie> = {}): SiteJarCookie {
  return {
    name,
    value: `${name}-value`,
    domain: 'openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    session: true,
    sendable: true,
    storeId: '0',
    ...over,
  };
}

const THREE = [cookie('alpha'), cookie('beta'), cookie('gamma')];

function Harness({
  cookies,
  onOpenSpy,
}: {
  cookies: ReadonlyArray<SiteJarCookie>;
  onOpenSpy: (name: string) => void;
}) {
  // The production highlight derives from which cookie document is the
  // ACTIVE editor tab; opening a cookie activates it. Model exactly that
  // (names are unique here, so name is the identity).
  const [activeName, setActiveName] = useState<string | null>(null);
  return (
    <AntApp>
      <CookiesSection
        cookies={cookies}
        scopeUrl={SCOPE_URL}
        writable
        onApplyEdit={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn()}
        onOpen={(c) => {
          onOpenSpy(c.name);
          setActiveName(c.name);
        }}
        isActive={(c) => c.name === activeName}
      />
    </AntApp>
  );
}

function renderSection(cookies: ReadonlyArray<SiteJarCookie> = THREE) {
  const onOpenSpy = vi.fn();
  const { container } = render(<Harness cookies={cookies} onOpenSpy={onOpenSpy} />);
  const grid = screen.getByRole('grid', { name: 'Cookies' }) as HTMLDivElement;
  return { container, grid, onOpenSpy };
}

function activeRowName(container: HTMLElement): string | null {
  const row = container.querySelector('.dt-storage-row[aria-selected="true"]');
  return row?.querySelector('.dt-storage-key')?.textContent ?? null;
}

describe('CookiesSection — keyboard navigation', () => {
  it('exposes the focusable grid anatomy with aria-selected, indexed rows', () => {
    const { container, grid } = renderSection();
    expect(grid.getAttribute('tabindex')).toBe('0');
    const rows = container.querySelectorAll('.dt-storage-row[role="row"]');
    expect(rows.length).toBe(3);
    rows.forEach((row, i) => {
      expect(row.getAttribute('aria-selected')).toBe('false');
      expect(row.getAttribute('data-entry-index')).toBe(String(i));
    });
  });

  it('ArrowDown walks from the first row, opening the cookie document per move, and clamps at the end', () => {
    const { container, grid, onOpenSpy } = renderSection();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowName(container)).toBe('alpha');
    expect(onOpenSpy).toHaveBeenLastCalledWith('alpha');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowName(container)).toBe('beta');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowName(container)).toBe('gamma');
    // Clamped at the end: no re-open of the same document.
    expect(onOpenSpy).toHaveBeenCalledTimes(3);
  });

  it('ArrowUp with no active row starts from the last row', () => {
    const { container, grid } = renderSection();
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowName(container)).toBe('gamma');
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(activeRowName(container)).toBe('beta');
  });

  it('Home and End jump to the first and last row', () => {
    const { container, grid } = renderSection();
    fireEvent.keyDown(grid, { key: 'End' });
    expect(activeRowName(container)).toBe('gamma');
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(activeRowName(container)).toBe('alpha');
  });

  it('click-then-arrow hands off: a row click activates it and the next arrow moves on', () => {
    const { container, grid, onOpenSpy } = renderSection();
    fireEvent.click(screen.getByTitle('beta'));
    expect(onOpenSpy).toHaveBeenLastCalledWith('beta');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(activeRowName(container)).toBe('gamma');
  });

  it('Enter has no gesture — it neither opens nor edits', () => {
    const { container, grid, onOpenSpy } = renderSection();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowName(container)).toBe('alpha');
    expect(document.querySelector('.dt-cookie-edit-popover')).toBeNull();
  });

  it('stands down while the edit popover is open', async () => {
    const { container, grid, onOpenSpy } = renderSection();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.click(screen.getByLabelText('Edit cookie alpha'));
    await waitFor(() => {
      expect(document.querySelector('.dt-cookie-edit-popover')).not.toBeNull();
    });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowName(container)).toBe('alpha');
  });

  it('presses on the row action lane belong to its buttons, not the grid nav', () => {
    const { grid, onOpenSpy } = renderSection();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    onOpenSpy.mockClear();
    fireEvent.keyDown(screen.getByLabelText('Delete cookie alpha'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByLabelText('Edit cookie alpha'), { key: 'ArrowDown' });
    expect(onOpenSpy).not.toHaveBeenCalled();
  });

  it('ignores non-navigation keys and modified presses', () => {
    const { container, grid, onOpenSpy } = renderSection();
    fireEvent.keyDown(grid, { key: 'a' });
    fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', metaKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', altKey: true });
    expect(onOpenSpy).not.toHaveBeenCalled();
    expect(activeRowName(container)).toBeNull();
  });
});
