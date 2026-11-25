/**
 * Our part of the Windows installer script. An update runs the new
 * installer and the old version's uninstaller, and each asks whether the
 * app is running; the builder's own answer starts PowerShell three times
 * per ask. The script supplies the answer through the builder's hook and
 * starts no program to get it. What the compiled installer does is seen
 * on a Windows machine; this holds the script to the rule.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(path.resolve(__dirname, '../../../build/windows/installer.nsh'), 'utf8');

const INSTALLER_OPTIONS: Record<string, unknown> = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
).build.nsis;

/** The script's instructions: comment lines dropped. */
const CODE = SCRIPT.split(/\r?\n/)
  .filter((line) => !line.trim().startsWith(';'))
  .join('\n');

function macro(name: string): string {
  const match = new RegExp(`!macro ${name}\\b[^\\n]*\\n([\\s\\S]*?)\\n!macroend`).exec(CODE);
  return match ? match[1] : '';
}

describe('the Windows installer script', () => {
  it('answers the running-app question through the hook the builder reads', () => {
    expect(macro('customCheckAppRunning')).toContain('!insertmacro openHeadersAppProcesses');
  });

  it('starts no program', () => {
    expect(CODE).not.toMatch(/\b(nsExec::|ExecWait\b|ExecShell\b|Exec\s|ExecDos::|powershell|tasklist|taskkill)/i);
  });

  it('leaves the uninstaller out of the processes it closes', () => {
    expect(macro('openHeadersAppProcesses')).toMatch(/\$\{UNINSTALL_FILENAME\}/);
  });

  it('tells the app apart from the helpers that run from its folder', () => {
    expect(macro('openHeadersAppProcesses')).toMatch(/\$\{APP_EXECUTABLE_FILENAME\}/);
  });

  it('adds no wait to an uninstall', () => {
    expect(macro('customUnInstall')).not.toMatch(/\bSleep\b/);
  });

  it('asks before closing a running app only when installing', () => {
    const asks = CODE.match(/MessageBox[^\n]*\$\(appRunning\)/g) ?? [];
    expect(asks).toHaveLength(1);
    expect(macro('customCheckAppRunning')).toMatch(
      /!ifndef BUILD_UNINSTALLER\s+MessageBox[^\n]*\$\(appRunning\)[^\n]*\n\s*Quit\s+!endif/,
    );
  });

  it('registers the quiet uninstall command the builder wrote as the one Windows Settings runs', () => {
    const install = macro('customInstall');
    expect(install).toMatch(/ReadRegStr \$R0 SHELL_CONTEXT "\$\{UNINSTALL_REGISTRY_KEY\}" QuietUninstallString/);
    expect(install).toMatch(/WriteRegStr SHELL_CONTEXT "\$\{UNINSTALL_REGISTRY_KEY\}" UninstallString "\$R0"/);
  });
});

describe("the uninstaller and the user's data", () => {
  const uninstall = macro('customUnInstall');
  const dataDelete =
    /\$\{ifNot\} \$\{isUpdated\}\s+\$\{andIfNot\} \$\{isMoveToPackage\}\s+((?:\s*(?:RMDir|!ifdef|!endif)[^\n]*\n)+)\s*\$\{endif\}/.exec(
      uninstall,
    )?.[1] ?? '';

  it("leaves the builder's own delete off: it would run in a move", () => {
    expect(INSTALLER_OPTIONS.deleteAppDataOnUninstall ?? false).toBe(false);
  });

  it('reads the move switch as the builder reads its own', () => {
    expect(macro('_isMoveToPackage')).toMatch(/\$\{StdUtils\.TestParameter\} \$R9 "move-to-package"/);
    expect(CODE).toContain('!define isMoveToPackage `"" isMoveToPackage ""`');
  });

  it('deletes the data on a plain uninstall: never in update mode, never in a move', () => {
    expect(dataDelete.match(/RMDir \/r "\$APPDATA/g)).toHaveLength(3);
    expect(uninstall.match(/RMDir \/r "\$APPDATA/g)).toHaveLength(3);
  });

  it("deletes the three folders the builder's delete named", () => {
    expect(dataDelete).toMatch(/RMDir \/r "\$APPDATA\\\$\{APP_FILENAME\}"/);
    expect(dataDelete).toMatch(
      /!ifdef APP_PRODUCT_FILENAME\s+RMDir \/r "\$APPDATA\\\$\{APP_PRODUCT_FILENAME\}"\s+!endif/,
    );
    expect(dataDelete).toMatch(/!ifdef APP_PACKAGE_NAME\s+RMDir \/r "\$APPDATA\\\$\{APP_PACKAGE_NAME\}"\s+!endif/);
  });

  it('deletes them from the profile of the user, whoever the install was for', () => {
    expect(uninstall).toMatch(
      /\$\{if\} \$installMode == "all"\s+SetShellVarContext current\s+\$\{endif\}[\s\S]*RMDir \/r "\$APPDATA[\s\S]*\$\{if\} \$installMode == "all"\s+SetShellVarContext all\s+\$\{endif\}/,
    );
  });
});
