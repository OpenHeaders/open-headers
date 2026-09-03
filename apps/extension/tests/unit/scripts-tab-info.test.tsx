// @vitest-environment jsdom
/**
 * ScriptsTab — the slot rail and its `(i)` popovers. Every row leads
 * with its kind's lifecycle card: one line per hook in wire order,
 * the hook's label opening it, the wire moment and the fields of its
 * `oh` view after, with the row's own line lit and the other hooks'
 * lines quiet. The card is the kind's, not the level's — the container
 * mount shows the same card. The `oh.*` API glossary stays beneath
 * the card. The Monaco CodeEditor is mocked to a textarea — the rail
 * and popover chrome are the contract here, not the editor.
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
  // A request mount names its kind — the HTTP editor's; a container
  // mount draws every group.
  return render(
    <ScriptsTab
      scope={scope}
      {...(scope === 'request' ? { requestKind: 'http' as const } : {})}
      scripts={scripts}
      onScriptChange={() => {}}
      {...rest}
    />,
  );
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

/** The lines of the open popover's card — one per hook of the kind. */
const cardLines = (): number => document.querySelectorAll('.oh-info-eg-line').length;

const editor = (): HTMLTextAreaElement => screen.getByTestId<HTMLTextAreaElement>('code-editor');

describe('ScriptsTab rail', () => {
  it('a request mount draws the two slots flat, the before-request slot active with its placeholder', () => {
    renderTab();
    expect(screen.getAllByTestId('oh-script-rail-row').map((row) => row.firstChild?.textContent)).toEqual([
      'Before request',
      'After response',
    ]);
    expect(screen.queryByTestId('oh-script-rail-group')).toBeNull();
    // No header to nest under — the flat rows keep the rail's edge.
    expect(screen.getAllByTestId('oh-script-rail-row')[0]?.style.paddingLeft).toBe('10px');
    expect(editor().placeholder).toBe('Use JavaScript to modify this request before it is sent.');
    fireEvent.click(screen.getByText('After response'));
    expect(editor().placeholder).toBe('Use JavaScript to test and read this response after it arrives.');
  });

  it('a container mount draws the slots under the HTTP kind header with the container placeholders', () => {
    renderTab({ scope: 'container' });
    expect(screen.getAllByTestId('oh-script-rail-group')[0]?.textContent).toBe('HTTPHTTP');
    expect(editor().placeholder).toBe('Write scripts to be run before each HTTP request is sent.');
    // The HTTP pair's row leads; the gRPC group's After response row
    // sits under its own kind header further down.
    fireEvent.click(screen.getAllByText('After response')[0] as HTMLElement);
    expect(editor().placeholder).toBe('Write scripts to be run at the end of each HTTP response.');
  });

  it('the editor edits the active slot and reports the slot it changed', () => {
    const onChange = vi.fn();
    render(
      <ScriptsTab
        scope="request"
        requestKind="http"
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
  it('leads the before-request popover with the HTTP lifecycle card, its own line lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Before request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Scripts');
    // The card holds both HTTP hooks in wire order; the row's line —
    // its label, the wire moment, the fields its `oh` view carries —
    // is the lit one, the After response line stays quiet.
    expect(cardLines()).toBe(2);
    expect(litTokens()).toEqual([
      'Before request',
      'POST https://api.openheaders.com/v1/users',
      'headers',
      'params',
      'body',
    ]);
    expect(screen.getByText('oh.setHeader(name, value)')).toBeTruthy();
  });

  it('leads the after-response popover with the same card, the response line lit', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About After response script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Scripts');
    expect(cardLines()).toBe(2);
    expect(litTokens()).toEqual(['After response', '200', '143 ms', 'headers', 'body']);
    expect(screen.getByText('oh.test(name, fn)')).toBeTruthy();
  });

  it('the card is the kind’s, not the level’s — a container mount shows the same one', async () => {
    renderTab({ scope: 'container' });
    fireEvent.click(screen.getByRole('button', { name: 'About Before request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    expect(cardLines()).toBe(2);
    expect(litTokens()).toEqual([
      'Before request',
      'POST https://api.openheaders.com/v1/users',
      'headers',
      'params',
      'body',
    ]);
  });

  it('keeps an open popover across a tab re-render', async () => {
    // The rail rows must be module-scope components: defined inside
    // the rail their type changes identity every render, so any
    // re-render of the tab (focus shifts, draft updates) remounted the
    // rows and silently closed an open popover.
    const view = renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'About Before request script' }));
    expect(await screen.findByText('Example send')).toBeTruthy();
    view.rerender(<ScriptsTab scope="request" requestKind="http" scripts={EMPTY} onScriptChange={() => {}} />);
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

describe('ScriptsTab request kinds', () => {
  it('a WebSocket request mount draws the four WebSocket slots flat, Before connect active with its placeholder', () => {
    render(<ScriptsTab scope="request" requestKind="websocket" scripts={EMPTY} onScriptChange={() => {}} />);
    expect(screen.getAllByTestId('oh-script-rail-row').map((row) => row.firstChild?.textContent)).toEqual([
      'Before connect',
      'Before send',
      'On message',
      'After close',
    ]);
    expect(screen.queryByTestId('oh-script-rail-group')).toBeNull();
    expect(screen.queryByText('Before request')).toBeNull();
    expect(editor().placeholder).toBe('Use JavaScript to modify the handshake before this session connects.');
    fireEvent.click(screen.getByText('After close'));
    expect(editor().placeholder).toBe('Use JavaScript to test and read this session after it closes.');
  });

  it('the Socket.IO flavor reads the WebSocket group and edits report the WebSocket kind', () => {
    const onChange = vi.fn();
    render(<ScriptsTab scope="request" requestKind="socketio" scripts={EMPTY} onScriptChange={onChange} />);
    fireEvent.click(screen.getByText('On message'));
    fireEvent.change(editor(), { target: { value: `await oh.send('pong');` } });
    expect(onChange).toHaveBeenCalledWith('ws-on-message', `await oh.send('pong');`);
  });

  it('a container mount draws the HTTP, gRPC, WebSocket and MQTT groups under their kind headers', () => {
    renderTab({ scope: 'container' });
    const groups = screen.getAllByTestId('oh-script-rail-group');
    // The WebSocket header's badge names its Socket.IO flavor — the one
    // group both flavors' sessions run; the rail keeps its width.
    expect(groups.map((g) => g.textContent)).toEqual(['HTTPHTTP', 'gRPCgRPC', 'WS/S.IOWebSocket', 'MQTTMQTT']);
    expect(screen.getByTestId('oh-script-rail').style.width).toBe('176px');
    // Each kind header's badge carries the kind's own tint — the tree
    // tags' color, not the picker's neutral gradient.
    expect(groups.map((g) => (g.firstChild as HTMLElement).style.color)).toEqual([
      'var(--oh-method-get, #0a7d33)',
      'var(--oh-method-grpc, #0b5cad)',
      'var(--oh-method-ws, #c2410c)',
      'var(--oh-method-mqtt, #7c3aed)',
    ]);
    // The selection is an aria state the stylesheet fills — no inline
    // background to out-rank the hover rule.
    const pressed = () =>
      screen.getAllByTestId('oh-script-rail-row').map((row) => row.getAttribute('aria-pressed') === 'true');
    expect(pressed().indexOf(true)).toBe(0);
    expect(screen.getAllByTestId('oh-script-rail-row')[0]?.style.background).toBe('');
    // The rows sit inset under their kind header; the header keeps the
    // rail's edge.
    expect(screen.getAllByTestId('oh-script-rail-row').map((row) => row.style.paddingLeft)).toEqual(
      Array(13).fill('24px'),
    );
    expect(groups.map((g) => g.style.paddingLeft)).toEqual(Array(4).fill('10px'));
    fireEvent.click(screen.getByText('Before send'));
    expect(pressed().indexOf(true)).toBe(6);
    expect(editor().placeholder).toBe('Write scripts to be run before each WebSocket message is sent.');
    fireEvent.click(screen.getByText('Before publish'));
    expect(editor().placeholder).toBe('Write scripts to be run before each MQTT message is published.');
  });

  it('a gRPC request mount draws the three gRPC slots flat and edits report the gRPC kind', () => {
    const onChange = vi.fn();
    render(<ScriptsTab scope="request" requestKind="grpc" scripts={EMPTY} onScriptChange={onChange} />);
    expect(screen.getAllByTestId('oh-script-rail-row').map((row) => row.firstChild?.textContent)).toEqual([
      'Before invoke',
      'On message',
      'After response',
    ]);
    expect(screen.queryByTestId('oh-script-rail-group')).toBeNull();
    expect(screen.queryByText('Before connect')).toBeNull();
    fireEvent.click(screen.getByText('After response'));
    fireEvent.change(editor(), { target: { value: `await oh.test('ok', () => {});` } });
    expect(onChange).toHaveBeenCalledWith('grpc-after-response', `await oh.test('ok', () => {});`);
  });

  it('a gRPC slot popover leads with the call lifecycle card, its line lit, the glossary beneath', async () => {
    render(<ScriptsTab scope="request" requestKind="grpc" scripts={EMPTY} onScriptChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Before invoke script' }));
    expect(await screen.findByText('Example call')).toBeTruthy();
    expect(cardLines()).toBe(3);
    expect(litTokens()).toEqual(['Before invoke', 'CALL books.v1.Library/WatchBooks', 'metadata', 'message']);
    expect(screen.getByText('oh.setMetadata(name, value)')).toBeTruthy();
    expect(screen.getByText('oh.setMessage(text)')).toBeTruthy();
    expect(screen.getByText('oh.session')).toBeTruthy();
  });

  it('a WebSocket slot popover leads with the session lifecycle card, its line lit, the glossary beneath', async () => {
    render(<ScriptsTab scope="request" requestKind="websocket" scripts={EMPTY} onScriptChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Before connect script' }));
    expect(await screen.findByText('Example session')).toBeTruthy();
    expect(cardLines()).toBe(4);
    expect(litTokens()).toEqual([
      'Before connect',
      'CONNECT wss://api.openheaders.com/v1/stream',
      'headers',
      'params',
      'subprotocols',
      'attempt',
    ]);
    expect(screen.getByText('oh.setSubprotocols(list)')).toBeTruthy();
    expect(screen.getByText('oh.session')).toBeTruthy();
  });

  it('the WebSocket card carries the Socket.IO facts as S.IO tokens — one card for both flavors', async () => {
    render(<ScriptsTab scope="request" requestKind="socketio" scripts={EMPTY} onScriptChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Before send script' }));
    expect(await screen.findByText('Example session')).toBeTruthy();
    expect(litTokens()).toEqual([
      'Before send',
      'SEND ↑ {"type":"subscribe"}',
      'text',
      'binary',
      'S.IO event',
      'S.IO ack',
    ]);
  });

  it('an MQTT request mount draws the four MQTT slots flat and edits report the MQTT kind', () => {
    const onChange = vi.fn();
    render(<ScriptsTab scope="request" requestKind="mqtt" scripts={EMPTY} onScriptChange={onChange} />);
    expect(screen.getAllByTestId('oh-script-rail-row').map((row) => row.firstChild?.textContent)).toEqual([
      'Before connect',
      'Before publish',
      'On message',
      'After close',
    ]);
    expect(screen.queryByTestId('oh-script-rail-group')).toBeNull();
    expect(screen.queryByText('Before send')).toBeNull();
    fireEvent.click(screen.getByText('On message'));
    fireEvent.change(editor(), { target: { value: `await oh.publish('probe/ack', 'ok');` } });
    expect(onChange).toHaveBeenCalledWith('mqtt-on-message', `await oh.publish('probe/ack', 'ok');`);
  });

  it('an MQTT slot popover leads with the session lifecycle card, its line lit, the glossary beneath', async () => {
    render(<ScriptsTab scope="request" requestKind="mqtt" scripts={EMPTY} onScriptChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'About After close script' }));
    expect(await screen.findByText('Example session')).toBeTruthy();
    expect(cardLines()).toBe(4);
    expect(litTokens()).toEqual([
      'After close',
      'DISCONNECT',
      'end',
      'CONNACK',
      'published',
      'received',
      'dropped',
      'duration',
    ]);
    expect(screen.getByText('oh.close')).toBeTruthy();
  });

  it('an MQTT slot popover lists the hook glossary', async () => {
    render(<ScriptsTab scope="request" requestKind="mqtt" scripts={EMPTY} onScriptChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Before connect script' }));
    expect(await screen.findByText('oh.setClientId(id)')).toBeTruthy();
    expect(screen.getByText('oh.addSubscription(filter, options)')).toBeTruthy();
    expect(screen.getByText('oh.session')).toBeTruthy();
  });
});

describe('ScriptsTab snippets menu', () => {
  /** The open popover's group headers, in order. */
  const groupHeaders = (): string[] =>
    screen.getAllByTestId('oh-script-snippet-group').map((el) => el.textContent ?? '');

  it('follows the rail — the selected hook’s own group leads, the tail shared', async () => {
    render(<ScriptsTab scope="request" requestKind="websocket" scripts={EMPTY} onScriptChange={() => {}} />);
    fireEvent.click(screen.getByTestId('oh-script-snippets'));
    expect(await screen.findByRole('button', { name: 'Set the subprotocol offer' })).toBeTruthy();
    expect(groupHeaders()).toEqual(['Connect', 'Variables', 'Requests']);
    // A rail click is an outside click — the popover closes; reopen it
    // on the After close row and the list is that hook's.
    fireEvent.click(screen.getByText('After close'));
    fireEvent.click(screen.getByTestId('oh-script-snippets'));
    expect(await screen.findByRole('button', { name: 'Nothing was dropped' })).toBeTruthy();
    expect(groupHeaders()).toEqual(['Close', 'Tests', 'Variables', 'Requests']);
    expect(screen.queryByRole('button', { name: 'Set the subprotocol offer' })).toBeNull();
  });

  it('a container mount drops the request-only entries; a request mount keeps them', async () => {
    renderTab({ scope: 'container' });
    fireEvent.click(screen.getByTestId('oh-script-snippets'));
    expect(await screen.findByRole('button', { name: 'Set a header' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set the URL' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set a JSON body' })).toBeNull();
    cleanup();
    renderTab();
    fireEvent.click(screen.getByTestId('oh-script-snippets'));
    expect(await screen.findByRole('button', { name: 'Set the URL' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set a JSON body' })).toBeTruthy();
  });
});
