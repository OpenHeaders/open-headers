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
// The viewer's Find cluster reads the keyboard registry; its Viewer menu
// the editor.* knobs.
import '@openheaders/ui/workbench/settings/schema/editor';
import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/requests';
import { LOCAL_PEER_EXECUTE_DISABLED_MESSAGE, REMOTE_PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { reset as resetSetting, set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The notice's own contract (the tier copy, the reveal hand-off) is pinned
// elsewhere — here only the mount and the tier it was handed.
vi.mock('@openheaders/ui/workbench/components/shared/PeerExecuteDisabledNotice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/ui/workbench/components/shared/PeerExecuteDisabledNotice')>()),
  default: ({ kind }: { kind: string }) => <div data-testid="peer-execute-disabled-notice" data-kind={kind} />,
}));

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
  // The sort / group choices are GLOBAL settings — reset between tests.
  resetSetting('requests.mqttMessagesNewestFirst');
  resetSetting('requests.mqttMessagesGroupByTopic');
  resetSetting('requests.mqttMessagesGroupByDirection');
  resetSetting('requests.mqttMessagesGroupRowLimit');
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

describe('MqttMessageTimeline — the ended row follows the end', () => {
  const ended = (endedKind: 'clean' | 'broker' | 'severed'): MqttTimelineLifecycle => ({
    startedAt: STARTED_AT,
    connected: true,
    endedBy: 'close',
    endedKind,
    endedAt: STARTED_AT + 900,
  });
  const glyphOf = () => screen.getByTestId('mqtt-timeline-ended-row').querySelector('.anticon');

  it('a clean DISCONNECT keeps the check, the broker’s DISCONNECT and a severed socket take the disconnect mark', () => {
    const { unmount } = render(<MqttMessageTimeline items={[]} count={0} lifecycle={ended('clean')} v5 />);
    expect(glyphOf()?.classList.contains('anticon-check-circle')).toBe(true);
    unmount();
    const broker = render(<MqttMessageTimeline items={[]} count={0} lifecycle={ended('broker')} v5 />);
    expect(glyphOf()?.classList.contains('anticon-disconnect')).toBe(true);
    broker.unmount();
    render(<MqttMessageTimeline items={[]} count={0} lifecycle={ended('severed')} v5 />);
    expect(glyphOf()?.classList.contains('anticon-disconnect')).toBe(true);
    expect(screen.getByTestId('mqtt-timeline-ended-row').getAttribute('data-ended-kind')).toBe('severed');
  });
});

describe('MqttMessageTimeline — secret-bearing messages', () => {
  const lifecycle: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true };

  it('shows the placeholder for a stamped ↑ PUBLISH and the text for a plain one', () => {
    render(
      <MqttMessageTimeline
        items={[
          {
            kind: 'message',
            direction: 'up',
            topic: 'probe/a',
            payloadBase64: btoa('s3cret'),
            qos: 0,
            retain: false,
            dup: false,
            secret: true,
          },
          {
            kind: 'message',
            direction: 'up',
            topic: 'probe/b',
            payloadBase64: btoa('plain'),
            qos: 0,
            retain: false,
            dup: false,
          },
        ]}
        count={2}
        lifecycle={lifecycle}
        v5
      />,
    );
    expect(screen.getByText('<hidden: a secret manager value>')).toBeTruthy();
    expect(screen.queryByText('s3cret')).toBeNull();
    expect(screen.getByText('plain')).toBeTruthy();
  });

  it('names an empty payload as the (empty) placeholder; the zero byte count lives behind the details trigger', async () => {
    render(
      <MqttMessageTimeline
        items={[
          {
            kind: 'message',
            direction: 'down',
            topic: 'probe/echo',
            payloadBase64: '',
            qos: 0,
            retain: false,
            dup: false,
          },
        ]}
        count={1}
        lifecycle={lifecycle}
        v5
      />,
    );
    const row = screen.getByTestId('mqtt-timeline-message-row');
    const placeholder = within(row).getByText('(empty)');
    expect(placeholder.style.fontStyle).toBe('italic');
    expect(within(row).queryByTestId('mqtt-timeline-byte-count')).toBeNull();
    fireEvent.mouseEnter(within(row).getByTestId('mqtt-timeline-message-info'));
    expect((await screen.findByTestId('mqtt-timeline-message-size')).textContent).toBe('0 B');
  });
});

