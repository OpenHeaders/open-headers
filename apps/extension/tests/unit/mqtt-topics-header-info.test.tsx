// @vitest-environment jsdom
/**
 * MQTT Topics table — the column headers' (i) cards (EditableGridTable's
 * `headerInfo` + `AuxColumn.info`): Topic / Options / QoS / Subscribe
 * each close with a hover-revealed trigger that lights their slice of
 * the shared example session's SUBSCRIBE leg; Description puts nothing
 * on the wire and stays bare.
 */

import type { MqttTopicRow } from '@openheaders/core/types';
import MqttTopicsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttTopicsTab';
// The filter cell's template input reads the rules-engine settings.
import '@openheaders/ui/workbench/settings/schema/rules-engine';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const rows: MqttTopicRow[] = [{ uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens', qos: 1 }];

function renderTab() {
  return render(
    <MqttTopicsTab
      rows={rows}
      onChange={() => {}}
      v5
      sessionOpen={false}
      liveSubs={new Map()}
      onLiveToggle={() => {}}
    />,
  );
}

/** The header cell whose words are `label`. */
function headerCell(container: HTMLElement, label: string): HTMLElement {
  const cells = Array.from(container.querySelectorAll<HTMLElement>('.editable-grid-header > span'));
  const cell = cells.find((c) => c.textContent?.replace(/i$/, '').trim() === label);
  if (!cell) throw new Error(`no header cell "${label}"`);
  return cell;
}

const trigger = (cell: HTMLElement): HTMLButtonElement | null => cell.querySelector('button.oh-info-trigger');

describe('mqtt topics — the header (i) cards', () => {
  it('Topic, Options, QoS and Subscribe close with a hover-revealed trigger; Description stays bare', () => {
    const { container } = renderTab();
    for (const label of ['Topic', 'Options', 'QoS', 'Subscribe']) {
      const cell = headerCell(container, label);
      const button = trigger(cell);
      expect(button, label).not.toBeNull();
      expect(button?.classList.contains('oh-info-trigger--hover'), label).toBe(true);
      expect(button?.classList.contains('oh-info-trigger--trailing'), label).toBe(true);
      expect(cell.classList.contains('oh-info-hover-host'), label).toBe(true);
      expect(button?.getAttribute('aria-label'), label).toBe(`About ${label}`);
    }
    const description = headerCell(container, 'Description');
    expect(trigger(description)).toBeNull();
    expect(description.classList.contains('oh-info-hover-host')).toBe(false);
  });

  it('the QoS card opens on click, lights the QoS token and lists the three levels under the Topics kicker', async () => {
    const { container } = renderTab();
    const button = trigger(headerCell(container, 'QoS'));
    if (!button) throw new Error('no QoS trigger');
    fireEvent.mouseEnter(button);
    expect(document.querySelector('.oh-info-popover')).toBeNull();
    fireEvent.click(button);
    await screen.findByText('Levels');
    expect(screen.getByText('Exactly once')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Topics');
    const lit = Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent);
    expect(lit).toEqual(['QoS 1']);
  });

  it('the Subscribe card lights the SUBSCRIBE opener itself', async () => {
    const { container } = renderTab();
    const button = trigger(headerCell(container, 'Subscribe'));
    if (!button) throw new Error('no Subscribe trigger');
    fireEvent.click(button);
    await waitFor(() => {
      const lit = Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent);
      expect(lit).toEqual(['SUBSCRIBE']);
    });
  });
});
