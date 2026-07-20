/**
 * Script-packages family — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key. Raw by
 * design inside keyed sentences: the `oh.require` / `module.exports`
 * API vocabulary (code chips), and {name} holes carrying package
 * names. Mints: 包 = package (dev term); 包库 = Package Library (the
 * chrome mint); measure word 个 for packages.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': '包库',
  'workbench.scriptPackages.new': '新建',
  'workbench.scriptPackages.searchPlaceholder': '查找包...',
  'workbench.scriptPackages.emptyNone': '还没有包',
  'workbench.scriptPackages.emptyNoMatch': '未找到包',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': '用包在请求之间复用脚本',
  'workbench.scriptPackages.primer.step1': '1. 创建一个包，写入一些可复用的代码。',
  'workbench.scriptPackages.primer.step2': '2. 导出你想复用的函数。',
  'workbench.scriptPackages.primer.step3': '3. 在请求脚本中用 oh.require 加载该包。',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': '包名称',
  'workbench.scriptPackages.descriptionPlaceholder': '描述（可选）',
  'workbench.scriptPackages.descriptionAria': '包描述',
  'workbench.scriptPackages.save': '保存',
  'workbench.scriptPackages.deleteTitle': '删除此包？',
  'workbench.scriptPackages.deleteDescription': '对它调用 oh.require 的脚本将开始失败。',
  'workbench.scriptPackages.delete': '删除',
  'workbench.scriptPackages.loadFromScriptPrefix': '在脚本中这样加载它：',
  'workbench.scriptPackages.exportViaInfix': '——公共接口通过这样导出：',
  'workbench.scriptPackages.sourcePlaceholder': '编写可复用的 JavaScript，然后用 module.exports 导出。',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': '丢弃未保存的更改？',
  'workbench.scriptPackages.discardContent': '当前包有未保存的编辑。切换会丢弃它们。',
  'workbench.scriptPackages.discardOk': '丢弃',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': '包名称是必填项——它就是 oh.require 的键。',
  'workbench.scriptPackages.saved': '包已保存',
  'workbench.scriptPackages.duplicateName': '此工作区中已存在名为“{name}”的包。',
  'workbench.scriptPackages.notFound': '未找到该包——它可能已被删除。',
  'workbench.scriptPackages.saveFailed': '保存失败',
  'workbench.scriptPackages.deleted': '包已删除',
  'workbench.scriptPackages.deleteFailed': '删除失败',
} as const satisfies Catalog;
