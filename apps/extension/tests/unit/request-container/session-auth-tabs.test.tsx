/**
 * Session auth tabs — WebSocket / gRPC / MQTT. Pins:
 *   - each select leads with Inherit ahead of the kind's own subset;
 *   - the Inherit empty state names what resolves and from where (the
 *     S8 attribution line), the generic parent note without ancestry,
 *     and the nothing-set note with a null source;
 *   - a resolved type outside the kind's mask renders the executor's
 *     refusal sentence in warning tone.
 */

import type { InheritedAuthAttribution } from '@openheaders/ui/workbench/components/request-editor/AuthorizationTab';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

// antd asks `matchMedia` at load in some responsive paths; jsdom ships none.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

import GrpcAuthTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcAuthTab';
import MqttAuthTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttAuthTab';
import WebSocketAuthTab from '@openheaders/ui/workbench/components/websocket-request-editor/WebSocketAuthTab';

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

afterEach(cleanup);

const BEARER_FROM_COLLECTION: InheritedAuthAttribution = {
  auth: { type: 'bearer', token: 't' },
  source: { kind: 'collection', name: 'Payments' },
};
const BASIC_FROM_FOLDER: InheritedAuthAttribution = {
  auth: { type: 'basic', username: 'u', password: 'p' },
  source: { kind: 'folder', name: 'Tokens' },
};
const OAUTH_FROM_FOLDER: InheritedAuthAttribution = {
  auth: {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abc12345',
    flow: 'authorization-code-pkce',
    tokenEndpoint: '',
    clientId: '',
    scopes: [],
  },
  source: { kind: 'folder', name: 'Tokens' },
};

describe('WebSocketAuthTab — Inherit', () => {
  it('names the resolved type and its level on the empty state, Inherit on the select', () => {
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={BEARER_FROM_COLLECTION}
          onChange={() => {}}
        />
      </App>,
    );
    expect(screen.getByTestId('ws-auth-inherit-state').textContent).toContain(
      'Bearer Token — from Collection ‘Payments’',
    );
    expect(screen.getByTestId('ws-auth-type').textContent).toContain('Inherit auth from parent');
    expect(screen.getByTestId('ws-auth-inherit-state').querySelector('.ant-typography-warning')).toBeNull();
  });

  it('renders the mask refusal in warning tone for an inherited OAuth 2.0', () => {
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={OAUTH_FROM_FOLDER}
          onChange={() => {}}
        />
      </App>,
    );
    const state = screen.getByTestId('ws-auth-inherit-state');
    expect(state.textContent).toContain(
      'OAuth 2.0 — from Folder ‘Tokens’ — cannot be applied to a WebSocket session.',
    );
    expect(state.querySelector('.ant-typography-warning')).not.toBeNull();
  });

  it('reads the generic parent note without ancestry and the nothing-set note with a null source', () => {
    const first = render(
      <App>
        <WebSocketAuthTab auth={{ type: 'inherit' }} socketioFlavor={false} onChange={() => {}} />
      </App>,
    );
    expect(screen.getByTestId('ws-auth-inherit-state').textContent).toContain('parent collection');
    first.unmount();
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={{ auth: { type: 'none' }, source: null }}
          onChange={() => {}}
        />
      </App>,
    );
    expect(screen.getByTestId('ws-auth-inherit-state').textContent).toContain('nothing is set');
  });
});

describe('GrpcAuthTab — Inherit', () => {
  it('an inherited Basic pair is inside the gRPC mask — the attribution line, no warning', () => {
    render(
      <App>
        <GrpcAuthTab auth={{ type: 'inherit' }} inheritedFrom={BASIC_FROM_FOLDER} onChange={() => {}} />
      </App>,
    );
    const state = screen.getByTestId('grpc-auth-inherit-state');
    expect(state.textContent).toContain('Basic Auth — from Folder ‘Tokens’');
    expect(state.querySelector('.ant-typography-warning')).toBeNull();
  });

  it('renders the gRPC refusal for an inherited OAuth 2.0', () => {
    render(
      <App>
        <GrpcAuthTab auth={{ type: 'inherit' }} inheritedFrom={OAUTH_FROM_FOLDER} onChange={() => {}} />
      </App>,
    );
    const state = screen.getByTestId('grpc-auth-inherit-state');
    expect(state.textContent).toContain('cannot be applied to a gRPC call.');
    expect(state.querySelector('.ant-typography-warning')).not.toBeNull();
  });
});

describe('MqttAuthTab — Inherit', () => {
  it('an inherited Bearer Token is outside the MQTT mask — the refusal in warning tone', () => {
    render(
      <App>
        <MqttAuthTab auth={{ type: 'inherit' }} inheritedFrom={BEARER_FROM_COLLECTION} onChange={() => {}} />
      </App>,
    );
    const state = screen.getByTestId('mqtt-auth-inherit-state');
    expect(state.textContent).toContain(
      'Bearer Token — from Collection ‘Payments’ — cannot be applied to an MQTT session.',
    );
    expect(state.querySelector('.ant-typography-warning')).not.toBeNull();
  });

  it('an inherited Basic pair reads as the attribution line', () => {
    render(
      <App>
        <MqttAuthTab auth={{ type: 'inherit' }} inheritedFrom={BASIC_FROM_FOLDER} onChange={() => {}} />
      </App>,
    );
    const state = screen.getByTestId('mqtt-auth-inherit-state');
    expect(state.textContent).toContain('Basic Auth — from Folder ‘Tokens’');
    expect(state.querySelector('.ant-typography-warning')).toBeNull();
  });
});
