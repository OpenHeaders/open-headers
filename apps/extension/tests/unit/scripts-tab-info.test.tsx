// @vitest-environment jsdom
/**
 * ScriptsTab rail `(i)` popovers — the pre-request / post-response
 * entries lead with the Settings tab's shared example card: the pre
 * script lights the request line it may rewrite, the post script
 * lights the journey outcome it tests, each alongside the scripts
 * slot both execute in. The `oh.*` API glossary stays beneath the
 * card. The Monaco CodeEditor is mocked to a textarea — the popover
 * chrome is the contract here, not the editor.
 *
 * The ancestor line: a request under a collection reads "Runs after N
 * scripts:" for the active phase with one link per level opening that
 * container's Scripts section; absent without ancestor scripts.
 */

// Side-effect imports: register the setting defs the toolbar reads —
// shortcut labels (CodeEditorActions → useShortcutLabel) and the
// editor view menu's wrap/line-number settings.
import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/editor';
import ScriptsTab from '@openheaders/ui/workbench/components/request-editor/ScriptsTab';
import type { AncestorScriptLevels } from '@openheaders/ui/workbench/components/request-container/ancestry';
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

function renderTab(extra: {
  ancestorScripts?: AncestorScriptLevels;
  onOpenContainerScripts?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
} = {}) {
  return render(
    <ScriptsTab
      preRequestScript=""
      postResponseScript=""
      onPreRequestChange={() => {}}
      onPostResponseChange={() => {}}
      {...extra}
    />,
  );
}

const ANCESTORS: AncestorScriptLevels = {
  pre: [
    { kind: 'collection', uid: 'col00001', name: 'Payments' },
    { kind: 'folder', uid: 'fld00001', name: 'Tokens' },
  ],
  post: [{ kind: 'collection', uid: 'col00001', name: 'Payments' }],
};

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

describe('ScriptsTab ancestor line', () => {
  it('names the levels that run ahead of the active phase, outer → inner, each opening its Scripts section', () => {
    const onOpen = vi.fn();
    renderTab({ ancestorScripts: ANCESTORS, onOpenContainerScripts: onOpen });
    const line = screen.getByTestId('oh-scripts-runs-after');
    expect(line.textContent).toBe('Runs after 2 scripts:Collection ‘Payments’·Folder ‘Tokens’');
    const links = screen.getAllByTestId('oh-scripts-ancestor-link');
    expect(links.map((l) => l.textContent)).toEqual(['Collection ‘Payments’', 'Folder ‘Tokens’']);
    fireEvent.click(links[1]);
    expect(onOpen).toHaveBeenCalledWith('folder', 'fld00001', 'Tokens');
  });

  it('follows the rail — the post-response phase reads its own levels', () => {
    renderTab({ ancestorScripts: ANCESTORS, onOpenContainerScripts: () => {} });
    fireEvent.click(screen.getByText('Post-response'));
    const line = screen.getByTestId('oh-scripts-runs-after');
    expect(line.textContent).toBe('Runs after 1 script:Collection ‘Payments’');
  });

  it('is absent without ancestor scripts for the phase, and on a mount that passes none', () => {
    renderTab({ ancestorScripts: { pre: [], post: ANCESTORS.post }, onOpenContainerScripts: () => {} });
    expect(screen.queryByTestId('oh-scripts-runs-after')).toBeNull();
    cleanup();
    renderTab();
    expect(screen.queryByTestId('oh-scripts-runs-after')).toBeNull();
  });
});
