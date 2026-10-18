// @vitest-environment jsdom
/**
 * The MQTT editor's gear popovers — the Message bar's and the Last Will
 * bar's properties gear (one component, two legs) and the Topics row's
 * subscription gear: each card inside lights its own packet of the
 * shared example session — PUBLISH for a message, the will line of the
 * CONNECT leg for the will, SUBSCRIBE for a topic row.
 */

import { emptyMessagePropertiesDraft } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MessagePropertiesPopover from '@openheaders/ui/workbench/components/mqtt-request-editor/MessagePropertiesPopover';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

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

async function openGear(testId: string): Promise<void> {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(screen.getByTestId(`${testId}-popover`)).toBeTruthy());
}

async function openCard(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(document.querySelector('.oh-info-popover')).not.toBeNull());
}

describe('mqtt gear popovers — the cards light their own packet', () => {
  it('the Message gear’s row cards light the PUBLISH properties', async () => {
    render(
      <MessagePropertiesPopover
        value={emptyMessagePropertiesDraft()}
        onChange={() => {}}
        v5
        leg="publish"
        testId="mqtt-publish-props"
      />,
    );
    await openGear('mqtt-publish-props');
    await openCard('About Response Topic');
    expect(litTokens()).toEqual(['reply to: sensors/1/ack']);
    expect(litLine()).toContain('application/json');
  });

  it('the Last Will gear’s cards light the will line of the CONNECT leg, never PUBLISH', async () => {
    render(
      <MessagePropertiesPopover
        value={emptyMessagePropertiesDraft()}
        onChange={() => {}}
        v5
        leg="will"
        testId="mqtt-will-props"
      />,
    );
    await openGear('mqtt-will-props');
    await openCard('About Response Topic');
    expect(litTokens()).toEqual(['props ✓']);
    expect(litLine()).toContain('will: clients/reporter-1/status');
    expect(litLine()).not.toContain('sensors/1/temp');
  });
});
