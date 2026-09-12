/**
 * Trusted-certificates family — Korean. Mirrors
 * `catalogs/en/workbench-trusted-roots.ts` key for key; PEM / CA /
 * PKI / TLS / SHA-256 ride raw (CA takes the head noun 인증서 where a
 * particle follows); the `Internal Root CA` sample name copies raw.
 * Mints: 신뢰된 인증서 = trusted certificates; 인증 기관 = certificate
 * authority; 고정 = pin; 신뢰 저장소 = trust store; 지문 = fingerprint;
 * 주체 / 발급자 = Subject / Issuer; 체인 = chain; 사설 CA = private CA.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': '신뢰된 인증서',
  'workbench.trustedRoots.description':
    '내장 루트 외에 이 워크스페이스의 모든 TLS 연결이 신뢰하는 인증 기관입니다. 공개 자료이며 워크스페이스와 동기화됩니다. 시크릿이 아닙니다.',
  'workbench.trustedRoots.count': '인증서 ({count})',
  'workbench.trustedRoots.empty': '아직 신뢰된 인증서가 없습니다',
  'workbench.trustedRoots.emptyHint':
    '검증을 끄지 않고도 자체 PKI 뒤의 서버와 브로커에 연결하려면 사설 CA 루트를 추가하세요.',
  'workbench.trustedRoots.add': '인증서 추가',
  'workbench.trustedRoots.header.name': '이름',
  'workbench.trustedRoots.header.subject': '주체',
  'workbench.trustedRoots.header.fingerprint': 'SHA-256 지문',
  'workbench.trustedRoots.header.expires': '만료',
  'workbench.trustedRoots.row.chain': '체인 {count}개',
  'workbench.trustedRoots.row.expired': '만료됨',
  'workbench.trustedRoots.row.copyFingerprint': '지문 복사',
  'workbench.trustedRoots.row.copied': '복사됨',
  'workbench.trustedRoots.row.remove': '제거',
  'workbench.trustedRoots.row.rename': '이름 바꾸기',
  'workbench.trustedRoots.add.pemLabel': '인증서 (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'PEM 인증서 또는 체인 붙여넣기',
  'workbench.trustedRoots.add.nameLabel': '이름',
  'workbench.trustedRoots.add.namePlaceholder': 'Internal Root CA',
  'workbench.trustedRoots.add.summary.subject': '주체',
  'workbench.trustedRoots.add.summary.issuer': '발급자',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': '유효 시작',
  'workbench.trustedRoots.add.summary.validUntil': '유효 종료',
  'workbench.trustedRoots.add.summary.chain': '체인',
  'workbench.trustedRoots.add.parsing': '인증서 읽는 중…',
  'workbench.trustedRoots.add.invalid': '인증서가 아닙니다: {message}',
  'workbench.trustedRoots.add.notCa':
    '이것은 인증 기관이 아니라 서버 인증서입니다. 대신 이를 발급한 루트 또는 중간 인증서를 추가하세요.',
  'workbench.trustedRoots.add.confirm': '추가',
  'workbench.trustedRoots.add.cancel': '취소',
  'workbench.trustedRoots.saveFailed': '신뢰된 인증서를 저장하지 못했습니다',
  'workbench.trustedRoots.saveFailedDetail': '신뢰된 인증서를 저장하지 못했습니다: {message}',
  'workbench.trustedRoots.settings.label': '신뢰된 인증서 (CA)',
  'workbench.trustedRoots.settings.count': '이 워크스페이스에서 {count}개',
  'workbench.trustedRoots.settings.none': '이 워크스페이스에서 없음',
  'workbench.trustedRoots.settings.manage': '신뢰된 인증서 관리',
  'workbench.trustedRoots.settings.empty': '이 워크스페이스에 아직 신뢰된 인증서가 없습니다.',
  'workbench.trustedRoots.settings.browserStore': '브라우저 저장소',
  'workbench.trustedRoots.settings.help':
    '내장 루트 외에 이 워크스페이스가 신뢰하는 인증 기관입니다. 앱 런타임이 여는 모든 TLS 연결에 적용되며 한 행에 루트 하나입니다. 검증을 끄는 대신 여기에 사설 CA 인증서를 추가하세요.',
  'workbench.trustedRoots.settings.deviceCount': '이 기기에서 {count}개',
  'workbench.trustedRoots.settings.groupWorkspace': '이 워크스페이스',
  'workbench.trustedRoots.settings.groupDevice': '이 기기',
  'workbench.trustedRoots.device.count': '이 기기에 고정됨 ({count})',
  'workbench.trustedRoots.device.empty': '이 기기에 고정된 인증서가 없습니다',
  'workbench.trustedRoots.device.emptyHint':
    '고정은 보통 실패한 전송에서 추가됩니다. 서버가 제시한 인증서를 이 컴퓨터에서만 신뢰합니다. 직접 고정하려면 여기에 붙여넣으세요.',
  'workbench.trustedRoots.settings.browserNote':
    '브라우저는 자체 신뢰 저장소로 검증합니다. 이 워크스페이스에 추가한 인증서는 앱 런타임이 보낼 때만 적용됩니다.',
  'workbench.trustedRoots.systemTrust.count':
    '이 컴퓨터의 신뢰 저장소에서 가져온 인증서 {count}개가 앱 런타임이 여는 모든 TLS 연결에 적용됩니다',
  'workbench.trustedRoots.systemTrust.off': '내장 루트와 위의 인증서만 신뢰합니다',
  'workbench.trustedRoots.systemTrust.unsupported':
    '이 런타임은 시스템 신뢰 저장소를 읽을 수 없습니다. Node 22.15 이상이 필요합니다',
  'workbench.trustedRoots.systemTrust.browser': '브라우저는 자체 신뢰 저장소로 검증합니다',
} as const satisfies Catalog;
