// @vitest-environment jsdom
/**
 * The MQTT editor's gear popovers — the Message bar's and the Last Will
 * bar's properties gear (one component, two legs) and the Topics row's
 * subscription gear. The gear anatomy: a title row naming the packet's
 * properties / options, the named knobs, a hairline, the user
 * properties LAST; every label the spec's word ("Settings" never
 * appears inside a gear); every section row wears the packet as a
 * mark; every card's kicker the raw packet; each card
 * lighting its own packet of the shared example session — PUBLISH for
 * a message, the will line of the CONNECT leg for the will, SUBSCRIBE
 * for a topic row. The bar gear is icon + word; the grid gear an icon
 * under its column header.
 */

import { emptyMessagePropertiesDraft } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MessagePropertiesPopover from '@openheaders/ui/workbench/components/mqtt-request-editor/MessagePropertiesPopover';
import TopicOptionsPopover from '@openheaders/ui/workbench/components/mqtt-request-editor/TopicOptionsPopover';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
});

const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

const litLine = (): string => document.querySelector('.oh-info-eg-hl')?.closest('.oh-info-eg-line')?.textContent ?? '';

const kicker = (): string => document.querySelector('.oh-info-popover-kicker')?.textContent ?? '';

/** The popover's strong labels, top to bottom — the title and the
 *  section headers. */
const headings = (popover: HTMLElement): string[] =>
  Array.from(popover.querySelectorAll('.ant-typography strong, strong.ant-typography')).map(
    (el) => el.textContent ?? '',
  );

/** The packet marks inside the popover — one per section row. */
const marks = (popover: HTMLElement): string[] =>
  within(popover)
    .queryAllByTestId('oh-option-label-mark')
    .map((el) => el.textContent ?? '');

async function openGear(testId: string, popoverTestId = `${testId}-popover`): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(screen.getByTestId(popoverTestId)).toBeTruthy());
  return screen.getByTestId(popoverTestId);
}

async function openCard(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(document.querySelector('.oh-info-popover')).not.toBeNull());
}

function renderMessageGear(leg: 'publish' | 'will', testId: string) {
  return render(
    <MessagePropertiesPopover value={emptyMessagePropertiesDraft()} onChange={() => {}} v5 leg={leg} testId={testId} />,
  );
}

describe('mqtt gear popovers — the anatomy', () => {
  it('the Message gear is icon + word on the bar; the popover is titled, the user properties last, no Settings', async () => {
    renderMessageGear('publish', 'mqtt-publish-props');
    expect(screen.getByTestId('mqtt-publish-props').textContent).toBe('Properties');
    const popover = await openGear('mqtt-publish-props');
    expect(headings(popover)).toEqual(['Message properties', 'User properties']);
    expect(marks(popover)).toEqual(['PUBLISH', 'PUBLISH']);
    expect(within(popover).queryByText('Settings')).toBeNull();
    const text = popover.textContent ?? '';
    expect(text.indexOf('Response Topic')).toBeLessThan(text.indexOf('User properties'));
    expect(within(popover).getByTestId('mqtt-publish-props-add-user-prop')).toBeTruthy();
  });

  it('the Last Will gear names the will', async () => {
    renderMessageGear('will', 'mqtt-will-props');
    expect(screen.getByTestId('mqtt-will-props').textContent).toBe('Properties');
    const popover = await openGear('mqtt-will-props');
    expect(headings(popover)).toEqual(['Will properties', 'User properties']);
    expect(marks(popover)).toEqual(['CONNECT', 'CONNECT']);
  });

  it('the Topics gear is icon + word; the popover splits options from properties the way SUBSCRIBE does', async () => {
    render(<TopicOptionsPopover row={{ uid: 'r1', topicFilter: 'sensors/+/temp' }} onChange={() => {}} v5 />);
    expect(screen.getByTestId('mqtt-topic-options').textContent).toBe('Subscription');
    const popover = await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    expect(headings(popover)).toEqual(['Subscription options', 'Subscription properties', 'User properties']);
    expect(marks(popover)).toEqual(['SUBSCRIBE', 'SUBSCRIBE', 'SUBSCRIBE']);
    expect(within(popover).queryByText('Settings')).toBeNull();
    const text = popover.textContent ?? '';
    expect(text.indexOf('Retain Handling')).toBeLessThan(text.indexOf('Subscription properties'));
    expect(text.indexOf('Subscription properties')).toBeLessThan(text.indexOf('Subscription Identifier'));
    expect(text.indexOf('Subscription Identifier')).toBeLessThan(text.indexOf('User properties'));
  });
});

