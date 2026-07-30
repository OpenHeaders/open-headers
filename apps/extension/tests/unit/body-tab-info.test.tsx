// @vitest-environment jsdom
/**
 * BodyTab mode `(i)` popovers — every encoding radio carries a
 * hover-revealed trigger whose popover leads with the Settings tab's
 * shared example card: the body leg is the card's variant slot, so
 * each mode swaps it to its own wire shape (`body: none` /
 * `multipart` / `form` / `json` / `graphql`) and lights it. The
 * Monaco CodeEditor is mocked to a textarea — the popover chrome is
 * the contract here, not the editor.
 */

// Side-effect imports: register the setting defs the editor toolbars
// read (shortcut labels, wrap/line-number settings) — the raw/GraphQL
// variants mount them.
import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/editor';
import BodyTab from '@openheaders/ui/workbench/components/request-editor/BodyTab';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (next: string) => void }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
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

afterEach(cleanup);

function renderTab() {
  return render(<BodyTab body={{ type: 'none' }} onChange={() => {}} />);
}

/** Highlighted example-card tokens of the currently open popover. */
const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

describe('BodyTab mode info popovers', () => {
  it('gives every mode a hover-revealed trigger inside a hover host', () => {
    renderTab();
    const triggers = document.querySelectorAll('.oh-info-trigger--hover');
    expect(triggers.length).toBe(5);
    for (const trigger of triggers) {
      expect(trigger.closest('.oh-info-hover-host')).toBeTruthy();
    }
  });

  it('leads the none popover with the shared card, body slot swapped and lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About none' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Body');
    expect(document.querySelector('.oh-info-popover-title')?.textContent).toBe('none');
    expect(litTokens()).toEqual(['body: none']);
  });

  const VARIANTS: ReadonlyArray<[trigger: string, slot: string]> = [
    ['About form-data', 'body: multipart'],
    ['About x-www-form-urlencoded', 'body: form'],
    ['About raw', 'body: json'],
    ['About GraphQL', 'body: graphql'],
  ];
  for (const [trigger, slot] of VARIANTS) {
    it(`lights the ${slot} slot for ${trigger.replace('About ', '')}`, async () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: trigger }));
      expect(await screen.findByText('Example send')).toBeTruthy();
      expect(litTokens()).toEqual([slot]);
    });
  }

  it('keeps an open popover across a tab re-render', async () => {
    const view = renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About form-data' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    view.rerender(<BodyTab body={{ type: 'none' }} onChange={() => {}} />);
    expect(screen.queryByText('Example send')).toBeTruthy();
  });
});
