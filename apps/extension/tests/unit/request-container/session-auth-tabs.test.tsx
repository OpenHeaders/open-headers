/**
 * Session auth tabs — WebSocket / gRPC / MQTT. Pins:
 *   - each select leads with Inherit ahead of the kind's own subset;
 *   - the Inherit pane heads with the resolved entry and the Inherited
 *     tag over the inert form, the generic parent note without
 *     ancestry, and the nothing-set note with a null source;
 *   - a resolved config the kind cannot carry — its type outside the
 *     mask, or a placement the kind has no leg for (a DPoP-bound OAuth
 *     entry, an AWS signature in header mode, a JWT in query mode on
 *     gRPC) — renders the executor's refusal sentence in warning tone,
 *     the placement named; the widened mask's types (OAuth 2.0, JWT,
 *     the query-placed key on WebSocket) read as the attribution line;
 *   - with ancestry the select leads with the Inherited group — every
 *     ancestor entry by name, the resolved default tagged, entries
 *     outside the kind's mask greyed with the refusal tooltip — over
 *     the own types;
 *   - the pane carries the dangling-pick warning, the inert form with
 *     the parent's values, and the "Edit in parent" opener;
 *   - the own offer IS the kind's mask (the request defines any type
 *     its kind can carry): a pick seeds through the shared form, the
 *     WebSocket SigV4 seeds in query mode, the placement selects offer
 *     only what the kind can ride (no Query on gRPC, no Header for the
 *     WebSocket signature, the DPoP binding parks), and a stored own
 *     config the kind refuses is named above its form.
 */

import type { Collection, OAuth2Auth } from '@openheaders/core/types';
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

