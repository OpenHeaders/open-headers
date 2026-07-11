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

import { commandConnect, commandStatus, runReadCommand } from './commands';
import { DAEMON_URL_ENV, DEFAULT_DAEMON_URL, TOKEN_ENV } from './connection';
import { EXIT_USAGE, exitCodeFor } from './exit-codes';
import { findReadCommand, READ_COMMANDS } from './read-commands';
import { CLI_VERSION } from './version';

function usage(): string {
  const commandLines = READ_COMMANDS.map((spec) => {
    const positional = spec.positional
      ? spec.positional.required
        ? ` <${spec.positional.name}>`
        : ` [${spec.positional.name}]`
      : '';
    const name = `${spec.group}${spec.verb ? ` ${spec.verb}` : ''}${positional}`;
    return `  ${name.padEnd(26)}${spec.summary}`;
  });
  return `oh v${CLI_VERSION} — Open Headers command line

Usage: oh <command> [options]

Commands:
  status                    Probe the daemon's /mcp surface (running / disabled / bad token)
  connect --token <secret>  Validate and save the daemon URL + token for later runs
${commandLines.join('\n')}

Options:
  --daemon <url>            Daemon URL (default ${DEFAULT_DAEMON_URL}; env ${DAEMON_URL_ENV})
  --token <secret>          Paired daemon token (env ${TOKEN_ENV}; oh connect persists one)
  --workspace <id>          Target workspace (default: the daemon's active workspace)
  --json                    Emit the tool result's JSON payload verbatim
  --limit <n>               activity only: max entries (default 50)

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
    const spec = findReadCommand(first, argv[1]);
    if (!spec) {
      console.log(usage());
      process.exitCode = EXIT_USAGE;
      return;
    }
    lines = await runReadCommand(spec, argv);
  }
  for (const line of lines) {
    console.log(line);
  }
}

main().catch((err: unknown) => {
  console.error(`oh: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = exitCodeFor(err);
});
