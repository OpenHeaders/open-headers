/**
 * Loopback `/metrics` probe + human formatting — the verbose half of
 * `oh daemon status`. Pure HTTP against the running daemon's bind, so
 * this module stays sqlite-free like the rest of the CLI entry: the
 * daemon derives every number; the CLI only renders it.
 *
 * The route is token-gated (tokens everywhere — loopback included), so
 * the caller supplies a paired token via `--token` or the
 * `OH_DAEMON_TOKEN` environment variable.
 */

import type { DaemonMetrics } from '@openheaders/oracle-host-node/daemon';

export class MetricsProbeError extends Error {}

export async function fetchMetrics(port: number, token: string, timeoutMs = 3000): Promise<DaemonMetrics> {
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${port}/metrics`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new MetricsProbeError(`could not reach /metrics on 127.0.0.1:${port}: ${(err as Error).message}`);
  }
  if (res.status === 401) {
    throw new MetricsProbeError('the token was refused — pass a valid paired token (--token or OH_DAEMON_TOKEN)');
  }
  if (!res.ok) {
    throw new MetricsProbeError(`/metrics answered ${res.status}`);
  }
  return (await res.json()) as DaemonMetrics;
}

export function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

const LABEL_WIDTH = 15;

function line(label: string, text: string): string {
  return `${`${label}:`.padEnd(LABEL_WIDTH)}${text}`;
}

export function formatMetrics(metrics: DaemonMetrics): string[] {
  const lines: string[] = [];
  lines.push(line('version', `${metrics.version} — up ${formatUptime(metrics.uptimeSeconds)}`));
  if (metrics.bind) {
    lines.push(line('bind', `${metrics.bind.state} on ${metrics.bind.host}:${metrics.bind.port}`));
  }
  const { total, loopback, lan } = metrics.peers;
  lines.push(line('peers', `${total} connected (${loopback} on this device, ${lan} on LAN)`));
  lines.push(line('workspaces', `${metrics.workspaces.total}`));
  lines.push(line('mutations', `${metrics.mutations.total} stored (${metrics.mutations.last24h} in the last 24h)`));
  lines.push(
    line(
      'audit',
      `${metrics.audit.total} decisions — ${metrics.audit.allowed} allowed, ` +
        `${metrics.audit.denied} denied (${metrics.audit.last24h} in the last 24h)`,
    ),
  );
  lines.push(line('observability', `${metrics.observability.entries} entries`));
  for (const [subsystem, entry] of Object.entries(metrics.status)) {
    if (entry) lines.push(line(subsystem, `${entry.state} — ${entry.message}`));
  }
  return lines;
}
