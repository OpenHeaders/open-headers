/**
 * Copy-paste client configuration for the MCP server. Two transports:
 *
 *   - stdio — every client config points at the installed app binary
 *     with `--mcp-stdio` (a thin pipe to the running app; everything
 *     ships in the bundle, nothing is downloaded at connect time).
 *   - HTTP — clients that speak streamable HTTP call the endpoint
 *     directly with the bearer token.
 *
 * The binary path is a per-platform placeholder for the standard
 * install location — shown for the platform this app is running on.
 * Snippets carry a token placeholder; the real secret comes from the
 * "Paired devices" section above and is shown exactly once at mint.
 */

import { App as AntApp, Button, Tabs, theme } from 'antd';
import type React from 'react';
import { MCP_HTTP_PATH, WS_PORT } from '@openheaders/core/protocol';
import { useSettingValue } from '../hooks';

const TOKEN_PLACEHOLDER = 'YOUR_ACCESS_TOKEN';

function binaryPathForThisPlatform(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.startsWith('win')) return 'C:\\Users\\YOU\\AppData\\Local\\Programs\\OpenHeaders\\OpenHeaders.exe';
  if (platform.startsWith('linux')) return '/opt/OpenHeaders/open-headers';
  return '/Applications/OpenHeaders.app/Contents/MacOS/OpenHeaders';
}

function stdioArgs(port: number): string[] {
  const args = ['--mcp-stdio', '--token', TOKEN_PLACEHOLDER];
  if (port !== WS_PORT) args.push('--port', String(port));
  return args;
}

function mcpServersJson(port: number, rootKey: string, extra?: Record<string, string>): string {
  return JSON.stringify(
    {
      [rootKey]: {
        'open-headers': { ...(extra ?? {}), command: binaryPathForThisPlatform(), args: stdioArgs(port) },
      },
    },
    null,
    2,
  );
}

const SnippetBlock: React.FC<{ title: string; body: string }> = ({ title, body }) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{title}</span>
        <Button
          size="small"
          type="text"
          style={{ fontSize: 11, color: token.colorTextSecondary }}
          onClick={() => {
            navigator.clipboard.writeText(body).then(
              () => message.success('Copied to clipboard'),
              () => message.error('Clipboard access denied — copy the value manually'),
            );
          }}
        >
          Copy
        </Button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '8px 10px',
          fontSize: 11,
          lineHeight: 1.5,
          background: token.colorBgLayout,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 6,
          overflowX: 'auto',
        }}
      >
        {body}
      </pre>
    </div>
  );
};

const McpConfigSnippets: React.FC = () => {
  const { token } = theme.useToken();
  const port = useSettingValue('backend.bindPort');
  const httpUrl = `http://127.0.0.1:${port}${MCP_HTTP_PATH}`;
  const binary = binaryPathForThisPlatform();
  const argsShell = stdioArgs(port).join(' ');

  const items = [
    {
      key: 'claude-desktop',
      label: 'Claude Desktop',
      children: (
        <SnippetBlock title="claude_desktop_config.json — merge into the existing file" body={mcpServersJson(port, 'mcpServers')} />
      ),
    },
    {
      key: 'claude-code',
      label: 'Claude Code',
      children: <SnippetBlock title="Run once in a terminal" body={`claude mcp add open-headers -- "${binary}" ${argsShell}`} />,
    },
    {
      key: 'cursor',
      label: 'Cursor',
      children: <SnippetBlock title=".cursor/mcp.json" body={mcpServersJson(port, 'mcpServers')} />,
    },
    {
      key: 'vscode',
      label: 'VS Code',
      children: <SnippetBlock title=".vscode/mcp.json" body={mcpServersJson(port, 'servers', { type: 'stdio' })} />,
    },
    {
      key: 'cli',
      label: 'CLI',
      children: (
        <SnippetBlock
          title="Run once in a terminal — later oh runs need no flags"
          body={`npm install -g @openheaders/cli\noh connect --daemon http://127.0.0.1:${port} --token ${TOKEN_PLACEHOLDER}`}
        />
      ),
    },
    {
      key: 'http',
      label: 'HTTP',
      children: (
        <SnippetBlock
          title="For clients that speak streamable HTTP directly"
          body={`URL:    ${httpUrl}\nHeader: Authorization: Bearer ${TOKEN_PLACEHOLDER}`}
        />
      ),
    },
  ];

  return (
    <section style={{ marginBottom: 12 }}>
      <header style={{ marginBottom: 6, padding: '0 2px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: token.colorTextSecondary,
          }}
        >
          Connect a client
        </h3>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
          Pick your client, replace {TOKEN_PLACEHOLDER} with a token generated above, and adjust the app path if you
          installed somewhere else. The app must be running for clients to connect.
        </div>
      </header>
      <div
        className="settings-card"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          padding: '4px 12px 10px',
        }}
      >
        <Tabs size="small" items={items} />
      </div>
    </section>
  );
};

export default McpConfigSnippets;
