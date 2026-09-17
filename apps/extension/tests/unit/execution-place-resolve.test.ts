/**
 * resolveExecutionPlace — the whole matrix of the Execution Place plan
 * pinned as TODAY'S truth (S1: no new wire; S2: the HTTP legs). Rows
 * marked "flips at Phase D/W" change their pin with that phase; the
 * pin is the record.
 */

import type { DesktopCompanionState } from '@openheaders/ui/shared/status';
import {
  type ExecutionPlaceMarkers,
  type ExecutionRequestKind,
  isSessionKind,
  mqttTransportOf,
  resolveExecutionPlace,
} from '@openheaders/ui/workbench/execution-place/resolve-execution-place';
import { describe, expect, it } from 'vitest';

const EXTENSION: ExecutionPlaceMarkers = {
  requestRuntime: 'browser',
  remoteRequestDispatch: null,
  grpcCompanionInvoke: true,
  wsPageSession: true,
  mqttPageSession: true,
  delegatedRequestDispatch: true,
  delegatedSessionDispatch: true,
};
/** The desktop renderer until its main process carries the leg toward a server. */
const DESKTOP: ExecutionPlaceMarkers = {
  requestRuntime: 'node',
  remoteRequestDispatch: null,
  grpcCompanionInvoke: false,
  wsPageSession: false,
  mqttPageSession: false,
  delegatedRequestDispatch: false,
  delegatedSessionDispatch: false,
};
const SERVER_UP = { workspaceServer: { name: 'Acme', connected: true } };
const SERVER_DOWN = { workspaceServer: { name: 'Acme', connected: false } };
/** The web tab since Phase W: its serving place, the HTTP send and the sessions delegated to it. */
const WEB: ExecutionPlaceMarkers = {
  ...DESKTOP,
  remoteRequestDispatch: 'Acme',
  delegatedRequestDispatch: true,
  delegatedSessionDispatch: true,
};
/** A browser surface without the workbench's page-realm sockets. */
const BARE_BROWSER: ExecutionPlaceMarkers = {
  ...EXTENSION,
  grpcCompanionInvoke: false,
  wsPageSession: false,
  mqttPageSession: false,
  delegatedRequestDispatch: false,
  delegatedSessionDispatch: false,
};

const KINDS: readonly ExecutionRequestKind[] = [
  'http',
  'graphql-query',
  'graphql-subscription',
  'grpc',
  'websocket',
  'mqtt',
];

function resolve(
  kind: ExecutionRequestKind,
  markers: ExecutionPlaceMarkers,
  desktopApp: DesktopCompanionState = 'not-connected',
  extra: Partial<Parameters<typeof resolveExecutionPlace>[0]> = {},
) {
  return resolveExecutionPlace({ kind, markers, desktopApp, desktopAppLaunchable: true, ...extra });
}

describe('resolveExecutionPlace — the desktop app (node runtime)', () => {
  it('runs every kind here, whatever the companion state', () => {
    for (const kind of KINDS) {
      for (const desktopApp of ['connected', 'not-installed'] as const) {
        expect(resolve(kind, DESKTOP, desktopApp, { mqttTransport: 'tcp' })).toEqual({
          place: 'here',
          placeName: null,
          state: 'ready',
          reason: { kind: 'runs-here' },
          cta: null,
          alternatives: [],
        });
      }
    }
  });
});

