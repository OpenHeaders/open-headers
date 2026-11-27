/**
 * `scripts/build/test-msix-install.ps1`, held to what it rests on. The
 * script installs a package on a Windows machine through the installer
 * program and asks it whether it starts — seen on the release lane's
 * runners, not here. What can be held here: it runs the installer with
 * switches the installer takes and looks for a sentence its log writes,
 * it asks with the switch the app answers to, it starts the alias the
 * manifest names first, and it is a file Windows PowerShell reads as
 * written.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_MANIFEST_FILE_NAME } from '../../../src/main/bootstrap/install-kind';
import { PACKAGE_APP_ALIAS } from '../../../src/main/bootstrap/package-aliases';
import { CHECK_PACKAGE_START_SWITCH, PACKAGE_START_CHECK_EXIT } from '../../../src/main/bootstrap/package-start-check';

const APP_DIR = path.resolve(__dirname, '../../..');
const SCRIPT = readFileSync(path.join(APP_DIR, 'scripts/build/test-msix-install.ps1'), 'utf8');
const MANIFEST = readFileSync(path.join(APP_DIR, 'build/windows', PACKAGE_MANIFEST_FILE_NAME), 'utf8');
const INSTALLER_SOURCE = path.resolve(APP_DIR, '../../native/windows-installer/src');
const INSTALLER_SWITCHES = readFileSync(path.join(INSTALLER_SOURCE, 'args.rs'), 'utf8');
const INSTALLER_RUN = readFileSync(path.join(INSTALLER_SOURCE, 'flow.rs'), 'utf8');

describe("the Windows package's install test", () => {
  it('runs the installer program with switches it takes', () => {
    const line = /-ArgumentList \('([^']+)' -f \$Package, \$runLog\)/.exec(SCRIPT)?.[1] ?? '';
    const switches = line.split(' ').filter((word) => word.startsWith('--'));

    expect(switches).toEqual(['--silent', '--no-launch', '--package', '--log']);
    for (const name of switches) expect(INSTALLER_SWITCHES).toContain(`"${name}"`);
  });

  it("passes on the sentence the installer's log writes when the package's signer is its own", () => {
    const sentence = /-like "\*([^*]+)\*"/.exec(SCRIPT)?.[1] ?? '';

    expect(sentence).not.toBe('');
    expect(INSTALLER_RUN).toContain(`log.line("${sentence}");`);
  });

  it('asks the installed app with the switch its start check answers to, and passes on its "starts"', () => {
    expect(SCRIPT).toContain(`-ArgumentList '${CHECK_PACKAGE_START_SWITCH}'`);
    expect(SCRIPT).toContain(`$check.ExitCode -eq ${PACKAGE_START_CHECK_EXIT.starts})`);
  });

  it("starts the first alias the manifest names, which is the app's", () => {
    expect(SCRIPT).toContain('$($aliases[0])');
    expect(/<uap5:ExecutionAlias Alias="([^"]+)" \/>/.exec(MANIFEST)?.[1]).toBe(PACKAGE_APP_ALIAS);
  });

  it('is plain ASCII: Windows PowerShell reads a script without a byte-order mark in an old code page', () => {
    const beyondAscii = [...SCRIPT].filter((character) => (character.codePointAt(0) ?? 0) > 0x7e);

    expect(beyondAscii).toEqual([]);
  });
});
