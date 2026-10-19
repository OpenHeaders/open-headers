/**
 * The Report Issue hand-off (the error reports plan §8.7): the
 * repository's new-issue page with its title and body prefilled from
 * the URL, so the person lands on GitHub with the version, the platform
 * and the system facts typed in and reviews every line before posting.
 * Nothing is uploaded and no token is involved; the app only opens a
 * link. The templates are markdown (`.github/ISSUE_TEMPLATE/*.md`), so
 * the page shows one title and one description — the body composed
 * here replaces the template's own.
 *
 * Laws: only the `diagnosticsFacts` answer rides the URL — never the
 * status snapshot, the diagnostic log, a log line or the telemetry
 * session (the bundle is the hand-off for those). The link has a
 * measured cap (GitHub answers 500 above roughly 6.8 KB of query when
 * the sign-in redirect carries the URL, 414 above 8 KB), so the
 * builder trims the facts in a fixed order — the GPU table first, the
 * displays next, the whole block last — and never the person's text.
 *
 * The rows are English on purpose: the table lands in a public issue
 * the maintainers read, and the dialog shows the same rows so what the
 * person sees is what leaves.
 */

import type { DesktopDiagnosticsFacts, DiagnosticsFacts, ExtensionDiagnosticsFacts } from './facts';

export const ISSUE_NEW_URL = 'https://github.com/OpenHeaders/open-headers/issues/new';

/** Whole-URL budget in bytes — under the measured cap with room for GitHub's own sign-in redirect. */
export const ISSUE_URL_BUDGET = 6144;

export type IssueKind = 'bug' | 'feature';

/** The host the dialog runs in; the body's "Component" line names it. */
export type IssueHost = 'desktop' | 'extension' | 'web';

/** The dialog's two inputs — a title and one description, whatever the kind (the VS Code reporter's shape). */
export interface IssueDraft {
  kind: IssueKind;
  title: string;
  description: string;
}

/** The `template=` value per kind — the file names under `.github/ISSUE_TEMPLATE`; their front matter applies the label. */
export const ISSUE_TEMPLATE: Record<IssueKind, string> = {
  bug: 'bug_report.md',
  feature: 'feature_request.md',
};

/** The body's "Component" line per host — the template's own vocabulary. */
export const ISSUE_COMPONENT: Record<IssueHost, string> = {
  extension: 'Browser extension',
  desktop: 'Desktop app',
  web: 'Web app',
};

/** One line of the system-information table; `trim` names the group that gives first when the link is long. */
export interface SystemInformationRow {
  label: string;
  value: string;
  trim?: 'gpu' | 'displays';
}

/** How much of the facts block the budget took: nothing, the GPU table, the displays too, or the whole block. */
export type IssueTrim = 'none' | 'gpu' | 'displays' | 'facts';

export interface IssueLink {
  url: string;
  body: string;
  trimmed: IssueTrim;
  /** The person's own text alone exceeds the budget — the link would fail; nothing was cut. */
  overBudget: boolean;
}

const OS_NAMES: Record<string, string> = {
  darwin: 'macOS',
  mac: 'macOS',
  win32: 'Windows',
  win: 'Windows',
  linux: 'Linux',
  cros: 'ChromeOS',
  android: 'Android',
  openbsd: 'OpenBSD',
  fuchsia: 'Fuchsia',
};

const BROWSER_NAMES: Record<ExtensionDiagnosticsFacts['browser'], string> = {
  chrome: 'Chrome',
  firefox: 'Firefox',
  edge: 'Edge',
  safari: 'Safari',
  other: 'Browser',
};

function osName(platform: string): string {
  return OS_NAMES[platform] ?? platform;
}