describe('resolveExecutionPlace — the web tab (remote dispatch)', () => {
  it('HTTP and GraphQL query run on the serving place as DELEGATED sends — the tab is the context (Phase W)', () => {
    for (const kind of ['http', 'graphql-query'] as const) {
      expect(resolve(kind, WEB)).toEqual({
        place: 'workspace-server',
        placeName: 'Acme',
        state: 'ready',
        reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
        cta: null,
        alternatives: [],
      });
    }
    // The tab's knobs the serving socket cannot honour ride the reason.
    expect(resolve('http', WEB, 'connected', { delegationKnobs: ['cookieJar'] }).reason).toEqual({
      kind: 'delegated',
      role: 'workspace-server',
      knobs: ['cookieJar'],
    });
  });

  it('a serving surface whose send does not honour a place keeps the context send, resolved there', () => {
    for (const kind of ['http', 'graphql-query'] as const) {
      expect(resolve(kind, { ...WEB, delegatedRequestDispatch: false })).toEqual({
        place: 'workspace-server',
        placeName: 'Acme',
        state: 'ready',
        reason: { kind: 'context-send', name: 'Acme' },
        cta: null,
        alternatives: [],
      });
    }
  });

  it('gRPC stays a context send (the web wire forwards executeGrpcRequest)', () => {
    expect(resolve('grpc', WEB).reason).toEqual({ kind: 'context-send', name: 'Acme' });
    expect(resolve('grpc', WEB).state).toBe('ready');
  });

  it('the three session kinds run on the serving place as DELEGATED sessions — the executor in the tab, the tcp dial included (Phase W)', () => {
    for (const kind of ['websocket', 'mqtt', 'graphql-subscription'] as const) {
      for (const mqttTransport of ['websocket', 'tcp'] as const) {
        expect(resolve(kind, WEB, 'connected', { mqttTransport })).toEqual({
          place: 'workspace-server',
          placeName: 'Acme',
          state: 'ready',
          reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
          cta: null,
          alternatives: [],
        });
      }
    }
  });

  it('a serving surface whose session Connect does not honour a place keeps the honest not-forwarded row', () => {
    for (const kind of ['websocket', 'mqtt', 'graphql-subscription'] as const) {
      expect(resolve(kind, { ...WEB, delegatedSessionDispatch: false }, 'connected', { mqttTransport: 'tcp' })).toEqual(
        {
          place: 'workspace-server',
          placeName: 'Acme',
          state: 'unsupported',
          reason: { kind: 'session-not-forwarded', name: 'Acme' },
          cta: null,
          alternatives: [],
        },
      );
    }
  });
});

