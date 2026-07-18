/**
 * `oh` — the Open Headers command line: headless scripting and CI
 * integration against the same daemon the extension and desktop app
 * use (CLI_PLAN.md). Every command is one `tools/call` POST to the
 * daemon's `/mcp` surface; admission, tiers, validation, and audit are
 * the server's — this binary is a protocol-only, engine-opaque client.
 * The daemon host's own control binary is `ohd` (the daemon
 * distribution); the two never share code beyond `@openheaders/core`
 * protocol constants.
 */

import type { CommandSpec } from './command-spec';
import { commandChannel, commandConnect, commandStatus, runReadCommand, runToolCommand } from './commands';
import { completionScript } from './completions';
import { DAEMON_URL_ENV, DEFAULT_DAEMON_URL, TOKEN_ENV } from './connection';
import { EXEC_COMMANDS, findExecCommand } from './exec-commands';
import { EXIT_USAGE, exitCodeFor, OperationFailedError } from './exit-codes';
import { bootCliProductTelemetry } from './product-telemetry';
import { findReadCommand, READ_COMMANDS } from './read-commands';
import { runTui } from './tui/run';
import { bootUpdateNotify } from './update-check';
import { commandUpgrade } from './upgrade';
import { CLI_VERSION } from './version';
import { findWriteCommand, WRITE_COMMANDS } from './write-commands';

function usage(): string {
  const readLines = READ_COMMANDS.map((spec) => {
    const positional = spec.positional
      ? spec.positional.required
        ? ` <${spec.positional.name}>`
        : ` [${spec.positional.name}]`
      : '';
    const name = `${spec.group}${spec.verb ? ` ${spec.verb}` : ''}${positional}`;
    return `  ${name.padEnd(30)}${spec.summary}`;
  });
  const specLine = (spec: CommandSpec) => {
    const name = `${spec.group} ${spec.verb} ${spec.argsHelp}`;
    return `  ${name.padEnd(30)}${spec.summary}`;
  };
  const writeLines = WRITE_COMMANDS.map(specLine);
  const execLines = EXEC_COMMANDS.map(specLine);
  return `oh v${CLI_VERSION} — Open Headers command line

Usage: oh <command> [options]

Commands:
  status                        Probe the daemon's /mcp surface (running / disabled / bad token)
  connect --token <secret>      Validate and save the daemon URL + token for later runs
  channel [stable|beta]         Show or set the release line version checks follow
  upgrade [--channel <line>]    Download and install the newest release of this binary
  completion bash|zsh           Print a shell completion script (source it from your profile)
  tui                           Open the terminal dashboard (early preview)
${readLines.join('\n')}
${writeLines.join('\n')}
${execLines.join('\n')}

Options:
  --daemon <url>            Daemon URL (default ${DEFAULT_DAEMON_URL}; env ${DAEMON_URL_ENV})
  --token <secret>          Paired daemon token (env ${TOKEN_ENV}; oh connect persists one)
  --workspace <id>          Target workspace (default: the daemon's active workspace)
  --json                    Emit the tool result's JSON payload verbatim
  --limit <n>               activity only: max entries (default 50)
  --none                    env switch only: select "No environment"
  --collection <uid>        vars set only: target that collection's variable scope
  --secret                  vars set only: store the value as a masked secret
  --env <name-or-uid>       request send / workflow run: environment to resolve variables under
  --channel <stable|beta>   upgrade only: release line to install from (persists like oh channel)
  --no-color                tui only: disable color output (NO_COLOR is honored too)
  --ascii                   tui only: ASCII borders and markers instead of unicode

Exit codes: 0 ok · 1 operation failed · 2 usage · 3 daemon unreachable or MCP disabled · 4 auth/tier denied
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [first] = argv;

  // Anonymous usage counting (TELEMETRY_PLAN.md §2): one invocation is
  // one session. Boot prints the first-run notice to stderr when owed;
  // the exit flush in the finally is best-effort and abort-capped, so
  // telemetry can never change a command's outcome or hold it open.
  const telemetry = await bootCliProductTelemetry();
  // Update availability notify (DISTRIBUTION_PLAN.md §5): prints from
  // the 24h cache only, TTY-and-flag gated; the ≤1/day feed refresh
  // rides in the background and is capped in the exit flush like the
  // telemetry channel — it can never change a command's outcome.
  // stderr.write, not console.error: bun paints console.error red on a
  // TTY, which would make the normal availability line loud by accident.
  const updateNotify = await bootUpdateNotify(argv);
  if (updateNotify.line !== null) process.stderr.write(`${updateNotify.line}\n`);
  try {
    await runCommand(argv, first);
  } finally {
    await telemetry.finish();
    await updateNotify.finish();
  }
}

async function runCommand(argv: string[], first: string | undefined): Promise<void> {
  if (first === '--version' || first === '-v') {
    console.log(CLI_VERSION);
    return;
  }
  if (first === undefined || first === 'help' || first === '--help' || first === '-h') {
    console.log(usage());
    return;
  }

  if (first === 'completion') {
    console.log(completionScript(argv[1]));
    return;
  }

  if (first === 'tui') {
    await runTui(
      { input: process.stdin, output: process.stdout, errorOutput: process.stderr, proc: process },
      { argv: argv.slice(1), env: process.env },
    );
    return;
  }

  let lines: string[];
  if (first === 'status') {
    lines = await commandStatus(argv.slice(1));
  } else if (first === 'connect') {
    lines = await commandConnect(argv.slice(1));
  } else if (first === 'channel') {
    lines = await commandChannel(argv.slice(1));
  } else if (first === 'upgrade') {
    lines = await commandUpgrade(argv.slice(1));
  } else {
    const readSpec = findReadCommand(first, argv[1]);
    const toolSpec = readSpec ? undefined : (findWriteCommand(first, argv[1]) ?? findExecCommand(first, argv[1]));
    if (readSpec) {
      lines = await runReadCommand(readSpec, argv);
    } else if (toolSpec) {
      lines = await runToolCommand(toolSpec, argv);
    } else {
      console.log(usage());
      process.exitCode = EXIT_USAGE;
      return;
    }
  }
  for (const line of lines) {
    console.log(line);
  }
}

main().catch((err: unknown) => {
  // A failed send/run under --json still owes stdout the payload (the machine contract).
  if (err instanceof OperationFailedError && err.stdout !== undefined) {
    for (const line of err.stdout) {
      console.log(line);
    }
  }
  console.error(`oh: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = exitCodeFor(err);
});
