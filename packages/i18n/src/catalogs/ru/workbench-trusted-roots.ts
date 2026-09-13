/**
 * Trusted-certificates family — Russian. Mirrors
 * `catalogs/en/workbench-trusted-roots.ts` key for key; PEM / CA /
 * PKI / TLS / SHA-256 ride raw (CA takes the head noun сертификат /
 * центр where a case ending would follow); the `Internal Root CA`
 * sample name copies raw (ja / ko precedent). Mints: доверенные
 * сертификаты = trusted certificates; центр сертификации = certificate
 * authority; закрепить / закреплённый = pin / pinned; хранилище
 * доверия = trust store; отпечаток = fingerprint; Субъект / Издатель =
 * Subject / Issuer; цепочка = chain; частный CA = private CA.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': 'Доверенные сертификаты',
  'workbench.trustedRoots.description':
    'Центры сертификации, которым доверяет каждое TLS-соединение в этом рабочем пространстве, в дополнение к ' +
    'встроенным корневым. Открытые данные — синхронизируются с рабочим пространством, никогда не секрет.',
  'workbench.trustedRoots.count': 'СЕРТИФИКАТЫ ({count})',
  'workbench.trustedRoots.empty': 'Доверенных сертификатов пока нет',
  'workbench.trustedRoots.emptyHint':
    'Добавьте корневой сертификат вашего частного CA, чтобы обращаться к серверам и брокерам за вашей собственной ' +
    'PKI, не отключая проверку.',
  'workbench.trustedRoots.add': 'Добавить сертификат',
  'workbench.trustedRoots.header.name': 'Имя',
  'workbench.trustedRoots.header.subject': 'Субъект',
  'workbench.trustedRoots.header.fingerprint': 'Отпечаток SHA-256',
  'workbench.trustedRoots.header.expires': 'Истекает',
  'workbench.trustedRoots.row.chain': 'Цепочка из {count}',
  'workbench.trustedRoots.row.expired': 'Истёк',
  'workbench.trustedRoots.row.copyFingerprint': 'Копировать отпечаток',
  'workbench.trustedRoots.row.copied': 'Скопировано',
  'workbench.trustedRoots.row.remove': 'Удалить',
  'workbench.trustedRoots.row.rename': 'Переименовать',
  'workbench.trustedRoots.add.pemLabel': 'Сертификат (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'Вставьте сертификат или цепочку в формате PEM',
  'workbench.trustedRoots.add.nameLabel': 'Имя',
  'workbench.trustedRoots.add.namePlaceholder': 'Internal Root CA',
  'workbench.trustedRoots.add.summary.subject': 'Субъект',
  'workbench.trustedRoots.add.summary.issuer': 'Издатель',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': 'Действителен с',
  'workbench.trustedRoots.add.summary.validUntil': 'Действителен до',
  'workbench.trustedRoots.add.summary.chain': 'Цепочка',
  'workbench.trustedRoots.add.parsing': 'Чтение сертификата…',
  'workbench.trustedRoots.add.invalid': 'Не является сертификатом: {message}',
  'workbench.trustedRoots.add.notCa':
    'Это сертификат сервера, а не центра сертификации. Вместо него добавьте корневой или промежуточный сертификат, ' +
    'который его выдал.',
  'workbench.trustedRoots.add.confirm': 'Добавить',
  'workbench.trustedRoots.add.cancel': 'Отмена',
  'workbench.trustedRoots.saveFailed': 'Не удалось сохранить доверенные сертификаты',
  'workbench.trustedRoots.saveFailedDetail': 'Не удалось сохранить доверенные сертификаты: {message}',
  'workbench.trustedRoots.settings.label': 'Доверенные сертификаты (CA)',
  'workbench.trustedRoots.settings.count': '{count} из этого рабочего пространства',
  'workbench.trustedRoots.settings.none': 'Из этого рабочего пространства — нет',
  'workbench.trustedRoots.settings.manage': 'Управление доверенными сертификатами',
  'workbench.trustedRoots.settings.empty': 'В этом рабочем пространстве пока нет доверенных сертификатов.',
  'workbench.trustedRoots.settings.browserStore': 'Хранилище браузера',
  'workbench.trustedRoots.settings.help':
    'Центры сертификации, которым это рабочее пространство доверяет в дополнение к встроенным корневым — ' +
    'применяются к каждому TLS-соединению, которое устанавливает среда выполнения приложения, по одному корневому ' +
    'сертификату в строке. Добавьте частный CA здесь вместо отключения проверки.',
  'workbench.trustedRoots.settings.deviceCount': '{count} на этом устройстве',
  'workbench.trustedRoots.settings.groupWorkspace': 'Это рабочее пространство',
  'workbench.trustedRoots.settings.groupDevice': 'Это устройство',
  'workbench.trustedRoots.device.count': 'ЗАКРЕПЛЕНО НА ЭТОМ УСТРОЙСТВЕ ({count})',
  'workbench.trustedRoots.device.empty': 'На этом устройстве нет закреплённых сертификатов',
  'workbench.trustedRoots.device.emptyHint':
    'Закрепления обычно добавляются после неудачной отправки — доверять сертификату, который предъявил сервер, ' +
    'только на этой машине. Вставьте сертификат сюда, чтобы закрепить его вручную.',
  'workbench.trustedRoots.settings.browserNote':
    'Браузер выполняет проверку по собственному хранилищу доверия; сертификаты, добавленные в это рабочее ' +
    'пространство, действуют только при отправке средой выполнения приложения.',
  'workbench.trustedRoots.systemTrust.count':
    'Сертификаты из хранилища доверия этой машины ({count}) применяются к каждому TLS-соединению, которое ' +
    'устанавливает среда выполнения приложения',
  'workbench.trustedRoots.systemTrust.off': 'Доверие только встроенным корневым сертификатам и сертификатам выше',
  'workbench.trustedRoots.systemTrust.unsupported':
    'Эта среда выполнения не может читать системное хранилище доверия — требуется Node 22.15 или новее',
  'workbench.trustedRoots.systemTrust.browser': 'Браузер выполняет проверку по собственному хранилищу доверия',
} as const satisfies Catalog;
