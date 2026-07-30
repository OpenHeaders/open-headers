import { describe, expect, it } from 'vitest';
import { recognizeSocketUrl } from '../../src/utils/socket-url';

describe('recognizeSocketUrl', () => {
  it('recognizes a plain unix:// URL — the whole remainder is the socket', () => {
    expect(recognizeSocketUrl('unix:///var/run/docker.sock')).toEqual({
      socketPath: '/var/run/docker.sock',
      requestPath: '',
    });
  });

  it('recognizes the scheme-only unix: spelling', () => {
    expect(recognizeSocketUrl('unix:/var/run/docker.sock')).toEqual({
      socketPath: '/var/run/docker.sock',
      requestPath: '',
    });
  });

  it("splits curl's `:/request/path` tail off the socket", () => {
    expect(recognizeSocketUrl('unix:///var/run/docker.sock:/v1.43/containers/json')).toEqual({
      socketPath: '/var/run/docker.sock',
      requestPath: '/v1.43/containers/json',
    });
  });

  it('recognizes the http+unix:// percent-encoded idiom with its request path', () => {
    expect(recognizeSocketUrl('http+unix://%2Fvar%2Frun%2Fdocker.sock/v1.43/containers/json')).toEqual({
      socketPath: '/var/run/docker.sock',
      requestPath: '/v1.43/containers/json',
    });
  });

  it('accepts any scheme prefix on +unix (https+unix, ws+unix)', () => {
    expect(recognizeSocketUrl('https+unix://%2Ftmp%2Foh.sock')).toEqual({
      socketPath: '/tmp/oh.sock',
      requestPath: '',
    });
    expect(recognizeSocketUrl('ws+unix://%2Ftmp%2Foh.sock/session')).toEqual({
      socketPath: '/tmp/oh.sock',
      requestPath: '/session',
    });
  });

  it('rejects a +unix host that does not decode to an absolute path', () => {
    expect(recognizeSocketUrl('http+unix://docker.sock/v1')).toBeNull();
    expect(recognizeSocketUrl('http+unix://%ZZ/v1')).toBeNull();
  });

  it("normalizes Docker's npipe idiom to the \\\\.\\pipe spelling", () => {
    expect(recognizeSocketUrl('npipe:////./pipe/docker_engine')).toEqual({
      socketPath: '\\\\.\\pipe\\docker_engine',
      requestPath: '',
    });
    expect(recognizeSocketUrl('npipe://./pipe/openheaders')).toEqual({
      socketPath: '\\\\.\\pipe\\openheaders',
      requestPath: '',
    });
  });

  it('leaves plain URLs, templates, and garbage untouched', () => {
    expect(recognizeSocketUrl('https://api.openheaders.io/v1/ping')).toBeNull();
    expect(recognizeSocketUrl('ws://stream.openheaders.io/session')).toBeNull();
    expect(recognizeSocketUrl('{{base}}/v1/ping')).toBeNull();
    expect(recognizeSocketUrl('unix://relative/path.sock')).toBeNull();
    expect(recognizeSocketUrl('')).toBeNull();
  });
});
