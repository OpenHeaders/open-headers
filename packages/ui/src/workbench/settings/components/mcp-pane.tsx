/**
 * McpPane — right-pane renderer for the MCP category (desktop only).
 * Three sections, in trust order:
 *
 *   1. The switches — master toggle plus the write / execute / secrets
 *      tiers, all default-off and applied live (the server re-reads
 *      them per request; no restart, no rebind).
 *   2. Access tokens — the same paired-devices ledger the daemon uses
 *      for every connection; MCP clients authenticate with the same
 *      tokens, so mint/rotate/revoke here governs both surfaces.
 *   3. Client config snippets for the stdio bridge and the raw HTTP
 *      endpoint.
 */

import { Alert, theme } from 'antd';
import type React from 'react';
import SettingRow from '../fields/SettingRow';
import { useSettingValue } from '../hooks';
import type { CategoryPaneProps } from '../types';
import DaemonTokensSection from './daemon-tokens-section';
import McpConfigSnippets from './mcp-config-snippets';

const McpPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const enabled = useSettingValue('mcp.enabled');

  return (
    <div style={{ padding: '14px 18px 20px', maxWidth: 760 }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.label}
        </h2>
        {category.description && (
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>{category.description}</p>
        )}
      </header>

      {!enabled && (
        <Alert
          type="info"
          showIcon
          message={<span style={{ fontSize: 12 }}>The MCP server is off — clients can’t connect until you enable it.</span>}
          style={{ marginBottom: 12 }}
        />
      )}

      <section style={{ marginBottom: 14 }}>
        <div className="settings-card">
          {defs.map((def) => (
            <SettingRow key={def.key} def={def} />
          ))}
        </div>
      </section>

      <DaemonTokensSection />

      <McpConfigSnippets />
    </div>
  );
};

export default McpPane;
