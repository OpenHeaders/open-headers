/**
 * Script-packages family — Russian. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key; `oh.require`
 * / `module.exports` ride raw with a head noun (вызов, конструкция)
 * where a case ending would follow. The prefix / infix sandwich around
 * the two code chips keeps the infix dash as the structural chip
 * separator. Mints: Библиотека пакетов = Package Library; повторное
 * использование = reuse; Отменить изменения = Discard; экспортировать
 * = export.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'Библиотека пакетов',
  'workbench.scriptPackages.new': 'Создать',
  'workbench.scriptPackages.searchPlaceholder': 'Поиск пакетов...',
  'workbench.scriptPackages.emptyNone': 'Пакетов пока нет',
  'workbench.scriptPackages.emptyNoMatch': 'Пакет не найден',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'Используйте скрипты повторно в разных запросах с помощью пакетов',
  'workbench.scriptPackages.primer.step1': '1. Создайте пакет с кодом для повторного использования.',
  'workbench.scriptPackages.primer.step2': '2. Экспортируйте функции, которые хотите использовать повторно.',
  'workbench.scriptPackages.primer.step3': '3. Загружайте пакет в скриптах запросов через вызов oh.require.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'Имя пакета',
  'workbench.scriptPackages.descriptionPlaceholder': 'Описание (необязательно)',
  'workbench.scriptPackages.descriptionAria': 'Описание пакета',
  'workbench.scriptPackages.save': 'Сохранить',
  'workbench.scriptPackages.deleteTitle': 'Удалить этот пакет?',
  'workbench.scriptPackages.deleteDescription':
    'Скрипты, вызывающие для него oh.require, начнут завершаться с ошибкой.',
  'workbench.scriptPackages.delete': 'Удалить',
  'workbench.scriptPackages.loadFromScriptPrefix': 'Загружайте его из скрипта через',
  'workbench.scriptPackages.exportViaInfix': '— экспортируйте публичный интерфейс через',
  'workbench.scriptPackages.sourcePlaceholder':
    'Напишите JavaScript для повторного использования, затем экспортируйте через module.exports.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': 'Отменить несохранённые изменения?',
  'workbench.scriptPackages.discardContent': 'В текущем пакете есть несохранённые правки. Переключение отменит их.',
  'workbench.scriptPackages.discardOk': 'Отменить изменения',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': 'Имя пакета обязательно — это ключ для oh.require.',
  'workbench.scriptPackages.saved': 'Пакет сохранён',
  'workbench.scriptPackages.duplicateName': 'Пакет с именем «{name}» уже существует в этом рабочем пространстве.',
  'workbench.scriptPackages.notFound': 'Пакет не найден — возможно, он был удалён.',
  'workbench.scriptPackages.saveFailed': 'Не удалось сохранить',
  'workbench.scriptPackages.deleted': 'Пакет удалён',
  'workbench.scriptPackages.deleteFailed': 'Не удалось удалить',
} as const satisfies Catalog;
