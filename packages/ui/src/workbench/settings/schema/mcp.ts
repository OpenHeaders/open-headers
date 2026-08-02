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
 * host-gated; the category itself is registered desktop-only in
 * `../categories.tsx`.
 */

import * as v from 'valibot';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { registerSetting } from '../registry';

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'mcp.enabled': boolean;
    'mcp.allowObserve': boolean;
    'mcp.allowWrite': boolean;
    'mcp.allowExecute': boolean;
    'mcp.allowSecrets': boolean;
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
  category: 'mcp',
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
  category: 'mcp',
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
  category: 'mcp',
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
  category: 'mcp',
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
  category: 'mcp',
  tags: ['mcp', 'secret', 'vault', 'reveal', 'mask'],
  scope: 'user',
  when: desktopOnly,
});