describe('resolveExecutionPlace — the extension (browser runtime)', () => {
  it('HTTP and GraphQL query run here in the service worker', () => {
    for (const kind of ['http', 'graphql-query'] as const) {
      expect(resolve(kind, EXTENSION)).toEqual({
        place: 'here',
        placeName: null,
        state: 'ready',
        reason: { kind: 'runs-here-browser' },
        cta: null,
        alternatives: [],
      });
    }
  });

  it('WebSocket, GraphQL subscription and MQTT over ws(s) run here in the page realm, naming the knobs they cannot apply', () => {
    expect(resolve('websocket', EXTENSION, 'not-installed', { inapplicableKnobs: ['headers', 'auth'] })).toEqual({
      place: 'here',
      placeName: null,
      state: 'ready',
      reason: { kind: 'runs-here-page-realm', knobs: ['headers', 'auth'] },
      cta: null,
      alternatives: [],
    });
    expect(resolve('graphql-subscription', EXTENSION).reason).toEqual({ kind: 'runs-here-page-realm', knobs: [] });
    for (const mqttTransport of ['websocket', 'unknown'] as const) {
      expect(
        resolve('mqtt', EXTENSION, 'not-installed', { mqttTransport, inapplicableKnobs: ['sslVerify'] }).reason,
      ).toEqual({
        kind: 'runs-here-page-realm',
        knobs: ['sslVerify'],
      });
    }
  });

  it('gRPC runs on the connected desktop app', () => {
    expect(resolve('grpc', EXTENSION, 'connected')).toEqual({
      place: 'desktop-app',
      placeName: null,
      state: 'ready',
      reason: { kind: 'companion-invoke' },
      cta: null,
      alternatives: [],
    });
  });

  it('gRPC without a connected desktop app needs the companion, with the ladder rung for its state', () => {
    const base = {
      place: 'desktop-app',
      placeName: null,
      state: 'needs-companion',
      reason: { kind: 'companion-required' },
      alternatives: [],
    };
    expect(resolve('grpc', EXTENSION, 'not-connected')).toEqual({ ...base, cta: 'launch-desktop-app' });
    expect(resolve('grpc', EXTENSION, 'not-connected', { desktopAppLaunchable: false })).toEqual({
      ...base,
      cta: null,
    });
    expect(resolve('grpc', EXTENSION, 'installed-not-connected')).toEqual({ ...base, cta: 'connect-desktop-app' });
    expect(resolve('grpc', EXTENSION, 'not-installed')).toEqual({ ...base, cta: 'download-desktop-app' });
    for (const desktopApp of ['connecting', 'off', 'unknown'] as const) {
      expect(resolve('grpc', EXTENSION, desktopApp)).toEqual({ ...base, cta: null });
    }
  });

  it("an mqtt(s):// session with the desktop app connected runs DELEGATED there — the reporter's case (Phase D)", () => {
    expect(resolve('mqtt', EXTENSION, 'connected', { mqttTransport: 'tcp' })).toEqual({
      place: 'desktop-app',
      placeName: null,
      state: 'ready',
      reason: { kind: 'delegated', role: 'desktop-app', knobs: [] },
      cta: null,
      alternatives: [],
    });
    expect(resolve('mqtt', EXTENSION, 'not-connected', { ...SERVER_UP, mqttTransport: 'tcp' })).toEqual({
      place: 'workspace-server',
      placeName: 'Acme',
      state: 'ready',
      reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
      cta: null,
      alternatives: [],
      serverName: 'Acme',
    });
    expect(resolve('mqtt', EXTENSION, 'connected', { ...SERVER_UP, mqttTransport: 'tcp' }).alternatives).toEqual([
      'workspace-server',
    ]);
  });

  it('an mqtt(s):// session with no eligible place needs the desktop app, with the ladder rung for its state', () => {
    const base = {
      place: 'desktop-app',
      placeName: null,
      state: 'needs-companion',
      reason: { kind: 'tcp-scheme' },
      alternatives: [],
    };
    expect(resolve('mqtt', EXTENSION, 'not-connected', { mqttTransport: 'tcp' })).toEqual({
      ...base,
      cta: 'launch-desktop-app',
    });
    expect(resolve('mqtt', EXTENSION, 'installed-not-connected', { mqttTransport: 'tcp' })).toEqual({
      ...base,
      cta: 'connect-desktop-app',
    });
    expect(resolve('mqtt', EXTENSION, 'not-installed', { mqttTransport: 'tcp' })).toEqual({
      ...base,
      cta: 'download-desktop-app',
    });
  });

  it('the tcp scheme never rides the knobs — the session does not run here at all', () => {
    expect(
      resolve('mqtt', EXTENSION, 'not-connected', { mqttTransport: 'tcp', inapplicableKnobs: ['sslVerify'] }).reason,
    ).toEqual({
      kind: 'tcp-scheme',
    });
    // Delegated, the place applies every knob — none is named.
    expect(
      resolve('mqtt', EXTENSION, 'connected', { mqttTransport: 'tcp', inapplicableKnobs: ['sslVerify'] }).reason,
    ).toEqual({ kind: 'delegated', role: 'desktop-app', knobs: [] });
  });
});

describe('resolveExecutionPlace — a browser surface without the page-realm sockets or the companion seam', () => {
  it('sessions and gRPC are unsupported, needing the desktop app, with no ladder', () => {
    for (const kind of ['websocket', 'graphql-subscription', 'mqtt', 'grpc'] as const) {
      expect(resolve(kind, BARE_BROWSER, 'connected', { mqttTransport: 'websocket' })).toEqual({
        place: 'desktop-app',
        placeName: null,
        state: 'unsupported',
        reason: { kind: 'no-runtime' },
        cta: null,
        alternatives: [],
      });
    }
  });

  it('HTTP and GraphQL query still run here', () => {
    expect(resolve('http', BARE_BROWSER).state).toBe('ready');
    expect(resolve('graphql-query', BARE_BROWSER).place).toBe('here');
  });
});

