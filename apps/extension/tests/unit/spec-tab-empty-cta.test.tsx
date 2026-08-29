// @vitest-environment jsdom
/**
 * The Spec tabs with no spec of their format in the workspace: the
 * picker gives way to the fact plus one action — a jump to the
 * sidebar's SPECS section (posted through the specs-section-reveal
 * intent the shell subscribes to). Pins the CTA on HTTP (OpenAPI), WS
 * and MQTT (AsyncAPI), the post on click, and the picker's return the
 * moment a spec of the format exists.
 */

import type { Spec } from '@openheaders/core/types';
import MqttSpecTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSpecTab';
import type { MqttComposeAids } from '@openheaders/ui/workbench/components/mqtt-request-editor/useMqttComposeAids';
import { emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import SpecTab from '@openheaders/ui/workbench/components/request-editor/SpecTab';
import type { WsComposeAids } from '@openheaders/ui/workbench/components/websocket-request-editor/useWsComposeAids';
import WsSpecTab from '@openheaders/ui/workbench/components/websocket-request-editor/WsSpecTab';
import {
  postSpecsSectionReveal,
  subscribeSpecsSectionReveal,
} from '@openheaders/ui/workbench/data/specs-section-reveal';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockUseSpecs } = vi.hoisted(() => ({ mockUseSpecs: vi.fn<() => Spec[]>(() => []) }));

vi.mock('@openheaders/ui/shared/hooks/readers/useSpecs', () => ({
  useSpecs: () => mockUseSpecs(),
}));

afterEach(() => {
  cleanup();
  mockUseSpecs.mockReset();
  mockUseSpecs.mockReturnValue([]);
});

function makeSpec(format: Spec['format']): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/books-spc00001',
    name: 'Books API',
    format,
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.yaml', content: '' }],
  };
}

function aids(asyncapiSpecs: Spec[]): WsComposeAids & MqttComposeAids {
  return {
    asyncapiSpecs,
    linkedSpec: null,
    census: { census: null, parseError: null },
    exampleMessages: [],
    applyExampleMessage: () => undefined,
    browserTree: [],
    handleBrowserSelect: () => undefined,
  };
}

describe('specs-section reveal intent', () => {
  it('reaches every subscriber and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSpecsSectionReveal(listener);
    postSpecsSectionReveal();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    postSpecsSectionReveal();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('HTTP Spec tab with no OpenAPI spec in the workspace', () => {
  it('shows the fact and a Go to Specs action instead of the picker, and posts the reveal', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSpecsSectionReveal(listener);
    render(
      <SpecTab
        workspaceId="ws1"
        collection={undefined}
        requestName="Books"
        draft={emptyDraft()}
        setDraft={() => undefined}
      />,
    );
    expect(screen.getByTestId('request-spec-empty').textContent).toContain('No OpenAPI spec in this workspace yet.');
    expect(screen.queryByTestId('request-spec-select')).toBeNull();
    fireEvent.click(screen.getByTestId('request-spec-empty-go'));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('renders the picker once an OpenAPI spec exists (a protobuf spec does not count)', () => {
    mockUseSpecs.mockReturnValue([makeSpec('protobuf')]);
    const first = render(
      <SpecTab
        workspaceId="ws1"
        collection={undefined}
        requestName="Books"
        draft={emptyDraft()}
        setDraft={() => undefined}
      />,
    );
    expect(screen.getByTestId('request-spec-empty')).toBeTruthy();
    first.unmount();

    mockUseSpecs.mockReturnValue([makeSpec('openapi-3.1')]);
    render(
      <SpecTab
        workspaceId="ws1"
        collection={undefined}
        requestName="Books"
        draft={emptyDraft()}
        setDraft={() => undefined}
      />,
    );
    expect(screen.queryByTestId('request-spec-empty')).toBeNull();
    expect(screen.getByTestId('request-spec-select')).toBeTruthy();
  });
});

describe('WS and MQTT Spec tabs with no AsyncAPI spec in the workspace', () => {
  it('WS shows the AsyncAPI CTA and the picker once a spec exists', () => {
    const empty = render(<WsSpecTab aids={aids([])} onLinkSpec={() => undefined} />);
    expect(screen.getByTestId('websocket-spec-empty').textContent).toContain('No AsyncAPI spec in this workspace yet.');
    expect(screen.queryByTestId('websocket-spec-select')).toBeNull();
    empty.unmount();
    render(<WsSpecTab aids={aids([makeSpec('asyncapi')])} onLinkSpec={() => undefined} />);
    expect(screen.getByTestId('websocket-spec-select')).toBeTruthy();
  });

  it('MQTT shows the AsyncAPI CTA and posts the reveal on click', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSpecsSectionReveal(listener);
    render(<MqttSpecTab aids={aids([])} onLinkSpec={() => undefined} />);
    expect(screen.queryByTestId('mqtt-spec-select')).toBeNull();
    fireEvent.click(screen.getByTestId('mqtt-spec-empty-go'));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
