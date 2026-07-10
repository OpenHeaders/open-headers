/**
 * Fetch-failure classification — net-code tier (webRequest-recovered
 * ground truth) and the heuristic fallback tier without a code.
 */

import { describe, expect, it } from 'vitest';
import { classifyFetchFailure } from '@/background/modules/request-executor/failure-classify';

const RAW = 'Failed to fetch';

describe('classifyFetchFailure — recovered net code', () => {
  it('maps ERR_NAME_NOT_RESOLVED to a DNS message with the raw code', () => {
    const r = classifyFetchFailure('https://api.openheaders.io/v1/ping', RAW, 'net::ERR_NAME_NOT_RESOLVED');
    expect(r.message).toContain('net::ERR_NAME_NOT_RESOLVED');
    expect(r.message).toContain('api.openheaders.io');
    expect(r.message).toMatch(/resolve|DNS/i);
    expect(r.hint).toBeUndefined();
  });

  it('maps ERR_CONNECTION_REFUSED with the explicit port', () => {
    const r = classifyFetchFailure('http://localhost:8081/health', RAW, 'net::ERR_CONNECTION_REFUSED');
    expect(r.message).toContain('net::ERR_CONNECTION_REFUSED');
    expect(r.message).toContain('port 8081');
    expect(r.message).toMatch(/is the service running/i);
  });

  it('maps certificate codes to the self-signed guidance with the open-in-tab hint (local host)', () => {
    const url = 'https://localhost:8080/v1/workspaces/123/rules';
    const r = classifyFetchFailure(url, RAW, 'net::ERR_CERT_AUTHORITY_INVALID');
    expect(r.message).toContain('net::ERR_CERT_AUTHORITY_INVALID');
    expect(r.message).toMatch(/self-signed/i);
    expect(r.message).toMatch(/accept the certificate/i);
    expect(r.hint).toEqual({ kind: 'open-in-tab', url });
  });

  it('keeps the certificate hint for public hosts without the self-signed note', () => {
    const url = 'https://api.openheaders.io/v1/ping';
    const r = classifyFetchFailure(url, RAW, 'net::ERR_CERT_DATE_INVALID');
    expect(r.message).toContain('net::ERR_CERT_DATE_INVALID');
    expect(r.message).not.toMatch(/self-signed/i);
    expect(r.hint).toEqual({ kind: 'open-in-tab', url });
  });

  it('maps ERR_SSL_PROTOCOL_ERROR to the https-on-http-port explanation with no tab hint', () => {
    const r = classifyFetchFailure('https://localhost:8080/api', RAW, 'net::ERR_SSL_PROTOCOL_ERROR');
    expect(r.message).toContain('net::ERR_SSL_PROTOCOL_ERROR');
    expect(r.message).toContain('http://localhost:8080');
    expect(r.hint).toBeUndefined();
  });

  it('maps ERR_BLOCKED_BY_CLIENT to the extension/blocking-rule explanation', () => {
    const r = classifyFetchFailure('https://ads.openheaders.io/track', RAW, 'net::ERR_BLOCKED_BY_CLIENT');
    expect(r.message).toContain('net::ERR_BLOCKED_BY_CLIENT');
    expect(r.message).toMatch(/extension|blocking rule/i);
  });

  it('passes an unknown code through verbatim with the host', () => {
    const r = classifyFetchFailure('https://api.openheaders.io/v1/ping', RAW, 'net::ERR_QUIC_PROTOCOL_ERROR');
    expect(r.message).toContain('net::ERR_QUIC_PROTOCOL_ERROR');
    expect(r.message).toContain('api.openheaders.io');
  });
});

describe('classifyFetchFailure — heuristic fallback (no net code)', () => {
  it('explains the self-signed case for local https and hints open-in-tab', () => {
    const url = 'https://localhost:8080/v1/rules';
    const r = classifyFetchFailure(url, RAW);
    expect(r.message).toMatch(/self-signed/i);
    expect(r.hint).toEqual({ kind: 'open-in-tab', url });
  });

  it('asks "is the service running" for local http with no hint', () => {
    const r = classifyFetchFailure('http://localhost:3000/health', RAW);
    expect(r.message).toMatch(/Is the service running/);
    expect(r.hint).toBeUndefined();
  });

  it('lists likely causes for public hosts and hints open-in-tab on https', () => {
    const url = 'https://api.openheaders.io/v1/ping';
    const r = classifyFetchFailure(url, RAW);
    expect(r.message).toMatch(/host not found|connection refused|TLS|permission/i);
    expect(r.hint).toEqual({ kind: 'open-in-tab', url });
  });

  it('reports the invalid-URL case with the raw message', () => {
    const r = classifyFetchFailure('http://', RAW);
    expect(r.message).toContain(RAW);
    expect(r.message).toMatch(/invalid URL/i);
  });
});
