/**
 * `ohd status` composition — turns observed facts into the lines the
 * command prints, and nothing else: every probe, file read and clock
 * read happens in the caller and arrives here as data, so the whole
 * decision table is unit-testable without a daemon.
 *
 * The report answers one question — what is the daemon ACTUALLY doing —
 * from the runtime manifest the running process wrote, never from the
 * configuration re-resolved a second time (which describes the next
 * boot, not this one). Three facts follow from that and each earns a
 * line only when it is true: the bind the process holds, the addresses
 * a LAN client can reach it at, and whether the configuration on disk
 * has moved on since it started — the case that needs `ohd restart`.
 *
 * When no manifest can be trusted (a daemon older than the manifest, or
 * a file left stale by a crash) the report degrades to the probe plus
 * the configured bind, and SAYS that is what it is showing.
 */

import type { RuntimeConfigSnapshot, RuntimeManifest } from '../runtime-manifest';
import type { JoinUrl } from './join-urls';
import { formatUptime } from './metrics-probe';

export interface StatusFacts {
  /** What the config chain resolves to for this invocation. */
  config: RuntimeConfigSnapshot;
  /** The `daemon.json` this invocation read. */
  configPath: string;
  /** Did loopback `/healthz` answer? */
  healthzOk: boolean;
  /** The manifest a daemon left behind, or null when there is none. */
  runtime: RuntimeManifest | null;
  /** Does the manifest's pid still name a live process? A stale file is ignored. */
  runtimeAlive: boolean;
  /** LAN join URLs for a port — injected so this module stays pure. */
  lanJoinUrls: (port: number) => readonly JoinUrl[];
  /** Where the service unit appends the daemon's output. */
  logFile: string;
  nowMs: number;
}

export interface StatusReport {
  lines: readonly string[];
  /** False ⇒ nothing is serving; the command exits non-zero. */
  serving: boolean;
}

export function formatStatus(facts: StatusFacts): StatusReport {
  // A stale manifest is no manifest: its pid is gone, so nothing in it
  // describes a process that exists.
  const runtime = facts.runtimeAlive ? facts.runtime : null;
  const bind = runtime?.bind ?? null;

  // A failed bind leaves the process up with no socket — "not running"
  // would send the operator after a dead service that is in fact alive
  // and telling them the port is taken.
  if (runtime !== null && bind !== null && bind.state === 'failed') {
    const lines = [
      `not serving — the daemon (pid ${runtime.pid}) is up but failed to bind on ${bind.host}:${bind.port}`,
      '  another process may already hold that port',
      `  log: ${facts.logFile}`,
    ];
    if (facts.healthzOk) lines.push(`  (the /healthz answer on port ${bind.port} is another process)`);
    return { lines, serving: false };
  }

  if (!facts.healthzOk) {
    const lines = [`not running — no /healthz on 127.0.0.1:${facts.config.bindPort}`];
    // The process is gone, but it left the reason it could not serve.
    // Without this the operator is told only that nothing answers, and
    // the cause sits in a log they have no reason to open.
    const lastBind = facts.runtime?.bind;
    if (lastBind !== undefined && lastBind !== null && lastBind.state === 'failed') {
      lines.push(`  the last run failed to bind on ${lastBind.host}:${lastBind.port} — another process may hold it`);
      lines.push(`  log: ${facts.logFile}`);
    }
    return { lines, serving: false };
  }

  if (runtime === null) {
    return {
      lines: [
        `running — /healthz OK on 127.0.0.1:${facts.config.bindPort}`,
        `  configured bind ${facts.config.bindAddress}:${facts.config.bindPort}` +
          ' — the running daemon reported no runtime details, so this is the configuration, not an observation',
        `  config ${facts.configPath}`,
      ],
      serving: true,
    };
  }

  const uptimeSeconds = Math.max(0, Math.round((facts.nowMs - Date.parse(runtime.startedAt)) / 1000));
  const lines = [`running — pid ${runtime.pid}, v${runtime.appVersion}, up ${formatUptime(uptimeSeconds)}`];
  lines.push(...bindLines(bind, facts));
  lines.push(`  config ${runtime.configPath}`);
  lines.push(...configLines(runtime, facts));
  return { lines, serving: true };
}

