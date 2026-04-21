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
  DatabaseOutlined,
  DesktopOutlined,
  EditOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LayoutOutlined,
  SettingOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { registerCategory } from './registry';

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
  description: 'How workbench are evaluated, compiled, and arbitrated.',
});

registerCategory({
  id: 'recording',
  label: 'Recording',
  icon: <VideoCameraOutlined />,
  order: 55,
  description: 'Session recording, video capture, and hotkey bindings.',
});

registerCategory({
  id: 'desktopConnection',
  label: 'Desktop Connection',
  icon: <DesktopOutlined />,
  order: 70,
  description: 'WebSocket link to the Open Headers desktop app.',
});

registerCategory({
  id: 'keyboard',
  label: 'Keyboard',
  icon: <KeyOutlined />,
  order: 80,
  description: 'Customize keyboard shortcuts.',
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