// The Inherit pane renders the parent's fields through TemplateInput,
// which reads the settings registry — populated by importing the
// schema barrel for its side effects.
import '@openheaders/ui/workbench/settings/schema';
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
const OAUTH_OWN: OAuth2Auth = {
  type: 'oauth2',
  credentialRef: 'oauth2-cred-abc12345',
  flow: 'client-credentials',
  tokenEndpoint: 'https://idp.openheaders.io/token',
  clientId: 'client',
  scopes: [],
};
const DPOP_OAUTH_FROM_FOLDER: InheritedAuthAttribution = {
  auth: { ...OAUTH_FROM_FOLDER.auth, tokenBinding: 'dpop' } as InheritedAuthAttribution['auth'],
  source: OAUTH_FROM_FOLDER.source,
};
const AWS_HEADER_FROM_FOLDER: InheritedAuthAttribution = {
  auth: { type: 'aws-sigv4', accessKeyId: 'a', secretAccessKey: 's', service: '', region: '' },
  source: { kind: 'folder', uid: 'fld00001', name: 'Tokens', entryName: 'Gateway' },
};
const JWT_QUERY_FROM_FOLDER: InheritedAuthAttribution = {
  auth: { type: 'jwt', algorithm: 'HS256', secret: 's', privateKey: '', payload: '{}', addTo: 'query' },
  source: { kind: 'folder', uid: 'fld00001', name: 'Tokens', entryName: 'Signer' },
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
          tokenBinding: 'dpop',
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
    const state = screen.getByTestId('ws-auth-inherit-state');
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Bearer Token');
    expect(screen.getByTestId('oh-auth-inherited-tag').textContent).toBe('Inherited');
    expect(screen.getByTestId('oh-auth-inherited-form').hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('ws-auth-type').textContent).toContain('Inherit auth from parent');
    expect(state.querySelector('.ant-typography-warning')).toBeNull();
  });

  it('renders the refusal in warning tone with the placement named — a DPoP-bound OAuth 2.0, an AWS signature in header mode', () => {
    const dpop = render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={DPOP_OAUTH_FROM_FOLDER}
          onChange={() => {}}
        />
      </App>,
    );
    const state = screen.getByTestId('ws-auth-inherit-state');
    expect(state.textContent).toContain(
      'OAuth 2.0 bound to a DPoP key — from Folder ‘Tokens’ — cannot be applied to a WebSocket session.',
    );
    expect(state.querySelector('.ant-typography-warning')).not.toBeNull();
    dpop.unmount();
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={AWS_HEADER_FROM_FOLDER}
          onChange={() => {}}
        />
      </App>,
    );
    expect(screen.getByTestId('ws-auth-inherit-state').textContent).toContain(
      'AWS Signature v4 in header — from Folder ‘Tokens’ — cannot be applied to a WebSocket session.',
    );
  });

  it('an inherited OAuth 2.0 (bearer tokens) and a query-placed key are inside the widened mask — no warning', () => {
    const oauth = render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={OAUTH_FROM_FOLDER}
          onChange={() => {}}
        />
      </App>,
    );
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('OAuth 2.0');
    expect(screen.getByTestId('ws-auth-inherit-state').querySelector('.ant-typography-warning')).toBeNull();
    oauth.unmount();
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'inherit' }}
          socketioFlavor={false}
          inheritedFrom={{
            auth: { type: 'api-key', key: 'X-Api-Key', value: 'v', in: 'query' },
            source: { kind: 'folder', uid: 'fld00001', name: 'Tokens', entryName: 'Partner' },
          }}
          onChange={() => {}}
        />
      </App>,
    );
    expect(screen.getByTestId('ws-auth-inherit-state').querySelector('.ant-typography-warning')).toBeNull();
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
          auth={{ type: 'none' }}
          socketioFlavor={false}
          ancestry={makeAncestry()}
          onChange={onChange}
        />
      </App>,
    );
    const options = openSelect('ws-auth-type');
    const texts = options.map((o) => o.textContent ?? '');
    expect(texts[0]).toBe('Admin tokenDefault');
    expect(texts[1]).toBe('SSO');
    // Sectioned own offer — No Auth sits apart, last.
    expect(texts[texts.length - 1]).toBe('No Auth');
    const sso = options[1];
    expect(sso.getAttribute('aria-disabled')).toBe('true');
    expect(sso.getAttribute('title')).toContain('cannot be applied to a WebSocket session');
    // Picking the default entry follows the default.
    fireEvent.click(options[0]);
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit' });
  });

  it('the pane carries the inert form with the parent values, the opener, and the dangling warning', () => {
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
    const form = screen.getByTestId('oh-auth-inherited-form');
    expect(form.hasAttribute('inert')).toBe(true);
    expect(form.textContent).toContain('john.doe');
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Basic Auth');
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
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Basic Auth');
    expect(state.querySelector('.ant-typography-warning')).toBeNull();
  });

  it('renders the gRPC refusal for a DPoP-bound OAuth 2.0 and a JWT in query mode; plain OAuth 2.0 passes', () => {
    const dpop = render(
      <App>
        <GrpcAuthTab auth={{ type: 'inherit' }} inheritedFrom={DPOP_OAUTH_FROM_FOLDER} onChange={() => {}} />
      </App>,
    );
    const state = screen.getByTestId('grpc-auth-inherit-state');
    expect(state.textContent).toContain(
      'OAuth 2.0 bound to a DPoP key — from Folder ‘Tokens’ — cannot be applied to a gRPC call.',
    );
    expect(state.querySelector('.ant-typography-warning')).not.toBeNull();
    dpop.unmount();
    const jwt = render(
      <App>
        <GrpcAuthTab auth={{ type: 'inherit' }} inheritedFrom={JWT_QUERY_FROM_FOLDER} onChange={() => {}} />
      </App>,
    );
    expect(screen.getByTestId('grpc-auth-inherit-state').textContent).toContain(
      'JWT Bearer in query — from Folder ‘Tokens’ — cannot be applied to a gRPC call.',
    );
    jwt.unmount();
    render(
      <App>
        <GrpcAuthTab auth={{ type: 'inherit' }} inheritedFrom={OAUTH_FROM_FOLDER} onChange={() => {}} />
      </App>,
    );
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('OAuth 2.0');
    expect(screen.getByTestId('grpc-auth-inherit-state').querySelector('.ant-typography-warning')).toBeNull();
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
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Basic Auth');
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

describe('own types are the kind’s mask', () => {
  const ownTexts = (testId: string): string[] => openSelect(testId).map((o) => o.textContent ?? '');

  it('the WebSocket select offers every type the mask carries; a pick seeds through the shared form', () => {
    const onChange = vi.fn();
    render(
      <App>
        <WebSocketAuthTab auth={{ type: 'none' }} socketioFlavor={false} onChange={onChange} />
      </App>,
    );
    const options = openSelect('ws-auth-type');
    const texts = options.map((o) => o.textContent ?? '');
    expect(texts).toEqual([
      'Inherit auth from parent',
      'API Key',
      'Basic Auth',
      'Bearer Token',
      'JWT Bearer',
      'OAuth 2.0',
      'AWS Signature v4',
      'No Auth',
    ]);
    fireEvent.click(options[texts.indexOf('JWT Bearer')]);
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'jwt',
      algorithm: 'HS256',
      secret: '',
      privateKey: '',
      payload: '',
      addTo: 'header',
    });
  });

  it('the WebSocket SigV4 seeds in query mode — the signed URL is the only leg', () => {
    const onChange = vi.fn();
    render(
      <App>
        <WebSocketAuthTab auth={{ type: 'none' }} socketioFlavor={false} onChange={onChange} />
      </App>,
    );
    const options = openSelect('ws-auth-type');
    fireEvent.click(options[options.findIndex((o) => o.textContent === 'AWS Signature v4')]);
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'aws-sigv4',
      accessKeyId: '',
      secretAccessKey: '',
      service: '',
      region: '',
      addTo: 'query',
    });
  });

  it('the gRPC select offers the gRPC mask — no AWS signature; MQTT offers Basic alone', () => {
    const grpc = render(
      <App>
        <GrpcAuthTab auth={{ type: 'none' }} onChange={() => {}} />
      </App>,
    );
    expect(ownTexts('grpc-auth-type')).toEqual([
      'Inherit auth from parent',
      'API Key',
      'Basic Auth',
      'Bearer Token',
      'JWT Bearer',
      'OAuth 2.0',
      'No Auth',
    ]);
    grpc.unmount();
    render(
      <App>
        <MqttAuthTab auth={{ type: 'none' }} onChange={() => {}} />
      </App>,
    );
    expect(ownTexts('mqtt-auth-type')).toEqual(['Inherit auth from parent', 'Basic Auth', 'No Auth']);
  });

  it('an own api-key on gRPC offers Header alone; on WebSocket both placements', () => {
    const grpc = render(
      <App>
        <GrpcAuthTab auth={{ type: 'api-key', key: 'X-Api-Key', value: 'v', in: 'header' }} onChange={() => {}} />
      </App>,
    );
    expect(ownTexts('oh-auth-apikey-in')).toEqual(['Header']);
    expect(screen.queryByTestId('oh-auth-own-refusal')).toBeNull();
    grpc.unmount();
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'api-key', key: 'X-Api-Key', value: 'v', in: 'header' }}
          socketioFlavor={false}
          onChange={() => {}}
        />
      </App>,
    );
    expect(ownTexts('oh-auth-apikey-in')).toEqual(['Header', 'Query Params']);
  });

  it('an own JWT on gRPC offers Header alone; a stored query-mode JWT is named above its form', () => {
    const header = render(
      <App>
        <GrpcAuthTab
          auth={{ type: 'jwt', algorithm: 'HS256', secret: 's', privateKey: '', payload: '{}', addTo: 'header' }}
          onChange={() => {}}
        />
      </App>,
    );
    expect(ownTexts('oh-auth-jwt-add-to')).toEqual(['Header']);
    header.unmount();
    render(
      <App>
        <GrpcAuthTab
          auth={{ type: 'jwt', algorithm: 'HS256', secret: 's', privateKey: '', payload: '{}', addTo: 'query' }}
          onChange={() => {}}
        />
      </App>,
    );
    const refusal = screen.getByTestId('oh-auth-own-refusal');
    expect(refusal.textContent).toBe('JWT Bearer in query cannot be applied to a gRPC call.');
    expect(refusal.classList.contains('ant-typography-warning')).toBe(true);
  });

  it('an own WebSocket SigV4 offers the signed URL alone; a stored header-mode signature is named', () => {
    render(
      <App>
        <WebSocketAuthTab
          auth={{ type: 'aws-sigv4', accessKeyId: 'a', secretAccessKey: 's', service: '', region: '' }}
          socketioFlavor={false}
          onChange={() => {}}
        />
      </App>,
    );
    expect(ownTexts('oh-auth-aws-add-to')).toEqual(['Query Params']);
    expect(screen.getByTestId('oh-auth-own-refusal').textContent).toBe(
      'AWS Signature v4 in header cannot be applied to a WebSocket session.',
    );
  });

  it('an own OAuth 2.0 on gRPC has no URL send mode and a parked DPoP binding; the WebSocket keeps URL', () => {
    const grpc = render(
      <App>
        <GrpcAuthTab auth={OAUTH_OWN} onChange={() => {}} />
      </App>,
    );
    expect(ownTexts('oh-auth-oauth2-send-as')).toEqual(['Request Headers']);
    grpc.unmount();
    const binding = render(
      <App>
        <GrpcAuthTab auth={OAUTH_OWN} onChange={() => {}} />
      </App>,
    );
    const dpop = openSelect('oh-oauth2-token-binding').find((o) => o.textContent === 'DPoP');
    expect(dpop?.getAttribute('aria-disabled')).toBe('true');
    binding.unmount();
    render(
      <App>
        <WebSocketAuthTab auth={OAUTH_OWN} socketioFlavor={false} onChange={() => {}} />
      </App>,
    );
    expect(ownTexts('oh-auth-oauth2-send-as')).toEqual(['Request Headers', 'Request URL']);
  });

  it('an own MQTT Basic renders the shared form with the stored pair', () => {
    render(
      <App>
        <MqttAuthTab auth={{ type: 'basic', username: 'john.doe', password: 'secret' }} onChange={() => {}} />
      </App>,
    );
    expect(screen.getByTestId('oh-auth-basic-username').textContent).toBe('john.doe');
    expect(screen.getByTestId('oh-auth-basic-password')).toBeTruthy();
    expect(screen.queryByTestId('oh-auth-own-refusal')).toBeNull();
  });
});
