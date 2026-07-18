// @vitest-environment jsdom
/**
 * TextPayload (ws/sse preview panes) — the whole-buffer decode chip on
 * the plain-text branch. Pins:
 *   - a wholly-encoded text payload (base64) gets the corner Decode
 *     chip, and it opens the shared encoded-value modal read-only;
 *   - JSON payloads stay the tree's job — no chip, no detection run;
 *   - plain readable text gets no chip.
 *
 * The shared Monaco CodeEditor is mocked to a plain <textarea> — the
 * contract under test is the chip gating + readOnly wiring.
 */

import { TextPayload } from '@openheaders/ui/panel/components/detail/streams/MessagePreview';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, readOnly }: { value?: string; readOnly?: boolean }) => (
    <textarea data-testid="code-editor" value={value} readOnly={readOnly} onChange={() => undefined} />
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

describe('TextPayload decode chip', () => {
  it('offers the chip on a wholly-base64 payload and opens the read-only modal', async () => {
    render(
      <App>
        <TextPayload text={btoa('user@openheaders.io:hunter2!!')} />
      </App>,
    );
    const chip = screen.getByRole('button', { name: 'Decode' });
    expect(chip.getAttribute('title')).toContain('Base64 value');
    fireEvent.click(chip);

    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe('user@openheaders.io:hunter2!!');
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });

  it('offers no chip on a JSON payload — the tree owns it', () => {
    render(
      <App>
        <TextPayload text='{"userId":123,"role":"admin"}' />
      </App>,
    );
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });

  it('offers no chip on plain readable text', () => {
    render(
      <App>
        <TextPayload text="ping 42 from openheaders.io" />
      </App>,
    );
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });
});
