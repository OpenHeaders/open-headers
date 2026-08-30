/**
 * Session auth tabs — WebSocket / gRPC / MQTT. Pins:
 *   - each select leads with Inherit ahead of the kind's own subset;
 *   - the Inherit empty state names what resolves and from where (the
 *     S8 attribution line), the generic parent note without ancestry,
 *     and the nothing-set note with a null source;
 *   - a resolved type outside the kind's mask renders the executor's
 *     refusal sentence in warning tone;
 *   - with ancestry the select leads with the Inherited group — the
 *     default's label, every named ancestor entry, entries outside
 *     the kind's mask greyed with the refusal tooltip — and a named
 *     pick writes `{ type: 'inherit', authUid }`;
 *   - the empty state carries the dangling-pick warning, the dashed
 *     read-only preview (secrets masked), and the "Edit in …" opener.
 */

import type { Collection } from '@openheaders/core/types';
import type { RequestAncestry } from '@openheaders/ui/workbench/components/request-container/ancestry';
import type { InheritedAuthAttribution } from '@openheaders/ui/workbench/components/request-editor/inherited-auth';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
  source: { kind: 'collection', uid: 'col00001', name: 'Payments', entryName: '' },
};
const BASIC_FROM_FOLDER: InheritedAuthAttribution = {
  auth: { type: 'basic', username: 'john.doe', password: 'secret' },
  source: { kind: 'folder', uid: 'fld00001', name: 'Tokens', entryName: '' },
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
  source: { kind: 'folder', uid: 'fld00001', name: 'Tokens', entryName: '' },
};

function makeAncestry(): RequestAncestry {
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests/payments-col00001',
    name: 'Payments',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    auths: [
      { uid: 'admin001', name: 'Admin token', config: { type: 'bearer', token: '{{token}}' } },
      {
        uid: 'oauth001',
        name: 'SSO',
        config: {
          type: 'oauth2',
          credentialRef: 'oauth2-cred-abc12345',
          flow: 'authorization-code-pkce',
          tokenEndpoint: '',
          clientId: '',
          scopes: [],
        },
      },
    ],
    defaultAuthUid: 'admin001',
  };
  return { collection, folders: [] };
}

/** Open an antd select from the keyboard and return the rendered
 *  option elements (group headers are a different class and excluded). */
function openSelect(testId: string): HTMLElement[] {
  const select = screen.getByTestId(testId);
  const input = select.querySelector('input');
  if (!input) throw new Error('no select input');
  fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
  return Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
}

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

  it('with ancestry the select leads with the Inherited group; a masked entry is greyed with the refusal', () => {
    const onChange = vi.fn();
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          ancestry={makeAncestry()}
          onChange={onChange}
        />
      </App>,
    );
    // The collapsed select renders the Default option's label.
    expect(screen.getByTestId('ws-auth-type').textContent).toContain(
      'Default (Bearer Token — Collection ‘Payments’)',
    );
    const options = openSelect('ws-auth-type');
    const texts = options.map((o) => o.textContent ?? '');
    expect(texts[0]).toContain('Default (Bearer Token — Collection ‘Payments’)');
    expect(texts[1]).toContain('Collection ‘Payments’ › Admin token');
    expect(texts[2]).toContain('Collection ‘Payments’ › SSO');
    const sso = options[2];
    expect(sso.getAttribute('aria-disabled')).toBe('true');
    expect(sso.getAttribute('title')).toContain('cannot be applied to a WebSocket session');
    // Picking the named bearer entry writes the pick.
    fireEvent.click(options[1]);
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', authUid: 'admin001' });
  });

  it('the empty state carries the preview (secrets masked), the opener, and the dangling warning', () => {
    const onOpen = vi.fn();
    const first = render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={BASIC_FROM_FOLDER}
          onOpenContainerAuth={onOpen}
          onChange={() => {}}
        />
      </App>,
    );
    const preview = screen.getByTestId('oh-auth-inherited-preview');
    expect(preview.textContent).toContain('john.doe');
    expect(preview.textContent).not.toContain('secret');
    expect(preview.textContent).toContain('••••••••');
    fireEvent.click(screen.getByTestId('oh-auth-edit-in-source'));
    expect(onOpen).toHaveBeenCalledWith('folder', 'fld00001', 'Tokens');
    expect(screen.queryByTestId('oh-auth-dangling')).toBeNull();
    first.unmount();

    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit', authUid: 'gone0000' }}
          socketioFlavor={false}
          inheritedFrom={{ ...BEARER_FROM_COLLECTION, danglingAuthUid: 'gone0000' }}
          onChange={() => {}}
        />
      </App>,
    );
    expect(screen.getByTestId('oh-auth-dangling').textContent).toContain('no longer exists');
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

  it('with ancestry the Inherited group greys the masked entry with the gRPC refusal', () => {
    render(
      <App>
        <GrpcAuthTab auth={{ type: 'inherit' }} ancestry={makeAncestry()} onChange={() => {}} />
      </App>,
    );
    const options = openSelect('grpc-auth-type');
    const sso = options.find((o) => (o.textContent ?? '').includes('SSO'));
    expect(sso?.getAttribute('aria-disabled')).toBe('true');
    expect(sso?.getAttribute('title')).toContain('cannot be applied to a gRPC call');
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

  it('with ancestry even the bearer entry greys — MQTT carries Basic only', () => {
    render(
      <App>
        <MqttAuthTab auth={{ type: 'inherit' }} ancestry={makeAncestry()} onChange={() => {}} />
      </App>,
    );
    const options = openSelect('mqtt-auth-type');
    const admin = options.find((o) => (o.textContent ?? '').includes('Admin token'));
    expect(admin?.getAttribute('aria-disabled')).toBe('true');
    expect(admin?.getAttribute('title')).toContain('cannot be applied to an MQTT session');
  });
});
