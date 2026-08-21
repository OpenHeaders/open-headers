/**
 * Desktop namespace — Simplified Chinese. Mirrors `catalogs/en/desktop.ts`
 * key for key; role-bound menu items keep Electron's own labels and the
 * 'Open Headers' brand rides raw inside the values. Menu vocabulary
 * follows zh-CN platform convention (文件 / 编辑 / 查看 / 窗口 / 帮助;
 * 新建 for New); Settings = 设置 (register contract). File mints:
 * 硬件加速 = hardware acceleration (启用/停用 pair); 标签页 carried for
 * Tab; 更新 = Update noun.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': '打开 Open Headers',
  'desktop.tray.quit': '退出',
  'desktop.menu.settings': '设置…',
  'desktop.menu.about': '关于 {name}',
  'desktop.menu.enableHardwareAcceleration': '启用硬件加速',
  'desktop.menu.disableHardwareAcceleration': '停用硬件加速',
  'desktop.menu.file': '文件',
  'desktop.menu.edit': '编辑',
  'desktop.menu.view': '查看',
  'desktop.menu.window': '窗口',
  'desktop.menu.help': '帮助',
  'desktop.menu.newItem': '新建…',
  'desktop.menu.newTab': '新建标签页',
  'desktop.menu.newWindow': '新建窗口',
  'desktop.menu.import': '导入…',
  'desktop.menu.closeTab': '关闭标签页',
  'desktop.menu.nextTab': '下一个标签页',
  'desktop.menu.previousTab': '上一个标签页',
  'desktop.menu.actualSize': '实际大小',
  'desktop.menu.documentation': '文档',
  'desktop.menu.reportIssue': '报告问题',
  'desktop.menu.licenseAgreement': '许可协议',
  'desktop.update.check': '检查更新…',
  'desktop.update.checking': '正在检查更新…',
  'desktop.update.updateAndRestart': '更新到 {version} 并重启',
  'desktop.update.availableExternal': '版本 {version} 可用…',
  'desktop.update.downloading': '正在下载更新… {percent}%',
  'desktop.update.downloadingNoProgress': '正在下载更新…',
  'desktop.update.restartToInstall': '重新启动以安装 {version}',
  'desktop.dialog.hardwareAcceleration.title': '硬件加速',
  'desktop.dialog.hardwareAcceleration.willBeDisabled': '下次启动 {name} 时将停用硬件加速。',
  'desktop.dialog.hardwareAcceleration.willBeEnabled': '下次启动 {name} 时将启用硬件加速。',
  'desktop.dialog.hardwareAcceleration.detail': '现在重新启动可立即应用更改。',
  'desktop.dialog.hardwareAcceleration.restartNow': '立即重新启动',
  'desktop.dialog.hardwareAcceleration.later': '稍后',
  'desktop.firstRunLegal.message': '继续使用 Open Headers，即表示你同意我们的许可条款和隐私政策。',
  'desktop.firstRunLegal.license': '许可条款',
  'desktop.firstRunLegal.privacy': '隐私政策',
  'desktop.firstRunLegal.acknowledge': '知道了',
} as const satisfies Catalog;