describe('resolveExecutionPlace — the delegated legs (Phase C)', () => {
  it('HTTP and GraphQL query on the extension offer the connected desktop app and the connected workspace server', () => {
    for (const kind of ['http', 'graphql-query'] as const) {
      expect(resolve(kind, EXTENSION, 'connected', SERVER_UP)).toEqual({
        place: 'here',
        placeName: null,
        state: 'ready',
        reason: { kind: 'runs-here-browser' },
        cta: null,
        alternatives: ['desktop-app', 'workspace-server'],
        serverName: 'Acme',
      });
    }
    expect(resolve('http', EXTENSION, 'connected').alternatives).toEqual(['desktop-app']);
    expect(resolve('http', EXTENSION, 'not-connected', SERVER_UP).alternatives).toEqual(['workspace-server']);
    expect(resolve('http', EXTENSION, 'not-connected', SERVER_DOWN).alternatives).toEqual([]);
  });

  it('a surface whose send does not honour a place never offers a leg it could not honour', () => {
    expect(resolve('http', DESKTOP, 'connected', SERVER_UP).alternatives).toEqual([]);
    expect(resolve('http', BARE_BROWSER, 'connected', SERVER_UP).alternatives).toEqual([]);
  });

  it('a node surface that honours a place offers the server alone — it IS the desktop app', () => {
    expect(resolve('http', { ...DESKTOP, delegatedRequestDispatch: true }, 'connected', SERVER_UP)).toEqual({
      place: 'here',
      placeName: null,
      state: 'ready',
      reason: { kind: 'runs-here' },
      cta: null,
      alternatives: ['workspace-server'],
      serverName: 'Acme',
    });
  });

  it('the ws(s) session kinds offer the same legs as HTTP; gRPC offers none', () => {
    for (const kind of ['websocket', 'graphql-subscription', 'mqtt'] as const) {
      const resolved = resolve(kind, EXTENSION, 'connected', { ...SERVER_UP, mqttTransport: 'websocket' });
      expect(resolved.place).toBe('here');
      expect(resolved.alternatives).toEqual(['desktop-app', 'workspace-server']);
    }
    expect(resolve('grpc', EXTENSION, 'connected', SERVER_UP).alternatives).toEqual([]);
  });

  it('a surface whose session Connect does not honour a place offers no session leg even when its HTTP send does', () => {
    const markers = { ...EXTENSION, delegatedSessionDispatch: false };
    expect(resolve('websocket', markers, 'connected', SERVER_UP).alternatives).toEqual([]);
    expect(resolve('mqtt', markers, 'connected', { mqttTransport: 'tcp' }).state).toBe('needs-companion');
    expect(resolve('http', markers, 'connected', SERVER_UP).alternatives).toEqual(['desktop-app', 'workspace-server']);
  });

  it('a delegated session picked back to here runs in the page realm with the knobs named', () => {
    const resolved = resolve('websocket', EXTENSION, 'connected', {
      inapplicableKnobs: ['headers'],
      preference: 'desktop-app',
    });
    expect(resolved).toMatchObject({ place: 'desktop-app', state: 'ready', reason: { kind: 'delegated' } });
    expect(
      resolve('websocket', EXTENSION, 'connected', { inapplicableKnobs: ['headers'], preference: 'here' }),
    ).toEqual({
      place: 'here',
      placeName: null,
      state: 'ready',
      reason: { kind: 'runs-here-page-realm', knobs: ['headers'] },
      cta: null,
      alternatives: ['desktop-app'],
    });
  });

  it('the web tab keeps its one server — a context send names no alternatives', () => {
    expect(resolve('http', { ...WEB, delegatedRequestDispatch: true }, 'connected', SERVER_UP).alternatives).toEqual(
      [],
    );
  });
});

