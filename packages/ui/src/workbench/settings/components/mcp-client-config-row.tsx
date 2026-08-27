/**
 * Client configuration row — custom editor for `mcp.clientConfig` on
 * the AI · MCP Server › Clients page: copy-paste client configuration
 * for the MCP server. Two transports:
 *
 *   - stdio — every client config points at the installed app binary
 *     with `--mcp-stdio` (a thin pipe to the running app; everything
 *     ships in the bundle, nothing is downloaded at connect time).
 *   - HTTP — clients that speak streamable HTTP call the endpoint
 *     directly with the bearer token.
 *
 * The binary path is a per-platform placeholder for the standard
 * install location — shown for the platform this app is running on.
 * Snippets carry a token placeholder; the real secret is minted on
 * Backend › Server (the one token home — the row links there) and is
 * shown exactly once at mint.
 */

import { App as AntApp, Button, Tabs, theme } from 'antd';
import type React from 'react';
import { MCP_HTTP_PATH, WS_PORT } from '@openheaders/core/protocol';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useSettingValue } from '../hooks';
import { resolveDescription, resolveLabel } from '../localize';
import { useSelectSettingsCategory } from '../NavigationContext';
import { getCategory } from '../registry';
import type { SettingDef } from '../types';

const TOKEN_PLACEHOLDER = 'YOUR_ACCESS_TOKEN';
const TOKENS_HOME_CATEGORY = 'backendServer';

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
  const t = useT();
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
              () => message.success(t('shared.toast.copiedToClipboard')),
              () => message.error(t('shared.toast.copyFailed')),
            );
          }}
        >
          {t('shared.action.copy')}
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
          overscrollBehavior: 'none',
        }}
      >
        {body}
      </pre>
    </div>
  );
};

/** "Access tokens are minted under <Backend · Server>" — the link jumps to the one token home. */
const TokensHomeNote: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  const selectCategory = useSelectSettingsCategory();
  const home = getCategory(TOKENS_HOME_CATEGORY);
  if (!home) return null;
  return (
    <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>
      {t('workbench.settings.mcpPane.tokensHome')}{' '}
      <button
        type="button"
        onClick={() => selectCategory?.(home.id)}
        disabled={selectCategory === null}
        style={{
          padding: 0,
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          color: token.colorPrimary,
          cursor: 'pointer',
        }}
        data-testid="mcp-tokens-home"
      >
        {resolveLabel(home, t)}
      </button>
    </div>
  );
};

const McpClientConfigRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const port = useSettingValue('backend.bindPort');
  const httpUrl = `http://127.0.0.1:${port}${MCP_HTTP_PATH}`;
  const binary = binaryPathForThisPlatform();
  const argsShell = stdioArgs(port).join(' ');

  const items = [
    {
      key: 'claude-desktop',
      label: 'Claude Desktop',
      children: (
        <SnippetBlock
          title={t('workbench.settings.mcpPane.snippet.claudeDesktopTitle')}
          body={mcpServersJson(port, 'mcpServers')}
        />
      ),
    },
    {
      key: 'claude-code',
      label: 'Claude Code',
      children: (
        <SnippetBlock
          title={t('workbench.settings.mcpPane.snippet.runOnceTitle')}
          body={`claude mcp add open-headers -- "${binary}" ${argsShell}`}
        />
      ),
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
          title={t('workbench.settings.mcpPane.snippet.cliTitle')}
          body={`npm install -g @openheaders/cli\noh connect --daemon http://127.0.0.1:${port} --token ${TOKEN_PLACEHOLDER}`}
        />
      ),
    },
    {
      key: 'http',
      label: 'HTTP',
      children: (
        <SnippetBlock
          title={t('workbench.settings.mcpPane.snippet.httpTitle')}
          body={`URL:    ${httpUrl}\nHeader: Authorization: Bearer ${TOKEN_PLACEHOLDER}`}
        />
      ),
    },
  ];

  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
    >
      <Tabs size="small" items={items} />
      <TokensHomeNote />
    </FieldRow>
  );
};

export default McpClientConfigRow;
