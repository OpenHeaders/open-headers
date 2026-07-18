// @vitest-environment jsdom
/**
 * TextPayload (ws/sse preview panes) — the Monaco-backed text branch.
 * Pins:
 *   - a non-JSON text payload renders through the panel CodeViewer
 *     (plaintext, read-only) — the viewer's own planes (JWT underline,
 *     whole-buffer Decode chip) carry the decode ladder, so a wholly-
 *     encoded or wholly-JWT frame needs no local wiring here;
 *   - a JSON payload defaults to the tree (no viewer mounted, no
 *     detection run); switching to Raw mounts the viewer JSON-colored;
 *   - the viewer is always read-only — frames are transient, there is
 *     never a write-back.
 *
 * The panel CodeViewer is mocked to a `<pre>` exposing its props — the
 * contract under test is the branch wiring, not Monaco.
 */

import { TextPayload } from '@openheaders/ui/panel/components/detail/streams/MessagePreview';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/panel/components/detail/CodeViewer', () => ({
  default: ({ value, language, readOnly }: { value: string; language: string; readOnly?: boolean }) => (
    <pre data-testid="monaco-viewer" data-language={language} data-readonly={String(readOnly ?? false)}>
      {value}
    </pre>
  ),
}));

afterEach(cleanup);

describe('TextPayload — Monaco text branch', () => {
  it('renders a non-JSON payload through the read-only plaintext viewer', async () => {
    render(
      <App>
        <TextPayload text={btoa('user@openheaders.io:hunter2!!')} />
      </App>,
    );
    const viewer = await screen.findByTestId('monaco-viewer');
    expect(viewer.textContent).toBe(btoa('user@openheaders.io:hunter2!!'));
    expect(viewer.getAttribute('data-language')).toBe('plaintext');
    expect(viewer.getAttribute('data-readonly')).toBe('true');
  });

  it('a JSON payload defaults to the tree — no viewer mounted', () => {
    render(
      <App>
        <TextPayload text='{"userId":123,"role":"admin"}' />
      </App>,
    );
    expect(screen.queryByTestId('monaco-viewer')).toBeNull();
    expect(document.querySelector('.dt-msg-preview-json')).not.toBeNull();
  });

  it('Raw mode mounts the viewer JSON-colored and read-only', async () => {
    render(
      <App>
        <TextPayload text='{"userId":123,"role":"admin"}' />
      </App>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
    const viewer = await screen.findByTestId('monaco-viewer');
    expect(viewer.getAttribute('data-language')).toBe('json');
    expect(viewer.getAttribute('data-readonly')).toBe('true');
    expect(viewer.textContent).toBe('{"userId":123,"role":"admin"}');
  });
});
