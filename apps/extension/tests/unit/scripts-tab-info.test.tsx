// @vitest-environment jsdom
/**
 * ScriptsTab rail `(i)` popovers — the pre-request / post-response
 * entries lead with the Settings tab's shared example card: the pre
 * script lights the request line it may rewrite, the post script
 * lights the journey outcome it tests, each alongside the scripts
 * slot both execute in. The `oh.*` API glossary stays beneath the
 * card. The Monaco CodeEditor is mocked to a textarea — the popover
 * chrome is the contract here, not the editor.
 */

// Side-effect imports: register the setting defs the toolbar reads —
// shortcut labels (CodeEditorActions → useShortcutLabel) and the
// editor view menu's wrap/line-number settings.
import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/editor';
import ScriptsTab from '@openheaders/ui/workbench/components/request-editor/ScriptsTab';
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
  return render(
    <ScriptsTab
      preRequestScript=""
      postResponseScript=""
      onPreRequestChange={() => {}}
      onPostResponseChange={() => {}}
    />,
  );
}

/** Highlighted example-card tokens of the currently open popover. */
const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

describe('ScriptsTab rail info popovers', () => {
  it('leads the pre-request popover with the shared card, request line and scripts slot lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Pre-request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Scripts');
    expect(litTokens()).toEqual(['https://api.openheaders.com/v1/users', 'scripts: safe']);
    expect(screen.getByText('oh.setHeader(name, value)')).toBeTruthy();
  });

  it('leads the post-response popover with the outcome and scripts slot lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Post-response script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Scripts');
    expect(litTokens()).toEqual(['302 → 200', 'scripts: safe']);
    expect(screen.getByText('oh.test(name, fn)')).toBeTruthy();
  });

  it('keeps an open popover across a tab re-render', async () => {
    // The rail rows must be module-scope components: defined inside
    // ScriptsTab their type changes identity every render, so any
    // re-render of the tab (focus shifts, draft updates) remounted the
    // rows and silently closed an open popover.
    const view = renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Pre-request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    view.rerender(
      <ScriptsTab
        preRequestScript=""
        postResponseScript=""
        onPreRequestChange={() => {}}
        onPostResponseChange={() => {}}
      />,
    );
    expect(screen.queryByText('Example send')).toBeTruthy();
  });
});
