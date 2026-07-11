/**
 * Prometheus text exposition for the daemon metrics snapshot — the
 * second serialization of the same {@link DaemonMetrics} numbers the
 * JSON route already serves. No counters store, no new numbers: every
 * series maps 1:1 onto a provider field, so the two formats can never
 * disagree.
 *
 * Everything is a gauge — the provider derives row counts at read
 * time and prune sweeps can shrink them, so none of these are
 * monotonic counters in the Prometheus sense. Subsystem status maps
 * to a numeric level (0 green, 1 yellow, 2 red) so `> 0` alerts work;
 * the free-text status message is an unbounded label value and is
 * deliberately not exported.
 */

import type { StatusLevel } from '@openheaders/core/types';
import type { DaemonMetrics } from './metrics';

/** Classic Prometheus text format — what every scraper accepts. */
export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

const STATUS_LEVEL_VALUE: Record<StatusLevel, number> = { green: 0, yellow: 1, red: 2 };

/**
 * True when the request's `Accept` header names a Prometheus media
 * type (`text/plain` or `application/openmetrics-text` — a scraper
 * lists both). JSON stays the default for everything else: the CLI
 * and curl send no `Accept`, and a bare wildcard never flips the
 * format.
 */
export function wantsPrometheusText(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  return acceptHeader.split(',').some((entry) => {
    const mediaType = entry.split(';')[0]?.trim().toLowerCase();
    return mediaType === 'text/plain' || mediaType === 'application/openmetrics-text';
  });
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function labels(pairs: Record<string, string>): string {
  const rendered = Object.entries(pairs)
    .map(([name, value]) => `${name}="${escapeLabelValue(value)}"`)
    .join(',');
  return rendered ? `{${rendered}}` : '';
}

interface Sample {
  labels: Record<string, string>;
  value: number;
}

function series(name: string, help: string, samples: Sample[]): string[] {
  if (samples.length === 0) return [];
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} gauge`,
    ...samples.map((s) => `${name}${labels(s.labels)} ${s.value}`),
  ];
}

export function renderPrometheusMetrics(metrics: DaemonMetrics): string {
  const lines = [
    ...series('oh_info', 'Daemon build info.', [{ labels: { version: metrics.version }, value: 1 }]),
    ...series('oh_uptime_seconds', 'Seconds since the daemon spine booted.', [
      { labels: {}, value: metrics.uptimeSeconds },
    ]),
    ...series(
      'oh_bind_info',
      'Composed-bind lifecycle state; absent before the first bind.',
      metrics.bind
        ? [
            {
              labels: { state: metrics.bind.state, host: metrics.bind.host, port: String(metrics.bind.port) },
              value: 1,
            },
          ]
        : [],
    ),
    ...series('oh_peers', 'Connected WebSocket peers by scope.', [
      { labels: { scope: 'loopback' }, value: metrics.peers.loopback },
      { labels: { scope: 'lan' }, value: metrics.peers.lan },
    ]),
    ...series('oh_workspaces', 'Workspaces on this daemon.', [{ labels: {}, value: metrics.workspaces.total }]),
    ...series(
      'oh_status_level',
      'Subsystem status level (0 green, 1 yellow, 2 red).',
      Object.entries(metrics.status).map(([subsystem, entry]) => ({
        labels: { subsystem },
        value: STATUS_LEVEL_VALUE[entry.state],
      })),
    ),
    ...series('oh_mutation_entries', 'Rows in the mutation log.', [{ labels: {}, value: metrics.mutations.total }]),
    ...series('oh_mutation_entries_last24h', 'Mutation-log rows minted in the last 24 hours.', [
      { labels: {}, value: metrics.mutations.last24h },
    ]),
    ...series('oh_audit_entries', 'Rows in the audit log by decision.', [
      { labels: { decision: 'allowed' }, value: metrics.audit.allowed },
      { labels: { decision: 'denied' }, value: metrics.audit.denied },
    ]),
    ...series('oh_audit_entries_last24h', 'Audit rows minted in the last 24 hours.', [
      { labels: {}, value: metrics.audit.last24h },
    ]),
    ...series('oh_observability_entries', 'Rows in the observability ring.', [
      { labels: {}, value: metrics.observability.entries },
    ]),
  ];
  return `${lines.join('\n')}\n`;
}
