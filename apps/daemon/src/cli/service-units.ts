/**
 * Service-unit rendering — pure text generation for the two service
 * managers the daemon installs under (the daemon plan §6): a launchd
 * user LaunchAgent on macOS and a systemd user unit on Linux. No I/O
 * here; `service-manager.ts` owns paths and process control.
 *
 * The unit execs the daemon entry directly — absolute binary plus its
 * fixed arguments (`node dist/main.js` for the plain-Node
 * distribution, `ohd run` for the single-binary SEA build), so
 * the service survives PATH and cwd differences between login shells
 * and the service manager.
 */

export const LAUNCHD_LABEL = 'io.openheaders.daemon';
export const SYSTEMD_UNIT_NAME = 'oh-daemon.service';

export interface ServiceDefinition {
  /** The daemon exec line: absolute program path plus its fixed arguments. */
  command: readonly string[];
  /** Config flags baked into the unit (already resolved/absolute). */
  args: readonly string[];
  /** Absolute path the daemon's stdout/stderr append to. */
  logFile: string;
}

function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderLaunchdPlist(def: ServiceDefinition): string {
  const programArguments = [...def.command, ...def.args]
    .map((arg) => `    <string>${xmlEscape(arg)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${programArguments}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(def.logFile)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(def.logFile)}</string>
</dict>
</plist>
`;
}

/** Quote for a systemd ExecStart= line when the value needs it. */
function systemdQuote(arg: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) return arg;
  return `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function renderSystemdUnit(def: ServiceDefinition): string {
  const execStart = [...def.command, ...def.args].map(systemdQuote).join(' ');
  return `[Unit]
Description=Open Headers daemon

[Service]
ExecStart=${execStart}
Restart=on-failure
StandardOutput=append:${def.logFile}
StandardError=append:${def.logFile}

[Install]
WantedBy=default.target
`;
}
