import { WS_CLOSE_CODES, wsCloseCodePhrase } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';

describe('wsCloseCodePhrase', () => {
  it('names the registered codes and stays silent on application codes', () => {
    expect(wsCloseCodePhrase(1000)).toBe('Normal Closure');
    expect(wsCloseCodePhrase(1006)).toBe('Abnormal Closure');
    expect(wsCloseCodePhrase(1015)).toBe('TLS Handshake');
    expect(wsCloseCodePhrase(1004)).toBeNull();
    expect(wsCloseCodePhrase(4444)).toBeNull();
    expect(WS_CLOSE_CODES).toHaveLength(15);
  });
});
