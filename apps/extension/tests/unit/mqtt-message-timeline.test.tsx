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
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { reset as resetSetting } from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

describe('MqttMessageTimeline — script marks', () => {
  const lifecycle: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true };
  const scriptMark = (over: Partial<Extract<MqttTimelineItem, { kind: 'script' }>> = {}): MqttTimelineItem => ({
    kind: 'script',
    hook: 'mqtt-before-connect',
    succeeded: true,
    durationMs: 3,
    chain: [
      { level: 'collection', uid: 'col1', name: 'Fleet', durationMs: 2, succeeded: true },
      { level: 'request', uid: 'req1', name: 'Probe', durationMs: 1, succeeded: true },
    ],
    ...over,
  });

  it('renders a hook run as a lifecycle row naming the hook and the levels, at its log position', () => {
    render(
      <MqttMessageTimeline
        items={[
          scriptMark(),
          { kind: 'subscribed', grants: [{ topicFilter: 'probe/#', reasonCode: 1 }] },
          scriptMark({ hook: 'mqtt-on-message' }),
        ]}
        count={3}
        timestamps={[STARTED_AT + 5, STARTED_AT + 6, STARTED_AT + 7]}
        lifecycle={lifecycle}
        v5
      />,
    );
    const rows = screen.getAllByTestId('mqtt-timeline-script-row');
    expect(rows).toHaveLength(2);
    // Newest first: the On message mark sits above the subscribed row,
    // the connect mark below it; each carries its positional stamp.
    expect(rows[0]?.textContent).toContain('On message — Collection ‘Fleet’ · Request · 3 ms');
    expect(rows[0]?.textContent).toContain(formatMessageTime(STARTED_AT + 7));
    expect(rows[1]?.textContent).toContain('Before connect — Collection ‘Fleet’ · Request · 3 ms');
    const sequence = [
      ...document.querySelectorAll(
        '[data-testid="mqtt-timeline-subscribed-row"], [data-testid="mqtt-timeline-script-row"]',
      ),
    ].map((el) => el.getAttribute('data-testid'));
    expect(sequence).toEqual(['mqtt-timeline-script-row', 'mqtt-timeline-subscribed-row', 'mqtt-timeline-script-row']);
  });

  it('a failed run reads the error, a drop names the level, a reconnect dial its attempt', () => {
    render(
      <MqttMessageTimeline
        items={[
          scriptMark({ succeeded: false, error: { name: 'Error', message: "Collection 'Fleet': boom" } }),
          scriptMark({ hook: 'mqtt-before-publish', droppedBy: "Folder 'Guard'" }),
          scriptMark({ attempt: 2 }),
        ]}
        count={3}
        lifecycle={lifecycle}
        v5
      />,
    );
    const rows = screen.getAllByTestId('mqtt-timeline-script-row').map((el) => el.textContent ?? '');
    expect(rows.some((r) => r.includes("Before connect failed — Collection 'Fleet': boom"))).toBe(true);
    expect(rows.some((r) => r.includes("Before publish dropped the message — Folder 'Guard'"))).toBe(true);
    expect(rows.some((r) => r.includes('attempt 2'))).toBe(true);
  });

  it("the row's hover (i) opens the MQTT lifecycle card with the mark's hook line lit", () => {
    render(
      <MqttMessageTimeline items={[scriptMark({ hook: 'mqtt-before-publish' })]} count={1} lifecycle={lifecycle} v5 />,
    );
    const row = screen.getByTestId('mqtt-timeline-script-row');
    expect(row.classList.contains('oh-info-hover-host')).toBe(true);
    const trigger = within(row).getByRole('button', { name: 'About Before publish script' });
    expect(trigger.classList.contains('oh-info-trigger--hover')).toBe(true);
    fireEvent.click(trigger);
    // The rail row's card verbatim — four hook lines, Before publish's lit.
    expect(document.querySelectorAll('.oh-info-eg-line')).toHaveLength(4);
    const lit = Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent);
    expect(lit).toEqual(['Before publish', 'PUBLISH ↑ sensors/1/temp', 'payload', 'QoS', 'retain', 'properties']);
    expect(screen.getByText('oh.setTopic(topic)')).toBeTruthy();
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

describe('MqttMessageTimeline — trust certificate gesture', () => {
  const failed: MqttTimelineLifecycle = {
    startedAt: STARTED_AT,
    connected: false,
    errorMessage: 'TLS certificate error reaching broker.openheaders.io (SELF_SIGNED_CERT_IN_CHAIN).',
    endedAt: STARTED_AT + 200,
  };

  it('shows Trust certificate on the error row only with a handler', () => {
    const { unmount } = render(<MqttMessageTimeline items={[]} count={0} lifecycle={failed} v5 />);
    expect(screen.queryByTestId('mqtt-timeline-trust-certificate')).toBeNull();
    unmount();
    const onTrustCertificate = vi.fn();
    render(
      <MqttMessageTimeline
        items={[]}
        count={0}
        lifecycle={failed}
        v5
        onTrustCertificate={onTrustCertificate}
        trustOfferOpen
      />,
    );
    const button = screen.getByTestId('mqtt-timeline-trust-certificate');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onTrustCertificate).toHaveBeenCalledTimes(1);
  });
});
