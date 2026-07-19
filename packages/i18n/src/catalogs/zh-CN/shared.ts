/**
 * Shared namespace — Simplified Chinese. Mirrors `catalogs/en/shared.ts`
 * key for key; see that file for the namespace rules. Register contract
 * for the zh-CN catalogs (pattern-setter): plain 你 (never 您), verb-first
 * imperatives without the pronoun; full-width punctuation ，。；：？！（）
 * in prose with the aside dash rendered as the 破折号 ——（no surrounding
 * spaces）; half-width punctuation stays inside code/wire fragments and
 * raw tokens; a half-width space separates Latin/digit tokens from CJK
 * text; UI labels quoted in prose use “”; en's unspaced `{percent}%`
 * figure style kept. Plurals are `other`-only (CLDR zh); measure words
 * mint per noun — 条 for rules. Dev nouns retain English liberally: the
 * glossary raw-token laws carry over unchanged (WebSocket, URL, token
 * lowercase raw). Mints: 工作区 = workspace; 后端 = back-end; 握手 =
 * handshake; 配对 = pair; 切换 = Switch; 设置 = Settings; 弹窗 = popup;
 * 探测 = probe.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': '保存',
  'shared.action.cancel': '取消',
  'shared.action.close': '关闭',
  'shared.action.copy': '复制',
  'shared.action.remove': '移除',
  'shared.toast.copiedToClipboard': '已复制到剪贴板',
  'shared.toast.copyFailed': '剪贴板访问被拒绝——请手动复制该值',
  'shared.count.rules': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 条规则' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': '出了点问题',
  'shared.errorBoundary.subtitle': '加载弹窗时出错。请关闭后重新打开。',
  'shared.errorBoundary.reload': '重新加载',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': '连接正常',
  'shared.probe.reachableDescription': '{label} 可访问。',
  'shared.probe.notReachable': '不可访问',
  'shared.probe.title.authRequired': '可访问，但需要身份验证',
  'shared.probe.title.workspaceUnknown': '可访问，但工作区未共享',
  'shared.probe.title.versionMismatch': '可访问，但版本不匹配',
  'shared.probe.title.notReady': '可访问，但尚未就绪',
  'shared.probe.fail.invalidUrl': 'URL 无效。',
  'shared.probe.fail.invalidUrlDetail': 'URL 无效。{detail}',
  'shared.probe.fail.timeout': '等待响应超时——后端在运行吗？',
  'shared.probe.fail.closedBeforeWelcome': '连接在握手之前就被关闭——后端可能没有在该端口上运行。',
  'shared.probe.fail.openFailed': '无法打开 WebSocket。',
  'shared.probe.fail.openFailedDetail': '无法打开 WebSocket：{detail}。',
  'shared.probe.fail.protocolMismatch': '可访问，但协议版本不兼容——请更新两侧应用。',
  'shared.probe.fail.workspaceUnknown': '可访问——后端已在运行，但尚未共享此工作区。切换会将两者配对。',
  'shared.probe.fail.protocolTooOld': '可访问——但此应用比后端旧。请更新这一侧。',
  'shared.probe.fail.protocolTooNew': '可访问——但后端比此应用旧。请更新后端。',
  'shared.probe.fail.authRequired':
    '可访问——但此设备尚未通过身份验证。用配对码配对，或在上方粘贴 token，然后点击“切换”。',
  'shared.probe.fail.rejected': '被拒绝：{reason}',
  'shared.probe.fail.rejectedUnknown': '被拒绝：原因未知',
  'shared.probe.fail.malformedWelcome': '连接到了一个服务器，但它不使用 Open Headers 协议。',
  'shared.probe.fail.generic': '探测失败。',
} as const satisfies Catalog;
