/**
 * Exit-code contract (the CI interface, the CLI plan §5): 0 success,
 * 1 operation failed, 2 usage error, 3 daemon unreachable or MCP
 * disabled, 4 auth or tier denial. Each non-zero class has a dedicated
 * error type; `exitCodeFor` is the single classification point.
 */

export const EXIT_OK = 0;
export const EXIT_OPERATION_FAILED = 1;
export const EXIT_USAGE = 2;
export const EXIT_UNREACHABLE = 3;
export const EXIT_AUTH = 4;

/** Caller mistake: unknown command, missing argument, bad flag. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** The daemon is not there (connect failure) or its /mcp surface is disabled (404). */
export class UnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreachableError';
  }
}

/** Rejected token (HTTP 401) or a tier/capability denial from the policy gate. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * The call itself succeeded but the tool reported an unsuccessful
 * outcome as a value (a failed send/run). `stdout` carries the `--json`
 * payload so scripting keeps the machine contract alongside exit 1.
 */
export class OperationFailedError extends Error {
  readonly stdout?: readonly string[];
  constructor(message: string, stdout?: readonly string[]) {
    super(message);
    this.name = 'OperationFailedError';
    this.stdout = stdout;
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof UsageError) return EXIT_USAGE;
  if (err instanceof UnreachableError) return EXIT_UNREACHABLE;
  if (err instanceof AuthError) return EXIT_AUTH;
  return EXIT_OPERATION_FAILED;
}
