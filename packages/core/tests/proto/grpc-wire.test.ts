/**
 * gRPC wire ceremony — framing round trips, cut-tail honesty, the
 * grpc-timeout unit ladder, and grpc-status extraction across the
 * normal and trailers-only reply shapes (missing status stays null,
 * grpc-message percent-decodes with a malformed-sequence fallback).
 */

import {
  decodeGrpcMessage,
  encodeGrpcTimeout,
  extractGrpcStatus,
  grpcStatusLabel,
  readGrpcFrames,
  writeGrpcFrame,
} from '@openheaders/core/proto';
import { describe, expect, it } from 'vitest';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe('gRPC message framing', () => {
  it('wraps a message with the flag byte and big-endian length', () => {
    const frame = writeGrpcFrame(bytes(0x0a, 0x02, 0x68, 0x69));
    expect([...frame]).toEqual([0, 0, 0, 0, 4, 0x0a, 0x02, 0x68, 0x69]);
  });

  it('marks the compressed flag when asked', () => {
    expect(writeGrpcFrame(bytes(1), true)[0]).toBe(1);
  });

  it('round-trips multiple frames and preserves flags verbatim', () => {
    const one = writeGrpcFrame(bytes(1, 2, 3));
    const two = writeGrpcFrame(bytes(9), true);
    const joined = new Uint8Array([...one, ...two, ...writeGrpcFrame(bytes())]);
    const { frames, incomplete } = readGrpcFrames(joined);
    expect(incomplete).toBe(false);
    expect(frames.map((f) => f.flag)).toEqual([0, 1, 0]);
    expect([...frames[0].data]).toEqual([1, 2, 3]);
    expect([...frames[1].data]).toEqual([9]);
    expect(frames[2].data.byteLength).toBe(0);
  });

  it('keeps a non-standard flag byte as received', () => {
    const frame = new Uint8Array([0x80, 0, 0, 0, 1, 0x2a]);
    const { frames } = readGrpcFrames(frame);
    expect(frames[0].flag).toBe(0x80);
  });

  it('reports a body cut mid-prefix as incomplete with prior frames intact', () => {
    const whole = writeGrpcFrame(bytes(7, 8));
    const cut = new Uint8Array([...whole, 0, 0, 0]);
    const { frames, incomplete } = readGrpcFrames(cut);
    expect(incomplete).toBe(true);
    expect(frames).toHaveLength(1);
    expect([...frames[0].data]).toEqual([7, 8]);
  });

  it('reports a body cut mid-payload as incomplete', () => {
    const whole = writeGrpcFrame(bytes(7, 8, 9));
    const { frames, incomplete } = readGrpcFrames(whole.subarray(0, whole.byteLength - 1));
    expect(incomplete).toBe(true);
    expect(frames).toHaveLength(0);
  });

  it('reads an empty body as zero complete frames', () => {
    expect(readGrpcFrames(bytes())).toEqual({ frames: [], incomplete: false });
  });
});

describe('encodeGrpcTimeout', () => {
  it('rides milliseconds verbatim within eight digits', () => {
    expect(encodeGrpcTimeout(30_000)).toBe('30000m');
    expect(encodeGrpcTimeout(99_999_999)).toBe('99999999m');
  });

  it('climbs to seconds past eight millisecond digits, rounding up', () => {
    expect(encodeGrpcTimeout(100_000_000)).toBe('100000S');
    expect(encodeGrpcTimeout(100_000_001)).toBe('100001S');
  });

  it('floors negative and fractional inputs to whole non-negative units', () => {
    expect(encodeGrpcTimeout(-5)).toBe('0m');
    expect(encodeGrpcTimeout(1.2)).toBe('2m');
  });
});

describe('extractGrpcStatus', () => {
  const field = (key: string, value: string) => ({ key, value });

  it('prefers trailers and percent-decodes grpc-message', () => {
    const status = extractGrpcStatus(
      [field('grpc-status', '0')],
      [field('Grpc-Status', '3'), field('grpc-message', 'bad%20name')],
    );
    expect(status).toEqual({ code: 3, message: 'bad name', source: 'trailers' });
  });

  it('falls back to headers for trailers-only replies', () => {
    const status = extractGrpcStatus([field('grpc-status', '5'), field('grpc-message', 'missing')], []);
    expect(status).toEqual({ code: 5, message: 'missing', source: 'headers' });
  });

  it('resolves null when no grpc-status arrived anywhere', () => {
    expect(extractGrpcStatus([field('content-type', 'application/grpc')], [])).toEqual({
      code: null,
      source: null,
    });
  });

  it('ignores an unparseable grpc-status value', () => {
    expect(extractGrpcStatus([], [field('grpc-status', 'nope')])).toEqual({ code: null, source: null });
  });

  it('keeps a malformed percent sequence verbatim', () => {
    expect(decodeGrpcMessage('50%% off')).toBe('50%% off');
  });
});

describe('grpcStatusLabel', () => {
  it('names canonical codes and leaves unknown ones bare', () => {
    expect(grpcStatusLabel(0)).toBe('0 OK');
    expect(grpcStatusLabel(14)).toBe('14 UNAVAILABLE');
    expect(grpcStatusLabel(42)).toBe('42');
  });
});
