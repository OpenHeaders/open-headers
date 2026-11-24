import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_FRAME_BYTES, fitsFrame, SyncWelcomeMessageSchema, utf8ByteLength } from '../../src/protocol';

describe('utf8ByteLength', () => {
  it.each([
    ['', 0],
    ['abc', 3],
    ['é', 2],
    ['€', 3],
    ['日本語', 9],
    ['😀', 4],
    ['a😀é€', 1 + 4 + 2 + 3],
  ])('counts %j as %i bytes', (text, bytes) => {
    expect(utf8ByteLength(text)).toBe(bytes);
    expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).length);
  });
});

describe('fitsFrame', () => {
  it('admits text a third of the limit long without counting it', () => {
    expect(fitsFrame('x'.repeat(100), 300)).toBe(true);
  });

  it('refuses text with more code units than the limit has bytes', () => {
    expect(fitsFrame('x'.repeat(301), 300)).toBe(false);
  });

  it('counts the bytes of text in between', () => {
    // 200 ASCII units are 200 bytes; 200 three-byte units are 600.
    expect(fitsFrame('x'.repeat(200), 300)).toBe(true);
    expect(fitsFrame('€'.repeat(200), 300)).toBe(false);
    expect(fitsFrame('€'.repeat(100), 300)).toBe(true);
    expect(fitsFrame(`${'€'.repeat(100)}x`, 300)).toBe(false);
  });

  it('holds at the default limit, to the byte', () => {
    expect(fitsFrame('x'.repeat(DEFAULT_MAX_FRAME_BYTES), DEFAULT_MAX_FRAME_BYTES)).toBe(true);
    expect(fitsFrame('x'.repeat(DEFAULT_MAX_FRAME_BYTES + 1), DEFAULT_MAX_FRAME_BYTES)).toBe(false);
  });
});

describe('the WELCOME frame limit', () => {
  const accept = {
    type: 'oh.sync.welcome',
    accepted: true,
    protocolVersion: 1,
    role: 'desktop',
    nodeId: 'node-1',
    workspaceId: 'ws-1',
    agent: '@openheaders/desktop@2026.11.1',
  };

  it('parses a WELCOME that states its limit', () => {
    const parsed = v.safeParse(SyncWelcomeMessageSchema, { ...accept, maxFrameBytes: DEFAULT_MAX_FRAME_BYTES });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.output.accepted && parsed.output.maxFrameBytes).toBe(DEFAULT_MAX_FRAME_BYTES);
  });

  it('parses a WELCOME from a host that predates the field', () => {
    const parsed = v.safeParse(SyncWelcomeMessageSchema, accept);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.output.accepted && parsed.output.maxFrameBytes).toBeUndefined();
  });

  it('refuses a limit that is not a positive integer', () => {
    expect(v.safeParse(SyncWelcomeMessageSchema, { ...accept, maxFrameBytes: 0 }).success).toBe(false);
    expect(v.safeParse(SyncWelcomeMessageSchema, { ...accept, maxFrameBytes: 1.5 }).success).toBe(false);
  });
});
