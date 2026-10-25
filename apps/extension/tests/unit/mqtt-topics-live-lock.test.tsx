// @vitest-environment jsdom
/**
 * MQTT Topics table — a row subscribed on the open session is a session
 * fact (the broker holds the filter it went up with), so its filter
 * cell reads DISABLED while the subscription is live; a row the session
 * does not hold stays editable, and a closed session locks nothing.
 */

import type { MqttTopicRow } from '@openheaders/core/types';
import MqttTopicsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttTopicsTab';
import type { LiveSubscriptionMark } from '@openheaders/ui/workbench/components/mqtt-request-editor/useMqttSessionPlane';
// The filter cell's template input reads the rules-engine settings.
import '@openheaders/ui/workbench/settings/schema/rules-engine';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

// The grid's column-resize hook observes its container.
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

const rows: MqttTopicRow[] = [
  { uid: 'mqtp0001', topicFilter: 'devices/{{vault.otp}}/#', qos: 1 },
  { uid: 'mqtp0002', topicFilter: 'alerts/#', subscribe: false },
];

function renderTab(sessionOpen: boolean, liveSubs: ReadonlyMap<string, LiveSubscriptionMark>) {
  return render(
    <MqttTopicsTab
      rows={rows}
      onChange={() => {}}
      v5
      sessionOpen={sessionOpen}
      liveSubs={liveSubs}
      onLiveToggle={() => {}}
    />,
  );
}

const filterCells = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-testid="mqtt-topic-filter-input"]'));

const disabledOf = (container: HTMLElement): (string | null)[] =>
  filterCells(container).map((cell) => cell.getAttribute('aria-disabled'));

describe('mqtt topics — the live-subscribed row locks its filter', () => {
  it('a closed session locks nothing', () => {
    const { container } = renderTab(false, new Map());
    expect(disabledOf(container)).toEqual([null, null, null]);
  });

  it('an open-time row the seed has not marked yet reads locked by the draft; the off row stays editable', () => {
    const { container } = renderTab(true, new Map());
    expect(disabledOf(container)).toEqual(['true', null, null]);
  });

  it('the live marks are the truth — a toggle off frees the filter, a toggle on locks it', () => {
    const marks = new Map<string, LiveSubscriptionMark>([
      ['mqtp0001', { subscribed: false, grantCode: null }],
      ['mqtp0002', { subscribed: true, grantCode: 0 }],
    ]);
    const { container } = renderTab(true, marks);
    expect(disabledOf(container)).toEqual([null, 'true', null]);
  });
});
