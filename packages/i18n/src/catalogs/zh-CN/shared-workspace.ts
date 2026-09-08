/**
 * Workspace-org family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-workspace.ts` key for key; Org names (raw noun —
 * 此 Org), workspace names, backend labels/URLs, LAN/WAN and the →
 * glyph stay raw. Mints: 通过 = via / over; ACTIVE tag = 活动; 活动
 * 工作区 = active workspace; 规则引擎 = rule engine; 局域网（LAN）/
 * 互联网（WAN）keep the raw acronym parenthetical; "Lands on" = 会落在;
 * places: 此电脑 = this computer, 桌面应用 = desktop app, 服务器 =
 * server; the entry row mirrors the settings root mint 备份与同步.
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': '此浏览器',
  'shared.org.hint.desktop': '此电脑',
  'shared.org.hint.serverLocal': '本地服务器',
  'shared.org.hint.serverRemote': '远程服务器',

  // ── Org places — what a joined Org's group header reads as ─────────
  'shared.org.place.desktopApp': '此电脑 · 桌面应用',
  'shared.org.place.desktopAppNamed': '{name} · 桌面应用',
  'shared.org.place.server': '{name} · 服务器',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': '不再同步',
  'shared.org.sync.off': '通过 {label}——已关闭，不同步',
  'shared.org.sync.connecting': '通过 {label}——连接中…',
  'shared.org.sync.synced': '通过 {label}',
  'shared.org.sync.repair': '通过 {label}——需要重新配对',
  'shared.org.sync.disconnected': '通过 {label}——已断开连接',
  'shared.org.sync.orphaned': '连接已移除——本地副本',

  // ── Org states beside a place (the switcher headers name the place) ─
  'shared.org.state.off': '已关闭，不同步',
  'shared.org.state.repair': '需要重新配对',
  'shared.org.state.disconnected': '已断开连接',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser': '保留在此设备上的此浏览器内。绝不同步到任何地方。',
  'shared.org.scope.local.desktopClient': '保留在此设备上的桌面应用内。绝不同步到任何地方。',
  'shared.org.scope.local.desktopLan': '保留在你的设备上。通过局域网（LAN）同步。',
  'shared.org.scope.local.desktopLoopback': '保留在此设备上——在桌面应用与已连接的浏览器之间同步。',
  'shared.org.scope.local.serverLan': '共享在此服务器上。通过局域网（LAN）同步。',
  'shared.org.scope.local.serverWan': '共享在此服务器上。通过互联网（WAN）同步。',
  'shared.org.scope.local.serverLoopback': '存放在此服务器上——只有本机可以连接。',
  'shared.org.scope.local.generic': '保留在此设备上。',
  'shared.org.scope.personal.desktop': '保留在此设备上——在此浏览器与桌面应用之间同步。',
  'shared.org.scope.personal.serverWan': '通过互联网（WAN）与你的服务器同步。',
  'shared.org.scope.personal.serverLan': '通过局域网（LAN）与你的服务器同步。',
  'shared.org.scope.personal.generic': '在你的设备之间同步。',
  'shared.org.scope.team.wan': '通过互联网（WAN）与团队共享。',
  'shared.org.scope.team.lan': '通过局域网（LAN）与团队共享。',
  'shared.org.scope.team.generic': '与此团队的所有成员共享。',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': '搜索工作区…',
  'shared.workspaceDropdown.noMatch': '没有匹配的工作区。',
  'shared.workspaceDropdown.empty': '还没有工作区。',
  'shared.workspaceDropdown.activeTag': '活动',
  'shared.workspaceDropdown.activePopoverTitle': '活动工作区',
  'shared.workspaceDropdown.activePopoverBody':
    '规则引擎正在注入此工作区的 http 规则以更改实时流量。每个浏览器同一时间只能有一个活动工作区。',
  'shared.workspaceDropdown.setActiveTooltip': '设为活动',
  'shared.workspaceDropdown.checkActiveTooltip': '活动工作区',
  'shared.workspaceDropdown.makeActiveAria': '将“{name}”设为活动工作区',
  'shared.workspaceDropdown.orphanedOrgHeader': '不再同步',
  'shared.workspaceDropdown.activeFooterLabel': '活动：',
  'shared.workspaceDropdown.export': '导出',
  'shared.workspaceDropdown.import': '导入',
  'shared.workspaceDropdown.manage': '管理工作区',

  // ── The one entry row into Backup and Sync (the plan D2) ────────────
  'shared.workspaceDropdown.backupAndSync': '备份与同步…',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': '切换到 {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': '切换到 {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed': '会落在“{name}”，因为它是你在此 Org 中最近使用的工作区。',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault': '会落在“{name}”，因为它是此 Org 的默认工作区。',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst': '会落在“{name}”，因为它是此 Org 的第一个工作区。',
} as const satisfies Catalog;
