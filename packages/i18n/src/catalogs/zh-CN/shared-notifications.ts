/**
 * Shared notifications family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key; see that file for
 * the family rules (store copy is captured at push time — timeline
 * entries keep the locale they were pushed under). Mints: 时间线 =
 * timeline; 钥匙串 = keychain (macOS, Apple zh-CN vocabulary); 密钥环 =
 * keyring (Linux); 凭据存储 = credential store; 更新 = update; GitHub /
 * OAuth raw; ellipsis-suffixed menu-style actions keep en's `…`.
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': '通知',
  'shared.notifications.info.summary':
    '关于你的设置的建议，以及应用事件的会话时间线——更新可用性、后台任务结果和其他通知，都收集在这里，而不会打断你的工作。',
  'shared.notifications.suggestionsHeading': '建议',
  'shared.notifications.timelineHeading': '时间线',
  'shared.notifications.clearAll': '全部清除',
  'shared.notifications.suggestionsEmpty': '暂无建议——关于你的设置的建议会显示在这里。',
  'shared.notifications.timelineEmpty': '暂无通知——应用事件和更新会显示在这里。',
  'shared.notifications.dismiss': '忽略',
  'shared.notifications.moreActions': '更多操作',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': '不再显示',
  'shared.notifications.muted.title': '通知已禁用',
  'shared.notifications.muted.description': '“{title}”将不再显示。',
  'shared.notifications.muted.reEnable': '重新启用',
  'shared.notifications.muted.reEnableTooltip': '允许此通知再次显示',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': '探索 Open Headers',
  'shared.notifications.seed.website.description': '交互式了解我们的全部功能，以及最新更新。',
  'shared.notifications.seed.website.action': '访问我们的网站',
  'shared.notifications.seed.website.tooltip': '打开网站并清除通知',
  'shared.notifications.seed.star.title': '帮助我们成长',
  'shared.notifications.seed.star.description': '把我们推荐给你的朋友和同事',
  'shared.notifications.seed.star.action': '在 GitHub 上给我们一颗星',
  'shared.notifications.seed.star.tooltip': '打开 GitHub 并清除通知',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': 'Open Headers {version} 可用',
  'shared.notifications.appUpdate.securityTitle': 'Open Headers {version} 安全更新可用',
  'shared.notifications.appUpdate.securityDescription': '此版本修复了一个影响你当前所用版本的安全问题。请尽快更新。',
  'shared.notifications.appUpdate.download': '下载…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': '设置…',
  'shared.notifications.toast.dontShowAgain': '不再显示',
  'shared.notifications.toast.optionsTooltip': '关闭或更改行为',
  'shared.notifications.toast.optionsAria': '更新通知选项',
  'shared.notifications.toast.close': '关闭',
  'shared.notifications.toast.upToDateTitle': '已是最新版本',
  'shared.notifications.toast.upToDateDescription': 'Open Headers {version} 已是最新版本。',
  'shared.notifications.toast.checkFailed': '更新检查失败',
  'shared.notifications.toast.downloadFailed': '更新下载失败',
  'shared.notifications.toast.available': 'Open Headers {version} 可用',
  'shared.notifications.toast.update': '更新…',
  'shared.notifications.toast.downloading': '正在下载 Open Headers {version}…',
  'shared.notifications.toast.readyToInstall': 'Open Headers {version} 已就绪，可以安装',
  'shared.notifications.toast.restartToInstall': '重启以安装',
  'shared.notifications.toast.updatedTo': '已更新到 Open Headers {version}',
  'shared.notifications.toast.seeWhatsNew': '查看新功能',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    'Open Headers {availableVersion} 修复了一个影响你当前所用版本（{currentVersion}）的安全问题。请尽快更新。',
  'shared.notifications.securityBanner.messageNoVersion':
    '已发布针对你当前所用版本（{currentVersion}）的安全修复。请尽快更新。',
  'shared.notifications.securityBanner.update': '更新…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': '机密存储已锁定',
  'shared.notifications.secrets.description': '本次会话无法读取或保存 Vault 机密和 OAuth token。{remedy}',
  'shared.notifications.secrets.relaunch': '重新启动应用',
  'shared.notifications.secrets.remedy.darwin':
    'Open Headers 被拒绝访问系统钥匙串。请重新启动应用，并在提示时允许钥匙串访问。',
  'shared.notifications.secrets.remedy.linux':
    '没有可用的密钥环后端。请设置一个（GNOME Keyring 或 KWallet），然后重新启动应用。',
  'shared.notifications.secrets.remedy.other': 'Open Headers 无法访问系统凭据存储。请重新启动应用重试。',
} as const satisfies Catalog;
