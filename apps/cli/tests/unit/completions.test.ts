/**
 * Completion scripts — generated from the live command tables, so the
 * assertions here pin table-derivation, not hand-kept word lists: the
 * verbs and per-command flags must appear because the specs do.
 */

import { describe, expect, it } from 'vitest';
import { completionScript } from '../../src/completions';
import { EXEC_COMMANDS } from '../../src/exec-commands';
import { UsageError } from '../../src/exit-codes';
import { READ_COMMANDS } from '../../src/read-commands';
import { WRITE_COMMANDS } from '../../src/write-commands';

describe('completionScript', () => {
  it('rejects an unknown shell as a usage error', () => {
    expect(() => completionScript('fish')).toThrow(UsageError);
    expect(() => completionScript(undefined)).toThrow(UsageError);
  });

  for (const shell of ['bash', 'zsh'] as const) {
    describe(shell, () => {
      const script = completionScript(shell);

      it('completes every table group and the local commands at the first word', () => {
        for (const word of ['status', 'connect', 'channel', 'completion', 'tui', 'help']) {
          expect(script).toContain(word);
        }
        for (const spec of [...READ_COMMANDS, ...WRITE_COMMANDS, ...EXEC_COMMANDS]) {
          expect(script).toContain(spec.group);
        }
      });

      it('completes verbs per group and the completion shells', () => {
        expect(script).toMatch(/rules\) .*list get toggle/);
        expect(script).toMatch(/workflow\) .*list history run/);
        expect(script).toMatch(/completion\) .*bash zsh/);
        expect(script).toMatch(/channel\) .*stable beta/);
      });

      it('completes per-command flags from the specs', () => {
        expect(script).toMatch(/"vars set"\) .*--collection --secret/);
        expect(script).toMatch(/"env switch"\) .*--none/);
        expect(script).toMatch(/"request send"\) .*--env/);
        expect(script).toMatch(/activity\) .*--limit/);
      });
    });
  }

  it('bash registers the completer; zsh carries the compdef header', () => {
    expect(completionScript('bash')).toContain('complete -F _oh oh');
    expect(completionScript('zsh')).toMatch(/^#compdef oh/);
  });
});
