/**
 * Run reporters — the CLI's formatting of the daemon's `runs_execute`
 * report (fork 4: the daemon emits structured run events, the CLI
 * formats them). The interfaces here are the CLI's read view of the
 * tool contract (run-tools.ts), same discipline as `format.ts`; the
 * `json` reporter emits the payload verbatim and bypasses all of this.
 */

export interface RunReportItem {
  kind: string;
  uid: string;
  name: string;
  path?: string;
  method?: string;
  status: 'passed' | 'failed' | 'skipped';
  httpStatus?: number;
  durationMs?: number;
  assertions?: { name: string; passed: boolean; message?: string }[];
  error?: string;
}

export interface RunReport {
  workspaceId: string;
  target: { kind: string; uid: string; name: string; path?: string };
  environmentId: string | null;
  ok: boolean;
  startedAt: number;
  durationMs: number;
  scripts?: { available: boolean; mode?: string };
  items: RunReportItem[];
  totals: { items: number; passed: number; failed: number; skipped: number };
}

const STATUS_MARK: Record<RunReportItem['status'], string> = {
  passed: 'pass',
  failed: 'FAIL',
  skipped: 'skip',
};

function itemTiming(item: RunReportItem): string {
  const parts: string[] = [];
  if (item.httpStatus !== undefined) parts.push(String(item.httpStatus));
  if (item.durationMs !== undefined) parts.push(`${Math.round(item.durationMs)} ms`);
  return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
}

/** One line per item, failure detail indented beneath — the terminal view. */
export function formatRunHuman(report: RunReport): string[] {
  const lines: string[] = [];
  for (const item of report.items) {
    const label = item.method !== undefined ? `${item.method} ${item.name}` : item.name;
    lines.push(`${STATUS_MARK[item.status]}  ${label}${itemTiming(item)}`);
    for (const assertion of item.assertions ?? []) {
      if (!assertion.passed) {
        lines.push(`      assertion failed: ${assertion.name}${assertion.message ? ` — ${assertion.message}` : ''}`);
      }
    }
    // Assertion failures already print above; the folded error line
    // would repeat them verbatim.
    if (item.error !== undefined && !item.error.startsWith('Assertion failed:')) {
      lines.push(`      ${item.error}`);
    }
  }
  if (report.scripts?.available === false) {
    lines.push('note: this host has no script runtime — scripts and their assertions did not run');
  }
  lines.push(formatRunSummary(report));
  return lines;
}

/** The one-line verdict — stdout's last line, and the stderr line when
 *  `--output` sends the reporter's text to a file. */
export function formatRunSummary(report: RunReport): string {
  const { totals } = report;
  const skipped = totals.skipped > 0 ? ` · ${totals.skipped} skipped` : '';
  const seconds = (report.durationMs / 1000).toFixed(1);
  return (
    `${report.target.kind} "${report.target.name}" — ${totals.passed} passed · ` +
    `${totals.failed} failed${skipped} · ${seconds} s · workspace ${report.workspaceId}`
  );
}

function xmlEscape(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * JUnit XML — one `<testsuite>` for the target, one `<testcase>` per
 * item (classname = the item's tree path, so CI groups by folder).
 * Failed assertions ride the failure body; a failed item without
 * assertions carries its error as the failure message.
 */
export function formatRunJUnit(report: RunReport): string {
  const seconds = (ms: number | undefined): string => ((ms ?? 0) / 1000).toFixed(3);
  const cases = report.items.map((item) => {
    const attrs =
      `name="${xmlEscape(item.name)}" classname="${xmlEscape(item.path ?? report.target.name)}" ` +
      `time="${seconds(item.durationMs)}"`;
    if (item.status === 'skipped') return `    <testcase ${attrs}><skipped/></testcase>`;
    if (item.status === 'failed') {
      const failedAssertions = (item.assertions ?? []).filter((assertion) => !assertion.passed);
      const detail = failedAssertions
        .map((assertion) => `${assertion.name}${assertion.message ? `: ${assertion.message}` : ''}`)
        .join('\n');
      const message = xmlEscape(item.error ?? (detail !== '' ? detail : 'failed'));
      const body = detail !== '' ? xmlEscape(detail) : '';
      return `    <testcase ${attrs}><failure message="${message}">${body}</failure></testcase>`;
    }
    return `    <testcase ${attrs}/>`;
  });
  const suiteAttrs =
    `name="${xmlEscape(report.target.name)}" tests="${report.totals.items}" ` +
    `failures="${report.totals.failed}" skipped="${report.totals.skipped}" ` +
    `time="${seconds(report.durationMs)}" timestamp="${new Date(report.startedAt).toISOString()}"`;
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<testsuite ${suiteAttrs}>`, ...cases, '</testsuite>'].join('\n');
}
