/**
 * Category registry for the settings shell.
 *
 * Each entry becomes one section in the left nav, in `order`. New
 * categories declare their icon and label here; schemas reference them
 * by id. Subcategories are optional one-level-deep groupings rendered
 * as sub-headings inside a section.
 */

import {
  ApiOutlined,
  BgColorsOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  EditOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LayoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { lazy } from 'react';
import { registerCategory } from './registry';

// Lazy so the schema-bootstrap path stays free of Monaco / Ant Design
// component code at module-load time. Importing BackendPane eagerly
// here would pull `SettingRow` → `CodeField` → monaco/bootstrap.ts into
// every test that touches the settings registry, breaking jsdom-based
// suites on `document.queryCommandSupported`.
const BackendPane = lazy(() => import('./components/BackendPane'));

registerCategory({
  id: 'general',
  label: 'General',
  icon: <SettingOutlined />,
  order: 5,
  description: 'App-wide behavior, startup, and locale.',
});

registerCategory({
  id: 'backend',
  label: 'Backend',
  icon: <CloudServerOutlined />,
  order: 7,
  description:
    'Where your workspaces, rules, vault, and history live. Pick the host that matches your reach — local-only either way.',
  renderPane: BackendPane,
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
  id: 'devpanelLayout',
  label: 'DevTools Panel Layout',
  icon: <ApiOutlined />,
  order: 16,
  description: 'Tool-window shell behavior for the browser DevTools panel.',
});

registerCategory({
  id: 'editor',
  label: 'Code Editor',
  icon: <EditOutlined />,
  order: 20,
  description: 'Font, indentation, and view options for code editing surfaces.',
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
  icon: <KeyOutlined />,
  order: 80,
  description: 'Customize keyboard shortcuts.',
  subcategories: [
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
  description:
    'Trust controls for workspace exports — allowlisted hosts the URL-fetch import source may retrieve from.',
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
