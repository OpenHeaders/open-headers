/**
 * Import/export family — Korean. Mirrors
 * `catalogs/en/workbench-import-export.ts` key for key. Raw by design
 * inside keyed sentences: brand + format proper nouns (Postman /
 * Insomnia / Bruno / Thunder Client / HAR / OpenAPI / cURL per the
 * glossary), file extensions and filenames rendered as code chips
 * (`.bru`, `.har`, `.openheaders.yaml`, `bruno.json`), export ids /
 * fingerprints / entity names ({id} / {name} holes carry data), uid /
 * workspace.uid, `{{ _.var }}` / `{{var}}` / `{{baseUrl}}` /
 * `{{clientId}}` / `{{clientSecret}}` template tokens, oh.* API,
 * `oh-license.` prefixes, the Postman-UI walkthrough steps (Postman's
 * own UI is English; the glyph labels stay English as ja / zh-CN do),
 * and the ` · ` separator glyphs. Quotes the shipped ko mints: 가져오기
 * 허브 = import hub (settings keyboard defs), the merge strategies “새로
 * 추가” / “바꾸기” / “건너뛰기” (settings defs), 누락 / 변환 = drops /
 * transforms (the settings import-report label), 다른 도구에서 이전 =
 * Migrate from another tool (workbench-chrome), 암호 구문 =
 * passphrase, 지문 = fingerprint, 암호문 = ciphertext, 사양 = spec,
 * 프리셋 = preset, 페어링 / 데스크톱 앱 carried, 게시 / 게시되지 않음.
 * MINTS: 평문 = plaintext; 엄격 리터럴 = strict literal; 충돌 =
 * collision; 재바인딩 = rebind; 이 컴퓨터 스캔 = Scan this computer;
 * 감지됨 = detected; 익명화 carried; 저장된 예시 = saved example; 전역
 * 변수 = global variable. Copy-as-cURL quotes Chrome's ko DevTools row
 * (“cURL 명령으로 복사” — the particle law keeps the raw token clean). The report sentence fragments (withOpen / and /
 * into) read SOV with the arrow `→` for `into` (ja precedent).
 * Plurals are `other`-only with 개.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': '내보내기',
  'workbench.importExport.export.cancel': '취소',
  'workbench.importExport.export.download': '다운로드',
  'workbench.importExport.export.sourceLabel': '소스:',
  'workbench.importExport.export.scopeLabel': '범위:',
  'workbench.importExport.export.filenameLabel': '파일 이름:',
  'workbench.importExport.export.scopeWholeWorkspace': '워크스페이스 전체',
  'workbench.importExport.export.vaultSecrets': 'Vault 시크릿',
  'workbench.importExport.export.vaultOmit': '제외 (기본값)',
  'workbench.importExport.export.vaultEncrypted': '암호화 (암호 구문)',
  'workbench.importExport.export.vaultPlaintext': '평문 (고급)',
  'workbench.importExport.export.passphrasePlaceholder': '암호 구문',
  'workbench.importExport.export.confirmPassphrasePlaceholder': '암호 구문 확인',
  'workbench.importExport.export.hintPlaceholder':
    '힌트 (선택 사항, 받는 사람에게 보임. 암호 구문 자체는 절대 넣지 마세요)',
  'workbench.importExport.export.strengthEmpty': '암호 구문을 입력하세요',
  'workbench.importExport.export.strengthWeak': '약함',
  'workbench.importExport.export.strengthFair': '보통',
  'workbench.importExport.export.strengthGood': '좋음',
  'workbench.importExport.export.strengthStrong': '강함',
  'workbench.importExport.export.strengthNote':
    '암호 구문 강도: {label}. 암호 구문은 별도 경로 (Signal, 비밀번호 관리자, 음성)로 공유하세요. 암호 구문을 가진 사람은 누구나 이 내보내기의 모든 시크릿을 읽을 수 있습니다.',
  'workbench.importExport.export.plaintextTitle': '평문 시크릿은 이 파일을 보는 누구나 읽을 수 있습니다',
  'workbench.importExport.export.plaintextUseOnly':
    '완전히 신뢰하는 시스템과 공유할 때만 쓰세요 (예: 내 암호화된 드라이브로 백업).',
  'workbench.importExport.export.switchToEncrypted': '암호화로 전환 (권장)',
  'workbench.importExport.export.acknowledgeRisks': '위험을 이해합니다',
  'workbench.importExport.export.fingerprintsTitle': '암호화됨. 이 지문을 받는 사람과 공유하세요',
  'workbench.importExport.export.ciphertextFingerprint': '암호문 지문:',
  'workbench.importExport.export.keyFingerprint': '키 지문:',
  'workbench.importExport.export.fingerprintMatchNote':
    '받는 사람이 암호 구문을 입력하면, 내 것과 일치할 경우 같은 키 지문이 보입니다.',
  'workbench.importExport.export.advanced': '고급',
  'workbench.importExport.export.strictLiteralLabel': '엄격 리터럴: 내가 선택한 것만 내보내기',
  'workbench.importExport.export.strictLiteralHelp':
    '기본적으로 컬렉션이나 폴더를 고르면 가져오기가 홀로 서도록 모든 하위 항목과 상위 컨테이너가 함께 들어갑니다. 엄격 리터럴을 켜면 고른 uid 항목만 실리며, 포함하지 않은 것에 대해 받는 사람에게 의존성 누락이 표시됩니다.',
  'workbench.importExport.export.oauthNote':
    'OAuth 클라이언트 시크릿은 vault 모드와 무관하게 항상 제외됩니다. 받는 사람이 첫 인증 때 자기 것을 입력합니다.',
  'workbench.importExport.export.exportFailed': '내보내기 실패',
  'workbench.importExport.export.exportedShareFingerprints':
    '{filename} 파일을 내보냈습니다. 지문을 받는 사람과 공유하세요',
  'workbench.importExport.export.exported': '{filename} 파일을 내보냈습니다',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': '가져오기',
  'workbench.importExport.hub.closeAria': '가져오기 닫기',
  'workbench.importExport.hub.readingFile': '파일 읽는 중…',
  'workbench.importExport.hub.pastePlaceholder': 'curl 명령 또는 URL 주소 붙여넣기',
  'workbench.importExport.hub.continueAria': '가져오기 계속',
  'workbench.importExport.hub.notRecognized':
    '아직 인식되지 않았습니다. curl 명령, URL 주소, HAR 파일, Postman / Insomnia / Bruno 내보내기, OpenAPI 문서 또는 워크스페이스 내보내기를 붙여넣으세요.',
  'workbench.importExport.hub.dropAria': '가져올 수 있는 파일이나 폴더를 여기에 놓으세요',
  'workbench.importExport.hub.dropTitle': '파일이나 폴더를 놓아 가져오기',
  'workbench.importExport.hub.kindHar': 'HAR 캡처',
  'workbench.importExport.hub.kindPostman': 'Postman 컬렉션 또는 백업',
  'workbench.importExport.hub.kindInsomnia': 'Insomnia 내보내기',
  'workbench.importExport.hub.kindBrunoSuffix': '파일 또는 컬렉션 폴더',
  'workbench.importExport.hub.kindOpenapi': 'OpenAPI 3.x 문서',
  'workbench.importExport.hub.kindGraphqlSchema': 'GraphQL 스키마 (SDL 또는 인트로스펙션 JSON)',
  'workbench.importExport.hub.kindWorkspaceSuffix': '워크스페이스 내보내기',
  'workbench.importExport.hub.autoDetected': '형식은 자동으로 인식됩니다.',
  'workbench.importExport.hub.browseFiles': '파일 찾아보기…',
  'workbench.importExport.hub.browseFolder': '폴더 찾아보기…',
  'workbench.importExport.hub.switchingFrom': '다른 도구에서 옮겨 오나요?',
  'workbench.importExport.hub.switchingOr': '또는',
  'workbench.importExport.hub.migrateCta': '다른 도구에서 이전',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles':
    '그 폴더에 Bruno 파일이 없습니다. .bru 파일이나 bruno.json 파일이 있어야 합니다.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), { other: '파일 {count}개를 읽을 수 없어 건너뛰었습니다.' }),
  'workbench.importExport.modals.readFailed': '{name} 파일을 읽을 수 없습니다: {message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `“${label}”에서 ${plural(locale, Number(count), { other: '항목 {count}개' })}를 가져왔습니다`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': '워크스페이스 내보내기 가져오기',
  'workbench.importExport.preview.closeAria': '가져오기 미리 보기 닫기',
  'workbench.importExport.preview.cancel': '취소',
  'workbench.importExport.preview.emptyFile': '.openheaders.yaml 파일을 놓으면 미리 볼 수 있습니다.',
  'workbench.importExport.preview.emptyClipboard': '워크스페이스 내보내기를 붙여넣으면 미리 볼 수 있습니다.',
  'workbench.importExport.preview.preparing': '가져오기 준비 중…',
  'workbench.importExport.preview.footerExportInfo': '내보내기 {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': '미리 볼 파일을 고르세요',
  'workbench.importExport.preview.footerNoData': '데이터 없음',
  'workbench.importExport.preview.importInto': '가져올 위치:',
  'workbench.importExport.preview.staleTitle': '이 미리 보기를 연 뒤 워크스페이스가 바뀌었습니다',
  'workbench.importExport.preview.staleDescription':
    '가져오기 미리 보기를 다시 열어 차이를 새로 고친 다음 다시 시도하세요.',
  'workbench.importExport.preview.advanced': '고급',
  'workbench.importExport.preview.advancedCount': '고급 ({count})',
  'workbench.importExport.preview.previewFailed': '미리 보기 실패',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `가져오기: ${plural(locale, Number(count), { other: '항목 {count}개' })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': '가져올 위치',
  'workbench.importExport.target.current': '현재',
  'workbench.importExport.target.new': '새로 만들기',
  'workbench.importExport.target.pickExisting': '기존 선택',
  'workbench.importExport.target.noActiveWorkspace': '활성 워크스페이스 없음',
  'workbench.importExport.target.selectWorkspace': '워크스페이스 선택',
  'workbench.importExport.target.landsOnOrg': '{name} 조직에 들어가 그 기기들과 동기화됩니다',
  'workbench.importExport.target.staysLocal': '이 기기에 남습니다',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': '고급',
  'workbench.importExport.advanced.closeAria': '고급 패널 닫기',
  'workbench.importExport.advanced.backupRestoreLabel': '내 것입니다: uid 기준 업데이트 우선',
  'workbench.importExport.advanced.backupRestoreHelp':
    'uid 일치 충돌의 처리를 “새로 추가”에서 “바꾸기”로 바꿉니다. 내보내기 이후 로컬에서 편집된 항목은 건너뜁니다.',
  'workbench.importExport.advanced.trustExportLabel': '이 내보내기를 신뢰: 활성 플래그 유지',
  'workbench.importExport.advanced.trustExportHelp':
    '가져온 규칙 / 라이브 워크플로 / 라이브 변수는 기본적으로 비활성 상태로 들어옵니다. 보낸 사람을 신뢰할 때만 켜세요.',
  'workbench.importExport.advanced.stripScriptsLabel': '가져올 때 요청 스크립트 제거',
  'workbench.importExport.advanced.stripScriptsHelp':
    '가져오는 모든 요청에서 요청 전 및 응답 후 스크립트를 제거합니다. 보낸 사람이 낯설 때 권장합니다.',
  'workbench.importExport.advanced.omitOAuthLabel': 'OAuth 구성 제외',
  'workbench.importExport.advanced.omitOAuthHelp':
    '기본적으로 OAuth2 구성은 요청과 함께 들어옵니다 (token 엔드포인트, 클라이언트 id, 범위. 클라이언트 시크릿이나 token 값은 절대 포함되지 않음). 켜면 모든 OAuth2 요청의 인증이 없음으로 들어옵니다.',
  'workbench.importExport.advanced.keepOrderLabel': '업데이트 시 대상 컬렉션 순서 유지',
  'workbench.importExport.advanced.keepOrderHelp':
    '기본적으로 업데이트된 컬렉션은 내보내기의 하위 순서를 따릅니다. 켜면 기존 대상의 순서가 보존됩니다.',
  'workbench.importExport.advanced.workspaceSettingsLabel': '워크스페이스 수준 설정 포함',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    '워크스페이스 의미의 설정 허용 목록을 위해 예약되어 있습니다. 현재 허용 목록은 비어 있어 v1에서는 이 토글로 아무것도 실리지 않습니다.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'workspace.uid 충돌 시 거부',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    '기본적으로 새 워크스페이스로 가져올 때 충돌하면 워크스페이스 uid 값을 조용히 다시 만듭니다. 켜면 같은 uid 값을 가진 기존 워크스페이스가 가져오기를 막습니다.',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': '무시',
  'workbench.importExport.chips.plaintextLabel': '평문 시크릿',
  'workbench.importExport.chips.plaintextTitle': '이 내보내기에는 평문 vault 시크릿이 들어 있습니다.',
  'workbench.importExport.chips.plaintextBody':
    '이 파일을 가진 누구나 그 안의 모든 시크릿을 읽을 수 있습니다. 전달하기 전에 암호화하여 다시 발급하는 것을 고려하세요.',
  'workbench.importExport.chips.skippedLabel': '{count}개 건너뜀',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '항목 {count}개를 파싱할 수 없어 건너뜁니다.' }),
  'workbench.importExport.chips.andMore': '…외 {count}개',
  'workbench.importExport.chips.dedupSameLabel': '여기에 이미 가져옴',
  'workbench.importExport.chips.dedupSameTitle': '이 내보내기 ({id})를 {date}에 여기로 가져왔습니다.',
  'workbench.importExport.chips.dedupSameBody': '다시 가져오면 현재의 항목별 전략 선택이 적용됩니다.',
  'workbench.importExport.chips.dedupOtherLabel': '다른 곳에 가져옴',
  'workbench.importExport.chips.dedupOtherTitle': '내보내기 {id}를 “{name}”에도 가져왔습니다.',
  'workbench.importExport.chips.dedupOtherBody': '그 워크스페이스는 이 가져오기의 영향을 받지 않습니다.',
  'workbench.importExport.chips.dedupUidLabel': '소스가 이미 있음',
  'workbench.importExport.chips.dedupUidTitle': '이 소스에서 온 워크스페이스가 이미 있습니다 (“{name}”).',
  'workbench.importExport.chips.dedupUidBody': '위의 대상을 바꿔 그것을 새로 고치거나, 새 사본으로 가져오세요.',
  'workbench.importExport.chips.staleLabel': '데이터 변경됨',
  'workbench.importExport.chips.staleTitle': '대상 워크스페이스가 다른 탭에서 수정되었습니다.',
  'workbench.importExport.chips.staleBody': '아래 충돌 트리를 새로 고쳤습니다. 검토한 뒤 가져오기를 다시 누르세요.',
  'workbench.importExport.chips.previewErrorLabel': '미리 보기 실패',
  'workbench.importExport.chips.previewErrorTitle': '충돌 차이를 계산할 수 없습니다.',
  'workbench.importExport.chips.unresolvedLabel': '{count}개 미해결',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '미해결 참조 {count}개.' }),
  'workbench.importExport.chips.unresolvedBody':
    '이 이름들은 내보내기에서도 대상에서도 해석되지 않습니다. 가져오면 끊어진 바인딩으로 들어오니, 빠진 항목이 나타나면 다시 바인딩하세요.',
  'workbench.importExport.chips.referencedBy': '참조 {count}개',
  'workbench.importExport.chips.summaryThen': '이전:',
  'workbench.importExport.chips.summaryNow': '현재:',
  'workbench.importExport.chips.summaryNew': '새 항목 {count}개',
  'workbench.importExport.chips.summaryKept': '유지 {count}개',
  'workbench.importExport.chips.summaryRemoved': '제거 {count}개',
  'workbench.importExport.chips.showBreakdown': '섹션별 내역 표시',
  'workbench.importExport.chips.hideBreakdown': '내역 숨기기',
  'workbench.importExport.chips.sectionNew': '(+{count} 새 항목)',
  'workbench.importExport.chips.sectionRemoved': '({count} 제거)',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '암호화된 vault: 시크릿 {count}개' }),
  'workbench.importExport.vault.hintFromSender': '보낸 사람의 힌트:',
  'workbench.importExport.vault.enterPassphrase':
    '이 시크릿을 로컬에서 복호화하려면 암호 구문을 입력하세요. 복호화를 건너뛰어도 나머지 가져오기는 진행되며, 시크릿만 제외됩니다.',
  'workbench.importExport.vault.passphrasePlaceholder': '암호 구문',
  'workbench.importExport.vault.decrypt': 'vault 복호화',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'Vault 복호화됨: 시크릿 {count}개 가져올 준비 완료' }),
  'workbench.importExport.vault.keyFingerprint': '키 지문:',
  'workbench.importExport.vault.compareWithSender': '(보낸 사람과 비교)',
  'workbench.importExport.vault.ciphertextFingerprint': '암호문 지문:',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '시크릿 {count}개를 해독할 수 없어 가져오기에서 제외됩니다' }),
  'workbench.importExport.vault.andMore': '…외 {count}개',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': '취소',
  'workbench.importExport.import.importCta': '가져오기',
  'workbench.importExport.import.importCtaCount': '가져오기 ({count})',
  'workbench.importExport.import.importShortcutTooltip': '가져오기 ({shortcut})',
  'workbench.importExport.import.importTo': '가져올 위치',
  'workbench.importExport.import.hintNavigate': '이동',
  'workbench.importExport.import.hintSelect': '선택',
  'workbench.importExport.import.hintImport': '가져오기',
  'workbench.importExport.import.hintClose': '닫기',
  'workbench.importExport.import.cantReadFile': '이 파일을 읽을 수 없습니다',
  'workbench.importExport.import.failedCreateCollection': '컬렉션을 만들지 못했습니다',
  'workbench.importExport.import.importFailed': '가져오기 실패: {message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '변환 {count}개' }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '누락 {count}개' }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '요청 {count}개를 가져왔습니다' }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'HAR 파일에서 가져오기',
  'workbench.importExport.har.tooltipChooseFile': '먼저 .har 파일을 고르세요',
  'workbench.importExport.har.tooltipSelectEntry': '항목을 하나 이상 선택하세요',
  'workbench.importExport.har.footerSelected': '{total}개 중 {selected}개 선택',
  'workbench.importExport.har.footerChooseFile': '.har 파일 고르기',
  'workbench.importExport.har.introPrefix': 'DevTools 창이나 프록시에서 내보낸',
  'workbench.importExport.har.introSuffix':
    '파일 (HTTP Archive)을 가져옵니다. 각 항목은 선택한 컬렉션의 목적지 요청이 됩니다. 쿠키와 멀티파트 업로드는 추적 주석과 함께 누락되고, 인증 헤더는 정식 인증 유형으로 승격됩니다.',
  'workbench.importExport.har.filterPlaceholder': 'URL 주소 / 메서드 / 이름으로 필터',
  'workbench.importExport.har.selectAll': '모두 선택',
  'workbench.importExport.har.selectNone': '없음',
  'workbench.importExport.har.readFailed': 'HAR 파일을 읽지 못했습니다: {message}',
  'workbench.importExport.har.dropTitle': '.har 파일을 여기에 놓거나, 클릭해서 고르세요',
  'workbench.importExport.har.dropHint': 'DevTools 창의 Network 탭 → 오른쪽 클릭 → 모두 HAR 형식으로 저장에서 내보냄',
  'workbench.importExport.har.noImportableEntries': '파일에 가져올 수 있는 항목이 없습니다.',
  'workbench.importExport.har.noFilterMatch': '필터와 일치하는 항목이 없습니다.',
  'workbench.importExport.har.showingFirst': '{total}개 중 처음 {shown}개를 표시합니다. 필터로 범위를 좁히세요.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), { other: '소스에 변환 {count}개 적용' }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), { other: '누락 {count}개 기록' }),
  'workbench.importExport.har.transformsTooltip':
    '변환은 소스 필드를 정규화된 대응물로 다시 씁니다. 예: Authorization 헤더를 정식 인증 유형으로 승격.',
  'workbench.importExport.har.dropsTooltip':
    '누락은 모델에 대응하지 않는 소스 필드입니다 (쿠키, 멀티파트 업로드 등). 각각 전체 보고서에 추적 주석이 있습니다.',
  'workbench.importExport.har.reportHover':
    '마우스를 올리면 자세히 · 전체 목록은 가져오기 보고서 내보내기에 (애플리케이션 › 데이터)',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'cURL 명령에서 가져오기',
  'workbench.importExport.curl.tooltipPasteFirst': '먼저 curl 명령을 붙여넣으세요',
  'workbench.importExport.curl.tooltipEnterName': '이름을 입력하세요',
  'workbench.importExport.curl.introPrefix': '',
  'workbench.importExport.curl.introSuffix':
    '명령을 붙여넣으세요 (예: 브라우저 DevTools 창이나 API 문서의 “cURL 명령으로 복사”).',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': '이 명령을 파싱할 수 없습니다',
  'workbench.importExport.curl.parseFallback': '파싱할 수 없습니다. 명령을 확인하고 다시 시도하세요.',
  'workbench.importExport.curl.nameLabel': '이름',
  'workbench.importExport.curl.namePlaceholder': '사이드바에 표시될 이 요청의 이름',
  'workbench.importExport.curl.failedCreateRequest': '요청을 만들지 못했습니다',
  'workbench.importExport.curl.importedName': '“{name}” 항목을 가져왔습니다',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '헤더 {count}개' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '쿼리 매개변수 {count}개' }),
  'workbench.importExport.curl.noBody': '본문 없음',
  'workbench.importExport.curl.bodyType': '{type} 본문',
  'workbench.importExport.curl.noAuth': '인증 없음',
  'workbench.importExport.curl.authType': '{type} 인증',
  'workbench.importExport.curl.droppedWord': '누락됨',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'Postman 컬렉션에서 가져오기',
  'workbench.importExport.postman.intro':
    'Postman Collection v2.1 JSON 파일을 가져옵니다. 폴더 구조, 컬렉션 변수, 요청 문서와 설정, 요청별 인증 (basic / bearer / api-key / OAuth 2.0), 요청 스크립트 (가능한 경우 oh.* API 형식으로 번역)가 보존됩니다. AWS sigv4 인증과 파일 업로드는 누락으로 추적됩니다. 선택적으로 Postman 환경 파일을 첨부하면 대응하는 환경이 만들어집니다.',
  'workbench.importExport.postman.tooltipChooseFile': '먼저 컬렉션 파일을 고르세요',
  'workbench.importExport.postman.tooltipEnterName': '컬렉션 이름을 입력하세요',
  'workbench.importExport.postman.collectionNameLabel': '컬렉션 이름',
  'workbench.importExport.postman.collectionNamePlaceholder': '새 컬렉션의 이름',
  'workbench.importExport.postman.readFileFailed': '파일을 읽지 못했습니다: {message}',
  'workbench.importExport.postman.readEnvFailed': '환경을 읽지 못했습니다: {message}',
  'workbench.importExport.postman.parsedCollection': '파싱된 컬렉션',
  'workbench.importExport.postman.requestsLabel': '요청:',
  'workbench.importExport.postman.foldersLabel': '폴더:',
  'workbench.importExport.postman.collectionVarsLabel': '컬렉션 변수:',
  'workbench.importExport.postman.folderTree': '폴더 트리',
  'workbench.importExport.postman.optionalEnvFile': '선택 사항 · 환경 파일',
  'workbench.importExport.postman.environmentLabel': '환경: {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '변수 {count}개' }),
  'workbench.importExport.postman.secretCount': '시크릿 {count}개',
  'workbench.importExport.postman.remove': '제거',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), { other: '환경 변수 {count}개 누락 (비활성 항목)' }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Postman Collection v2.1 JSON 파일을 여기에 놓거나, 클릭해서 고르세요',
  'workbench.importExport.postman.dropEnvTitle': 'Postman Environment JSON 파일을 여기에 놓으세요 (선택 사항)',
  'workbench.importExport.postman.dropCollectionHint':
    'Postman → Collection → ⋯ → Export (Collection v2.1) 메뉴에서 내보냄',
  'workbench.importExport.postman.dropEnvHint': 'Postman → Environments → ⋯ → Export 메뉴에서 내보냄',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '폴더 {count}개' }),
  'workbench.importExport.postman.oneEnvironment': '환경 1개',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'Postman 백업에서 가져오기',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Postman 백업 데이터 덤프를 가져옵니다. 컬렉션, 환경, 전역 변수, 헤더 프리셋이 인식되며, 헤더 프리셋은 게시되지 않은 헤더 규칙으로 들어옵니다. 스크립트, OAuth 2.0, AWS sigv4 인증, 파일 업로드는 누락으로 추적됩니다.',
  'workbench.importExport.sectioned.titleInsomnia': 'Insomnia 내보내기에서 가져오기',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Insomnia 내보내기 (v4 JSON 또는 v5 YAML)를 가져옵니다. 워크스페이스는 폴더 트리를 가진 컬렉션이 되고, 환경은 평탄화되며 (하위 환경이 베이스 위에 병합됨) {{ _.var }} 참조는 {{var}} 형식으로 다시 쓰이고, 포함된 API 사양은 생성된 컬렉션에 연결된 편집 가능한 사양으로 유지됩니다.',
  'workbench.importExport.sectioned.titleBruno': 'Bruno 파일에서 가져오기',
  'workbench.importExport.sectioned.blurbBruno':
    'Bruno .bru 요청 파일이나 컬렉션 폴더 전체를 가져옵니다. 메서드, 헤더, 매개변수, 본문, basic/bearer/api-key 인증이 보존되며, 폴더는 폴더 트리, 순서, 환경을 함께 가져오고, 스크립트, 테스트, 문서 블록은 누락으로 추적됩니다.',
  'workbench.importExport.sectioned.titleOpenapi': 'OpenAPI 문서에서 가져오기',
  'workbench.importExport.sectioned.blurbOpenapi':
    'OpenAPI 3.x 문서 (JSON 또는 YAML)를 가져옵니다. 작업은 {{baseUrl}} 아래의 요청이 되고, 태그는 폴더가 되며, 매개변수와 요청 본문은 보존되고 (스키마만 있는 본문은 자리 표시자 뼈대를 받음), 보안 스킴은 인증에 대응합니다. 가져온 뒤 {{clientId}}/{{clientSecret}} 자리 표시자를 채우세요. 문서는 생성된 컬렉션에 연결된 편집 가능한 사양으로 계속 남을 수도 있습니다.',
  'workbench.importExport.sectioned.titleGraphqlSchema': 'GraphQL 스키마 가져오기',
  'workbench.importExport.sectioned.blurbGraphqlSchema':
    'GraphQL 스키마 (SDL 텍스트 또는 인트로스펙션 결과)를 가져옵니다. GraphQL 요청이 스키마 소스로 연결하는 편집 가능한 사양으로 들어오며, 가져온 뒤 열어서 루트 필드로부터 요청 컬렉션을 생성하세요.',
  'workbench.importExport.sectioned.tooltipNothingParsed': '아직 파싱된 것이 없습니다',
  'workbench.importExport.sectioned.tooltipNeedsNames': '모든 컬렉션에 이름이 필요합니다',
  'workbench.importExport.sectioned.cantReadImport': '이 가져오기를 읽을 수 없습니다',
  'workbench.importExport.sectioned.readInputFailed': '입력을 읽지 못했습니다: {message}',
  'workbench.importExport.sectioned.importAs': '가져오기 형태',
  'workbench.importExport.sectioned.specWithCollection': '컬렉션이 딸린 사양',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    '문서는 생성된 컬렉션에 연결된 편집 가능한 사양으로 계속 남습니다.',
  'workbench.importExport.sectioned.collectionOnly': '컬렉션',
  'workbench.importExport.sectioned.collectionOnlyHelp': '변환만 합니다. 문서 자체는 보관하지 않습니다.',
  'workbench.importExport.sectioned.specificationsSection': '사양 · {count}',
  'workbench.importExport.sectioned.collectionsSection': '컬렉션 · {count}',
  'workbench.importExport.sectioned.environmentsSection': '환경 · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': '헤더 프리셋 · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': '컬렉션 이름',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { other: '변수 {count}개' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { other: '헤더 {count}개' }),
  'workbench.importExport.sectioned.presetsNote':
    '각 프리셋은 게시되지 않은 헤더 규칙으로 들어옵니다. 조건을 추가하고 준비되면 게시하세요. 그때까지는 라이브 트래픽에 아무 영향도 없습니다.',
  'workbench.importExport.sectioned.nothingImportable': '이 파일에 가져올 수 있는 것이 없습니다',
  'workbench.importExport.sectioned.nothingImportableDesc':
    '파일은 파싱되었지만 모든 섹션이 비어 있거나 누락되었습니다. 아래 가져오기 메모를 보세요.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '요청 {count}개' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '사양 {count}개' }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '환경 {count}개' }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '헤더 규칙 {count}개 (게시되지 않음)' }),
  'workbench.importExport.sectioned.importedLead': '{parts}를 가져왔습니다',
  'workbench.importExport.sectioned.emptyFinish': '가져오기를 마쳤습니다. 가져올 것이 없었습니다',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': '다른 도구에서 이전',
  'workbench.importExport.migrate.scanCta': '이 컴퓨터 스캔',
  'workbench.importExport.migrate.pullCta': 'Postman 계정에서 가져오기',
  'workbench.importExport.migrate.scanNote':
    '스캔은 정해진 애플리케이션 폴더 목록을 확인하고 도구 데이터 파일 (백업과 로컬 저장소)만 읽습니다. 자격 증명, 쿠키, 세션 파일은 절대 열지 않으며, 아무것도 이 컴퓨터를 떠나지 않습니다. 무엇이든 가져오는 것은 별도의 명시적 단계입니다.',
  'workbench.importExport.migrate.scanFailed':
    '스캔을 실행할 수 없습니다. 다시 시도하거나, 내보낸 파일로 가져오기 허브를 이용하세요.',
  'workbench.importExport.migrate.backupReadFailed': '백업 파일을 읽을 수 없습니다.',
  'workbench.importExport.migrate.localReadFailed': '로컬 데이터를 읽을 수 없습니다.',
  'workbench.importExport.migrate.detected': '감지됨',
  'workbench.importExport.migrate.notFound': '찾을 수 없음',
  'workbench.importExport.migrate.cancel': '취소',
  'workbench.importExport.migrate.fromAccount': 'Postman 계정에서 가져오기',
  'workbench.importExport.migrate.localDataPrefix':
    '로컬 Insomnia, Thunder Client, Bruno 데이터가 있나요? 도구에서 내보낸 파일을',
  'workbench.importExport.migrate.importHub': '가져오기 허브',
  'workbench.importExport.migrate.localDataSuffix':
    '에 놓으세요. 또는 Open Headers 데스크톱 앱으로 이 컴퓨터를 스캔하세요.',
  'workbench.importExport.migrate.desktopConnected':
    '데스크톱 앱이 연결되어 있습니다. 거기서 “다른 도구에서 이전”을 고르세요. 진행 상황이 여기에 비치고, 가져온 워크스페이스가 동기화되어 넘어옵니다.',
  'workbench.importExport.migrate.desktopNeeded':
    '스캔에는 데스크톱 앱이 필요합니다. 거기서 실행되면 가져온 워크스페이스가 이 브라우저로 동기화됩니다.',
  'workbench.importExport.migrate.closeConfirmTitle': '가져오기를 닫으시겠습니까?',
  'workbench.importExport.migrate.closeListingContent':
    '워크스페이스 목록을 아직 불러오는 중입니다. 큰 계정은 1분 정도 걸릴 수 있습니다. 닫으면 목록 불러오기를 포기합니다.',
  'workbench.importExport.migrate.closeListingOk': '계속 기다리기',
  'workbench.importExport.migrate.closeSelectingContent':
    '워크스페이스 선택이 버려집니다. 아직 아무것도 가져오지 않았습니다.',
  'workbench.importExport.migrate.closeSelectingOk': '계속 선택하기',
  'workbench.importExport.migrate.closeAnyway': '그래도 닫기',
  'workbench.importExport.migrate.discardAndClose': '버리고 닫기',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman's UI is English, so the labels stay.
  'workbench.importExport.pull.keyIntro':
    'Postman API 키를 붙여넣으면 워크스페이스 목록을 불러와 가져올 것을 고를 수 있습니다.',
  'workbench.importExport.pull.keyAria': 'Postman API 키',
  'workbench.importExport.pull.listCta': '워크스페이스 목록 불러오기',
  'workbench.importExport.pull.listFailed': '워크스페이스 목록을 불러올 수 없습니다.',
  'workbench.importExport.pull.startFailed': '가져오기를 시작할 수 없습니다.',
  'workbench.importExport.pull.quipContacting': 'Postman 계정에 연결하는 중',
  'workbench.importExport.pull.quipCounting': '컬렉션을 세는 중',
  'workbench.importExport.pull.quipWeighing': '환경을 저울질하는 중',
  'workbench.importExport.pull.quipWrangling': '워크스페이스를 모으는 중',
  'workbench.importExport.pull.quipAlphabetizing': '폴더를 정렬하는 중',
  'workbench.importExport.pull.quipSniffing': '요청을 찾아내는 중',
  'workbench.importExport.pull.quipUntangling': '변수를 풀어내는 중',
  'workbench.importExport.pull.quipStacking': '헤더를 쌓는 중',
  'workbench.importExport.pull.pickIntro':
    '선택한 각 Postman 워크스페이스는 이름을 그대로 유지한 채 자기 워크스페이스로 들어오며, 실행 종료 보고서가 함께 옵니다.',
  'workbench.importExport.pull.noWorkspaces': '이 계정에서 워크스페이스를 찾지 못했습니다.',
  'workbench.importExport.pull.workspaceCounts': '컬렉션 {collections}개 · 환경 {environments}개',
  'workbench.importExport.pull.importCta': '선택 항목 가져오기',
  'workbench.importExport.pull.back': '뒤로',
  'workbench.importExport.pull.steps.menuA': 'Postman 앱 또는 https://postman.co 에서',
  'workbench.importExport.pull.steps.menuB': 'Settings 메뉴 → Account settings',
  'workbench.importExport.pull.steps.generateA': '왼쪽 사이드바 → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': '아무 이름이나 입력 → Generate API key',
  'workbench.importExport.pull.steps.copyB': '키 복사 → 위에 붙여넣기',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': '공급업체',
  'workbench.importExport.detection.dataFoundCol': '발견된 데이터',
  'workbench.importExport.detection.contentsCol': '내용',
  'workbench.importExport.detection.backupFrom': '{date} 백업',
  'workbench.importExport.detection.localData': '로컬 데이터',
  'workbench.importExport.detection.importCta': '가져오기…',
  'workbench.importExport.detection.exportFallbackPrefix': '또는 내보낸 다음 (Preferences → Data → Export), 그 파일을',
  'workbench.importExport.detection.backupContents':
    '컬렉션 {collections}개 · 환경 {environments}개 · 헤더 프리셋 {headerPresets}개 · 전역 변수 {globals}개',
  'workbench.importExport.detection.localContents':
    '컬렉션 {collections}개 · 환경 {environments}개 · 요청 {requests}개',
  'workbench.importExport.detection.emptyScanned': '이 컴퓨터에서 가져올 수 있는 데이터 저장소를 찾지 못했습니다.',
  'workbench.importExport.detection.emptyNotScanned':
    '아직 스캔하지 않았습니다. “이 컴퓨터 스캔”이 가져올 수 있는 데이터를 여기에 나열합니다.',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), { other: '저장소 파일 {count}개를 건너뛰었습니다:' }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Postman 가져오기 보고서',
  'workbench.importExport.report.noReport': '이 워크스페이스의 가져오기 보고서를 찾지 못했습니다.',
  'workbench.importExport.report.cleanImport': '모두 깔끔하게 가져왔습니다. 누락도 변환도 없습니다.',
  'workbench.importExport.report.copyOk': '보고서를 JSON 형식으로 복사했습니다',
  'workbench.importExport.report.copyAnonymizedOk': '익명화한 보고서를 JSON 형식으로 복사했습니다',
  'workbench.importExport.report.copyFailed': '보고서를 복사할 수 없습니다.',
  'workbench.importExport.report.copyReport': '보고서 복사',
  'workbench.importExport.report.download': '다운로드',
  'workbench.importExport.report.anonymizeTooltip':
    '공개 공유용입니다 (예: GitHub 이슈): 워크스페이스 이름은 “워크스페이스 N”이 되고 다시 쓰인 값은 가려집니다. 경로, 이유, 개수는 남아 보고서를 계속 디버깅할 수 있습니다.',
  'workbench.importExport.report.anonymize': '익명화',
  'workbench.importExport.report.close': '닫기',
  'workbench.importExport.report.openWorkspace': '워크스페이스 열기',
  'workbench.importExport.report.countsLine': '컬렉션 {collections}개 · 환경 {environments}개 · 요청 {requests}개',
  'workbench.importExport.report.savedExamplesPart': '저장된 예시 {count}개',
  'workbench.importExport.report.globalVariablesPart': '전역 변수 {count}개',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '메모 {count}개' }),
  'workbench.importExport.report.summaryImported': '가져옴',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { other: '컬렉션' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { other: '환경' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) => plural(locale, Number(count), { other: '요청' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), { other: '저장된 예시' }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), { other: '전역 변수' }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), { other: '워크스페이스 {count}개' }),
  'workbench.importExport.report.withOpen': '(포함:',
  'workbench.importExport.report.and': '및',
  'workbench.importExport.report.into': '→',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': '이전에',
  'workbench.importExport.reimport.previouslyImported': '(이전 가져오기: {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), { other: '마지막 가져오기 이후 새 문제 {count}개' }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이전에 지원되지 않던 항목 {count}개가 이제 처리됩니다' }),
  'workbench.importExport.reimport.countsChanged': '마지막 가져오기 이후 개수가 바뀌었습니다',
  'workbench.importExport.reimport.minorChanges': '마지막 가져오기 대비 사소한 변경',
  'workbench.importExport.reimport.newDrops': '새 누락 ({count})',
  'workbench.importExport.reimport.dropsResolved': '해결된 누락 ({count})',
  'workbench.importExport.reimport.newTransforms': '새 변환 ({count})',
  'workbench.importExport.reimport.transformsResolved': '더 이상 필요 없는 변환 ({count})',
} as const satisfies Catalog;