function osLine(facts: DiagnosticsFacts): string {
  const name = osName(facts.platform);
  return facts.osVersion ? `${name} ${facts.osVersion}` : name;
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function gigabytes(kb: number): string {
  return `${(kb / 1_048_576).toFixed(1)} GB`;
}

function desktopRows(facts: DesktopDiagnosticsFacts): SystemInformationRow[] {
  const rows: SystemInformationRow[] = [
    { label: 'App version', value: facts.appVersion },
    { label: 'Channel', value: facts.channel },
    { label: 'Packaged', value: yesNo(facts.packaged) },
    { label: 'OS', value: `${osLine(facts)} (${facts.arch})` },
    { label: 'Electron', value: facts.runtime.electron },
    { label: 'Chromium', value: facts.runtime.chromium },
    { label: 'Node', value: facts.runtime.node },
    { label: 'V8', value: facts.runtime.v8 },
    { label: 'Locale', value: facts.locale },
    { label: 'Uptime', value: `${facts.uptimeSeconds} s` },
    { label: 'Memory', value: `${gigabytes(facts.memory.totalKB)} total, ${gigabytes(facts.memory.freeKB)} free` },
    { label: 'Windows', value: String(facts.windows) },
    {
      label: 'Hardware acceleration disabled on next launch',
      value: yesNo(facts.hardwareAccelerationDisabledOnNextLaunch),
    },
    { label: 'Previous session ended dirty', value: yesNo(facts.previousSessionEndedDirty) },
  ];
  if (facts.runningUnderArm64Translation) rows.push({ label: 'Running under arm64 translation', value: 'yes' });
  facts.displays.forEach((display, index) => {
    rows.push({
      label: `Display ${index + 1}`,
      value: `${display.width}×${display.height} @${display.scaleFactor}x${display.internal ? ', internal' : ''}`,
      trim: 'displays',
    });
  });
  for (const [feature, status] of Object.entries(facts.gpuFeatureStatus)) {
    rows.push({ label: `GPU: ${feature}`, value: status, trim: 'gpu' });
  }
  return rows;
}

function browserLine(facts: ExtensionDiagnosticsFacts): string {
  const name = BROWSER_NAMES[facts.browser];
  return facts.browserVersion !== undefined ? `${name} ${facts.browserVersion}` : name;
}

function extensionRows(facts: ExtensionDiagnosticsFacts): SystemInformationRow[] {
  const rows: SystemInformationRow[] = [
    { label: 'Extension version', value: facts.appVersion },
    { label: 'Channel', value: facts.channel },
    { label: 'Browser', value: browserLine(facts) },
    { label: 'Manifest version', value: String(facts.manifestVersion) },
    { label: 'OS', value: `${osLine(facts)} (${facts.arch})` },
    { label: 'Locale', value: facts.locale },
    { label: 'Uptime', value: `${facts.uptimeSeconds} s` },
  ];
  if (facts.storageBytesInUse !== undefined) {
    rows.push({ label: 'Storage in use', value: `${facts.storageBytesInUse} bytes` });
  }
  if (facts.dynamicRules !== undefined) rows.push({ label: 'Dynamic rules', value: String(facts.dynamicRules) });
  if (facts.sessionRules !== undefined) rows.push({ label: 'Session rules', value: String(facts.sessionRules) });
  return rows;
}

/** The two-column table the dialog shows and the link carries — the same rows, the same order. */
export function systemInformationRows(facts: DiagnosticsFacts): SystemInformationRow[] {
  return facts.host === 'desktop' ? desktopRows(facts) : extensionRows(facts);
}

/** The body's "Version" line: which host, which version. */
export function issueVersionLine(facts: DiagnosticsFacts): string {
  return `${facts.host} ${facts.appVersion}`;
}

/** The body's "Platform" line: the OS and the runtime that drew the window. */
export function issuePlatformLine(facts: DiagnosticsFacts): string {
  const runtime = facts.host === 'desktop' ? `Electron ${facts.runtime.electron}` : browserLine(facts);
  return `${osLine(facts)}, ${runtime}`;
}

function markdownCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const TRIM_NOTE: Record<Exclude<IssueTrim, 'none' | 'facts'>, string> = {
  gpu: 'The GPU feature table was left out to keep the link short; the diagnostic bundle has it.',
  displays:
    'The GPU feature table and the displays were left out to keep the link short; the diagnostic bundle has them.',
};

/** The collapsed markdown table of the rows that survived the trim. */
export function systemInformationMarkdown(rows: SystemInformationRow[], trimmed: IssueTrim): string {
  const lines = ['<details>', '<summary>System information</summary>', '', '| Item | Value |', '|---|---|'];
  for (const row of rows) lines.push(`| ${markdownCell(row.label)} | ${markdownCell(row.value)} |`);
  if (trimmed === 'gpu' || trimmed === 'displays') lines.push('', TRIM_NOTE[trimmed]);
  lines.push('</details>');
  return lines.join('\n');
}

function rowsAfterTrim(rows: SystemInformationRow[], trimmed: IssueTrim): SystemInformationRow[] {
  if (trimmed === 'none') return rows;
  if (trimmed === 'gpu') return rows.filter((row) => row.trim !== 'gpu');
  return rows.filter((row) => row.trim === undefined);
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * The body, in the template's own order: the type line, the person's
 * description, then (bug only) the component, version and platform
 * lines and the collapsed facts table. A missing facts answer leaves
 * the version and platform lines blank for the person to fill.
 */
export function issueBody(
  draft: IssueDraft,
  host: IssueHost,
  facts: DiagnosticsFacts | null,
  trimmed: IssueTrim,
): string {
  const description = draft.description.trim();
  if (draft.kind === 'feature') return ['Type: Feature request', description].join('\n\n');
  const parts = [
    'Type: Bug',
    description,
    [
      `Component: ${ISSUE_COMPONENT[host]}`,
      `Version: ${facts ? issueVersionLine(facts) : ''}`,
      `Platform: ${facts ? issuePlatformLine(facts) : ''}`,
    ].join('\n'),
  ];
  if (facts && trimmed !== 'facts') {
    parts.push(systemInformationMarkdown(rowsAfterTrim(systemInformationRows(facts), trimmed), trimmed));
  }
  return parts.join('\n\n');
}

function composeUrl(draft: IssueDraft, body: string): string {
  const params = new URLSearchParams();
  params.set('template', ISSUE_TEMPLATE[draft.kind]);
  if (draft.title.trim()) params.set('title', draft.title.trim());
  params.set('body', body);
  return `${ISSUE_NEW_URL}?${params.toString()}`;
}

const TRIM_ORDER: IssueTrim[] = ['none', 'gpu', 'displays', 'facts'];

/**
 * The link for a draft. `facts` is the host's `diagnosticsFacts` answer
 * when the person keeps "Include system information" on, else null.
 * Only the bug body carries facts: the feature template has no place
 * for them.
 */
export function issueLink(draft: IssueDraft, host: IssueHost, facts: DiagnosticsFacts | null): IssueLink {
  const carriesFacts = draft.kind === 'bug' && facts !== null;
  for (const trimmed of carriesFacts ? TRIM_ORDER : ['none' as const]) {
    const body = issueBody(draft, host, facts, trimmed);
    const url = composeUrl(draft, body);
    if (utf8Length(url) <= ISSUE_URL_BUDGET) return { url, body, trimmed, overBudget: false };
  }
  const trimmed: IssueTrim = carriesFacts ? 'facts' : 'none';
  const body = issueBody(draft, host, facts, trimmed);
  return { url: composeUrl(draft, body), body, trimmed, overBudget: true };
}
