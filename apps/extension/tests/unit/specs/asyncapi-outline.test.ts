/**
 * AsyncAPI outline derivation — the structure pane's groups for an
 * asyncapi spec (WebSocket epic Phase A).
 *
 * Pins the contract: Servers / Channels / Operations / Components
 * groups derive from the census in vendor anatomy (channels nest their
 * messages, Components holds Schemas and Messages subgroups), server
 * rows carry a protocol chip, operation rows a send/receive action,
 * offsets point at the declarations, and a non-parsing buffer returns
 * null so the pane keeps the last good tree.
 */

import { buildAsyncApiOutline } from '@openheaders/ui/workbench/components/specs/asyncapi-outline';
import { ASYNCAPI_30_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import { describe, expect, it } from 'vitest';

describe('buildAsyncApiOutline', () => {
  it('derives the four groups from the scaffold in vendor anatomy order', () => {
    const groups = buildAsyncApiOutline(ASYNCAPI_30_SCAFFOLD);
    expect(groups).not.toBeNull();
    if (groups === null) return;
    expect(groups.map((g) => g.key)).toEqual(['servers', 'channels', 'operations', 'components']);
    expect(groups[0].children.map((n) => n.label)).toEqual(['production', 'development']);
    expect(groups[1].children.map((n) => n.label)).toEqual(['/ws/events', '/ws/control']);
    expect(groups[2].children.map((n) => n.label)).toEqual(['sendSubscribe', 'onEvent', 'sendPing']);
    expect(groups[3].children.map((n) => n.key)).toEqual(['components:schemas', 'components:messages']);
    expect(groups[3].children[0].children.map((n) => n.label)).toEqual(['Event']);
    expect(groups[3].children[1].children.map((n) => n.label)).toEqual(['Subscribe', 'Event']);
  });

  it('server rows carry protocol chips, operation rows their action', () => {
    const groups = buildAsyncApiOutline(ASYNCAPI_30_SCAFFOLD);
    if (groups === null) return;
    expect(groups[0].children.map((n) => [n.kind, n.protocol])).toEqual([
      ['server', 'wss'],
      ['server', 'ws'],
    ]);
    expect(groups[2].children.map((n) => [n.kind, n.action])).toEqual([
      ['operation', 'send'],
      ['operation', 'receive'],
      ['operation', 'send'],
    ]);
  });

  it('channels nest their messages under the channel row', () => {
    const groups = buildAsyncApiOutline(ASYNCAPI_30_SCAFFOLD);
    const events = groups?.[1].children[0];
    expect(events?.kind).toBe('channel');
    expect(events?.children.map((n) => [n.label, n.kind])).toEqual([
      ['subscribe', 'message'],
      ['event', 'message'],
    ]);
  });

  it('carries declaration offsets that point at each node', () => {
    const groups = buildAsyncApiOutline(ASYNCAPI_30_SCAFFOLD);
    if (groups === null) return;
    expect(groups[0].children[0].offset).toBe(ASYNCAPI_30_SCAFFOLD.indexOf('production:'));
    expect(groups[1].children[0].offset).toBe(ASYNCAPI_30_SCAFFOLD.indexOf('events:'));
    expect(groups[2].children[1].offset).toBe(ASYNCAPI_30_SCAFFOLD.indexOf('onEvent:'));
    expect(groups[3].children[0].children[0].offset).toBe(
      ASYNCAPI_30_SCAFFOLD.indexOf('Event:', ASYNCAPI_30_SCAFFOLD.indexOf('schemas:')),
    );
  });

  it('groups are present but empty when their sections are absent', () => {
    const groups = buildAsyncApiOutline('asyncapi: 3.0.0\ninfo:\n  title: Empty\n');
    expect(groups).not.toBeNull();
    if (groups === null) return;
    expect(groups.map((g) => g.children.length)).toEqual([0, 0, 0, 2]);
    expect(groups[3].children.map((n) => n.children.length)).toEqual([0, 0]);
    expect(groups[0].offset).toBeNull();
  });

  it('returns null when the buffer does not parse as AsyncAPI', () => {
    expect(buildAsyncApiOutline('asyncapi: [3.0.0\n')).toBeNull();
    expect(buildAsyncApiOutline('openapi: 3.1.0\n')).toBeNull();
  });
});