describe('MqttMessageTimeline — the message row’s hover cluster', () => {
  const lifecycle: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true };
  const message = (payload: string): MqttTimelineItem => ({
    kind: 'message',
    direction: 'down',
    topic: 'probe/echo',
    payloadBase64: btoa(payload),
    qos: 0,
    retain: false,
    dup: false,
  });

  it('copies the payload as the viewer shows it, turns the icon into a check, and never toggles the row', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<MqttMessageTimeline items={[message('{"a":1}')]} count={1} lifecycle={lifecycle} v5 />);
    const row = screen.getByTestId('mqtt-timeline-message-row');
    const copy = within(row).getByTestId('mqtt-timeline-copy-message');
    expect(copy.getAttribute('aria-label')).toBe('Copy message');
    expect(copy.querySelector('.anticon-copy')).toBeTruthy();
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
    expect(screen.queryByTestId('code-editor')).toBeNull();
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(await within(row).findByRole('img', { name: 'check' })).toBeTruthy();
    expect(copy.querySelector('.anticon-copy')).toBeNull();
  });

  it('the details trigger reads the size alone on hover — the time is the row’s column; no byte column', async () => {
    render(
      <MqttMessageTimeline
        items={[message('x'.repeat(2048))]}
        count={1}
        timestamps={[STARTED_AT + 1_500]}
        lifecycle={lifecycle}
        v5
      />,
    );
    const row = screen.getByTestId('mqtt-timeline-message-row');
    expect(row.textContent).not.toContain('2.0 KB');
    const info = within(row).getByTestId('mqtt-timeline-message-info');
    expect(info.getAttribute('aria-label')).toBe('Message details');
    fireEvent.mouseEnter(info);
    expect((await screen.findByTestId('mqtt-timeline-message-size')).textContent).toBe('2.0 KB');
    expect(screen.getByText('Size:')).toBeTruthy();
    expect(screen.queryByText('Time:')).toBeNull();
    expect(screen.getAllByText(formatMessageTime(STARTED_AT + 1_500))).toHaveLength(1);
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

  const editorValue = () =>
    (
      screen
        .getByTestId('mqtt-timeline-message-viewer')
        .querySelector('[data-testid="code-editor"]') as HTMLTextAreaElement
    ).value;
  const pick = async (label: string) => {
    fireEvent.click(screen.getByTestId('mqtt-timeline-viewer-picker'));
    fireEvent.click(await screen.findByRole('menuitem', { name: label }));
  };

  it('expands a row into the viewer with the body toolbar; Hex is a view on the picker', async () => {
    render(<MqttMessageTimeline items={[message('ping')]} count={1} lifecycle={CONNECTED} v5 />);
    fireEvent.click(screen.getByTestId('mqtt-timeline-message-row'));
    expect(editorValue()).toBe('ping');
    expect(screen.getByTestId('mqtt-timeline-viewer-picker-label').textContent).toBe('Text');
    // The compose bar's cluster on a read-only host — icon + name.
    const viewer = screen.getByTestId('mqtt-timeline-message-viewer');
    expect(within(viewer).getByTestId('code-editor-find').textContent).toBe('Find');
    expect(within(viewer).getByTestId('mqtt-timeline-viewer-menu').textContent).toBe('Viewer');
    expect(within(viewer).queryByTestId('mqtt-timeline-viewer-copy')).toBeNull();
    expect(screen.queryByTestId('mqtt-timeline-viewer-hex')).toBeNull();
    await pick('Hex');
    expect(screen.getByTestId('mqtt-timeline-hex').textContent).toMatch(/70 69 6e 67/i);
    expect(screen.queryByTestId('code-editor')).toBeNull();
    expect(screen.getByTestId('mqtt-timeline-viewer-picker-label').textContent).toBe('Hex');
    await pick('Text');
    expect(editorValue()).toBe('ping');
  });

  it('opens a JSON message pretty-printed; Raw is the wire text, a language pick returns to Pretty', async () => {
    render(<MqttMessageTimeline items={[message('{"temp":21,"unit":"C"}')]} count={1} lifecycle={CONNECTED} v5 />);
    fireEvent.click(screen.getByTestId('mqtt-timeline-message-row'));
    expect(editorValue()).toBe('{\n  "temp": 21,\n  "unit": "C"\n}');
    expect(screen.getByTestId('mqtt-timeline-viewer-picker-label').textContent).toBe('JSON');
    await pick('Raw');
    expect(editorValue()).toBe('{"temp":21,"unit":"C"}');
    expect(screen.getByTestId('mqtt-timeline-viewer-picker-label').textContent).toBe('Raw');
    await pick('Base64');
    expect(editorValue()).toBe(btoa('{"temp":21,"unit":"C"}'));
    await pick('JSON');
    expect(editorValue()).toBe('{\n  "temp": 21,\n  "unit": "C"\n}');
  });

  it('a plain-text message reads as it came under Pretty — Text has nothing to re-indent', () => {
    render(<MqttMessageTimeline items={[message('ping')]} count={1} lifecycle={CONNECTED} v5 />);
    fireEvent.click(screen.getByTestId('mqtt-timeline-message-row'));
    expect(screen.getByTestId('mqtt-timeline-viewer-picker-label').textContent).toBe('Text');
    expect(editorValue()).toBe('ping');
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

describe('MqttMessageTimeline — the delegated open refused by the place', () => {
  const refused = (errorMessage: string): MqttTimelineLifecycle => ({
    startedAt: STARTED_AT,
    connected: false,
    errorMessage,
    endedAt: STARTED_AT + 200,
  });

  it('mounts the host-aware refusal notice above the list for the opt-in refusal string alone', () => {
    const { unmount } = render(
      <MqttMessageTimeline items={[]} count={0} lifecycle={refused(LOCAL_PEER_EXECUTE_DISABLED_MESSAGE)} v5 />,
    );
    const notice = screen.getByTestId('peer-execute-disabled-notice');
    expect(notice.getAttribute('data-kind')).toBe('local');
    // The notice sits above the list, never inside a pinned row.
    expect(notice.closest('[data-testid="mqtt-timeline-error-row"]')).toBeNull();
    expect(screen.getByTestId('mqtt-timeline-error-row')).toBeTruthy();
    unmount();
    const remote = render(
      <MqttMessageTimeline items={[]} count={0} lifecycle={refused(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE)} v5 />,
    );
    expect(screen.getByTestId('peer-execute-disabled-notice').getAttribute('data-kind')).toBe('remote');
    remote.unmount();
    render(
      <MqttMessageTimeline items={[]} count={0} lifecycle={refused('Could not reach broker.openheaders.io')} v5 />,
    );
    expect(screen.queryByTestId('peer-execute-disabled-notice')).toBeNull();
  });
});

describe('MqttMessageTimeline — a classified failure with advice', () => {
  it('paints the fact on the error tint and the advice after it in the secondary tone, one searchable line', () => {
    render(
      <MqttMessageTimeline
        items={[]}
        count={0}
        lifecycle={{
          startedAt: STARTED_AT,
          connected: false,
          errorMessage: 'Connection refused by 127.0.0.1:3131.',
          errorAdvice: 'Is the MQTT broker running on that host/port?',
          endedAt: STARTED_AT + 3,
        }}
        v5
      />,
    );
    const detail = screen.getByTestId('mqtt-session-error-detail');
    expect(detail.textContent).toBe(
      'Connection refused by 127.0.0.1:3131. Is the MQTT broker running on that host/port?',
    );
    const advice = screen.getByTestId('mqtt-session-error-advice');
    expect(advice.textContent).toBe(' Is the MQTT broker running on that host/port?');
    expect(advice.style.color).not.toBe(detail.style.color);
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: 'broker running' } });
    expect(screen.getByTestId('mqtt-timeline-error-row')).toBeTruthy();
  });
});

describe('MqttMessageTimeline — the refused CONNACK', () => {
  // A 3.1.1-only broker answering a 5.0 CONNECT in its own form: two
  // bytes, return code 1, no properties — the executor names it from
  // the 3.1.1 table and the pane carries the packet beside the error.
  const refusedByBroker: MqttTimelineLifecycle = {
    startedAt: STARTED_AT,
    connected: false,
    connack: { reasonCode: 1, reasonName: 'Unacceptable protocol version', sessionPresent: false, remainingLength: 2 },
    errorMessage: 'The broker refused the connection: Unacceptable protocol version (code 1).',
    endedAt: STARTED_AT + 3,
  };

  it('expands the error row to the refused CONNACK facts, the block directly under it in both orders', () => {
    render(<MqttMessageTimeline items={[]} count={0} lifecycle={refusedByBroker} v5 />);
    const errorRow = screen.getByTestId('mqtt-timeline-error-row');
    expect(errorRow.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('mqtt-timeline-connack-details')).toBeNull();
    fireEvent.click(errorRow);
    expect(errorRow.getAttribute('aria-expanded')).toBe('true');
    const details = screen.getByTestId('mqtt-timeline-connack-details');
    expect(details.textContent).toContain('reasonCode: 1 (Unacceptable protocol version)');
    expect(details.textContent).toContain('length: 2');
    expect(details.textContent).toContain('sessionPresent: false');
    // Newest first (the default): the block follows its row, before
    // Connecting; flipped, the row keeps its block directly under it.
    const rowOrder = () =>
      Array.from(
        screen
          .getByTestId('mqtt-message-timeline')
          .querySelectorAll('[data-testid$="-row"], [data-testid="mqtt-timeline-connack-details"]'),
      ).map((el) => el.getAttribute('data-testid'));
    expect(rowOrder()).toEqual(['mqtt-timeline-error-row', 'mqtt-timeline-connack-details', 'mqtt-timeline-sent-row']);
    act(() => setSetting('requests.mqttMessagesNewestFirst', false));
    expect(rowOrder()).toEqual(['mqtt-timeline-sent-row', 'mqtt-timeline-error-row', 'mqtt-timeline-connack-details']);
    // No Connected row ever renders for a refusal — the session never opened.
    expect(screen.queryByTestId('mqtt-timeline-connected-row')).toBeNull();
    fireEvent.keyDown(screen.getByTestId('mqtt-timeline-error-row'), { key: 'Enter' });
    expect(screen.queryByTestId('mqtt-timeline-connack-details')).toBeNull();
  });

  it('keeps a failure without a CONNACK (the transport never answered) a plain row', () => {
    render(
      <MqttMessageTimeline
        items={[]}
        count={0}
        lifecycle={{
          startedAt: STARTED_AT,
          connected: false,
          errorMessage: 'Could not reach broker.openheaders.io',
          endedAt: STARTED_AT + 200,
        }}
        v5
      />,
    );
    const errorRow = screen.getByTestId('mqtt-timeline-error-row');
    expect(errorRow.getAttribute('aria-expanded')).toBeNull();
    fireEvent.click(errorRow);
    expect(screen.queryByTestId('mqtt-timeline-connack-details')).toBeNull();
  });
});

describe('MqttMessageTimeline — the control strip', () => {
  const lifecycle: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true };
  const message = (direction: 'up' | 'down', topic: string, text: string): MqttTimelineItem => ({
    kind: 'message',
    direction,
    topic,
    payloadBase64: btoa(text),
    qos: 0,
    retain: false,
    dup: false,
  });
  const items = [
    message('up', 'probe/a', 'one'),
    message('down', 'probe/b', 'two'),
    message('down', 'probe/c', 'three'),
  ];

  it('reads the direction in force on its trigger and filters the rows from the menu', () => {
    render(<MqttMessageTimeline items={items} count={3} lifecycle={lifecycle} v5 />);
    const trigger = screen.getByTestId('mqtt-timeline-direction-filter');
    expect(trigger.textContent).toBe('All messages');
    expect(screen.getAllByTestId('mqtt-timeline-message-row')).toHaveLength(3);
    expect(screen.getByTestId('mqtt-timeline-count').textContent).toBe('3 messages');
    fireEvent.click(trigger);
    // The menu is a single choice on the selection plane — the row in
    // force carries antd's selected class (the Editor menu's anatomy).
    const allRow = screen.getByText('All messages', { selector: '.ant-dropdown-menu-item *' });
    expect(allRow.closest('.ant-dropdown-menu-item')?.classList.contains('ant-dropdown-menu-item-selected')).toBe(true);
    expect(allRow.closest('.ant-dropdown-menu')?.classList.contains('oh-choice-menu')).toBe(true);
    fireEvent.click(screen.getByText('Sent', { selector: '.ant-dropdown-menu-item *' }));
    expect(trigger.textContent).toBe('Sent');
    expect(screen.getAllByTestId('mqtt-timeline-message-row')).toHaveLength(1);
    // The count beside the filters reads what the filters let through.
    expect(screen.getByTestId('mqtt-timeline-count').textContent).toBe('1 of 3 messages');
    expect(screen.getByText('one')).toBeTruthy();
  });

  it('Lifecycle only hides every message row and keeps the skeleton rows, without a no-match notice', () => {
    render(<MqttMessageTimeline items={items} count={3} lifecycle={lifecycle} v5 />);
    const trigger = screen.getByTestId('mqtt-timeline-direction-filter');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Lifecycle only', { selector: '.ant-dropdown-menu-item *' }));
    expect(trigger.textContent).toBe('Lifecycle only');
    expect(screen.queryAllByTestId('mqtt-timeline-message-row')).toHaveLength(0);
    expect(screen.getByTestId('mqtt-timeline-connected-row')).toBeTruthy();
    expect(screen.getByTestId('mqtt-timeline-sent-row')).toBeTruthy();
    expect(screen.getByTestId('mqtt-timeline-count').textContent).toBe('0 of 3 messages');
    expect(screen.queryByText(/no messages match/i)).toBeNull();
  });

  it('search is a lookup over every row — a lifecycle row hides unless its words carry the needle', () => {
    const connected: MqttTimelineLifecycle = {
      startedAt: STARTED_AT,
      connected: true,
      endedBy: 'close',
      endedMessage: 'the broker said goodbye',
    };
    const log: MqttTimelineItem[] = [
      { kind: 'subscribed', grants: [{ topicFilter: 'probe/echo/reply', reasonCode: 0 }] },
      ...items,
    ];
    render(<MqttMessageTimeline items={log} count={4} lifecycle={connected} v5 />);
    expect(screen.getByTestId('mqtt-timeline-subscribed-row')).toBeTruthy();
    // "broker" lives in the Connected row's words and the ended detail
    // — nowhere else: the other skeleton rows and every message hide.
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: 'broker' } });
    expect(screen.getByTestId('mqtt-timeline-connected-row')).toBeTruthy();
    expect(screen.getByTestId('mqtt-timeline-ended-row')).toBeTruthy();
    expect(screen.queryByTestId('mqtt-timeline-sent-row')).toBeNull();
    expect(screen.queryByTestId('mqtt-timeline-subscribed-row')).toBeNull();
    expect(screen.queryAllByTestId('mqtt-timeline-message-row')).toHaveLength(0);
    // Two rows matched — nothing says "no match".
    expect(screen.queryByText('No messages match the filter.')).toBeNull();
    // A needle no row carries — the notice, and nothing else.
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: 'zzz-no-such-words' } });
    expect(screen.queryByTestId('mqtt-timeline-connected-row')).toBeNull();
    expect(screen.getByText('No messages match the filter.')).toBeTruthy();
    // The subscribed row's topic filter is part of its words.
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: 'echo/reply' } });
    expect(screen.getByTestId('mqtt-timeline-subscribed-row')).toBeTruthy();
    expect(screen.queryByTestId('mqtt-timeline-connected-row')).toBeNull();
    // Cleared, the skeleton is whole again.
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: '' } });
    expect(screen.getByTestId('mqtt-timeline-sent-row')).toBeTruthy();
    expect(screen.getAllByTestId('mqtt-timeline-message-row')).toHaveLength(3);
  });

  it('search reads the words behind a chevron and the full message text, not the capped preview', () => {
    const connected: MqttTimelineLifecycle = {
      startedAt: STARTED_AT,
      connected: true,
      connack: { reasonCode: 0, reasonName: 'Connection Accepted', sessionPresent: false, remainingLength: 2 },
    };
    // A body whose only unique word sits past the 400-char preview cap.
    const longBody = `{"pad":"${'x'.repeat(450)}","needle":"deep-in-the-body"}`;
    const log: MqttTimelineItem[] = [...items, message('down', 'probe/long', longBody)];
    render(<MqttMessageTimeline items={log} count={4} lifecycle={connected} v5 />);
    // "accepted" lives in the Connected row's CONNACK block alone — the
    // row stays (collapsed, chevron intact); everything else hides.
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: 'accepted' } });
    expect(screen.getByTestId('mqtt-timeline-connected-row')).toBeTruthy();
    expect(screen.queryByTestId('mqtt-timeline-connack-details')).toBeNull();
    expect(screen.queryByTestId('mqtt-timeline-sent-row')).toBeNull();
    expect(screen.queryAllByTestId('mqtt-timeline-message-row')).toHaveLength(0);
    expect(screen.queryByText('No messages match the filter.')).toBeNull();
    // A word past the preview cap still finds its message.
    fireEvent.change(screen.getByTestId('mqtt-timeline-search'), { target: { value: 'deep-in-the-body' } });
    const rows = screen.getAllByTestId('mqtt-timeline-message-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('probe/long');
  });

  it('filters by several topics at once', () => {
    render(<MqttMessageTimeline items={items} count={3} lifecycle={lifecycle} v5 />);
    const select = screen.getByTestId('mqtt-timeline-topic-filter');
    // The root carries the test id; antd 6 opens on the root's mousedown.
    fireEvent.mouseDown(select);
    fireEvent.click(screen.getByTitle('probe/a'));
    fireEvent.click(screen.getByTitle('probe/c'));
    const texts = screen.getAllByTestId('mqtt-timeline-message-row').map((row) => row.textContent);
    expect(texts.some((text) => text?.includes('one'))).toBe(true);
    expect(texts.some((text) => text?.includes('three'))).toBe(true);
    expect(texts.some((text) => text?.includes('two'))).toBe(false);
  });

  it('labels the sort and clear triggers — Sort by stays a name whatever the order', () => {
    render(<MqttMessageTimeline items={items} count={3} lifecycle={lifecycle} v5 />);
    expect(screen.getByTestId('mqtt-timeline-sort').textContent).toBe('Sort by');
    expect(screen.getByTestId('mqtt-timeline-clear').textContent).toBe('Clear');
    act(() => setSetting('requests.mqttMessagesNewestFirst', false));
    expect(screen.getByTestId('mqtt-timeline-sort').textContent).toBe('Sort by');
  });
});

