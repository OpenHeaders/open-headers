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
import { commandConnect, commandStatus, runReadCommand, runToolCommand } from './commands';
import { DAEMON_URL_ENV, DEFAULT_DAEMON_URL, TOKEN_ENV } from './connection';
import { EXEC_COMMANDS, findExecCommand } from './exec-commands';
import { EXIT_USAGE, exitCodeFor, OperationFailedError } from './exit-codes';
import { findReadCommand, READ_COMMANDS } from './read-commands';
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

Exit codes: 0 ok · 1 operation failed · 2 usage · 3 daemon unreachable or MCP disabled · 4 auth/tier denied
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [first] = argv;

  if (first === '--version' || first === '-v') {
    console.log(CLI_VERSION);
    return;
  }
  if (first === undefined || first === 'help' || first === '--help' || first === '-h') {
    console.log(usage());
    return;
  }

  let lines: string[];
  if (first === 'status') {
    lines = await commandStatus(argv.slice(1));
  } else if (first === 'connect') {
    lines = await commandConnect(argv.slice(1));
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
