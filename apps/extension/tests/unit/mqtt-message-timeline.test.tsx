// @vitest-environment jsdom
/**
 * MqttMessageTimeline — the MQTT session's lifecycle-row times. Pins
 * the lifecycle-instants law: the aborted row carries the abort
 * instant, the "Disconnected from broker" row carries its OWN observed
 * teardown instant (the end frame's host stamp) and renders timeless —
 * never a fabricated time — when a host predates the stamp. The shared
 * Monaco CodeEditor is mocked to a <textarea> — the contract under
 * test is the row list, not Monaco.
 */

import MqttMessageTimeline from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttMessageTimeline';
import {
  formatMessageTime,
  type MqttTimelineItem,
  type MqttTimelineLifecycle,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-timeline-model';
// Registers the requests.* settings the timeline's toolbar reads/writes.
import '@openheaders/ui/workbench/settings/schema/requests';
import { reset as resetSetting } from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, readOnly }: { value?: string; readOnly?: boolean }) => (
    <textarea data-testid="code-editor" value={value} readOnly={readOnly} onChange={() => {}} />
  ),
}));

// antd's Segmented measures via rc-resize-observer — jsdom has none.
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

afterEach(() => {
  cleanup();
  // The sort choice is a GLOBAL setting — reset between tests.
  resetSetting('requests.mqttMessagesNewestFirst');
});

const STARTED_AT = 1_700_000_000_000;
const ABORT_AT = 1_700_000_000_700;
const TEARDOWN_AT = 1_700_000_000_745;

const ABORTED_LIFECYCLE: MqttTimelineLifecycle = {
  startedAt: STARTED_AT,
  connected: false,
  aborted: true,
  abortedDisconnected: true,
  endedAt: ABORT_AT,
};

function renderAborted(lifecycle: MqttTimelineLifecycle) {
  return render(<MqttMessageTimeline items={[]} count={0} lifecycle={lifecycle} v5 />);
}

describe('MqttMessageTimeline — aborted lifecycle instants', () => {
  it('times the aborted row and gives the teardown row its own observed instant', () => {
    renderAborted({ ...ABORTED_LIFECYCLE, abortedDisconnectedAt: TEARDOWN_AT });
    expect(screen.getByTestId('mqtt-timeline-aborted-row').textContent).toContain(formatMessageTime(ABORT_AT));
    const teardownRow = screen.getByTestId('mqtt-timeline-aborted-end-row');
    expect(teardownRow.textContent).toContain('Disconnected from broker');
    expect(teardownRow.textContent).toContain(formatMessageTime(TEARDOWN_AT));
  });

  it('renders the teardown row timeless when the host predates the lifecycle stamps', () => {
    renderAborted(ABORTED_LIFECYCLE);
    const teardownRow = screen.getByTestId('mqtt-timeline-aborted-end-row');
    expect(teardownRow.textContent).toBe('Disconnected from broker');
  });
});

describe('MqttMessageTimeline — reconnect attempt rows', () => {
  const lifecycle: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true };

  it('states the wait an attempt sat through, and reads "now" for an attempt the user asked for', () => {
    render(
      <MqttMessageTimeline
        items={[
          { kind: 'lost', end: null },
          { kind: 'reconnecting', attempt: 1, delayMs: 5_000 },
          { kind: 'reconnecting', attempt: 2, delayMs: 1_250, forced: true, error: 'Connection refused.' },
        ]}
        count={3}
        lifecycle={lifecycle}
        v5
      />,
    );
    const rows = screen.getAllByTestId('mqtt-timeline-reconnecting-row').map((row) => row.textContent);
    expect(rows.some((text) => text?.includes('Reconnect attempt 1 after 5 s'))).toBe(true);
    expect(rows.some((text) => text?.includes('Reconnect attempt 2 now — Connection refused.'))).toBe(true);
  });

  it('a reconnected row counts the unacknowledged messages a fresh session dropped', () => {
    render(
      <MqttMessageTimeline
        items={[
          { kind: 'lost', end: null },
          { kind: 'reconnected', attempt: 1, sessionPresent: true, reasonCode: 0, remainingLength: 2 },
          { kind: 'reconnected', attempt: 2, sessionPresent: false, reasonCode: 0, remainingLength: 2, dropped: 1 },
          { kind: 'reconnected', attempt: 3, sessionPresent: false, reasonCode: 0, remainingLength: 2, dropped: 3 },
        ]}
        count={4}
        lifecycle={lifecycle}
        v5
      />,
    );
    const rows = screen.getAllByTestId('mqtt-timeline-reconnected-row').map((row) => row.textContent);
    expect(rows).toHaveLength(3);
    expect(rows.filter((text) => text?.includes('dropped'))).toHaveLength(2);
    expect(rows.some((text) => text?.includes('Reconnected to broker — one unacknowledged message dropped'))).toBe(
      true,
    );
    expect(rows.some((text) => text?.includes('Reconnected to broker — 3 unacknowledged messages dropped'))).toBe(true);
  });
});

describe('MqttMessageTimeline — message viewer', () => {
  const message = (payload: string): MqttTimelineItem => ({
    kind: 'message',
    direction: 'down',
    topic: 'sensors/temp',
    payloadBase64: encodeBase64Bytes(new TextEncoder().encode(payload)),
    qos: 0,
    retain: false,
    dup: false,
  });
  const CONNECTED: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true, connectedAt: STARTED_AT + 40 };

  it('expands a row into the viewer with the toolbar and toggles the hexdump', () => {
    render(<MqttMessageTimeline items={[message('ping')]} count={1} lifecycle={CONNECTED} v5 />);
    fireEvent.click(screen.getByTestId('mqtt-timeline-message-row'));
    const viewer = screen.getByTestId('mqtt-timeline-message-viewer');
    expect((viewer.querySelector('[data-testid="code-editor"]') as HTMLTextAreaElement).value).toBe('ping');
    expect(screen.getByTestId('mqtt-timeline-viewer-format')).toBeTruthy();
    expect(screen.getByTestId('mqtt-timeline-viewer-wrap')).toBeTruthy();
    expect(screen.getByTestId('mqtt-timeline-viewer-find')).toBeTruthy();
    const toggle = screen.getByTestId('mqtt-timeline-viewer-hex');
    expect(toggle.textContent).toBe('Show Hexdump');
    fireEvent.click(toggle);
    expect(screen.getByTestId('mqtt-timeline-hex').textContent).toMatch(/70 69 6e 67/i);
    expect(screen.queryByTestId('code-editor')).toBeNull();
    fireEvent.click(screen.getByTestId('mqtt-timeline-viewer-hex'));
    expect(screen.getByTestId('code-editor')).toBeTruthy();
  });
});