function bindLines(bind: RuntimeManifest['bind'], facts: StatusFacts): string[] {
  if (bind === null || bind.state === 'binding') return ['  binding — the daemon has not finished starting'];
  if (bind.host !== '0.0.0.0') {
    return [`  listening on ${bind.host}:${bind.port} (loopback only — clients on other machines cannot reach it)`];
  }
  const lines = [`  listening on 0.0.0.0:${bind.port} (every interface)`];
  const lan = facts.lanJoinUrls(bind.port);
  if (lan.length === 0) return lines;
  lines.push('  clients on this network join at:');
  for (const join of lan) lines.push(`    ${join.url}${join.iface ? `   (${join.iface})` : ''}`);
  // The daemon logs every connection it refuses, so a client that fails
  // WITHOUT a log line never reached the process — which is what a
  // closed firewall port looks like from both ends.
  lines.push('  a client that reaches none of these is blocked before the daemon — check the host firewall');
  return lines;
}

function configLines(runtime: RuntimeManifest, facts: StatusFacts): string[] {
  if (runtime.configPath !== facts.configPath) {
    return [
      '  ! this command read a different config file than the daemon booted with:',
      `      daemon:  ${runtime.configPath}`,
      `      command: ${facts.configPath}`,
    ];
  }
  const drift = describeConfigDrift(runtime, facts.config);
  if (drift.length === 0) return [];
  return [
    '  ! the configuration this command resolves differs from the one the daemon is running:',
    ...drift.map((entry) => `      ${entry}`),
    '    apply it with: ohd restart',
  ];
}

/**
 * Every difference between what the daemon is running and what the
 * config chain resolves to now, as `<what> <running> → <resolved>`.
 * The bind compares against the LIVE socket rather than the booted
 * configuration — a daemon rebound at runtime is doing what the socket
 * says, whatever it started with.
 */
function describeConfigDrift(runtime: RuntimeManifest, resolved: RuntimeConfigSnapshot): string[] {
  const running = runtime.config;
  const live = runtime.bind !== null && runtime.bind.state === 'bound' ? runtime.bind : null;
  const runningHost = live !== null ? live.host : running.bindAddress;
  const runningPort = live !== null ? live.port : running.bindPort;
  const out: string[] = [];
  if (runningHost !== resolved.bindAddress || runningPort !== resolved.bindPort) {
    out.push(`bind ${runningHost}:${runningPort} → ${resolved.bindAddress}:${resolved.bindPort}`);
  }
  if (running.dataDir !== resolved.dataDir) out.push(`data dir ${running.dataDir} → ${resolved.dataDir}`);
  if (running.logLevel !== resolved.logLevel) out.push(`log level ${running.logLevel} → ${resolved.logLevel}`);
  if (running.trustedProxy !== resolved.trustedProxy) {
    out.push(`trusted proxy ${flag(running.trustedProxy)} → ${flag(resolved.trustedProxy)}`);
  }
  if (running.allowInsecureLan !== resolved.allowInsecureLan) {
    out.push(`allow insecure LAN ${flag(running.allowInsecureLan)} → ${flag(resolved.allowInsecureLan)}`);
  }
  if (running.allowedHosts.join(' ') !== resolved.allowedHosts.join(' ')) {
    out.push(`allowed hosts ${hostList(running.allowedHosts)} → ${hostList(resolved.allowedHosts)}`);
  }
  if (running.webRoot !== resolved.webRoot) {
    out.push(`web root ${running.webRoot ?? 'none'} → ${resolved.webRoot ?? 'none'}`);
  }
  return out;
}

function flag(value: boolean): string {
  return value ? 'on' : 'off';
}

function hostList(hosts: readonly string[]): string {
  return hosts.length === 0 ? 'none' : hosts.join(' ');
}
