/**
 * Category registry for the settings shell.
 *
 * Each entry becomes one section in the left nav, in `order`. New
 * categories declare their icon and label here; schemas reference them
 * by id. Subcategories are optional one-level-deep groupings rendered
 * as sub-headings inside a section.
 */

import {
  BgColorsOutlined,
  BugOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  EditOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  LayoutOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { ApiRequestsIcon, KeyboardIcon } from '@openheaders/ui/shared/icons';
import { lazy } from 'react';
import { getCurrentHost } from '../../shared/host-vocabulary';
import DevPanelGlyph from './components/DevPanelGlyph';
import GroupLandingPane from './components/GroupLandingPane';
import { registerCategory } from './registry';

// Lazy so the schema-bootstrap path stays free of Monaco / Ant Design
// component code at module-load time. Importing BackendPane eagerly
// here would pull `SettingRow` → `CodeField` → monaco/bootstrap.ts into
// every test that touches the settings registry, breaking jsdom-based
// suites on `document.queryCommandSupported`.
const BackendPane = lazy(() => import('./components/BackendPane'));
const McpPane = lazy(() => import('./components/mcp-pane'));

registerCategory({
  id: 'backend',
  label: 'Backend',
  icon: <CloudServerOutlined />,
  order: 3,
  description:
    'Where your workspaces, rules, vault, and history live. Pick the host that matches your reach — local-only either way.',
  renderPane: BackendPane,
  // Subsections are rendered by BackendPane as section cards beneath
  // the mode picker. The order here is what drives card sequencing.
  subcategories: [
    { id: 'connection', label: 'Connection', order: 10 },
    { id: 'reliability', label: 'Reliability', order: 20 },
    { id: 'notifications', label: 'Notifications', order: 30 },
    { id: 'lan-peers', label: 'LAN peers', order: 40 },
  ],
});

registerCategory({
  id: 'mcp',
  label: 'MCP',
  icon: <RobotOutlined />,
  order: 4,
  description:
    'Let AI agents and other MCP clients read and control this app. Access is tiered — reading, writing, executing, and secret reveal are separate switches, all off by default.',
  renderPane: McpPane,
  // The desktop app is the only host that runs the MCP server; the
  // `when` is read at render time, after the host seam is installed.
  when: () => getCurrentHost() === 'desktop',
});

registerCategory({
  id: 'general',
  label: 'General',
  icon: <SettingOutlined />,
  order: 5,
  description: 'App-wide behavior, startup, and locale.',
});

registerCategory({
  id: 'appearance',
  label: 'Appearance',
  icon: <BgColorsOutlined />,
  order: 10,
  description: 'Theme, density and visual presentation.',
});

registerCategory({
  id: 'workspaceLayout',
  label: 'Workspace Layout',
  icon: <LayoutOutlined />,
  order: 15,
  description: 'Footer affordances and tool-window shell behavior.',
});

registerCategory({
  id: 'devpanel',
  label: 'DevTools Panel',
  icon: <DevPanelGlyph />,
  order: 16,
  description:
    'Defaults for the browser DevTools panel — the tool-window shell and each tab of the requests surface.',
  renderPane: GroupLandingPane,
});

registerCategory({
  id: 'devpanelLayout',
  label: 'DevTools Panel · Layout',
  navLabel: 'Layout',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="L" />,
  order: 15,
  description: 'Tool-window shell behavior for the browser DevTools panel.',
});

registerCategory({
  id: 'devpanelNetwork',
  label: 'DevTools Panel · Network',
  navLabel: 'Network',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="N" />,
  order: 16,
  description: 'Defaults for the Network requests table in the DevTools panel — layout, sort, dot column.',
});

registerCategory({
  id: 'devpanelHeaders',
  label: 'DevTools Panel · Headers',
  navLabel: 'Headers',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="H" />,
  order: 17,
  description: 'Defaults for the Headers tab in the DevTools panel — layout, sort, filters, suggestions.',
});

registerCategory({
  id: 'devpanelInitiator',
  label: 'DevTools Panel · Initiator',
  navLabel: 'Initiator',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="I" />,
  order: 18,
  description: 'Defaults for the Initiator tab in the DevTools panel — sort, filters, suggestions.',
});

registerCategory({
  id: 'devpanelCookies',
  label: 'DevTools Panel · Cookies',
  navLabel: 'Cookies',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="C" />,
  order: 19,
  description: 'Defaults for the Cookies tab in the DevTools panel — columns, sort, filters, suggestions.',
});

registerCategory({
  id: 'devpanelTiming',
  label: 'DevTools Panel · Timing',
  navLabel: 'Timing',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="T" />,
  order: 20,
  description: 'Defaults for the Timing tab in the DevTools panel — which bands are visible.',
});

registerCategory({
  id: 'inspection',
  label: 'Debug mode',
  icon: <BugOutlined />,
  order: 21,
  description:
    'The opt-in path that attaches your browser’s debugging protocol — inspect and modify requests with the same depth as the built-in developer tools.',
});

registerCategory({
  id: 'editor',
  label: 'Code Editor',
  icon: <EditOutlined />,
  order: 20,
  description: 'Font, indentation, and view options for code editing surfaces.',
});

registerCategory({
  id: 'requests',
  label: 'API Requests',
  icon: <ApiRequestsIcon />,
  order: 21,
  description: 'HTTP request sending and response handling.',
});

registerCategory({
  id: 'rulesEngine',
  label: 'Rules Engine',
  icon: <FunctionOutlined />,
  order: 30,
  description: 'How rules are evaluated, compiled, and arbitrated.',
});

registerCategory({
  id: 'keyboard',
  label: 'Keyboard',
  icon: <KeyboardIcon />,
  order: 80,
  description: 'Customize keyboard shortcuts.',
  subcategories: [
    { id: 'global', label: 'All Surfaces', order: 5 },
    { id: 'workbench-general', label: 'Workbench', order: 10 },
    { id: 'workbench-layout', label: 'Workbench · Layout', order: 20 },
    { id: 'workbench-tabs', label: 'Workbench · Tabs', order: 30 },
    { id: 'workbench-focus', label: 'Workbench · Focus', order: 40 },
    { id: 'popup-general', label: 'Popup & Side Panel', order: 110 },
    { id: 'popup-navigation', label: 'Popup & Side Panel · Navigation', order: 120 },
    { id: 'popup-rows', label: 'Popup & Side Panel · Row Actions', order: 130 },
    { id: 'popup-tabs', label: 'Popup & Side Panel · Tabs', order: 140 },
  ],
});

registerCategory({
  id: 'workspaceSharing',
  label: 'Workspace Sharing',
  icon: <CloudDownloadOutlined />,
  order: 85,
  description: 'Display preferences for the workspace-export import preview.',
});

registerCategory({
  id: 'data',
  label: 'Data',
  icon: <DatabaseOutlined />,
  order: 90,
  description: 'Diagnostics, import/export, and destructive maintenance.',
});

registerCategory({
  id: 'about',
  label: 'About',
  icon: <InfoCircleOutlined />,
  order: 900,
  description: 'Version, licenses and build information.',
});
