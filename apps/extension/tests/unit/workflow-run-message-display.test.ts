import type { SessionMessage } from '@openheaders/core/live';
import {
  defaultRunMessageIndex,
  runMessageBody,
  runMessageEntries,
} from '@openheaders/ui/workbench/components/live/run-message-display';
import { describe, expect, it } from 'vitest';

function message(position: number, body: string, overrides: Partial<SessionMessage> = {}): SessionMessage {
  return {
    position,
    at: 1_000 + position,
    address: 'devices/dev-1/status',
    body,
    fields: [{ key: 'topic', value: 'devices/dev-1/status' }],
    stored: false,
    ...overrides,
  };
}

const ONLINE = message(4, '{"state":"online"}', { stored: true });
const UPDATING = message(6, '{"state":"updating"}');
const REBOOTING = message(7, '{"state":"rebooting","command":"reboot"}');

describe('the messages a session step opens to', () => {
  it('an expect’s are its whole window, each with what became of it', () => {
    const entries = runMessageEntries({
      kind: 'message',
      message: REBOOTING,
      window: [
        { message: ONLINE, outcome: 'stored' },
        { message: UPDATING, outcome: 'not-matched' },
        { message: REBOOTING, outcome: 'matched' },
      ],
    });

    expect(entries.map((entry) => [entry.message.position, entry.note])).toEqual([
      [4, 'stored'],
      [6, 'not-matched'],
      [7, 'matched'],
    ]);
    expect(defaultRunMessageIndex(entries)).toBe(2);
  });

  it('an expect that missed opens on the last message that arrived, and on none when nothing did', () => {
    const missed = runMessageEntries({
      kind: 'message',
      message: null,
      window: [
        { message: ONLINE, outcome: 'stored' },
        { message: UPDATING, outcome: 'not-matched' },
      ],
    });
    expect(defaultRunMessageIndex(missed)).toBe(1);

    const silent = runMessageEntries({ kind: 'message', message: null, window: [] });
    expect(silent).toEqual([]);
    expect(defaultRunMessageIndex(silent)).toBeNull();
  });

  it('a send’s are its message and the reply to it', () => {
    const sent = message(9, '{"name":"n-1"}', { address: 'devices/dev-1/name' });
    const reply = message(10, '{"ok":true}', { address: null });

    expect(runMessageEntries({ kind: 'message', message: sent }).map((entry) => entry.note)).toEqual(['sent']);
    expect(runMessageEntries({ kind: 'message', message: sent, reply }).map((entry) => entry.note)).toEqual([
      'sent',
      'reply',
    ]);
    expect(runMessageEntries({ kind: 'message', message: null })).toEqual([]);
  });
});

describe('a message’s body, as the viewer reads it', () => {
  it('JSON is read as JSON, with one line of it for the list', () => {
    const body = runMessageBody(message(1, '{\n  "state": "rebooting"\n}'));

    expect(body).toMatchObject({ format: 'json', binary: false, preview: '{ "state": "rebooting" }' });
    expect(new TextDecoder().decode(body.bytes())).toBe('{\n  "state": "rebooting"\n}');
  });

  it('text that only looks like JSON is text', () => {
    expect(runMessageBody(message(1, '{not json')).format).toBe('text');
    expect(runMessageBody(message(1, 'rebooting')).format).toBe('text');
  });

  it('bytes that are not text keep their bytes and show no preview', () => {
    const body = runMessageBody(message(1, '/wAB', { bodyEncoding: 'base64' }));

    expect(body).toMatchObject({ text: '/wAB', binary: true, preview: '' });
    expect([...body.bytes()]).toEqual([0xff, 0x00, 0x01]);
  });
});
