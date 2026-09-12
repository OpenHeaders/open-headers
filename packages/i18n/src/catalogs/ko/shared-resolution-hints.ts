/**
 * Resolution-hint family — Korean. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key (core keeps
 * minting the English fallback; see the en header). `{{…}}` reference
 * syntax, namespace ids, `requestDomains`, sha256, punycode ride raw
 * with a head noun (형식, 조건) where a particle would follow; `Chrome`
 * reads Chrome 브라우저. Mints: 순수 호스트 이름 = bare hostname; 스킴 =
 * scheme; 와일드카드 = wildcard; 정리 = sanitization; 권한 부여 =
 * authorization; 시크릿 관리자 = secret manager.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': '참조가 비어 있습니다. {{name}} 또는 {{namespace.name}} 형식을 사용하세요.',
  'shared.resolutionHint.unknownNamespace':
    '알 수 없는 네임스페이스입니다. 유효한 네임스페이스: env, vault, collection, workspace, file, live, step, dynamic.',
  'shared.resolutionHint.unset.envActive':
    '이 변수를 환경 → 활성 환경에서 설정하세요 (또는 대체값으로 기본 환경에서 설정하세요).',
  'shared.resolutionHint.unset.envNoActive':
    '활성 환경이 선택되어 있지 않습니다. 환경에서 하나를 선택하거나 기본 환경을 설정하세요.',
  'shared.resolutionHint.unset.vault': 'Vault 저장소에 이 시크릿을 설정하세요.',
  'shared.resolutionHint.unset.collection': '현재 컬렉션에 이 변수를 설정하세요.',
  'shared.resolutionHint.unset.workspace': '워크스페이스 변수에 이 변수를 설정하세요.',
  'shared.resolutionHint.unset.file': '이 파일은 sha256 해시로 참조하세요.',
  'shared.resolutionHint.unset.live':
    '그런 이름의 라이브 변수가 없습니다. 라이브 변수에서 하나를 만들거나 첫 새로 고침으로 값이 채워질 때까지 기다리세요.',
  'shared.resolutionHint.unset.step':
    '이 워크플로 실행에서 단계 id 또는 캡처 이름을 찾을 수 없습니다. 워크플로 단계 구성을 확인하세요.',
  'shared.resolutionHint.unset.dynamic':
    '그런 이름의 내장 생성기가 없습니다. 제안 목록에서 하나를 선택하세요 ({{dynamic.uuid}}, {{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': '이 범위에 설정되어 있지 않습니다.',
  'shared.resolutionHint.stepOutOfContext':
    '단계 참조({{step.<stepId>.<captureName>}})는 라이브 워크플로 단계 안에서만 유효합니다.',
  'shared.resolutionHint.unresolved':
    'vault, 환경, 컬렉션, 워크스페이스 중 어디에서도 찾을 수 없습니다. 이 범위 중 하나에 정의하세요.',
  'shared.resolutionHint.secretAuthorizationRequired':
    '이 항목을 보관하는 시크릿 관리자에 권한 부여가 필요합니다. 관리자에서 잠금을 해제하거나 접근을 승인한 다음 다시 시도하세요.',
  'shared.resolutionHint.secretNotFound':
    '시크릿 관리자가 이 참조에서 시크릿을 찾지 못했습니다. Vault 항목의 참조 필드를 확인하세요.',
  'shared.resolutionHint.secretUnavailable':
    '이 항목의 시크릿 관리자를 이 기기에서 사용할 수 없습니다. 설치하거나 구성한 다음 다시 시도하세요.',
  'shared.resolutionHint.invalidDomain.whitespace':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. 공백이 포함되어 있습니다 (호스트 이름은 쉼표로 구분하세요). 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
  'shared.resolutionHint.invalidDomain.scheme':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. 스킴이 포함되어 있습니다. 프로토콜 접두사를 제거하세요. 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
  'shared.resolutionHint.invalidDomain.wildcard':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. 와일드카드가 포함되어 있습니다. requestDomains 조건은 하위 도메인을 자동으로 일치시킵니다. 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
  'shared.resolutionHint.invalidDomain.port':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. 포트가 포함되어 있습니다. requestDomains 조건은 호스트 이름으로만 일치시킵니다. 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
  'shared.resolutionHint.invalidDomain.uppercase':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. 대문자가 포함되어 있습니다. requestDomains 조건은 소문자 ASCII 문자만 허용합니다. 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
  'shared.resolutionHint.invalidDomain.nonAscii':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. Chrome 브라우저가 거부하는 문자가 포함되어 있습니다 (IDN 이름에는 punycode 형식을 사용하세요). 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
  'shared.resolutionHint.invalidDomain.empty':
    '변수가 이 슬롯에서 Chrome 브라우저가 거부하는 값으로 해결되었습니다. 정리 후 값이 비어 있습니다. 쉼표로 구분한 순수 호스트 이름을 사용하세요.',
} as const satisfies Catalog;
