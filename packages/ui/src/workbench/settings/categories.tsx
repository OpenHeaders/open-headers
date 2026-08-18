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
  BranchesOutlined,
  CodeOutlined,
  BugOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  FunctionOutlined,
  FundViewOutlined,
  GlobalOutlined,
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
const GitWorkspacePane = lazy(() => import('./components/git-workspace-pane'));
const ProxyTrustPane = lazy(() => import('./components/proxy-trust-pane'));
const SystemProxyPane = lazy(() => import('./components/system-proxy-pane'));
const KeymapPane = lazy(() => import('./components/keymap/KeymapPane'));

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
  // Browser hosts keep the nav entry and render the desktop teaser.
  when: () => getCurrentHost() === 'desktop',
  teaserWhenUnavailable: 'mcp',
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
  id: 'terminal',
  labelKey: 'workbench.settings.category.terminal.label',
  icon: <CodeOutlined />,
  order: 17,
  descriptionKey: 'workbench.settings.category.terminal.description',
  // The Terminal tool window rides the `terminal` capability, which
  // only the desktop host installs. Browser hosts keep the nav entry
  // and render the desktop teaser.
  when: () => getCurrentHost() === 'desktop',
  teaserWhenUnavailable: 'terminal',
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
  id: 'trafficMonitor',
  labelKey: 'workbench.settings.category.trafficMonitor.label',
  icon: <FundViewOutlined />,
  order: 22,
  descriptionKey: 'workbench.settings.category.trafficMonitor.description',
  // Only the desktop host runs the Traffic Monitor tool window (the
  // `liveNetwork` capability); browser hosts keep the nav entry and
  // render the desktop teaser, same as the tool window itself.
  when: () => getCurrentHost() === 'desktop',
  teaserWhenUnavailable: 'liveNetwork',
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
  // One section per request type, so each protocol's knobs read as a
  // block instead of one interleaved list.
  subcategories: [
    { id: 'http', labelKey: 'workbench.settings.category.requests.sub.http', order: 10 },
    { id: 'sse', labelKey: 'workbench.settings.category.requests.sub.sse', order: 20 },
    { id: 'grpc', labelKey: 'workbench.settings.category.requests.sub.grpc', order: 30 },
    { id: 'websocket', labelKey: 'workbench.settings.category.requests.sub.websocket', order: 40 },
  ],
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
  renderPane: KeymapPane,
  subcategories: [
    { id: 'global', labelKey: 'workbench.settings.category.keyboard.sub.global', order: 5 },
    { id: 'workbench-general', labelKey: 'workbench.settings.category.keyboard.sub.workbench-general', order: 10 },
    { id: 'workbench-layout', labelKey: 'workbench.settings.category.keyboard.sub.workbench-layout', order: 20 },
    { id: 'workbench-tabs', labelKey: 'workbench.settings.category.keyboard.sub.workbench-tabs', order: 30 },
    { id: 'workbench-focus', labelKey: 'workbench.settings.category.keyboard.sub.workbench-focus', order: 40 },
    { id: 'workbench-editor', labelKey: 'workbench.settings.category.keyboard.sub.workbench-editor', order: 50 },
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
  id: 'git',
  labelKey: 'workbench.settings.category.git.label',
  icon: <BranchesOutlined />,
  order: 86,
  descriptionKey: 'workbench.settings.category.git.description',
  renderPane: GitWorkspacePane,
  // Only Node hosts have a filesystem to bind (the git-sync plan §12): the
  // desktop is Phase 2's host; the daemon's served web tab follows
  // with the admin console work, and the extension never qualifies.
  // Browser hosts keep the nav entry and render the desktop teaser.
  when: () => getCurrentHost() === 'desktop',
  teaserWhenUnavailable: 'git',
});

registerCategory({
  id: 'proxy',
  labelKey: 'workbench.settings.category.proxy.label',
  icon: <GlobalOutlined />,
  order: 87,
  descriptionKey: 'workbench.settings.category.proxy.description',
  renderPane: GroupLandingPane,
  // Group node over the two proxy planes — outbound egress and capture
  // trust share the word but nothing else, so each child carries its
  // own pane and its own host gate. Hosts where every child's gate
  // denies keep this nav entry and render the desktop teaser.
  when: ({ daemonAdmin }) => getCurrentHost() === 'desktop' || daemonAdmin === 'admin',
  teaserWhenUnavailable: 'proxy',
});

registerCategory({
  id: 'proxyOutbound',
  labelKey: 'workbench.settings.category.proxyOutbound.label',
  navLabelKey: 'workbench.settings.category.proxyOutbound.navLabel',
  parent: 'proxy',
  icon: <ExportOutlined />,
  order: 88,
  descriptionKey: 'workbench.settings.category.proxyOutbound.description',
  renderPane: SystemProxyPane,
  // The outbound plane is per-device state the Electron main process
  // serves (Chromium resolution seams) — only the desktop host has it.
  // A served web tab is not that device, so the entry simply hides.
  when: () => getCurrentHost() === 'desktop',
});

registerCategory({
  id: 'proxyTrust',
  labelKey: 'workbench.settings.category.proxyTrust.label',
  navLabelKey: 'workbench.settings.category.proxyTrust.navLabel',
  parent: 'proxy',
  icon: <SafetyCertificateOutlined />,
  order: 89,
  descriptionKey: 'workbench.settings.category.proxyTrust.description',
  renderPane: ProxyTrustPane,
  // The trust plane rides the daemon admin table: the desktop operator
  // administers their own spine; a served web tab shows it only to
  // subjects whose `daemon.admin` probe resolves. The extension never
  // reaches the daemon's trust RPCs — there the parent's teaser covers.
  when: ({ daemonAdmin }) => getCurrentHost() === 'desktop' || daemonAdmin === 'admin',
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
  id: 'updates',
  labelKey: 'workbench.settings.category.updates.label',
  icon: <DownloadOutlined />,
  order: 898,
  descriptionKey: 'workbench.settings.category.updates.description',
  // Only the desktop app self-updates: the store updates the extension
  // and a served web tab updates with the daemon behind it.
  when: () => getCurrentHost() === 'desktop',
});

registerCategory({
  id: 'about',
  labelKey: 'workbench.settings.category.about.label',
  icon: <InfoCircleOutlined />,
  order: 900,
  descriptionKey: 'workbench.settings.category.about.description',
});
