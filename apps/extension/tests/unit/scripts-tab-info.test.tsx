// @vitest-environment jsdom
/**
 * ScriptsTab — the slot rail and its `(i)` popovers. The rows lead
 * with the Settings tab's shared example card: the before-request
 * card lights the request line the script may rewrite, the
 * after-response card lights the journey outcome it tests, each
 * alongside the scripts slot both execute in. The `oh.*` API glossary
 * stays beneath the card. The Monaco CodeEditor is mocked to a
 * textarea — the rail and popover chrome are the contract here, not
 * the editor.
 *
 * The two mounts: a request's tab draws its slots flat with the
 * request placeholders; a container's tab draws them under the HTTP
 * kind header with the container placeholders.
 *
 * The ancestor line: a request under a collection reads "Runs after N
 * scripts:" for the active slot with one link per level opening that
 * container's Scripts section; absent without ancestor scripts.
 */

// Side-effect imports: register the setting defs the toolbar reads —
// shortcut labels (CodeEditorActions → useShortcutLabel) and the
// editor view menu's wrap/line-number settings.
import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/editor';
import type { AncestorScriptLevels } from '@openheaders/ui/workbench/components/request-container/ancestry';
import ScriptsTab from '@openheaders/ui/workbench/components/request-editor/ScriptsTab';
import {
  emptyScriptSlotValues,
  type ScriptSlotScope,
  type ScriptSlotValues,
} from '@openheaders/ui/workbench/components/script-editor/script-slots';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (next: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
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

const EMPTY: ScriptSlotValues = emptyScriptSlotValues();

function renderTab(
  extra: {
    scope?: ScriptSlotScope;
    scripts?: ScriptSlotValues;
    ancestorScripts?: AncestorScriptLevels;
    onOpenContainerScripts?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  } = {},
) {
  const { scope = 'request', scripts = EMPTY, ...rest } = extra;
  return render(<ScriptsTab scope={scope} scripts={scripts} onScriptChange={() => {}} {...rest} />);
}

const ANCESTORS: AncestorScriptLevels = {
  'pre-request': [
    { kind: 'collection', uid: 'col00001', name: 'Payments' },
    { kind: 'folder', uid: 'fld00001', name: 'Tokens' },
  ],
  'post-response': [{ kind: 'collection', uid: 'col00001', name: 'Payments' }],
};

/** Highlighted example-card tokens of the currently open popover. */
const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

const editor = (): HTMLTextAreaElement => screen.getByTestId<HTMLTextAreaElement>('code-editor');

describe('ScriptsTab rail', () => {
  it('a request mount draws the two slots flat, the before-request slot active with its placeholder', () => {
    renderTab();
    expect(screen.getAllByTestId('oh-script-rail-row').map((row) => row.firstChild?.textContent)).toEqual([
      'Before request',
      'After response',
    ]);
    expect(screen.queryByTestId('oh-script-rail-group')).toBeNull();
    expect(editor().placeholder).toBe('Use JavaScript to modify this request before it is sent.');
    fireEvent.click(screen.getByText('After response'));
    expect(editor().placeholder).toBe('Use JavaScript to test and read this response after it arrives.');
  });

  it('a container mount draws the slots under the HTTP kind header with the container placeholders', () => {
    renderTab({ scope: 'container' });
    expect(screen.getByTestId('oh-script-rail-group').textContent).toBe('HTTPHTTP');
    expect(editor().placeholder).toBe('Write scripts to be run before each HTTP request is sent.');
    fireEvent.click(screen.getByText('After response'));
    expect(editor().placeholder).toBe('Write scripts to be run at the end of each HTTP response.');
  });

  it('the editor edits the active slot and reports the slot it changed', () => {
    const onChange = vi.fn();
    render(
      <ScriptsTab
        scope="request"
        scripts={{ ...EMPTY, 'pre-request': 'oh.setHeader("a", "1");' }}
        onScriptChange={onChange}
      />,
    );
    expect(editor().value).toBe('oh.setHeader("a", "1");');
    fireEvent.click(screen.getByText('After response'));
    expect(editor().value).toBe('');
    fireEvent.change(editor(), { target: { value: 'oh.test("ok", () => {});' } });
    expect(onChange).toHaveBeenCalledWith('post-response', 'oh.test("ok", () => {});');
  });
});

describe('ScriptsTab rail info popovers', () => {
  it('leads the before-request popover with the shared card, request line and scripts slot lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Before request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Scripts');
    expect(litTokens()).toEqual(['https://api.openheaders.com/v1/users', 'scripts: safe']);
    expect(screen.getByText('oh.setHeader(name, value)')).toBeTruthy();
  });

  it('leads the after-response popover with the outcome and scripts slot lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About After response script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Scripts');
    expect(litTokens()).toEqual(['302 → 200', 'scripts: safe']);
    expect(screen.getByText('oh.test(name, fn)')).toBeTruthy();
  });

  it('keeps an open popover across a tab re-render', async () => {
    // The rail rows must be module-scope components: defined inside
    // the rail their type changes identity every render, so any
    // re-render of the tab (focus shifts, draft updates) remounted the
    // rows and silently closed an open popover.
    const view = renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Before request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    view.rerender(<ScriptsTab scope="request" scripts={EMPTY} onScriptChange={() => {}} />);
    expect(screen.queryByText('Example send')).toBeTruthy();
  });
});

describe('ScriptsTab ancestor line', () => {
  it('names the levels that run ahead of the active slot, outer → inner, each opening its Scripts section', () => {
    const onOpen = vi.fn();
    renderTab({ ancestorScripts: ANCESTORS, onOpenContainerScripts: onOpen });
    const line = screen.getByTestId('oh-scripts-runs-after');
    expect(line.textContent).toBe('Runs after 2 scripts:Collection ‘Payments’·Folder ‘Tokens’');
    const links = screen.getAllByTestId('oh-scripts-ancestor-link');
    expect(links.map((l) => l.textContent)).toEqual(['Collection ‘Payments’', 'Folder ‘Tokens’']);
    fireEvent.click(links[1]);
    expect(onOpen).toHaveBeenCalledWith('folder', 'fld00001', 'Tokens');
  });

  it('follows the rail — the after-response slot reads its own levels', () => {
    renderTab({ ancestorScripts: ANCESTORS, onOpenContainerScripts: () => {} });
    fireEvent.click(screen.getByText('After response'));
    const line = screen.getByTestId('oh-scripts-runs-after');
    expect(line.textContent).toBe('Runs after 1 script:Collection ‘Payments’');
  });

  it('is absent without ancestor scripts for the slot, and on a mount that passes none', () => {
    renderTab({ ancestorScripts: { 'post-response': ANCESTORS['post-response'] }, onOpenContainerScripts: () => {} });
    expect(screen.queryByTestId('oh-scripts-runs-after')).toBeNull();
    cleanup();
    renderTab();
    expect(screen.queryByTestId('oh-scripts-runs-after')).toBeNull();
  });
});