describe('resolveExecutionPlace — the preference', () => {
  it('Auto and a preference naming the auto place resolve identically', () => {
    expect(resolve('http', EXTENSION, 'connected', { preference: 'auto' })).toEqual(
      resolve('http', EXTENSION, 'connected'),
    );
    expect(resolve('http', EXTENSION, 'connected', { preference: 'here' })).toEqual(
      resolve('http', EXTENSION, 'connected'),
    );
    expect(resolve('grpc', EXTENSION, 'connected', { preference: 'desktop-app' })).toEqual(
      resolve('grpc', EXTENSION, 'connected'),
    );
  });

  it('a preference naming an eligible leg resolves to it as a delegated send, the other places beside it', () => {
    expect(resolve('http', EXTENSION, 'connected', { ...SERVER_UP, preference: 'desktop-app' })).toEqual({
      place: 'desktop-app',
      placeName: null,
      state: 'ready',
      reason: { kind: 'delegated', role: 'desktop-app', knobs: [] },
      cta: null,
      alternatives: ['here', 'workspace-server'],
      serverName: 'Acme',
    });
    expect(
      resolve('graphql-query', EXTENSION, 'not-connected', { ...SERVER_UP, preference: 'workspace-server' }),
    ).toEqual({
      place: 'workspace-server',
      placeName: 'Acme',
      state: 'ready',
      reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
      cta: null,
      alternatives: ['here'],
      serverName: 'Acme',
    });
  });

  it('a preference naming a role no leg can honour is unsupported, never silently overridden, the possible places still on offer', () => {
    expect(resolve('http', EXTENSION, 'not-installed', { ...SERVER_UP, preference: 'desktop-app' })).toEqual({
      place: 'desktop-app',
      placeName: null,
      state: 'unsupported',
      reason: { kind: 'preference-unavailable', preferred: 'desktop-app' },
      cta: 'download-desktop-app',
      alternatives: ['here', 'workspace-server'],
      serverName: 'Acme',
    });
    expect(resolve('http', EXTENSION, 'connected', { ...SERVER_DOWN, preference: 'workspace-server' })).toEqual({
      place: 'workspace-server',
      placeName: null,
      state: 'unsupported',
      reason: { kind: 'preference-unavailable', preferred: 'workspace-server' },
      cta: null,
      alternatives: ['here', 'desktop-app'],
      serverName: 'Acme',
    });
    expect(resolve('http', DESKTOP, 'connected', { preference: 'workspace-server' }).reason).toEqual({
      kind: 'preference-unavailable',
      preferred: 'workspace-server',
    });
  });
});

describe('mqttTransportOf / isSessionKind', () => {
  it('classifies the dial scheme case-insensitively, trimming; anything else is unknown', () => {
    expect(mqttTransportOf('mqtt://broker.openheaders.io')).toBe('tcp');
    expect(mqttTransportOf('  MQTTS://broker.openheaders.io:8883 ')).toBe('tcp');
    expect(mqttTransportOf('ws://broker.openheaders.io/mqtt')).toBe('websocket');
    expect(mqttTransportOf('wss://broker.openheaders.io')).toBe('websocket');
    expect(mqttTransportOf('')).toBe('unknown');
    expect(mqttTransportOf('broker.openheaders.io')).toBe('unknown');
    expect(mqttTransportOf('{{brokerUrl}}')).toBe('unknown');
  });

  it('names the three session kinds', () => {
    expect(KINDS.filter(isSessionKind)).toEqual(['graphql-subscription', 'websocket', 'mqtt']);
  });
});

describe('resolveExecutionPlace — the knobs a delegated socket cannot honour (Phase E)', () => {
  it('a delegated send names the knobs handed in; a send that runs here never carries them', () => {
    const delegation = { delegationKnobs: ['cookieJar'] as const };
    expect(resolve('http', EXTENSION, 'connected', { ...delegation, preference: 'desktop-app' }).reason).toEqual({
      kind: 'delegated',
      role: 'desktop-app',
      knobs: ['cookieJar'],
    });
    expect(
      resolve('http', EXTENSION, 'not-connected', { ...SERVER_UP, ...delegation, preference: 'workspace-server' })
        .reason,
    ).toEqual({ kind: 'delegated', role: 'workspace-server', knobs: ['cookieJar'] });
    expect(resolve('http', EXTENSION, 'connected', delegation).reason).toEqual({ kind: 'runs-here-browser' });
    expect(resolve('http', EXTENSION, 'connected', { ...delegation, preference: 'here' }).reason).toEqual({
      kind: 'runs-here-browser',
    });
  });
});
