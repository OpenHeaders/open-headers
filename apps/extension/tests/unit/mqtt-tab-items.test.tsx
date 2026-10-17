// @vitest-environment jsdom
/**
 * MQTT request editor tab catalog (mqtt-tab-items.tsx) — the labels'
 * tones off the two unsaved readings: salmon unsaved over blue
 * has-content over nothing; the grid tabs' counts wearing the salmon,
 * a bare dot standing in at zero rows. Every label closes with the
 * tab's hover-revealed (i), its slot present whether or not a mark is.
 */

import type { MqttRequest } from '@openheaders/core/types';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { draftFromMqttRequest, type MqttDraft } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import {
  type MqttUnsavedSections,
  NO_UNSAVED_MQTT_SECTIONS,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-section-unsaved';
import type { MqttSettingsKnobKey } from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-settings-unsaved';
import {
  buildMqttTabItems,
  type MqttTabKey,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-tab-items';
import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The (i)'s popover observes its overlay once opened.
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

const mqttRequest = (overrides: Partial<MqttRequest> = {}): MqttRequest => ({
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtt://broker.openheaders.io:1883',
  topic: 'streetlights/1/lumens',
  payload: '',
  topics: [],
  savedMessages: [],
  userProperties: [],
  ...overrides,
});

const draftOf = (overrides: Partial<MqttDraft> = {}): MqttDraft => ({
  ...draftFromMqttRequest(mqttRequest()),
  ...overrides,
});

interface LabelInput {
  draft?: MqttDraft;
  unsaved?: Partial<MqttUnsavedSections>;
  unsavedSettings?: MqttSettingsKnobKey[];
  ownSettings?: boolean;
}

const ALL_TABS: readonly MqttTabKey[] = [
  'docs',
  'message',
  'topics',
  'auth',
  'properties',
  'lastwill',
  'scripts',
  'settings',
  'spec',
];

function labelNode(tab: MqttTabKey, input: LabelInput = {}): React.ReactNode {
  const items = buildMqttTabItems({
    draft: input.draft ?? draftOf(),
    t,
    unsaved: { ...NO_UNSAVED_MQTT_SECTIONS, ...input.unsaved },
    unsavedSettings: new Set(input.unsavedSettings ?? []),
    ownSettings: input.ownSettings ?? false,
  });
  return items.find((i) => i.key === tab)?.label;
}

/** Render one tab's label and return its container. */
function label(tab: MqttTabKey, input: LabelInput = {}): HTMLElement {
  const { container } = render(<div>{labelNode(tab, input)}</div>);
  return container;
}

const trigger = (container: HTMLElement): HTMLElement | null => container.querySelector('button.oh-info-trigger');

const has = (container: HTMLElement, testId: string): boolean =>
  container.querySelector(`[data-testid="${testId}"]`) !== null;
/** The label's words minus the (i) glyph's own letter. */
const text = (container: HTMLElement): string => {
  const copy = container.cloneNode(true) as HTMLElement;
  for (const glyph of copy.querySelectorAll('.oh-info-trigger')) glyph.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
};

describe('mqtt tab items — tones', () => {
  it('a clean request shows no dot on any label', () => {
    for (const tab of ['docs', 'message', 'topics', 'auth', 'properties', 'lastwill', 'scripts', 'settings'] as const) {
      const c = label(tab);
      expect(has(c, 'oh-section-unsaved')).toBe(false);
      expect(has(c, 'oh-section-content')).toBe(false);
      cleanup();
    }
  });

  it('every section dots salmon while its slice is unsaved', () => {
    const cases: Array<[MqttTabKey, Partial<MqttUnsavedSections>]> = [
      ['docs', { docs: true }],
      ['message', { message: true }],
      ['auth', { auth: true }],
      ['lastwill', { lastWill: true }],
      ['scripts', { scripts: { 'mqtt-on-message': true } }],
    ];
    for (const [tab, unsaved] of cases) {
      expect(has(label(tab, { unsaved }), 'oh-section-unsaved')).toBe(true);
      cleanup();
    }
  });

  it('Docs and Auth dot blue once the request owns content; salmon outranks', () => {
    expect(has(label('docs', { draft: draftOf({ description: 'Lamps.' }) }), 'oh-section-content')).toBe(true);
    cleanup();
    const basic = draftOf({ auth: { type: 'basic', username: 'john', password: 'doe' } });
    expect(has(label('auth', { draft: basic }), 'oh-section-content')).toBe(true);
    cleanup();
    // None is the default and Inherit the chain's value — neither is the request's own.
    expect(has(label('auth', { draft: draftOf({ auth: { type: 'inherit' } }) }), 'oh-section-content')).toBe(false);
    cleanup();
    const unsaved = label('auth', { draft: basic, unsaved: { auth: true } });
    expect(has(unsaved, 'oh-section-unsaved')).toBe(true);
    expect(has(unsaved, 'oh-section-content')).toBe(false);
  });

  it('Last Will dots once its block persists — a topic, or a payload typed before one', () => {
    const topic = draftOf();
    topic.lastWill.topic = 'status/offline';
    expect(has(label('lastwill', { draft: topic }), 'oh-section-content')).toBe(true);
    cleanup();
    const payload = draftOf();
    payload.lastWill.payload = 'offline';
    expect(has(label('lastwill', { draft: payload }), 'oh-section-content')).toBe(true);
  });

  it('Scripts dots blue while any slot has text, salmon while any slot is unsaved', () => {
    expect(
      has(
        label('scripts', { draft: draftOf({ scripts: { 'mqtt-before-connect': 'oh.log(1)' } }) }),
        'oh-section-content',
      ),
    ).toBe(true);
    cleanup();
    expect(
      has(label('scripts', { draft: draftOf({ scripts: { 'mqtt-before-connect': '   ' } }) }), 'oh-section-content'),
    ).toBe(false);
  });

  it('Settings dots salmon while any knob is unsaved, blue while the request owns a knob', () => {
    expect(has(label('settings', { ownSettings: true }), 'oh-section-content')).toBe(true);
    cleanup();
    const unsaved = label('settings', { ownSettings: true, unsavedSettings: ['keepAlive'] });
    expect(has(unsaved, 'oh-section-unsaved')).toBe(true);
    expect(has(unsaved, 'oh-section-content')).toBe(false);
  });
});

describe('mqtt tab items — grid counts', () => {
  it('Topics counts the filled rows and wears the salmon while unsaved; a bare dot stands in at zero rows', () => {
    const draft = draftOf({
      topics: [
        { uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens' },
        { uid: 'mqtp0002', topicFilter: 'streetlights/+/status' },
        { uid: 'mqtp0003', topicFilter: '' },
      ],
    });
    expect(text(label('topics', { draft }))).toBe('Topics 2');
    cleanup();
    const unsaved = label('topics', { draft, unsaved: { topics: true } });
    expect(unsaved.querySelector('[data-testid="oh-section-count-unsaved"]')?.textContent).toBe('2');
    cleanup();
    expect(has(label('topics', { unsaved: { topics: true } }), 'oh-section-unsaved')).toBe(true);
  });

  it('Properties counts the enabled keyed rows', () => {
    const draft = draftOf({
      userProperties: [
        makeKvRow({ key: 'x-tenant', value: 'openheaders', description: '', enabled: true }),
        makeKvRow({ key: 'x-off', value: '1', description: '', enabled: false }),
        makeKvRow({ key: '', value: '', description: '', enabled: true }),
      ],
    });
    expect(text(label('properties', { draft }))).toBe('Properties 1');
  });
});

describe('mqtt tab items — the (i) trigger', () => {
  it('every tab closes its label with the hover-revealed trigger, Spec included', () => {
    for (const tab of ALL_TABS) {
      const button = trigger(label(tab));
      expect(button, tab).not.toBeNull();
      expect(button?.classList.contains('oh-info-trigger--hover'), tab).toBe(true);
      expect(button?.classList.contains('oh-info-trigger--trailing'), tab).toBe(true);
      expect(button?.closest('.oh-info-hover-host'), tab).not.toBeNull();
      cleanup();
    }
  });

  it('the slot is present on an unmarked tab and sits after the mark on a marked one', () => {
    const bare = label('message');
    expect(has(bare, 'oh-section-content')).toBe(false);
    expect(bare.querySelector('.oh-info-hover-host')?.lastElementChild).toBe(trigger(bare));
    cleanup();
    const draft = draftOf({ topics: [{ uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens' }] });
    const marked = label('topics', { draft });
    const button = trigger(marked);
    expect(button?.previousElementSibling?.textContent).toBe('1');
    expect(marked.querySelector('.oh-info-hover-host')?.lastElementChild).toBe(button);
  });

  it('a click on the trigger opens the card and never reaches the tab', async () => {
    const onTabClick = vi.fn();
    const { container, findByText } = render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: the tab host stand-in
      // biome-ignore lint/a11y/noStaticElementInteractions: the tab host stand-in
      <div onClick={onTabClick}>{labelNode('topics')}</div>,
    );
    const button = trigger(container);
    expect(button).not.toBeNull();
    if (button) fireEvent.click(button);
    await findByText('SUBSCRIBE');
    expect(onTabClick).not.toHaveBeenCalled();
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onTabClick).toHaveBeenCalledTimes(1);
  });

  it('the trigger names its tab', () => {
    expect(trigger(label('lastwill'))?.getAttribute('aria-label')).toBe('About Last Will');
  });
});
