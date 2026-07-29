/**
 * `oh run <kind> <target>` — the CI runner verbs (fork 4 surface): one
 * `runs_execute` call per run, reporters formatted client-side. Owns
 * its own dispatch (unlike the table verbs) because the output
 * contract differs: `--reporter human|json|junit` selects the format,
 * `--output <file>` writes it to a file with the one-line summary on
 * stderr so CI logs stay readable, and a failed run exits 1 after the
 * report is emitted — the report itself is never lost to the failure.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { cliConfigPath, readCliConfig } from './config-store';
import { type Connection, resolveConnection } from './connection';
import { OperationFailedError, UsageError } from './exit-codes';
import { resolveEnvironmentTarget } from './resolvers';
import { callTool } from './rpc';
import { formatRunHuman, formatRunJUnit, formatRunSummary, type RunReport } from './run-reporters';

const RUN_KINDS = ['collection', 'folder', 'workflow'] as const;
type RunKind = (typeof RUN_KINDS)[number];

const RUN_USAGE =
  'usage: oh run <collection|folder|workflow> <name-or-uid> ' +
  '[--env <name-or-uid>] [--reporter human|json|junit] [--output <file>] [--bail]';

/** Spec-shaped rows for the usage listing + completions — same fields
 *  the command tables expose (group/verb/argsHelp/summary/extraOptions). */
export const RUN_COMMANDS = RUN_KINDS.map((verb) => ({
  group: 'run',
  verb,
  tool: 'runs_execute',
  argsHelp: '<name-or-uid>',
  summary:
    verb === 'workflow'
      ? 'Run a workflow with CI exit codes and reporters (human/json/junit)'
      : `Run every request in a ${verb} in tree order (CI exit codes + reporters)`,
  extraOptions: {
    env: { type: 'string' },
    reporter: { type: 'string' },
    output: { type: 'string' },
    bail: { type: 'boolean' },
  } as const,
}));

type Reporter = 'human' | 'json' | 'junit';

interface ParsedRun {
  kind: RunKind;
  ref: string;
  reporter: Reporter;
  output?: string;
  bail: boolean;
  workspace?: string;
  env?: string;
  daemon?: string;
  token?: string;
}

function parseRunArgs(argv: readonly string[]): ParsedRun {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: {
        daemon: { type: 'string' },
        token: { type: 'string' },
        workspace: { type: 'string' },
        json: { type: 'boolean' },
        env: { type: 'string' },
        reporter: { type: 'string' },
        output: { type: 'string' },
        bail: { type: 'boolean' },
      },
      allowPositionals: true,
    });
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
  const values = parsed.values as Record<string, string | boolean | undefined>;
  const [kind, ref, extra] = parsed.positionals;
  if (kind === undefined || ref === undefined || extra !== undefined || !isRunKind(kind)) {
    throw new UsageError(RUN_USAGE);
  }
  const reporter = reporterFor(values.reporter, values.json === true);
  return {
    kind,
    ref,
    reporter,
    ...(typeof values.output === 'string' ? { output: values.output } : {}),
    bail: values.bail === true,
    ...(typeof values.workspace === 'string' ? { workspace: values.workspace } : {}),
    ...(typeof values.env === 'string' ? { env: values.env } : {}),
    ...(typeof values.daemon === 'string' ? { daemon: values.daemon } : {}),
    ...(typeof values.token === 'string' ? { token: values.token } : {}),
  };
}

function isRunKind(raw: string): raw is RunKind {
  return (RUN_KINDS as readonly string[]).includes(raw);
}

/** `--json` stays the machine-contract alias everywhere; here it is
 *  exactly the json reporter. */
function reporterFor(raw: string | boolean | undefined, json: boolean): Reporter {
  const value = typeof raw === 'string' ? raw : json ? 'json' : 'human';
  if (value === 'human' || value === 'json' || value === 'junit') return value;
  throw new UsageError("--reporter must be 'human', 'json', or 'junit'");
}

function reporterText(reporter: Reporter, report: RunReport, payloadText: string): string {
  if (reporter === 'json') return payloadText;
  if (reporter === 'junit') return formatRunJUnit(report);
  return formatRunHuman(report).join('\n');
}

/** Run one `oh run` invocation end to end — parse, call, emit, exit-classify. */
export async function runRunCommand(argv: readonly string[]): Promise<void> {
  const run = parseRunArgs(argv.slice(1));
  const config = await readCliConfig(cliConfigPath());
  const conn: Connection = resolveConnection({ daemon: run.daemon, token: run.token }, process.env, config);

  let toolArgs: Record<string, unknown> = {
    kind: run.kind,
    ref: run.ref,
    ...(run.bail ? { bail: true } : {}),
    ...(run.workspace !== undefined ? { workspaceId: run.workspace } : {}),
    ...(run.env !== undefined ? { environmentId: run.env } : {}),
  };
  // The sanctioned name → uid pre-read, same as `request send --env`.
  toolArgs = await resolveEnvironmentTarget(toolArgs, conn);

  const payloadText = await callTool(conn, 'runs_execute', toolArgs);
  const report = JSON.parse(payloadText) as RunReport;
  const text = reporterText(run.reporter, report, payloadText);

  if (run.output !== undefined) {
    writeFileSync(run.output, `${text}\n`);
    process.stderr.write(`${formatRunSummary(report)}\n`);
    process.stderr.write(`${run.reporter} report written to ${run.output}\n`);
  } else {
    console.log(text);
  }

  if (report.ok === false) {
    // The report is already on stdout/file — the error carries only the
    // verdict line for stderr + the exit-1 classification.
    throw new OperationFailedError(`run failed — ${report.totals.failed} of ${report.totals.items} item(s) failed`);
  }
}
