import { describe, expect, it } from 'vitest';
import { topicFilterError, topicNameError } from '../../src/mqtt';

const NUL = String.fromCharCode(0);

describe('topicNameError', () => {
  it('accepts ordinary topic names, empty levels included', () => {
    expect(topicNameError('sensors/temp')).toBeNull();
    expect(topicNameError('a')).toBeNull();
    expect(topicNameError('/')).toBeNull();
    expect(topicNameError('a//b')).toBeNull();
    expect(topicNameError('$SYS/broker/uptime')).toBeNull();
  });

  it('rejects the empty topic', () => {
    expect(topicNameError('')).toBe('Topic is empty.');
  });

  it('rejects wildcards anywhere in a name', () => {
    expect(topicNameError('sensors/+/temp')).toBe('Topic names cannot contain wildcards.');
    expect(topicNameError('sensors/#')).toBe('Topic names cannot contain wildcards.');
    expect(topicNameError('a+b')).toBe('Topic names cannot contain wildcards.');
  });

  it('rejects U+0000 and oversize names', () => {
    expect(topicNameError(`a${NUL}b`)).toBe('Topic contains U+0000.');
    expect(topicNameError('x'.repeat(65_536))).toBe('Topic exceeds 65535 bytes.');
  });
});

describe('topicFilterError', () => {
  it('accepts legal wildcard placements', () => {
    expect(topicFilterError('#')).toBeNull();
    expect(topicFilterError('+')).toBeNull();
    expect(topicFilterError('sensors/+/temp')).toBeNull();
    expect(topicFilterError('sensors/tennis/#')).toBeNull();
    expect(topicFilterError('+/+/#')).toBeNull();
    expect(topicFilterError('a//+')).toBeNull();
  });

  it('passes $share filters through as ordinary filters', () => {
    expect(topicFilterError('$share/group/sensors/+')).toBeNull();
  });

  it('rejects the empty filter', () => {
    expect(topicFilterError('')).toBe('Topic filter is empty.');
  });

  it('rejects "+" glued to level text', () => {
    expect(topicFilterError('sensors+')).toBe('"+" must fill a whole topic level.');
    expect(topicFilterError('a/+b/c')).toBe('"+" must fill a whole topic level.');
  });

  it('rejects "#" glued to level text', () => {
    expect(topicFilterError('sensors#')).toBe('"#" must fill a whole topic level.');
    expect(topicFilterError('a/#b')).toBe('"#" must fill a whole topic level.');
  });

  it('rejects "#" before the last level', () => {
    expect(topicFilterError('a/#/b')).toBe('"#" is only legal as the last topic level.');
  });

  it('rejects U+0000 and oversize filters', () => {
    expect(topicFilterError(`a${NUL}b`)).toBe('Topic filter contains U+0000.');
    expect(topicFilterError('x'.repeat(65_536))).toBe('Topic filter exceeds 65535 bytes.');
  });
});