describe('mqtt gear popovers — the row dots and the gear badge', () => {
  const badgeColor = (): string =>
    (document.querySelector('.ant-badge-dot') as HTMLElement | null)?.style.backgroundColor ?? '';
  const SALMON = 'rgb(255, 120, 117)';
  const rowDot = (popover: HTMLElement, label: string, kind: 'modified' | 'unsaved'): boolean =>
    within(popover)
      .getByText(label)
      .closest('[data-testid="oh-option-label"]')
      ?.querySelector(`[data-testid="oh-setting-${kind}-dot"]`) !== null;

  it('a knob off its default dots neutral on its row and on the gear; no baseline, no salmon', async () => {
    render(
      <MessagePropertiesPopover
        value={{ ...emptyMessagePropertiesDraft(), correlationData: 'ok' }}
        onChange={() => {}}
        v5
        leg="publish"
        testId="mqtt-publish-props"
      />,
    );
    expect(badgeColor()).not.toBe('');
    expect(badgeColor()).not.toBe(SALMON);
    const popover = await openGear('mqtt-publish-props');
    expect(rowDot(popover, 'Correlation Data', 'modified')).toBe(true);
    expect(rowDot(popover, 'Correlation Data', 'unsaved')).toBe(false);
    expect(rowDot(popover, 'Response Topic', 'modified')).toBe(false);
    expect(within(popover).queryAllByTestId('oh-setting-modified-dot')).toHaveLength(1);
  });

  it('a knob differing from the saved request dots salmon, winning over neutral, and recolors the gear', async () => {
    render(
      <MessagePropertiesPopover
        value={{
          ...emptyMessagePropertiesDraft(),
          correlationData: 'ok',
          contentType: 'text/plain',
          userProperties: [
            { uid: 'u1', key: 'trace', value: 'on' },
            { uid: 'u2', key: 'env', value: 'prod' },
            { uid: 'u3', key: '', value: '' },
          ],
        }}
        onChange={() => {}}
        v5
        leg="publish"
        unsaved={{ knobs: new Set(['contentType', 'userProperties']), rows: new Set(['u2']) }}
        testId="mqtt-publish-props"
      />,
    );
    expect(badgeColor()).toBe(SALMON);
    const popover = await openGear('mqtt-publish-props');
    expect(rowDot(popover, 'Correlation Data', 'modified')).toBe(true);
    expect(rowDot(popover, 'Content Type', 'unsaved')).toBe(true);
    expect(rowDot(popover, 'Content Type', 'modified')).toBe(false);
    expect(rowDot(popover, 'User properties', 'unsaved')).toBe(true);
    // The list rows: the saved one neutral, the changed one salmon, the
    // blank one bare.
    const listRows = within(popover)
      .getAllByPlaceholderText('Property')
      .map((input) => input.closest('div') as HTMLElement);
    expect(listRows.map((r) => r.querySelector('[data-testid="oh-setting-modified-dot"]') !== null)).toEqual([
      true,
      false,
      false,
    ]);
    expect(listRows.map((r) => r.querySelector('[data-testid="oh-setting-unsaved-dot"]') !== null)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('a knob off its default wears the Settings rows’ undo, which puts it back; a default knob none', async () => {
    const onChange = vi.fn();
    render(
      <MessagePropertiesPopover
        value={{ ...emptyMessagePropertiesDraft(), correlationData: 'ok', payloadFormatIndicator: true }}
        onChange={onChange}
        v5
        leg="publish"
        testId="mqtt-publish-props"
      />,
    );
    const popover = await openGear('mqtt-publish-props');
    expect(within(popover).queryByRole('button', { name: 'Reset Response Topic to default' })).toBeNull();
    fireEvent.click(within(popover).getByRole('button', { name: 'Reset Correlation Data to default' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ correlationData: '', payloadFormatIndicator: true }),
    );
    fireEvent.click(within(popover).getByRole('button', { name: 'Reset Payload Format Indicator to default' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ payloadFormatIndicator: false }));
    cleanup();
    const onRowChange = vi.fn();
    render(
      <TopicOptionsPopover
        row={{ uid: 'r1', topicFilter: 'sensors/+/temp', retainHandling: 2 }}
        onChange={onRowChange}
        v5
      />,
    );
    const options = await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    expect(within(options).queryByRole('button', { name: 'Reset No Local to default' })).toBeNull();
    fireEvent.click(within(options).getByRole('button', { name: 'Reset Retain Handling to default' }));
    expect(onRowChange).toHaveBeenLastCalledWith({
      uid: 'r1',
      topicFilter: 'sensors/+/temp',
      retainHandling: undefined,
    });
  });

  it('an unsaved user-property row alone recolors the gear', () => {
    render(
      <MessagePropertiesPopover
        value={{ ...emptyMessagePropertiesDraft(), userProperties: [{ uid: 'u1', key: 'trace', value: 'on' }] }}
        onChange={() => {}}
        v5
        leg="publish"
        unsaved={{ knobs: new Set(), rows: new Set(['u1']) }}
        testId="mqtt-publish-props"
      />,
    );
    expect(badgeColor()).toBe(SALMON);
  });

  it('an all-default gear wears no badge', () => {
    renderMessageGear('publish', 'mqtt-publish-props');
    expect(document.querySelector('.ant-badge-dot')).toBeNull();
  });

  it('the Topics gear dots its rows the same way', async () => {
    render(
      <TopicOptionsPopover
        row={{ uid: 'r1', topicFilter: 'sensors/+/temp', noLocal: true, subscriptionId: 7 }}
        onChange={() => {}}
        v5
        unsaved={{ knobs: new Set(['subscriptionId']), rows: new Set() }}
      />,
    );
    expect(badgeColor()).toBe(SALMON);
    const popover = await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    expect(rowDot(popover, 'No Local', 'modified')).toBe(true);
    expect(rowDot(popover, 'Subscription Identifier', 'unsaved')).toBe(true);
    expect(rowDot(popover, 'Retain Handling', 'modified')).toBe(false);
  });
});

describe('mqtt gear popovers — the 3.1.1 gate line', () => {
  it('on 3.1.1 the first line says why the controls are inert and offers the switch; on 5.0 there is none', async () => {
    const onSwitchToV5 = vi.fn();
    render(
      <MessagePropertiesPopover
        value={emptyMessagePropertiesDraft()}
        onChange={() => {}}
        v5={false}
        leg="publish"
        onSwitchToV5={onSwitchToV5}
        testId="mqtt-publish-props"
      />,
    );
    const popover = await openGear('mqtt-publish-props');
    const gate = within(popover).getByTestId('mqtt-publish-props-v5-gate');
    expect(popover.firstElementChild).toBe(gate);
    expect(gate.textContent).toContain('MQTT 5.0 feature');
    fireEvent.click(within(gate).getByRole('button', { name: 'Switch request to MQTT 5.0' }));
    expect(onSwitchToV5).toHaveBeenCalledTimes(1);
    expect((within(popover).getByTestId('mqtt-publish-props-response-topic') as HTMLInputElement).disabled).toBe(true);
    cleanup();
    renderMessageGear('publish', 'mqtt-publish-props');
    const open = await openGear('mqtt-publish-props');
    expect(within(open).queryByTestId('mqtt-publish-props-v5-gate')).toBeNull();
    cleanup();
    render(
      <TopicOptionsPopover
        row={{ uid: 'r1', topicFilter: 'sensors/+/temp' }}
        onChange={() => {}}
        v5={false}
        onSwitchToV5={onSwitchToV5}
      />,
    );
    const options = await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    expect(options.firstElementChild).toBe(within(options).getByTestId('mqtt-topic-options-v5-gate'));
  });
});

describe('mqtt gear popovers — the example card folds the packets the card does not light', () => {
  const lineCount = (): number => document.querySelectorAll('.oh-info-eg-line').length;
  const fold = (opener: string): HTMLElement =>
    document.querySelector(`.oh-info-eg-fold[aria-label="${opener}"]`) as HTMLElement;

  it('a PUBLISH knob’s card opens PUBLISH in full and folds CONNECT and SUBSCRIBE to their opener rows', async () => {
    renderMessageGear('publish', 'mqtt-publish-props');
    await openGear('mqtt-publish-props');
    await openCard('About Response Topic');
    // CONNECT (1 of 4), SUBSCRIBE (1 of 2), PUBLISH (2 of 2).
    expect(lineCount()).toBe(4);
    expect(fold('CONNECT').getAttribute('aria-expanded')).toBe('false');
    expect(fold('SUBSCRIBE').getAttribute('aria-expanded')).toBe('false');
    expect(fold('PUBLISH').getAttribute('aria-expanded')).toBe('true');
    expect(litTokens()).toEqual(['reply to: sensors/1/ack']);
    fireEvent.click(fold('CONNECT'));
    expect(lineCount()).toBe(7);
    expect(fold('CONNECT').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(fold('PUBLISH'));
    expect(lineCount()).toBe(6);
    expect(litTokens()).toEqual([]);
  });

  it('a will knob’s card opens CONNECT, whose will line it lights', async () => {
    renderMessageGear('will', 'mqtt-will-props');
    await openGear('mqtt-will-props');
    await openCard('About Content Type');
    expect(fold('CONNECT').getAttribute('aria-expanded')).toBe('true');
    expect(fold('PUBLISH').getAttribute('aria-expanded')).toBe('false');
    expect(lineCount()).toBe(6);
  });
});

describe('mqtt gear popovers — the cards light their own packet', () => {
  it('the Message gear’s cards carry PUBLISH; the title lights the whole slice, a row its token', async () => {
    renderMessageGear('publish', 'mqtt-publish-props');
    await openGear('mqtt-publish-props');
    await openCard('About Message properties');
    expect(kicker()).toBe('PUBLISH');
    expect(litTokens()).toEqual([
      'reply to: sensors/1/ack',
      'corr: 42',
      'expires: 60 s',
      'type: application/json',
      'utf-8 ✓',
      'props: trace=on',
    ]);
    expect(document.querySelector('.oh-info-popover-description')?.textContent).toContain('3.1.1');
    cleanup();
    renderMessageGear('publish', 'mqtt-publish-props');
    await openGear('mqtt-publish-props');
    await openCard('About Response Topic');
    expect(kicker()).toBe('PUBLISH');
    expect(litTokens()).toEqual(['reply to: sensors/1/ack']);
    expect(litLine()).toContain('application/json');
  });

  it('the Last Will gear’s cards carry CONNECT and light the will line, never PUBLISH', async () => {
    renderMessageGear('will', 'mqtt-will-props');
    await openGear('mqtt-will-props');
    await openCard('About Response Topic');
    expect(kicker()).toBe('CONNECT');
    expect(litTokens()).toEqual(['props ✓']);
    expect(litLine()).toContain('will: clients/reporter-1/status');
    expect(litLine()).not.toContain('sensors/1/temp');
  });

  it('the Topics gear’s cards carry SUBSCRIBE; options, properties and user properties light their own slice', async () => {
    render(<TopicOptionsPopover row={{ uid: 'r1', topicFilter: 'sensors/+/temp' }} onChange={() => {}} v5 />);
    await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    await openCard('About Subscription options');
    expect(kicker()).toBe('SUBSCRIBE');
    expect(litTokens()).toEqual(['no local ✓', 'retain as published ✓', 'retained: on subscribe']);
    cleanup();
    render(<TopicOptionsPopover row={{ uid: 'r1', topicFilter: 'sensors/+/temp' }} onChange={() => {}} v5 />);
    await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    await openCard('About Subscription properties');
    expect(kicker()).toBe('SUBSCRIBE');
    expect(litTokens()).toEqual(['sub id: 7']);
    cleanup();
    render(<TopicOptionsPopover row={{ uid: 'r1', topicFilter: 'sensors/+/temp' }} onChange={() => {}} v5 />);
    await openGear('mqtt-topic-options', 'mqtt-topic-options-popover');
    await openCard('About User properties');
    expect(kicker()).toBe('SUBSCRIBE');
    expect(litTokens()).toEqual(['props: trace=on']);
  });
});
