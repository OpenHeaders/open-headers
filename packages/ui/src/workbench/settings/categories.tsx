/**
 * Category registry for the settings shell.
 *
 * Each entry becomes one section in the left nav, in `order`. New
 * categories declare their icon here and their label/description as
 * `workbench.settings.category.*` catalog keys; schemas reference them
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
  SafetyCertificateOutlined,
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
const LicensePane = lazy(() => import('./components/license-pane'));

registerCategory({
  id: 'backend',
  labelKey: 'workbench.settings.category.backend.label',
  icon: <CloudServerOutlined />,
  order: 3,
  descriptionKey: 'workbench.settings.category.backend.description',
  renderPane: BackendPane,
  // Subsections are rendered by BackendPane as section cards beneath
  // the mode picker. The order here is what drives card sequencing.
  subcategories: [
    { id: 'connection', labelKey: 'workbench.settings.category.backend.sub.connection', order: 10 },
    { id: 'reliability', labelKey: 'workbench.settings.category.backend.sub.reliability', order: 20 },
    { id: 'notifications', labelKey: 'workbench.settings.category.backend.sub.notifications', order: 30 },
    { id: 'lan-peers', labelKey: 'workbench.settings.category.backend.sub.lan-peers', order: 40 },
  ],
});

registerCategory({
  id: 'mcp',
  labelKey: 'workbench.settings.category.mcp.label',
  icon: <RobotOutlined />,
  order: 4,
  descriptionKey: 'workbench.settings.category.mcp.description',
  renderPane: McpPane,
  // The desktop app is the only host that runs the MCP server; the
  // `when` is read at render time, after the host seam is installed.
  when: () => getCurrentHost() === 'desktop',
});

registerCategory({
  id: 'general',
  labelKey: 'workbench.settings.category.general.label',
  icon: <SettingOutlined />,
  order: 5,
  descriptionKey: 'workbench.settings.category.general.description',
});

registerCategory({
  id: 'appearance',
  labelKey: 'workbench.settings.category.appearance.label',
  icon: <BgColorsOutlined />,
  order: 10,
  descriptionKey: 'workbench.settings.category.appearance.description',
});

registerCategory({
  id: 'workspaceLayout',
  labelKey: 'workbench.settings.category.workspaceLayout.label',
  icon: <LayoutOutlined />,
  order: 15,
  descriptionKey: 'workbench.settings.category.workspaceLayout.description',
});

registerCategory({
  id: 'devpanel',
  labelKey: 'workbench.settings.category.devpanel.label',
  icon: <DevPanelGlyph />,
  order: 16,
  descriptionKey: 'workbench.settings.category.devpanel.description',
  renderPane: GroupLandingPane,
});

registerCategory({
  id: 'devpanelLayout',
  labelKey: 'workbench.settings.category.devpanelLayout.label',
  navLabelKey: 'workbench.settings.category.devpanelLayout.navLabel',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="L" />,
  order: 15,
  descriptionKey: 'workbench.settings.category.devpanelLayout.description',
});

registerCategory({
  id: 'devpanelNetwork',
  labelKey: 'workbench.settings.category.devpanelNetwork.label',
  navLabelKey: 'workbench.settings.category.devpanelNetwork.navLabel',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="N" />,
  order: 16,
  descriptionKey: 'workbench.settings.category.devpanelNetwork.description',
});

registerCategory({
  id: 'devpanelHeaders',
  labelKey: 'workbench.settings.category.devpanelHeaders.label',
  navLabelKey: 'workbench.settings.category.devpanelHeaders.navLabel',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="H" />,
  order: 17,
  descriptionKey: 'workbench.settings.category.devpanelHeaders.description',
});

registerCategory({
  id: 'devpanelInitiator',
  labelKey: 'workbench.settings.category.devpanelInitiator.label',
  navLabelKey: 'workbench.settings.category.devpanelInitiator.navLabel',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="I" />,
  order: 18,
  descriptionKey: 'workbench.settings.category.devpanelInitiator.description',
});

registerCategory({
  id: 'devpanelCookies',
  labelKey: 'workbench.settings.category.devpanelCookies.label',
  navLabelKey: 'workbench.settings.category.devpanelCookies.navLabel',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="C" />,
  order: 19,
  descriptionKey: 'workbench.settings.category.devpanelCookies.description',
});

registerCategory({
  id: 'devpanelTiming',
  labelKey: 'workbench.settings.category.devpanelTiming.label',
  navLabelKey: 'workbench.settings.category.devpanelTiming.navLabel',
  parent: 'devpanel',
  icon: <DevPanelGlyph letter="T" />,
  order: 20,
  descriptionKey: 'workbench.settings.category.devpanelTiming.description',
});

registerCategory({
  id: 'inspection',
  labelKey: 'workbench.settings.category.inspection.label',
  icon: <BugOutlined />,
  order: 21,
  descriptionKey: 'workbench.settings.category.inspection.description',
});

registerCategory({
  id: 'editor',
  labelKey: 'workbench.settings.category.editor.label',
  icon: <EditOutlined />,
  order: 20,
  descriptionKey: 'workbench.settings.category.editor.description',
});

registerCategory({
  id: 'requests',
  labelKey: 'workbench.settings.category.requests.label',
  icon: <ApiRequestsIcon />,
  order: 21,
  descriptionKey: 'workbench.settings.category.requests.description',
});

registerCategory({
  id: 'rulesEngine',
  labelKey: 'workbench.settings.category.rulesEngine.label',
  icon: <FunctionOutlined />,
  order: 30,
  descriptionKey: 'workbench.settings.category.rulesEngine.description',
});

registerCategory({
  id: 'keyboard',
  labelKey: 'workbench.settings.category.keyboard.label',
  icon: <KeyboardIcon />,
  order: 80,
  descriptionKey: 'workbench.settings.category.keyboard.description',
  subcategories: [
    { id: 'global', labelKey: 'workbench.settings.category.keyboard.sub.global', order: 5 },
    { id: 'workbench-general', labelKey: 'workbench.settings.category.keyboard.sub.workbench-general', order: 10 },
    { id: 'workbench-layout', labelKey: 'workbench.settings.category.keyboard.sub.workbench-layout', order: 20 },
    { id: 'workbench-tabs', labelKey: 'workbench.settings.category.keyboard.sub.workbench-tabs', order: 30 },
    { id: 'workbench-focus', labelKey: 'workbench.settings.category.keyboard.sub.workbench-focus', order: 40 },
    { id: 'popup-general', labelKey: 'workbench.settings.category.keyboard.sub.popup-general', order: 110 },
    { id: 'popup-navigation', labelKey: 'workbench.settings.category.keyboard.sub.popup-navigation', order: 120 },
    { id: 'popup-rows', labelKey: 'workbench.settings.category.keyboard.sub.popup-rows', order: 130 },
    { id: 'popup-tabs', labelKey: 'workbench.settings.category.keyboard.sub.popup-tabs', order: 140 },
  ],
});

registerCategory({
  id: 'workspaceSharing',
  labelKey: 'workbench.settings.category.workspaceSharing.label',
  icon: <CloudDownloadOutlined />,
  order: 85,
  descriptionKey: 'workbench.settings.category.workspaceSharing.description',
});

registerCategory({
  id: 'data',
  labelKey: 'workbench.settings.category.data.label',
  icon: <DatabaseOutlined />,
  order: 90,
  descriptionKey: 'workbench.settings.category.data.description',
});

registerCategory({
  id: 'license',
  labelKey: 'workbench.settings.category.license.label',
  icon: <SafetyCertificateOutlined />,
  order: 895,
  descriptionKey: 'workbench.settings.category.license.description',
  renderPane: LicensePane,
  // License state is an admin surface: the desktop operator always
  // administers their own spine, while a served web tab shows it only
  // to subjects whose `daemon.admin` probe resolves — seat users see
  // nothing. The extension carries no license plumbing and its probe
  // reads denied.
  when: ({ daemonAdmin }) => getCurrentHost() === 'desktop' || daemonAdmin === 'admin',
});

registerCategory({
  id: 'about',
  labelKey: 'workbench.settings.category.about.label',
  icon: <InfoCircleOutlined />,
  order: 900,
  descriptionKey: 'workbench.settings.category.about.description',
});
