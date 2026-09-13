/**
 * Desktop namespace — Russian. Mirrors `catalogs/en/desktop.ts` key for
 * key; the 'Open Headers' brand rides raw. Menu rows are nouns /
 * infinitives in sentence case (en's Title Case does not carry);
 * macOS-style ellipsis rows keep `…`. Mints: аппаратное ускорение =
 * hardware acceleration; условия лицензии = license terms; политика
 * конфиденциальности = privacy policy; перезапустить = restart;
 * `{version}` and `{name}` holes take a head noun (версия {version},
 * приложение {name}) so no case ending touches the hole.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Открыть Open Headers',
  'desktop.tray.quit': 'Выйти',
  'desktop.menu.settings': 'Настройки…',
  'desktop.menu.about': 'О приложении {name}',
  'desktop.menu.enableHardwareAcceleration': 'Включить аппаратное ускорение',
  'desktop.menu.disableHardwareAcceleration': 'Выключить аппаратное ускорение',
  'desktop.menu.file': 'Файл',
  'desktop.menu.edit': 'Правка',
  'desktop.menu.view': 'Вид',
  'desktop.menu.window': 'Окно',
  'desktop.menu.help': 'Справка',
  'desktop.menu.newItem': 'Создать…',
  'desktop.menu.newTab': 'Новая вкладка',
  'desktop.menu.newWindow': 'Новое окно',
  'desktop.menu.import': 'Импорт…',
  'desktop.menu.closeTab': 'Закрыть вкладку',
  'desktop.menu.nextTab': 'Следующая вкладка',
  'desktop.menu.previousTab': 'Предыдущая вкладка',
  'desktop.menu.actualSize': 'Реальный размер',
  'desktop.menu.documentation': 'Документация',
  'desktop.menu.reportIssue': 'Сообщить о проблеме',
  'desktop.menu.licenseAgreement': 'Лицензионное соглашение',
  'desktop.update.check': 'Проверить обновления…',
  'desktop.update.checking': 'Проверка обновлений…',
  'desktop.update.updateAndRestart': 'Обновить до версии {version} и перезапустить',
  'desktop.update.availableExternal': 'Доступна версия {version}…',
  'desktop.update.downloading': 'Загрузка обновления… {percent}%',
  'desktop.update.downloadingNoProgress': 'Загрузка обновления…',
  'desktop.update.restartToInstall': 'Перезапустить для установки версии {version}',
  'desktop.dialog.hardwareAcceleration.title': 'Аппаратное ускорение',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    'Аппаратное ускорение будет выключено при следующем запуске приложения {name}.',
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    'Аппаратное ускорение будет включено при следующем запуске приложения {name}.',
  'desktop.dialog.hardwareAcceleration.detail': 'Перезапустите сейчас, чтобы применить изменение немедленно.',
  'desktop.dialog.hardwareAcceleration.restartNow': 'Перезапустить сейчас',
  'desktop.dialog.hardwareAcceleration.later': 'Позже',
  'desktop.firstRunLegal.message':
    'Продолжая использовать Open Headers, вы соглашаетесь с условиями лицензии и политикой конфиденциальности.',
  'desktop.firstRunLegal.license': 'Условия лицензии',
  'desktop.firstRunLegal.privacy': 'Политика конфиденциальности',
  'desktop.firstRunLegal.acknowledge': 'Понятно',
} as const satisfies Catalog;
