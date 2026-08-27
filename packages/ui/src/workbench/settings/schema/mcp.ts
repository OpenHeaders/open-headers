/**
 * MCP category — the agent-control surface. The desktop app can answer
 * MCP (Model Context Protocol) clients on its daemon port, exposing the
 * same workspaces every other surface sees. Access is tiered: reading
 * is the floor once the server is on; writing, executing, and secret
 * reveal are separate opt-ins, all default-off.
 *
 * These keys live in user settings and are read live by the server —
 * flipping a switch applies to the next request, no restart. The
 * desktop host is the only one that runs the server, so every row is
 * host-gated; the rows live on the AI · MCP Server › Access page
 * (`mcpAccess` in `../categories.tsx`, desktop-only).
 */

import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import CliAccessRow from '../components/cli-access-row';
import McpClientConfigRow from '../components/mcp-client-config-row';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'mcp.enabled': boolean;
    'mcp.allowObserve': boolean;
    'mcp.allowWrite': boolean;
    'mcp.allowExecute': boolean;
    'mcp.allowSecrets': boolean;
    'mcp.cliAccess': string;
    'mcp.clientConfig': string;
  }
}

const desktopOnly = (): boolean => getCurrentHost() === 'desktop';

registerSetting({
  key: 'mcp.enabled',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.mcp.enabled.label',
  descriptionKey: 'workbench.settings.def.mcp.enabled.description',
  category: 'mcpAccess',
  subcategory: 'server',
  tags: ['mcp', 'agent', 'ai', 'server', 'model', 'context', 'protocol'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'mcp.allowObserve',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.mcp.allowObserve.label',
  descriptionKey: 'workbench.settings.def.mcp.allowObserve.description',
  category: 'mcpAccess',
  subcategory: 'permissions',
  tags: ['mcp', 'observe', 'traffic', 'network', 'agent', 'redaction'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'mcp.allowWrite',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.mcp.allowWrite.label',
  descriptionKey: 'workbench.settings.def.mcp.allowWrite.description',
  category: 'mcpAccess',
  subcategory: 'permissions',
  tags: ['mcp', 'write', 'mutate', 'create', 'edit', 'delete'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'mcp.allowExecute',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.mcp.allowExecute.label',
  descriptionKey: 'workbench.settings.def.mcp.allowExecute.description',
  category: 'mcpAccess',
  subcategory: 'permissions',
  tags: ['mcp', 'execute', 'send', 'run', 'request', 'workflow'],
  scope: 'user',
  when: desktopOnly,
});

registerSetting({
  key: 'mcp.allowSecrets',
  type: 'boolean',
  default: false,
  schema: v.boolean(),
  labelKey: 'workbench.settings.def.mcp.allowSecrets.label',
  descriptionKey: 'workbench.settings.def.mcp.allowSecrets.description',
  category: 'mcpAccess',
  subcategory: 'permissions',
  tags: ['mcp', 'secret', 'vault', 'reveal', 'mask'],
  scope: 'user',
  when: desktopOnly,
});

// The Clients page: non-schema blocks ride `info` defs with a custom
// editor (the `about.openSource` idiom) so they take the page's
// section headers and row chrome. The CLI provisioning row and the
// client config snippets are readouts, not values — nothing to reset.
registerSetting({
  key: 'mcp.cliAccess',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.cliAccess.sectionTitle',
  descriptionKey: 'workbench.settings.cliAccess.sectionBlurb',
  category: 'mcpClients',
  subcategory: 'command-line',
  tags: ['mcp', 'cli', 'oh', 'terminal', 'provision', 'token'],
  scope: 'user',
  when: desktopOnly,
  customEditor: CliAccessRow,
});

registerSetting({
  key: 'mcp.clientConfig',
  type: 'info',
  default: '',
  schema: v.string(),
  labelKey: 'workbench.settings.mcpPane.connect.title',
  descriptionKey: 'workbench.settings.mcpPane.connect.blurb',
  category: 'mcpClients',
  subcategory: 'configuration',
  tags: ['mcp', 'client', 'config', 'snippet', 'stdio', 'http', 'claude', 'cursor', 'vscode'],
  scope: 'user',
  when: desktopOnly,
  customEditor: McpClientConfigRow,
});