describe('MqttMessageTimeline — grouping', () => {
  const lifecycle: MqttTimelineLifecycle = { startedAt: STARTED_AT, connected: true };
  const message = (direction: 'up' | 'down', topic: string, text: string): MqttTimelineItem => ({
    kind: 'message',
    direction,
    topic,
    payloadBase64: btoa(text),
    qos: 0,
    retain: false,
    dup: false,
  });
  // A subscription lands mid-log between the messages.
  const log: MqttTimelineItem[] = [
    message('up', 'probe/a', 'one'),
    { kind: 'subscribed', grants: [{ topicFilter: 'probe/b', reasonCode: 0 }] },
    message('down', 'probe/b', 'two'),
    message('down', 'probe/a', 'three'),
  ];
  const ROW_KINDS = new Set([
    'sent-row',
    'connected-row',
    'subscribed-row',
    'group-header',
    'message-row',
    'ended-row',
  ]);
  /** The rows in DOM order — a message by its text, every other row by its kind. */
  const rowSequence = () =>
    [...document.querySelectorAll('[data-testid^="mqtt-timeline-"]')]
      .map((el) => ({ el, kind: (el.getAttribute('data-testid') ?? '').slice('mqtt-timeline-'.length) }))
      .filter(({ kind }) => ROW_KINDS.has(kind))
      .map(({ el, kind }) =>
        kind === 'message-row'
          ? ['one', 'two', 'three'].find((word) => el.textContent?.includes(word))
          : kind === 'group-header'
            ? `header:${el.querySelector('[data-testid="mqtt-timeline-group-badge"]')?.textContent ?? ''}`
            : kind,
      );

  it('clusters messages under topic headers in first-appearance order with real totals; the lifecycle facts join the edge', () => {
    setSetting('requests.mqttMessagesNewestFirst', false);
    render(<MqttMessageTimeline items={log} count={4} lifecycle={lifecycle} v5 />);
    // Ungrouped: one event log — the subscription sits where the log
    // recorded it.
    expect(rowSequence()).toEqual(['sent-row', 'connected-row', 'one', 'subscribed-row', 'two', 'three']);
    act(() => setSetting('requests.mqttMessagesGroupByTopic', true));
    const headers = screen.getAllByTestId('mqtt-timeline-group-header');
    expect(headers.map((h) => h.textContent)).toEqual(['probe/a2 messages', 'probe/b1 message']);
    // Grouped mode is clustering, not a timeline — the subscription
    // joins Connected at the chronological edge.
    expect(rowSequence()).toEqual([
      'sent-row',
      'connected-row',
      'subscribed-row',
      'header:probe/a',
      'one',
      'three',
      'header:probe/b',
      'two',
    ]);
    // Newest-first flips the reading: the clusters above the facts.
    act(() => setSetting('requests.mqttMessagesNewestFirst', true));
    expect(rowSequence()).toEqual([
      'header:probe/b',
      'two',
      'header:probe/a',
      'three',
      'one',
      'subscribed-row',
      'connected-row',
      'sent-row',
    ]);
  });

  it('both axes on is the compound (direction, topic) identity — one header level, badge plus chip', () => {
    setSetting('requests.mqttMessagesNewestFirst', false);
    setSetting('requests.mqttMessagesGroupByTopic', true);
    setSetting('requests.mqttMessagesGroupByDirection', true);
    render(<MqttMessageTimeline items={log} count={4} lifecycle={lifecycle} v5 />);
    const headers = screen.getAllByTestId('mqtt-timeline-group-header');
    expect(headers.map((h) => h.textContent)).toEqual(['probe/a1 message', 'probe/b1 message', 'probe/a1 message']);
    expect(headers[0].querySelector('.anticon-arrow-up')).toBeTruthy();
    expect(headers[2].querySelector('.anticon-arrow-down')).toBeTruthy();
    // The topic lens still gates the rows under grouping.
    fireEvent.mouseDown(screen.getByTestId('mqtt-timeline-topic-filter'));
    fireEvent.click(screen.getByTitle('probe/b'));
    expect(screen.getAllByTestId('mqtt-timeline-group-header').map((h) => h.textContent)).toEqual(['probe/b1 message']);
  });

  it('windows each group to the row limit with show-older at the older edge and the re-window action on the header; collapse hides the rows', () => {
    setSetting('requests.mqttMessagesNewestFirst', false);
    setSetting('requests.mqttMessagesGroupByTopic', true);
    setSetting('requests.mqttMessagesGroupRowLimit', 1);
    render(<MqttMessageTimeline items={log} count={4} lifecycle={lifecycle} v5 />);
    // Limit 1: probe/a shows only its newest row; the header keeps 2.
    expect(rowSequence()).toEqual([
      'sent-row',
      'connected-row',
      'subscribed-row',
      'header:probe/a',
      'three',
      'header:probe/b',
      'two',
    ]);
    const more = screen.getByTestId('mqtt-timeline-group-more');
    expect(more.textContent).toBe('Show 1 older');
    // Oldest-first: the toggle sits right under the header (each entry
    // rides its own last-row wrapper).
    expect(
      more.parentElement?.previousElementSibling?.querySelector('[data-testid="mqtt-timeline-group-header"]'),
    ).toBeTruthy();
    fireEvent.click(more);
    expect(screen.getAllByTestId('mqtt-timeline-message-row')).toHaveLength(3);
    const rewindow = screen.getByTestId('mqtt-timeline-group-rewindow');
    expect(rewindow.textContent).toBe('Show only the newest 1');
    fireEvent.click(rewindow);
    expect(screen.getAllByTestId('mqtt-timeline-message-row')).toHaveLength(2);
    expect(screen.queryByTestId('mqtt-timeline-group-rewindow')).toBeNull();
    // Collapse: the header stays with its total, the rows go.
    fireEvent.click(screen.getAllByTestId('mqtt-timeline-group-header')[0]);
    expect(screen.getAllByTestId('mqtt-timeline-group-header')[0].textContent).toBe('probe/a2 messages');
    expect(screen.getAllByTestId('mqtt-timeline-message-row')).toHaveLength(1);
    expect(screen.queryByTestId('mqtt-timeline-group-more')).toBeNull();
  });

  it('View is a labeled trigger between Sort by and Clear; the menu is the Editor menu anatomy with the group knobs', () => {
    render(<MqttMessageTimeline items={log} count={4} lifecycle={lifecycle} v5 />);
    const view = screen.getByTestId('mqtt-timeline-view');
    expect(view.textContent).toBe('View');
    expect(
      view.compareDocumentPosition(screen.getByTestId('mqtt-timeline-sort')) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(
      view.compareDocumentPosition(screen.getByTestId('mqtt-timeline-clear')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(view);
    const topicRow = screen.getByText('Group by topic', { selector: '.ant-dropdown-menu-item *' });
    expect(topicRow.closest('.ant-dropdown-menu')?.classList.contains('oh-view-menu')).toBe(true);
    expect(topicRow.closest('.ant-dropdown-menu-item')?.classList.contains('ant-dropdown-menu-item-selected')).toBe(
      false,
    );
    // Rows per group rests while neither axis is on.
    const limitRow = screen.getByText('Rows per group').closest('.ant-dropdown-menu-submenu');
    expect(limitRow?.classList.contains('ant-dropdown-menu-submenu-disabled')).toBe(true);
    fireEvent.click(topicRow);
    expect(
      screen
        .getByText('Group by topic', { selector: '.ant-dropdown-menu-item *' })
        .closest('.ant-dropdown-menu-item')
        ?.classList.contains('ant-dropdown-menu-item-selected'),
    ).toBe(true);
    expect(screen.getAllByTestId('mqtt-timeline-group-header')).toHaveLength(2);
    expect(
      screen
        .getByText('Rows per group')
        .closest('.ant-dropdown-menu-submenu')
        ?.classList.contains('ant-dropdown-menu-submenu-disabled'),
    ).toBe(false);
  });
});
