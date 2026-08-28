import { binaryEncodingError, decodeBinaryText } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';

describe('binaryEncodingError', () => {
  it('accepts padded base64 with whitespace and rejects a stray alphabet or length', () => {
    expect(binaryEncodingError('aGVs bG8=', 'base64')).toBeNull();
    expect(binaryEncodingError('', 'base64')).toBeNull();
    expect(binaryEncodingError('aGVsbG8', 'base64')).toBe('base64');
    expect(binaryEncodingError('aGVs*G8=', 'base64')).toBe('base64');
  });

  it('accepts hex digit pairs in either case and rejects odd length or non-digits', () => {
    expect(binaryEncodingError('48 65 6C 6c 6f', 'hex')).toBeNull();
    expect(binaryEncodingError('', 'hex')).toBeNull();
    expect(binaryEncodingError('48656c6', 'hex')).toBe('hex');
    expect(binaryEncodingError('4g', 'hex')).toBe('hex');
  });
});

describe('decodeBinaryText', () => {
  it('decodes both spellings of the same bytes and returns null on the gate', () => {
    expect([...(decodeBinaryText('aGVsbG8=', 'base64') ?? [])]).toEqual([104, 101, 108, 108, 111]);
    expect([...(decodeBinaryText('68656C6c6f', 'hex') ?? [])]).toEqual([104, 101, 108, 108, 111]);
    expect(decodeBinaryText('aGVsbG8', 'base64')).toBeNull();
    expect(decodeBinaryText('4', 'hex')).toBeNull();
  });
});
