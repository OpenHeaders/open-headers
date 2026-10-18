// @vitest-environment jsdom
/**
 * MQTT compose bars — the (i) cards on the Message bar's Retain / QoS /
 * topic knobs and the Last Will bar's Will delay / Retain / QoS / topic:
 * the compose-parts leaves carry the trigger beside their label (the
 * topic field on its example line), and each card lights its own token
 * — the PUBLISH line for the Message bar, the will line of the CONNECT
 * leg for the Last Will bar.
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import {
  CompactQosSelect,
  ComposeLabel,
  TopicField,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/compose-parts';
import { mqttSettingsRowInfo } from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsRowInfo';
// Side-effect import — the topic field is a TemplateInput, which reads
// workbench settings via useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
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

const t = getTranslator(DEFAULT_LOCALE);

const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

async function openCard(button: HTMLElement): Promise<void> {
  fireEvent.click(button);
  await waitFor(() => expect(document.querySelector('.oh-info-popover')).not.toBeNull());
}

describe('mqtt compose bars — the (i) cards', () => {
  it('the QoS knob carries its trigger beside the label; the card lists the levels and lights the PUBLISH QoS', async () => {
    render(<CompactQosSelect value={0} onChange={() => {}} info={mqttSettingsRowInfo(t, 'publishQos')} testId="q" />);
    const button = screen.getByRole('button', { name: 'About QoS' });
    expect(button.previousElementSibling?.textContent).toBe('QoS:');
    await openCard(button);
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Message');
    expect(screen.getByText('Levels')).toBeTruthy();
    expect(litTokens()).toEqual(['QoS 1']);
    expect(document.querySelector('.oh-info-eg-method.oh-info-eg-hl')).toBeNull();
  });

  it('a knob without info renders no trigger', () => {
    render(<CompactQosSelect value={0} onChange={() => {}} testId="q" />);
    expect(screen.queryByRole('button', { name: /^About/ })).toBeNull();
  });

  it('the topic field closes its example line with the trigger; the Message card lights the PUBLISH topic', async () => {
    render(
      <TopicField
        value=""
        onChange={() => {}}
        placeholder="Topic to publish to"
        example="e.g. sensors/1/temperature"
        info={mqttSettingsRowInfo(t, 'publishTopic')}
        testId="topic"
      />,
    );
    const button = screen.getByRole('button', { name: 'About Topic' });
    expect(button.previousElementSibling?.textContent).toBe('e.g. sensors/1/temperature');
    await openCard(button);
    expect(litTokens()).toEqual(['sensors/1/temp']);
  });

  it('the Last Will cards light the will line of the CONNECT leg', async () => {
    render(<ComposeLabel text="Will delay" info={mqttSettingsRowInfo(t, 'willDelay')} />);
    await openCard(screen.getByRole('button', { name: 'About Will delay' }));
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Last Will');
    expect(litTokens()).toEqual(['will delay: 10 s']);
    cleanup();
    render(<ComposeLabel text="Retain" info={mqttSettingsRowInfo(t, 'willRetain')} />);
    await openCard(screen.getByRole('button', { name: 'About Retain' }));
    expect(litTokens()).toEqual(['retain ✓']);
    expect(document.querySelector('.oh-info-eg-hl')?.closest('.oh-info-eg-line')?.textContent).toContain(
      'will: clients/reporter-1/status',
    );
  });

  it('the Message Retain card lights the PUBLISH retain, not the will’s', async () => {
    render(<InfoTrigger content={mqttSettingsRowInfo(t, 'publishRetain')} />);
    await openCard(screen.getByRole('button', { name: 'About Retain' }));
    const lit = document.querySelector('.oh-info-eg-hl');
    expect(lit?.textContent).toBe('retain ✓');
    expect(lit?.closest('.oh-info-eg-line')?.textContent).toContain('sensors/1/temp');
  });
});
