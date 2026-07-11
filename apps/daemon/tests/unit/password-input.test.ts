/**
 * Password-input resolution for `oh daemon user set-password` — the
 * env/file pair rides the vault passphrase rules (exactly one source,
 * never empty, newline-stripped file), the interactive path prompts
 * twice and refuses a mismatch, and a non-TTY stdin with no env
 * refuses instead of hanging.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type PasswordInputIo,
  resolvePasswordInput,
  USER_PASSWORD_ENV,
  USER_PASSWORD_FILE_ENV,
} from '../../src/cli/password-input';

const tempDirs: string[] = [];

function makeSecretFile(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-pass-input-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, 'password');
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function promptIo(answers: string[]): PasswordInputIo {
  return { isTTY: true, promptHidden: () => Promise.resolve(answers.shift() ?? '') };
}

const noPromptIo: PasswordInputIo = {
  isTTY: false,
  promptHidden: () => Promise.reject(new Error('prompt must not run')),
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolvePasswordInput', () => {
  it('takes the direct env var without prompting', async () => {
    await expect(resolvePasswordInput({ [USER_PASSWORD_ENV]: 's15-env-pass' }, noPromptIo)).resolves.toBe(
      's15-env-pass',
    );
  });

  it('reads the file source and strips the trailing newline', async () => {
    const filePath = makeSecretFile('s15-file-pass\n');
    await expect(resolvePasswordInput({ [USER_PASSWORD_FILE_ENV]: filePath }, noPromptIo)).resolves.toBe(
      's15-file-pass',
    );
  });

  it('refuses both sources set, an empty value, and an unreadable file', async () => {
    const filePath = makeSecretFile('s15-file-pass\n');
    await expect(
      resolvePasswordInput({ [USER_PASSWORD_ENV]: 'x', [USER_PASSWORD_FILE_ENV]: filePath }, noPromptIo),
    ).rejects.toThrow('both set');
    await expect(resolvePasswordInput({ [USER_PASSWORD_ENV]: '' }, noPromptIo)).rejects.toThrow('empty');
    await expect(
      resolvePasswordInput({ [USER_PASSWORD_FILE_ENV]: path.join(os.tmpdir(), 'oh-no-such-file') }, noPromptIo),
    ).rejects.toThrow('cannot read');
  });

  it('prompts twice on a TTY and returns the confirmed password', async () => {
    await expect(resolvePasswordInput({}, promptIo(['s15-tty-pass', 's15-tty-pass']))).resolves.toBe('s15-tty-pass');
  });

  it('refuses a confirmation mismatch', async () => {
    await expect(resolvePasswordInput({}, promptIo(['s15-tty-pass', 's15-other']))).rejects.toThrow('do not match');
  });

  it('refuses a non-TTY stdin with no env source, naming the pair', async () => {
    await expect(resolvePasswordInput({}, noPromptIo)).rejects.toThrow(USER_PASSWORD_ENV);
  });
});
