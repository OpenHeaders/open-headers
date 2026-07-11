/**
 * Prometheus exposition of the daemon metrics snapshot — the renderer
 * is a pure serialization of {@link DaemonMetrics}, so every series is
 * asserted against the same fixture numbers the JSON route serves,
 * plus the negotiation predicate that selects the format.
 */

import { describe, expect, it } from 'vitest';
import type { DaemonMetrics } from '../../../src/daemon/metrics';
import { renderPrometheusMetrics, wantsPrometheusText } from '../../../src/daemon/metrics-prometheus';

const METRICS: DaemonMetrics = {
  version: '2026.7.0',
  uptimeSeconds: 4242,
  bind: { state: 'bound', host: '0.0.0.0', port: 8137 },
  peers: { total: 3, loopback: 1, lan: 2 },
  workspaces: { total: 3 },
  status: {
    sync: { state: 'green', message: 'Connected to 2 extensions (1 on LAN)' },
    live: { state: 'red', message: 'refresh failing' },
  },
  mutations: { total: 120, last24h: 7 },
  audit: { total: 40, allowed: 38, denied: 2, last24h: 5 },
  observability: { entries: 12 },
};

describe('wantsPrometheusText', () => {
  it('selects the exposition format for scraper Accept headers', () => {
    expect(wantsPrometheusText('text/plain;version=0.0.4;q=0.5,*/*;q=0.1')).toBe(true);
    expect(
      wantsPrometheusText('application/openmetrics-text;version=1.0.0,text/plain;version=0.0.4;q=0.5,*/*;q=0.1'),
    ).toBe(true);
    expect(wantsPrometheusText('TEXT/PLAIN')).toBe(true);
  });

  it('keeps JSON the default for everything else', () => {
    expect(wantsPrometheusText(undefined)).toBe(false);
    expect(wantsPrometheusText('application/json')).toBe(false);
    expect(wantsPrometheusText('*/*')).toBe(false);
    expect(wantsPrometheusText('text/html,application/xhtml+xml')).toBe(false);
  });
});

describe('renderPrometheusMetrics', () => {
  const body = renderPrometheusMetrics(METRICS);

  it('maps every provider number to an oh_-prefixed gauge', () => {
    expect(body).toContain('oh_info{version="2026.7.0"} 1');
    expect(body).toContain('oh_uptime_seconds 4242');
    expect(body).toContain('oh_bind_info{state="bound",host="0.0.0.0",port="8137"} 1');
    expect(body).toContain('oh_peers{scope="loopback"} 1');
    expect(body).toContain('oh_peers{scope="lan"} 2');
    expect(body).toContain('oh_workspaces 3');
    expect(body).toContain('oh_status_level{subsystem="sync"} 0');
    expect(body).toContain('oh_status_level{subsystem="live"} 2');
    expect(body).toContain('oh_mutation_entries 120');
    expect(body).toContain('oh_mutation_entries_last24h 7');
    expect(body).toContain('oh_audit_entries{decision="allowed"} 38');
    expect(body).toContain('oh_audit_entries{decision="denied"} 2');
    expect(body).toContain('oh_audit_entries_last24h 5');
    expect(body).toContain('oh_observability_entries 12');
  });

  it('emits HELP and TYPE comments for every series and ends with a newline', () => {
    for (const line of body.trimEnd().split('\n')) {
      if (line.startsWith('#')) {
        expect(line).toMatch(/^# (HELP|TYPE) oh_[a-z0-9_]+ /);
      } else {
        expect(line).toMatch(/^oh_[a-z0-9_]+(\{[^}]*\})? -?\d+$/);
      }
    }
    expect(body.endsWith('\n')).toBe(true);
    expect(body).toContain('# TYPE oh_peers gauge');
  });

  it('omits the bind series before the first bind instead of inventing a value', () => {
    const unbound = renderPrometheusMetrics({ ...METRICS, bind: null });
    expect(unbound).not.toContain('oh_bind_info');
    expect(unbound).toContain('oh_uptime_seconds 4242');
  });

  it('escapes label values', () => {
    const hostile = renderPrometheusMetrics({ ...METRICS, version: 'a"b\\c\nd' });
    expect(hostile).toContain('oh_info{version="a\\"b\\\\c\\nd"} 1');
  });
});
