/**
 * TUI namespace — the `oh tui` terminal dashboard — Simplified Chinese.
 * Mirrors `catalogs/en/tui.ts` key for key. Data stays data: workspace /
 * environment / rule names, uids, URLs, kinds, and daemon-provided copy
 * render verbatim; `env`, `uid`, `vars`, `{seconds}s` and the
 * `oh status` command ride raw (de/es precedent). daemon = 守护进程 per
 * the shared mint ledger. File mints: 仪表盘 = dashboard; 启停 = toggle
 * (terse footer/palette verb — 切换 stays switch per the referent-split
 * law); 遮罩 = masked; footer verbs terse two-character forms. The park
 * screen's double space before `oh status` is layout — keep it.
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: 无',
  'tui.header.connected': '已连接',
  'tui.header.unreachable': '守护进程不可达',
  'tui.header.synced': '{ago} 前已同步',
  'tui.header.syncedJustNow': '刚刚已同步',
  'tui.header.syncing': '正在同步…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': '工作区',
  'tui.pane.environments': '环境',
  'tui.pane.rules': '规则',
  'tui.pane.rules.summary': '{on} 开 {sep} {off} 关 {sep} {draft} 草稿',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': '开',
  'tui.row.off': '关',
  'tui.row.draft': '（草稿）',
  'tui.row.notLoaded': '未加载',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': '无环境',
  'tui.row.masked': '（已遮罩）',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': '移动',
  'tui.footer.open': '打开',
  'tui.footer.filter': '筛选',
  'tui.footer.refresh': '刷新',
  'tui.footer.yank': '复制 uid',
  'tui.footer.quit': '退出',
  'tui.footer.back': '返回',
  'tui.footer.scroll': '滚动',
  'tui.footer.retryNow': '立即重试',
  'tui.footer.palette': '命令面板',
  'tui.footer.help': '帮助',
  'tui.footer.toggle': '启停',
  'tui.footer.publish': '发布',
  'tui.footer.switch': '切换',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': '键盘',
  'tui.help.group.navigate': '导航',
  'tui.help.group.act': '操作',
  'tui.help.group.find': '查找',
  'tui.help.group.session': '会话',
  'tui.help.topBottom': '顶部 / 底部',
  'tui.help.page': '翻页',
  'tui.help.focusPane': '聚焦窗格',
  'tui.help.backClear': '返回 / 清除',
  'tui.help.filterPane': '筛选窗格',
  'tui.help.thisHelp': '本帮助',
  'tui.help.palette': '命令面板',
  'tui.help.openSwitch': '打开 / 切换',
  'tui.help.toggleRule': '启停规则',
  'tui.help.publish': '发布/取消发布',
  'tui.help.note': '在终端允许的范围内，与应用中的按键相同。',
  'tui.help.close': '关闭',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': '立即刷新',
  'tui.palette.action.help': '打开帮助',
  'tui.palette.action.switchWorkspace': '切换工作区…',
  'tui.palette.action.switchEnvironment': '切换环境…',
  'tui.palette.action.toggleRule': '启停规则',
  'tui.palette.action.publishRule': '发布 / 取消发布规则',
  'tui.palette.picker.workspace': '切换工作区',
  'tui.palette.picker.environment': '切换环境',
  'tui.palette.empty': '没有匹配的命令',
  'tui.palette.run': '运行',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': '筛选：/{query} {sep} {count} 个匹配',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid 已复制到剪贴板',
  'tui.notice.staleData': '正在显示最后已知数据——正在重新连接…',
  'tui.notice.writeLost': '更改未应用——守护进程不可达',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': '此工作区还没有规则。',
  'tui.empty.rules.body': '规则在 OpenHeaders 应用中创建——它们一旦存在，仪表盘就会读取。按 r 刷新。',
  'tui.empty.environments.title': '此工作区还没有环境。',
  'tui.empty.environments.body': '环境在 OpenHeaders 应用中创建。在此期间“无环境”仍可选择。',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': '规则：{name}',
  'tui.detail.state': '状态',
  'tui.detail.type': '类型',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': '已发布——在已连接的浏览器扩展中生效',
  'tui.detail.state.draft': '草稿——不影响实际流量',
  'tui.detail.editingNote': '编辑在 OpenHeaders 应用中进行——TUI 只读取和启停。',
  'tui.detail.loading': '正在加载…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': '环境：{name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': '守护进程不可达或 MCP 已禁用',
  'tui.park.body1': '无法连接位于以下地址的 OpenHeaders 守护进程：',
  'tui.park.body2': '{url}，或者其 MCP 界面已关闭。',
  'tui.park.hint1': '启动 OpenHeaders 应用（或你的守护进程主机），',
  'tui.park.hint2': '或用以下命令探测该界面：  oh status',
  'tui.park.hint3': '然后按 r 重试。',
  'tui.park.retryIn': '正在自动重试 {sep} {seconds}s 后再次尝试',
  'tui.park.retrying': '正在重试…',
} as const satisfies Catalog;
