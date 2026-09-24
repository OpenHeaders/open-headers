/**
 * Workbench settings — custom pane components — Korean. Extends the
 * ko register contract (`ko/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: 백엔드 keeps the back-end mint, 데몬 = daemon, vault /
 * workflow-seed `seed` / `Org` as dev loanwords, networking
 * vocabulary (loopback, LAN, WAN, TLS, `ws://` / `wss://`), IANA port
 * constants (1024 / 49152 / 65535), IP literals, `MCP` / `SSO` /
 * `CLI` / `oh` / streamable HTTP, snippet filenames
 * (claude_desktop_config.json), the `oh-license.…` key prefix, git
 * command vocabulary (`git remote add`, `--no-verify`, HEAD), and the
 * {chord} / {token} / {url} holes. Settings paths quote the ko shell
 * mints (백업 및 동기화 › 동기화); 시트 / 티어 / 무료 티어 / 취소 = revoke;
 * 발급 = mint (a token) reuses the chrome mint; 프리셋 and 단축키 reuse
 * workbench-settings-defs-keyboard; 페어링 = pair carries the shared
 * mint (페어링 코드 = pairing code); 스태시 / 셸브 carried from the
 * chrome. MINTS: 교체 = rotate (a token); 신뢰 저장소 = trust store
 * (carried); 인증 기관 = certificate authority (CA raw in chip
 * contexts); 구조 브랜치 = rescue branch; 특권 도우미 = privileged
 * helper; 루트 미리 보기 = route preview; 로그인 키체인 / 시스템 키체인.
 * Sandwich fragments: the pairing intro joins its chips with its own
 * spaces except between the settings-path chip and part2 (`,` in en),
 * so part2 opens with the particle attached to that Korean chip
 * (`를 열고, 그`); the remove-body / fallback fragments read SOV with
 * the chip as object (조직을 제공하며 / 옵션이 없나요?). Every raw token
 * takes a head noun before a particle (LAN 네트워크의, Org 조직이,
 * token 값을, CLI 도구가, HEAD 상태입니다).
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.learnMore': '자세히 알아보기',
  'workbench.settings.backendPane.rowMenuAria': '{label} 작업',
  'workbench.settings.backendPane.tierZero.title.extension': '이 브라우저',
  'workbench.settings.backendPane.tierZero.title.desktop': '이 컴퓨터',
  'workbench.settings.backendPane.tierZero.title.web': '이 서버',
  'workbench.settings.backendPane.tierZero.copy.extension':
    '워크스페이스는 여기에 있습니다. 아래의 장소를 통해서만 백업되고 동기화됩니다.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    '워크스페이스는 이 컴퓨터의 데스크톱 앱에 있습니다. 아래의 장소를 통해서만 백업되고 동기화됩니다.',
  'workbench.settings.backendPane.tierZero.copy.web':
    '워크스페이스는 이 서버에 있습니다. 여기에 로그인하는 모든 브라우저와 기기가 같은 사본으로 작업합니다.',
  'workbench.settings.backendPane.tierZero.alwaysOn': '항상 켜짐',
  'workbench.settings.backendPane.tierZero.administer': '관리…',
  'workbench.settings.backendPane.wizard.step.connect': '연결',
  'workbench.settings.backendPane.wizard.editTitle': '{label} 편집',
  'workbench.settings.backendPane.wizard.title.desktop': '데스크톱 앱 연결',
  'workbench.settings.backendPane.wizard.title.server': '서버에 로그인',
  'workbench.settings.backendPane.wizard.step.address': '주소',
  'workbench.settings.backendPane.wizard.step.signIn': '로그인',
  'workbench.settings.backendPane.wizard.connect': '연결',
  'workbench.settings.backendPane.wizard.checkAgain': '다시 확인',
  'workbench.settings.backendPane.wizard.checking': '{host} 확인 중…',
  'workbench.settings.backendPane.wizard.verdict.needsPairing': '{host} 호스트가 이 기기의 로그인을 요청합니다.',
  'workbench.settings.backendPane.wizard.verdict.signedIn': '{name}에 로그인했습니다.',
  'workbench.settings.backendPane.wizard.verdict.signedInUnnamed': '로그인했습니다.',
  'workbench.settings.backendPane.wizard.verdict.signedInAs': '{person} 계정으로 {name}에 로그인했습니다.',
  'workbench.settings.backendPane.wizard.verdict.signedInAsUnnamed': '{person} 계정으로 로그인했습니다.',
  'workbench.settings.backendPane.wizard.signIn.primary': '{host}에서 로그인',
  'workbench.settings.backendPane.wizard.signIn.intro':
    '{host} 호스트의 페이지가 브라우저에서 열립니다. 그곳에서 본인 계정으로 로그인하고 이 기기를 승인하세요. 여기에는 아무것도 입력하지 않습니다.',
  'workbench.settings.backendPane.wizard.signIn.codeLabel': '로그인 코드',
  'workbench.settings.backendPane.wizard.signIn.waiting': '브라우저에서 이 기기를 승인할 때까지 기다리는 중…',
  'workbench.settings.backendPane.wizard.signIn.openAgain': '페이지 다시 열기',
  'workbench.settings.backendPane.wizard.signIn.waitingBrowser': '브라우저에서 로그인을 마친 다음 여기로 돌아오세요…',
  'workbench.settings.backendPane.wizard.signIn.linkHint':
    '브라우저가 열리지 않았나요? 이 링크를 원하는 브라우저에서 여세요:',
  'workbench.settings.backendPane.wizard.signIn.tryAgain': '다시 시도',
  'workbench.settings.backendPane.wizard.signIn.cancelSignIn': '로그인 취소',
  'workbench.settings.backendPane.wizard.signIn.unclaimed':
    '이 서버에는 아직 관리자가 없습니다. 먼저 {url}에서 설정한 다음 여기에서 로그인하세요.',
  'workbench.settings.backendPane.wizard.signIn.noLogin':
    '브라우저에서 {host} 호스트에 로그인할 수 있는 사람이 없으므로, 관리자가 발급한 페어링 코드나 token 값이 유일한 방법입니다.',
  'workbench.settings.backendPane.wizard.signIn.secondary': '관리자에게 받은 페어링 코드나 token 값이 있나요?',
  'workbench.settings.backendPane.wizard.signIn.fail.denied': '서버 페이지에서 로그인이 거부되었습니다.',
  'workbench.settings.backendPane.wizard.signIn.fail.expired': '로그인 요청이 승인되기 전에 만료되었습니다.',
  'workbench.settings.backendPane.wizard.signIn.fail.lost':
    '서버가 이 로그인 요청을 더 이상 보유하지 않습니다. 다시 시작하세요.',
  'workbench.settings.backendPane.wizard.signIn.fail.abandoned':
    '브라우저에서 로그인이 완료되지 않았습니다. 다시 시도하세요.',
  'workbench.settings.backendPane.wizard.signIn.fail.tooManyPending':
    '{host} 호스트에 대기 중인 로그인이 너무 많습니다. 몇 분 후에 다시 시도하세요.',
  'workbench.settings.backendPane.wizard.signIn.fail.throttled':
    '{host} 호스트가 현재 이 기기의 요청을 거부하고 있습니다. 나중에 다시 시도하세요.',
  'workbench.settings.backendPane.wizard.signIn.fail.forbidden':
    '{host} 호스트가 이 기기의 로그인 요청을 거부했습니다.',
  'workbench.settings.backendPane.wizard.signIn.fail.offline':
    '{host} 호스트에서 아무 응답이 없습니다. 해당 주소에서 실행 중인가요?',
  'workbench.settings.backendPane.wizard.signIn.fail.generic': '로그인을 시작할 수 없습니다. 다시 시도하세요.',
  'workbench.settings.backendPane.wizard.next': '다음',
  'workbench.settings.backendPane.wizard.connectIntro':
    '이 기기가 연결하는 주소입니다. 마지막 단계에서 검증하기 전까지 아무것도 연결되지 않습니다.',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    '데스크톱 앱과의 자동 페어링이 진행되지 않았습니다. 실행 중이 아니거나 이 브라우저를 검증할 수 없었을 수 있습니다. 대신 코드나 token 값으로 페어링하세요.',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    '준비됨: {url}의 {label}, 로그인됨. 연결은 먼저 주소와 로그인을 검증합니다. 그다음 워크스페이스가 내려와 동기화되고 오프라인에서도 쓸 수 있습니다.',
  'workbench.settings.backendPane.wizard.readyIntroPairedUnnamed':
    '준비됨: {url}, 로그인됨. 연결은 먼저 주소와 로그인을 검증합니다. 그다음 워크스페이스가 내려와 동기화되고 오프라인에서도 쓸 수 있습니다.',
  'workbench.settings.backendPane.wizard.additionalConnection':
    '추가 연결입니다. 그 워크스페이스는 워크스페이스 전환기에 새 그룹으로 나타나고, 상태 팝오버에 행이 하나 늘며, 각 그룹은 정확히 한 곳에서만 동기화됩니다. 다른 연결이 이미 제공하는 그룹은 두 번 참여하지 않습니다.',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} 항목이 연결되어 있습니다. 연결을 편집하는 것은 살아 있는 선을 옮기는 일이므로 먼저 연결을 끊습니다. 설정과 페어링은 유지되며, 다시 켜면 연결 전에 새 구성을 검증합니다.',
  'workbench.settings.backendPane.wizard.disconnectEdit': '연결 끊고 편집',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': '동기화 대상',
  'workbench.settings.backendPane.connections.connectDesktop': '데스크톱 앱 연결',
  'workbench.settings.backendPane.connections.signInServer': '서버에 로그인…',
  'workbench.settings.backendPane.connections.emptyDesktopLine':
    '이 컴퓨터의 브라우저 간 동기화: 데스크톱 앱을 연결하세요.',
  'workbench.settings.backendPane.connections.emptyServerLine':
    '내 기기 간 또는 팀과의 동기화: OpenHeaders Server에 로그인하세요.',
  'workbench.settings.backendPane.connections.menu.connect': '연결',
  'workbench.settings.backendPane.connections.menu.disconnect': '연결 끊기',
  'workbench.settings.backendPane.connections.menu.edit': '편집…',
  'workbench.settings.backendPane.connections.menu.remove': '제거…',
  'workbench.settings.backendPane.connections.place.desktopApp': '이 컴퓨터의 데스크톱 앱',
  'workbench.settings.backendPane.placement.section': '새 워크스페이스',
  'workbench.settings.backendPane.placement.label': '저장 위치',
  'workbench.settings.backendPane.placement.description':
    '언제든 바꿀 수 있습니다. 기존 워크스페이스는 있던 곳에 남습니다.',
  'workbench.settings.backendPane.connections.writeFailed': '연결을 저장할 수 없습니다',
  'workbench.settings.backendPane.connections.status.connected': '연결됨',
  'workbench.settings.backendPane.connections.status.connecting': '연결 중…',
  'workbench.settings.backendPane.connections.status.authRequired': '다시 페어링 필요',
  'workbench.settings.backendPane.connections.status.error': '연결 끊김',
  'workbench.settings.backendPane.connections.status.off': '꺼짐',
  'workbench.settings.backendPane.connections.repair': '다시 페어링',
  'workbench.settings.backendPane.connections.autoConnect': '자동 연결',
  'workbench.settings.backendPane.connections.orgConflict':
    'Org “{org}” 조직은 이미 {provider}에서 제공합니다. 참여하지 않음',
  'workbench.settings.backendPane.connections.removedBackend': '제거된 연결',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': '{label}에 연결하는 중…',
  'workbench.settings.backendPane.enable.connected': '{label}에 연결했습니다.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    '{label} 항목은 연결되었지만 그 Org 조직에는 참여하지 않았습니다. 연결 행을 확인하세요.',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': '{label} 항목을 제거하시겠습니까?',
  'workbench.settings.backendPane.remove.confirmBody': '주소와 페어링이 잊힙니다. 아직 여기서 동기화된 것은 없습니다.',
  'workbench.settings.backendPane.remove.aria': '{label} 제거',
  'workbench.settings.backendPane.remove.removed': '{label} 항목을 제거했습니다.',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '워크스페이스 {count}개' }),
  'workbench.settings.backendPane.remove.body.prefix': '이 연결은',
  'workbench.settings.backendPane.remove.body.suffix':
    '조직을 제공하며, {workspaces}가 이 기기에 동기화되어 있습니다. 연결 측 데이터는 절대 건드리지 않습니다. 로컬 사본을 어떻게 할지 고르세요.',
  'workbench.settings.backendPane.remove.outcomeAria': '제거 결과',
  'workbench.settings.backendPane.remove.recommendedBadge': '권장',
  'workbench.settings.backendPane.remove.keep.title': '로컬 사본 유지',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs}의 동기화가 멈춥니다. {workspaces}는 오프라인 로컬 데이터로 이 기기에 남습니다.',
  'workbench.settings.backendPane.remove.discard.title': '로컬 사본 버리기',
  'workbench.settings.backendPane.remove.discard.description':
    '각 워크스페이스를 먼저 다운로드 파일로 백업한 뒤 이 기기에서 삭제합니다. 나중에 다시 연결하면 다시 내려받아 동기화됩니다.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    '백업 파일에 vault 시크릿 포함 (평문이므로 파일을 안전하게 보관하세요)',
  'workbench.settings.backendPane.remove.removeBackend': '연결 제거',
  'workbench.settings.backendPane.remove.backupThenRemove': '백업 후 제거',
  'workbench.settings.backendPane.remove.progress.removing': '연결을 제거하는 중…',
  'workbench.settings.backendPane.remove.progress.preparing': '백업을 준비하는 중…',
  'workbench.settings.backendPane.remove.progress.backingUp': '"{name}" 백업 중…',
  'workbench.settings.backendPane.remove.progress.deleting': '"{name}" 삭제 중…',
  'workbench.settings.backendPane.remove.keepDone':
    '{label} 항목을 제거했습니다. {orgs}의 동기화가 멈췄고, {workspaces}는 이 기기에 남습니다.',
  'workbench.settings.backendPane.remove.discardDone':
    '{label} 항목을 제거했습니다. {workspaces}를 백업하고 삭제했으며, {orgs}의 바인딩을 해제했습니다.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      other: `${String(label)} 항목을 제거했지만 워크스페이스 {count}개가 남았습니다`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody':
    '삭제할 수 없습니다: {names}. 로컬 데이터로 남아 있습니다.',
  'workbench.settings.backendPane.remove.backupFailedTitle': '"{name}" 백업 실패',
  'workbench.settings.backendPane.remove.backupFailedBody':
    '내보내기가 완료되지 않았습니다. 아무것도 제거되지 않았습니다.',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': '코드로 페어링',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'token 붙여넣기',
  'workbench.settings.backendPane.pair.codeBlurb':
    '데스크톱 앱이나 서버에 표시된 코드를 입력하세요. 이 기기를 로그인시키는 token 값으로 교환됩니다.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    '데스크톱 앱이나 서버에 표시된 token 값을 붙여넣으세요. 교체하면 새 시크릿이 한 번 표시됩니다. 이 기기의 자격 증명으로 저장됩니다.',
  'workbench.settings.backendPane.pair.codePlaceholder': '6자리 코드',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': '기기 이름 (선택 사항)',
  'workbench.settings.backendPane.pair.codeRequired': '데스크톱 앱이나 서버에 표시된 페어링 코드를 입력하세요.',
  'workbench.settings.backendPane.pair.pasteTokenRequired': '데스크톱 앱이나 서버에 표시된 token 값을 붙여넣으세요.',
  'workbench.settings.backendPane.pair.pairAction': '페어링',
  'workbench.settings.backendPane.pair.saveToken': 'token 저장',
  'workbench.settings.backendPane.pair.tokenSaved': '인증 token 값을 저장했습니다.',
  'workbench.settings.backendPane.pair.pairedSaved': '페어링됨. 인증 token 값을 저장했습니다.',
  'workbench.settings.backendPane.pair.switchToToken': 'token 값이 있나요? 대신 붙여넣기',
  'workbench.settings.backendPane.pair.switchToCode': '대신 페어링 코드가 있나요?',
  'workbench.settings.backendPane.pair.fail.unknown':
    '알 수 없거나 만료된 코드입니다. 새 코드를 요청해 다시 시도하세요.',
  'workbench.settings.backendPane.pair.fail.expired':
    '페어링 코드가 만료되었습니다. 데스크톱 앱이나 서버에서 새로 생성하세요.',
  'workbench.settings.backendPane.pair.fail.consumed':
    '이미 사용된 코드입니다. 데스크톱 앱이나 서버에서 새로 생성하세요.',
  'workbench.settings.backendPane.pair.fail.unreachable': '{url}에서 아무 응답이 없습니다. 그 주소에서 실행 중인가요?',
  'workbench.settings.backendPane.pair.fail.generic': '페어링에 실패했습니다. 다시 시도하세요.',
  'workbench.settings.backendPane.pair.nmRequired':
    '데스크톱 앱과의 수동 페어링이 꺼져 있습니다. 이 브라우저는 검증된 페어링으로만 연결합니다. “검증된 페어링 필수” 설정을 확인하세요.',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': '이름',
  'workbench.settings.backendPane.field.label.description':
    '앱 전체에서 이 연결을 부르는 이름입니다. 기본값은 주소입니다.',
  'workbench.settings.backendPane.field.label.placeholder': '업무용 VM',
  'workbench.settings.backendPane.field.label.aria': '연결 이름',
  'workbench.settings.backendPane.field.url.label': '서버 주소',
  'workbench.settings.backendPane.field.url.description':
    '관리자가 알려 준 주소나 URL 값입니다. 이 컴퓨터나 내 네트워크에는 `http` 또는 `ws`, 원격 서버에는 `https` 또는 `wss` 스킴을 사용합니다.',
  'workbench.settings.backendPane.field.url.invalid': '호스트, 호스트:포트 또는 URL 형식을 입력하세요.',
  'workbench.settings.backendPane.field.auth.label': '로그인',
  'workbench.settings.backendPane.field.auth.description':
    '이 기기가 로그인하는 방법입니다. 코드로 페어링하거나 token 값을 직접 붙여넣습니다.',
  'workbench.settings.backendPane.field.auth.codeAria': '페어링 코드',
  'workbench.settings.backendPane.field.auth.tokenAria': '인증 token',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'token 붙여넣기',
  'workbench.settings.backendPane.field.auth.paired': '페어링됨. 접근 token 값 저장됨',
  'workbench.settings.backendPane.field.auth.useToken': '대신 인증 token 사용',
  'workbench.settings.backendPane.field.auth.useCode': '대신 코드로 페어링',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': '포트를 입력하세요.',
  'workbench.settings.backendPane.port.notInteger': '포트는 정수여야 합니다.',
  'workbench.settings.backendPane.port.privileged':
    '1024 미만의 포트는 특권 포트이며 높은 권한이 필요합니다. 1024 이상을 고르세요.',
  'workbench.settings.backendPane.port.aboveMax': '포트는 65535 이하여야 합니다.',
  'workbench.settings.backendPane.port.ephemeral':
    '49152–65535 포트는 OS가 나가는 연결에 배정하는 범위입니다. 여기의 리스너는 간헐적으로 바인딩에 실패할 수 있습니다. 1024–49151 범위의 포트가 더 안정적입니다.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'LAN 피어를 허용하시겠습니까?',
  'workbench.settings.backendPane.lan.confirmOk': 'LAN 피어 허용',
  'workbench.settings.backendPane.lan.confirmCancel': '루프백만 유지',
  'workbench.settings.backendPane.lan.confirmBody':
    '데스크톱 앱이 모든 로컬 네트워크 인터페이스에서 수신 대기하여 네트워크의 다른 기기가 연결할 수 있게 됩니다. 네트워크에서든 이 컴퓨터에서든 모든 연결은 페어링된 token 값을 제시해야 하며, token 없는 경로는 없습니다. 기기는 앱이 표시하는 코드로 페어링합니다 (또는 백업 및 동기화 › 동기화에 token 값을 붙여넣습니다).',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.empty':
    '아직 등록된 호스트가 없습니다. 브라우저는 이 워크스페이스의 배타적 라이브 워크플로의 seed 값을 보유하면 이 목록에 참여합니다.',
  'workbench.settings.backendPane.fallback.saveFailed': '새 순서를 저장하지 못했습니다',
  'workbench.settings.backendPane.fallback.removeFailed': '호스트를 제거하지 못했습니다',
  'workbench.settings.backendPane.fallback.dragAria': '드래그하여 순서 변경',
  'workbench.settings.backendPane.fallback.selfTag': '이 브라우저',
  'workbench.settings.backendPane.fallback.pruneTitle': '이 호스트를 제거하시겠습니까?',
  'workbench.settings.backendPane.fallback.pruneBody':
    '배타적 워크플로의 seed 값을 계속 보유하고 있으면 자동으로 다시 참여합니다.',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': '단축키 검색',
  'workbench.settings.keymapPane.noMatches': '검색과 일치하는 단축키가 없습니다.',
  'workbench.settings.keymapPane.recording': '키를 누르세요…',
  'workbench.settings.keymapPane.unbound': '바인딩 없음',
  'workbench.settings.keymapPane.recordTip': '클릭하여 새 단축키 기록',
  'workbench.settings.keymapPane.recordAria': '{label} 단축키 변경',
  'workbench.settings.keymapPane.unbind': '단축키 제거',
  'workbench.settings.keymapPane.unbindAria': '{label} 단축키 제거',
  'workbench.settings.keymapPane.resetAria': '{label} 단축키 재설정',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), { other: '단축키 {count}개의 배정이 충돌합니다' }),
  'workbench.settings.keymapPane.conflictShowOnly': '충돌 표시',
  'workbench.settings.keymapPane.conflictShowAll': '모든 단축키 표시',
  'workbench.settings.keymapPane.conflictBadgeAria': '단축키 충돌',
  'workbench.settings.keymapPane.conflictTooltip': '다음에도 배정됨: {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': '예약된 단축키',
  'workbench.settings.keymapPane.reservedBrowser':
    '브라우저가 이 단축키를 예약합니다. 앱에 도달하기 전에 브라우저가 먼저 처리할 수 있습니다.',
  'workbench.settings.keymapPane.reservedSystem':
    '운영 체제가 이 단축키를 예약합니다. 앱에 도달하기 전에 운영 체제가 먼저 처리할 수 있습니다.',
  'workbench.settings.keymapPane.lookupTip': '단축키를 눌러 작업 찾기',
  'workbench.settings.keymapPane.lookupAria': '단축키로 작업 찾기',
  'workbench.settings.keymapPane.lookupEmpty': '{chord}에 바인딩된 작업이 없습니다.',
  'workbench.settings.keymapPane.conflictPrompt': '{chord}은(는) 이미 다음에 배정되어 있습니다: {labels}',
  'workbench.settings.keymapPane.conflictReassign': '다시 배정',
  'workbench.settings.keymapPane.conflictKeepBoth': '둘 다 유지',
  'workbench.settings.keymapPane.presetAria': '키맵 프리셋',
  'workbench.settings.keymapPane.presetSection': '키맵',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), { other: '프리셋 복원 (사용자 지정 {count}개)' }),
  'workbench.settings.keymapPane.presetRestoreTip': '사용자 지정한 모든 단축키를 활성 프리셋으로 재설정합니다.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': '페어링된 기기',
  'workbench.settings.backendTokens.sectionBlurb':
    '이 백엔드에 연결하는 각 기기는 접근 token 값으로 인증합니다. 연결된 기기는 강조됩니다. token 값을 교체하면 새 시크릿이 발급되고 이전 것은 폐기됩니다.',
  'workbench.settings.backendTokens.labelPlaceholder': "레이블 (선택 사항). 예: 'alice의 휴대폰'",
  'workbench.settings.backendTokens.bindUserPlaceholder': '사용자에 바인딩 (선택 사항)',
  'workbench.settings.backendTokens.generate': 'token 생성',
  'workbench.settings.backendTokens.pairDevice': '기기 페어링',
  'workbench.settings.backendTokens.explainer.intro': '둘 다 아래에 token 값을 추가합니다.',
  'workbench.settings.backendTokens.explainer.generateText': '은 복사하여 기기에 직접 붙여넣을 시크릿을 보여 줍니다.',
  'workbench.settings.backendTokens.explainer.pairText':
    '은 기기가 백업 및 동기화 › 동기화 › 코드로 페어링에서 입력할 짧은 코드를 보여 줍니다 (대체로 링크를 엽니다). 다른 사람이 기기를 설정할 때 쓰세요.',
  'workbench.settings.backendTokens.empty':
    '아직 기기가 없습니다. token 값을 생성해 기기의 백업 및 동기화 › 동기화에 붙여넣거나, 기기를 페어링하여 거기서 코드를 입력하게 하세요.',
  'workbench.settings.backendTokens.mintFailed': 'token 발급 실패: {message}',
  'workbench.settings.backendTokens.rotateFailed': '교체 실패: {message}',
  'workbench.settings.backendTokens.revokeFailed': '취소 실패: {message}',
  'workbench.settings.backendTokens.revokedDevice': 'token 값을 취소했습니다. 이를 쓰던 기기는 연결이 끊겼습니다.',
  'workbench.settings.backendTokens.revokedSession': '세션을 취소했습니다. 사용자가 로그아웃되었습니다.',
  'workbench.settings.backendTokens.rotate': '교체',
  'workbench.settings.backendTokens.revoke': '취소',
  'workbench.settings.backendTokens.rotateConfirmTitle': '이 token 값을 교체하시겠습니까?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    '새 시크릿이 발급되고 현재 것은 취소됩니다. 기기가 다시 연결하려면 새 token 값을 받아야 합니다.',
  'workbench.settings.backendTokens.revokeConfirmTitle': '이 token 값을 취소하시겠습니까?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    '현재 이를 쓰는 기기는 즉시 연결이 끊기며 다시 연결할 수 없습니다.',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': '이 세션을 취소하시겠습니까?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    '사용자가 즉시 로그아웃되고 연결이 끊깁니다. ID 공급자를 통해 다시 로그인해야 합니다.',
  'workbench.settings.backendTokens.revokedTag': '{when} 취소됨',
  'workbench.settings.backendTokens.connectedTag': '연결됨',
  'workbench.settings.backendTokens.expiredTag': '만료됨',
  'workbench.settings.backendTokens.unlabeled': '(레이블 없음)',
  'workbench.settings.backendTokens.unbound': '(바인딩 없음)',
  'workbench.settings.backendTokens.meta.device': 'id {id} · 생성 {created} · 마지막 사용 {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': '사용자 {user}',
  'workbench.settings.backendTokens.meta.session':
    '로그인 {signedIn} · 만료 {expires} · 마지막 접속 {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'SSO 세션',
  'workbench.settings.backendTokens.ssoBlurb':
    '각 SSO 로그인은 스스로 만료되는 세션을 발급합니다. 취소하면 사용자가 즉시 로그아웃되며, ID 공급자를 통해 다시 로그인해야 합니다.',
  'workbench.settings.backendTokens.secretTitle': '지금 이 token 값을 복사하세요',
  'workbench.settings.backendTokens.secretTitleRotated': '지금 교체된 token 값을 복사하세요',
  'workbench.settings.backendTokens.secretBody':
    '백엔드는 이 값의 해시만 저장합니다. 이 대화 상자를 닫으면 시크릿을 복구할 수 없습니다. 잃어버리면 token 값을 취소하고 새로 발급하세요.',
  'workbench.settings.backendTokens.secretBodyRotated':
    '이전 token 값은 이제 취소되었습니다. 기기가 다시 연결할 수 있도록 이 새 시크릿을 전달하세요. 백엔드는 이 값의 해시만 저장합니다. 이 대화 상자를 닫으면 시크릿을 복구할 수 없습니다. 잃어버리면 token 값을 취소하고 새로 발급하세요.',
  'workbench.settings.backendTokens.secretSaved': '저장했습니다',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': '완료',
  'workbench.settings.backendTokens.pairModal.allocating': '코드 할당 중…',
  'workbench.settings.backendTokens.pairModal.startFailed': '페어링을 시작할 수 없습니다',
  'workbench.settings.backendTokens.pairModal.expiredTitle': '페어링 만료',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    '확인 없이 5분이 지났습니다. 이 대화 상자를 닫고 기기 페어링을 다시 클릭하여 처음부터 시작하세요.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': '페어링됨',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    '기기가 코드를 확인했습니다. 새 접근 token 값이 발급되어 그 기기에 저장되었으며 아래 목록에 나타납니다. 기기가 연결할 수 없으면 항목을 취소하고 다시 페어링하세요.',
  'workbench.settings.backendTokens.pairModal.intro.part1': '다른 기기에서',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': '백업 및 동기화 › 동기화',
  'workbench.settings.backendTokens.pairModal.intro.part2': '를 열고, 그',
  'workbench.settings.backendTokens.pairModal.intro.address': '백엔드 주소',
  'workbench.settings.backendTokens.pairModal.intro.part3': '항목을 이 앱으로 향하게 한 다음',
  'workbench.settings.backendTokens.pairModal.intro.part4': '버튼을 클릭하고 다음을 입력하세요:',
  'workbench.settings.backendTokens.pairModal.codeLabel': '페어링 코드',
  'workbench.settings.backendTokens.pairModal.expiresIn': '{remaining} 후 만료',
  'workbench.settings.backendTokens.pairModal.addressListLabel': '이 앱의 백엔드 주소',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': '그 기기에',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    '옵션이 없나요? 대신 거기서 이 링크 중 하나를 여세요. 직접 붙여넣을 token 값을 건네주는 페이지가 열립니다.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'CLI 접근',
  'workbench.settings.cliAccess.sectionBlurb':
    '클릭 한 번으로 이 컴퓨터의 oh 명령줄 도구를 앱에 연결합니다. 접근 token 값이 만들어져 저장되며 복사할 것이 없습니다.',
  'workbench.settings.cliAccess.statusUnconfigured': '이 컴퓨터의 CLI 도구는 아직 연결되지 않았습니다.',
  'workbench.settings.cliAccess.statusConfigured': 'CLI 도구가 {label}(으)로 연결되었습니다.',
  'workbench.settings.cliAccess.statusStale':
    '저장된 CLI token 값이 더 이상 유효하지 않습니다. 접근을 다시 설정하여 다시 연결하세요.',
  'workbench.settings.cliAccess.statusExternal':
    'CLI 도구가 현재 다른 백엔드 ({url})에 연결되어 있습니다. 여기서 접근을 설정하면 대신 이 앱을 가리킵니다.',
  'workbench.settings.cliAccess.statusMalformed': 'CLI 구성 파일을 읽을 수 없습니다: {message}',
  'workbench.settings.cliAccess.pathNote': '{path}에 저장됨',
  'workbench.settings.cliAccess.setUp': 'CLI 접근 설정',
  'workbench.settings.cliAccess.rotate': 'CLI 접근 교체',
  'workbench.settings.cliAccess.connectHere': '이 앱에 연결',
  'workbench.settings.cliAccess.provisioned':
    'CLI 접근을 설정했습니다. 이제 이 컴퓨터의 모든 터미널에서 oh 명령이 동작합니다.',
  'workbench.settings.cliAccess.rotated': 'CLI token 값을 교체했습니다. 이전 token 값은 취소되었습니다.',
  'workbench.settings.cliAccess.provisionFailed': 'CLI 설정 실패: {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.connect.title': '클라이언트 연결',
  'workbench.settings.mcpPane.connect.blurb':
    '클라이언트를 고르고, token 자리 표시자를 접근 token 값으로 바꾸고, 다른 곳에 설치했다면 앱 경로를 조정하세요. 클라이언트가 연결하려면 앱이 실행 중이어야 합니다.',
  'workbench.settings.mcpPane.tokensHome': '접근 token 값의 발급과 취소는 다음 위치에서 합니다:',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle': 'claude_desktop_config.json. 기존 파일에 병합하세요',
  'workbench.settings.mcpPane.snippet.runOnceTitle': '터미널에서 한 번 실행',
  'workbench.settings.mcpPane.snippet.cliTitle': '터미널에서 한 번 실행. 이후 oh 명령 실행에는 플래그가 필요 없습니다',
  'workbench.settings.mcpPane.snippet.httpTitle': 'streamable HTTP 방식을 직접 쓰는 클라이언트용',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'MCP 서버 켜기',
  'workbench.settings.mcpConsent.body':
    '에이전트 클라이언트와 oh TUI 도구는 현재 꺼져 있는 MCP 서버를 통해 이 앱과 통신합니다.',
  'workbench.settings.mcpConsent.info.title': 'MCP 서버',
  'workbench.settings.mcpConsent.info.summary':
    'MCP 클라이언트는 백엔드의 /mcp 엔드포인트 (streamable HTTP 위의 Model Context Protocol)를 통해 이 앱에 접근합니다. mcp.enabled 설정이 그 엔드포인트를 제어합니다. 꺼져 있는 동안 엔드포인트는 404를 반환합니다. 클라이언트는 다른 모든 연결과 같은 접근 token 값으로 인증합니다.',
  'workbench.settings.mcpConsent.ok': '켜기',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': '설치된 파일은 라이선스 키가 아닙니다.',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    '설치된 라이선스가 이 버전이 지원하는 어떤 스키마와도 맞지 않습니다.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    '설치된 라이선스가 이 빌드가 신뢰하지 않는 키로 서명되어 있습니다.',
  'workbench.settings.licensePane.invalid.bad-signature':
    '설치된 라이선스의 서명 검증에 실패했습니다. 서명 후 텍스트가 변경되었습니다.',
  'workbench.settings.licensePane.installed': '라이선스 설치됨',
  'workbench.settings.licensePane.removed': '라이선스를 제거했습니다. 무료 티어로 돌아갑니다',
  'workbench.settings.licensePane.removeFailed': '라이선스 제거 실패: {message}',
  'workbench.settings.licensePane.freeTier.title': '무료 티어',
  'workbench.settings.licensePane.freeTier.body':
    '오늘날 Open Headers 앱의 모든 기능이 포함됩니다. 무료 티어는 서버당 활성 사용자 {limit}명까지 허용합니다. 시트 한도를 높이려면 라이선스 키를 설치하세요.',
  'workbench.settings.licensePane.invalidAlert.title': '설치된 라이선스를 사용할 수 없습니다',
  'workbench.settings.licensePane.invalidAlert.body':
    '앱은 무료 티어 (활성 사용자 {limit}명까지)로 계속 실행됩니다. 아래에 새 키를 붙여넣거나 지원팀에 문의하세요.',
  'workbench.settings.licensePane.grace.title': '라이선스 만료. 유예 기간 활성',
  'workbench.settings.licensePane.grace.body':
    '이 라이선스는 {expiredOn}에 만료되었습니다. {graceEndsOn} 전에 갱신하세요. 그 후에는 사용자 생성이나 재활성화가 무료 한도인 {limit}명으로 돌아갑니다. 기존 사용자는 계속 로그인할 수 있으며 데이터는 영향을 받지 않습니다.',
  'workbench.settings.licensePane.expired.title': '라이선스와 유예 기간이 끝났습니다',
  'workbench.settings.licensePane.expired.body':
    '이제 새 사용자 생성과 재활성화는 무료 한도인 활성 사용자 {limit}명을 따릅니다. 기존 사용자는 계속 로그인할 수 있고, 기존 워크스페이스는 계속 동작하며, 데이터는 영향을 받지 않습니다. 라이선스된 시트 수를 복원하려면 갱신된 키를 설치하세요.',
  'workbench.settings.licensePane.getLicenseCta': '라이선스 받기',
  'workbench.settings.licensePane.renewLicenseCta': '라이선스 갱신',
  'workbench.settings.licensePane.detailsSection': '라이선스',
  'workbench.settings.licensePane.detail.licensedTo': '라이선스 대상',
  'workbench.settings.licensePane.detail.contact': '연락처',
  'workbench.settings.licensePane.detail.seats': '시트',
  'workbench.settings.licensePane.detail.validUntil': '유효 기간',
  'workbench.settings.licensePane.detail.licenseId': '라이선스 id',
  'workbench.settings.licensePane.tag.active': '활성',
  'workbench.settings.licensePane.tag.offline': '오프라인 라이선스',
  'workbench.settings.licensePane.removeConfirm.title': '이 라이선스를 제거하시겠습니까?',
  'workbench.settings.licensePane.removeConfirm.body':
    '앱이 무료 티어 (활성 사용자 {limit}명까지)로 돌아갑니다. 데이터는 영향을 받지 않습니다.',
  'workbench.settings.licensePane.removeConfirm.ok': '제거',
  'workbench.settings.licensePane.removeButton': '라이선스 제거',
  'workbench.settings.licensePane.replaceTitle': '라이선스 교체',
  'workbench.settings.licensePane.installTitle': '라이선스 설치',
  'workbench.settings.licensePane.pastePlaceholder': '라이선스 키 붙여넣기 (oh-license.…)',
  'workbench.settings.licensePane.installButton': '설치',
  'workbench.settings.licensePane.loadFromFile': '파일에서 불러오기…',

  // ── System-plane proxy section (the request-engine proxy design P3) ─
  'workbench.settings.systemProxy.section': '프록시',
  'workbench.settings.systemProxy.previewSection': '경로 미리 보기',
  'workbench.settings.systemProxy.introNote':
    '기기 로컬이며 동기화되지 않습니다. 요청이 자체 프록시 모드를 설정하지 않는 한 모든 것이 이를 따릅니다.',
  'workbench.settings.systemProxy.mode.label': '모드',
  'workbench.settings.systemProxy.mode.infoTitle': '프록시 모드',
  'workbench.settings.systemProxy.mode.infoSummary':
    '이 기기가 각 요청, WebSocket 세션, gRPC 호출의 경로를 정하는 방식입니다.',
  'workbench.settings.systemProxy.mode.infoHeading': '모드',
  'workbench.settings.systemProxy.mode.system': '시스템',
  'workbench.settings.systemProxy.mode.systemDesc':
    '브라우저와 똑같이 이 컴퓨터 자체의 프록시 구성 (시스템 설정, PAC 파일, 자동 검색)을 따릅니다. 기본값입니다. 관리되지 않는 컴퓨터는 그냥 직접 연결합니다.',
  'workbench.settings.systemProxy.system.valuesLabel': '시스템 값',
  'workbench.settings.systemProxy.system.sourcedNote':
    '이 컴퓨터에서 읽음 ({source}). 해석은 여전히 URL 주소마다 답합니다.',
  'workbench.settings.systemProxy.system.unavailable': '시스템 구성을 읽을 수 없습니다: {message}',
  'workbench.settings.systemProxy.mode.manual': '수동',
  'workbench.settings.systemProxy.mode.manualDesc':
    '모든 것에 프록시 하나를 씁니다. URL 스킴에 따라 HTTP, HTTPS 또는 SOCKS5 프록시이며, vault 자격 증명과 우회 목록을 둡니다.',
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    'URL 주소나 로컬 경로의 PAC 파일이 URL 주소마다 결정합니다. 스크립트는 샌드박스된 브라우저 네트워크 스택 안에서만 실행되고 앱 안에서는 실행되지 않습니다.',
  'workbench.settings.systemProxy.mode.off': '끔',
  'workbench.settings.systemProxy.mode.offDesc': '컴퓨터 설정과 무관하게 항상 직접 연결합니다.',
  'workbench.settings.systemProxy.manual.url': '프록시',
  'workbench.settings.systemProxy.manual.urlPlaceholder': '프록시 없음. 직접 연결',
  'workbench.settings.systemProxy.manual.urlExample': '예: http://proxy.example:8080 또는 socks5://proxy.example:1080',
  'workbench.settings.systemProxy.manual.urlError':
    'host:port 또는 http://, https://, socks5:// 프록시 URL 주소를 입력하세요. SOCKS4 방식은 지원되지 않습니다.',
  'workbench.settings.systemProxy.manual.credentials': '자격 증명',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': '인증 없음',
  'workbench.settings.systemProxy.manual.credentialsEmpty': '이 기기의 vault 저장소에 아직 문자열 항목이 없습니다.',
  'workbench.settings.systemProxy.manual.credentialsManage': 'vault 저장소에서 자격 증명 관리',
  'workbench.settings.systemProxy.manual.bypass': '우회 목록',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': '우회 없음. 모든 호스트가 프록시 사용',
  'workbench.settings.systemProxy.manual.bypassExample': '예: localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.manual.bypassError':
    '쉼표로 구분한 항목만 가능합니다. 항목 안에 공백이나 스킴을 넣지 마세요.',
  'workbench.settings.systemProxy.manual.supported': '지원됨',
  'workbench.settings.systemProxy.pac.source': 'PAC',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'PAC URL 없음. 직접 연결',
  'workbench.settings.systemProxy.pac.sourceExample': '예: https://proxy.example/proxy.pac',
  'workbench.settings.systemProxy.pac.sourceError': 'http:// 또는 https:// PAC URL 주소여야 합니다.',
  'workbench.settings.systemProxy.pac.kindUrl': 'URL',
  'workbench.settings.systemProxy.pac.kindFile': '파일',
  'workbench.settings.systemProxy.pac.filePlaceholder': 'PAC 파일 없음. 직접 연결',
  'workbench.settings.systemProxy.pac.fileExample': '예: /path/to/proxy.pac',
  'workbench.settings.systemProxy.pac.fileError': '절대 파일 경로여야 합니다.',
  'workbench.settings.systemProxy.pac.browse': '찾아보기…',
  'workbench.settings.systemProxy.saveFailed': '설정을 저장할 수 없습니다: {message}',
  'workbench.settings.systemProxy.previewPlaceholder': 'URL 주소 미리 보기. 어떤 경로를 지날까요?',
  'workbench.settings.systemProxy.previewButton': '해석',

  // ── Proxy trust pane body (the proxy-security design §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'HTTPS 트래픽을 복호화하려면 이 컴퓨터에서 만든 인증 기관이 필요합니다. 여기서 신뢰를 설정하기 전까지 아무것도 설치되지 않으며, 여기서 설치한 모든 것은 여기서 제거할 수 있습니다.',
  'workbench.settings.proxyTrustPane.refresh': '다시 확인',
  'workbench.settings.proxyTrustPane.loadFailed': '신뢰 상태를 읽을 수 없습니다: {message}',
  'workbench.settings.proxyTrustPane.ca.title': '인증 기관',
  'workbench.settings.proxyTrustPane.ca.none':
    '아직 인증 기관이 없습니다. 처음 신뢰를 설정할 때 이 컴퓨터에서 만들어집니다. 앱과 함께 배포되지 않으며 개인 키는 이 컴퓨터를 떠나지 않습니다.',
  'workbench.settings.proxyTrustPane.ca.subject': '주체',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'SHA-256 지문',
  'workbench.settings.proxyTrustPane.ca.validity': '유효',
  'workbench.settings.proxyTrustPane.ca.validityRange': '{from}부터 {until}까지',
  'workbench.settings.proxyTrustPane.ca.deleteButton': '인증 기관 삭제',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': '인증 기관을 삭제하시겠습니까?',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    '키 쌍이 이 컴퓨터에서 삭제됩니다. 다시 신뢰를 설정하면 새 기관이 만들어집니다.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': '삭제',
  'workbench.settings.proxyTrustPane.ca.deleted': '인증 기관을 삭제했습니다',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': '인증 기관을 삭제할 수 없습니다: {message}',
  'workbench.settings.proxyTrustPane.stores.title': '신뢰 저장소',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': '로그인 키체인',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': '시스템 키체인',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Firefox 프로필',
  'workbench.settings.proxyTrustPane.stores.firefox': 'Firefox',
  'workbench.settings.proxyTrustPane.stores.state.trusted': '신뢰됨',
  'workbench.settings.proxyTrustPane.stores.state.absent': '설치 안 됨',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': '있지만 신뢰되지 않음',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': '다른 인증서',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': '읽을 수 없음',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'OS 저장소로 포함됨',
  'workbench.settings.proxyTrustPane.stores.empty': '이 컴퓨터에서 보이는 신뢰 저장소가 없습니다.',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': '신뢰 저장소에 다른 인증서가 있습니다',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    '우리 기관의 이름을 가진 인증서가 설치되어 있지만 지문이 이 컴퓨터의 기관과 다릅니다. 이 앱이 설치하지 않았고 절대 사용하지 않습니다. 그 인증서가 있는 저장소를 검토하세요.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '기록된 설치 {count}개' }),
  'workbench.settings.proxyTrustPane.installButton': '신뢰 설정…',
  'workbench.settings.proxyTrustPane.wizard.title': '프록시 인증 기관 설치',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': '설치되는 것',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    '이 컴퓨터에서 만든, 이 설치에 고유한 루트 인증서입니다. 개인 키는 저장 시 암호화되며 어디로도 전송되지 않습니다.',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': '가능해지는 것',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    '이를 보유한 신뢰 저장소는 캡처 프록시의 인증서를 받아들이므로 HTTPS 트래픽을 복호화할 수 있습니다. 명시적으로 범위를 지정한 호스트에 한합니다. 나머지는 그대로 통과합니다.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': '제거되는 방식',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    '모든 변경이 기록되며, 이 페이지에서 클릭 한 번으로 정확히 그 변경을 되돌립니다. 앱을 제거해도 같습니다.',
  'workbench.settings.proxyTrustPane.wizard.explain.next': '신뢰 저장소 선택',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb':
    '설치할 곳을 고르세요. 확인하기 전까지 아무것도 바뀌지 않습니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    '내 계정으로 실행되는 앱입니다. 관리자 승인이 필요 없습니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    '이 컴퓨터의 모든 사용자입니다. 관리자 승인을 요청합니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    '시스템 전체 신뢰는 이 빌드에서 아직 사용할 수 없습니다. OpenHeaders 도우미가 필요합니다. 지금은 로그인 키체인을 사용하세요.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox 브라우저는 자체 신뢰 저장소를 가집니다. 발견된 모든 프로필에 설치합니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone': '이 컴퓨터에서 Firefox 프로필을 찾지 못했습니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'Firefox 프로필을 찾았지만 certutil (NSS 도구)이 설치되어 있지 않아 이 컴퓨터에서 그 신뢰 저장소를 관리할 수 없습니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox 브라우저는 OS 저장소를 자동으로 신뢰합니다 (Firefox 120 이상). 위의 키체인이 이를 포함합니다.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), { other: '저장소 {count}개에 설치' }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': '고른 모든 저장소에 신뢰가 설치되었습니다.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    '일부 저장소는 바뀌지 않았습니다. 스스로 재시도하지 않습니다. 원인을 고친 뒤 신뢰를 다시 설정하거나, 신뢰를 제거하여 되돌리세요.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': '설치되고 신뢰됨',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    '관리자 승인이 거부되었습니다. 저장소는 바뀌지 않았습니다.',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    '인증서가 추가되었지만 신뢰될 수 없었습니다. “신뢰 제거”로 정리하세요.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': '실패: {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': '신뢰 설정 실패: {message}',
  'workbench.settings.proxyTrustPane.wizard.done': '완료',
  'workbench.settings.proxyTrustPane.removeButton': '신뢰 제거',
  'workbench.settings.proxyTrustPane.removeConfirm.title': '기록된 모든 저장소에서 인증서를 제거하시겠습니까?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    '기록된 설치를 하나씩 되돌리고 깨끗한지 검증한 뒤 기록을 지웁니다. 인증 기관 자체는 나중의 재설치를 위해 유지됩니다.',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': '제거',
  'workbench.settings.proxyTrustPane.removed':
    '신뢰를 제거했습니다. 기록된 모든 저장소가 깨끗한 것으로 검증되었습니다.',
  'workbench.settings.proxyTrustPane.removePartial':
    '일부 저장소는 깨끗한 것으로 검증할 수 없었습니다. 기록은 유지됩니다. 원인을 고친 뒤 제거를 다시 실행하세요.',
  'workbench.settings.proxyTrustPane.removeFailed': '제거 실패: {message}',
  'workbench.settings.proxyTrustPane.helper.title': '특권 도우미',
  'workbench.settings.proxyTrustPane.helper.blurb':
    '시스템 키체인 신뢰는 macOS에 백그라운드 항목으로 등록된 서명 도우미를 거칩니다. 도우미는 인증서 바이트만 옮기며, 모든 신뢰 결정은 여전히 macOS 관리자 대화 상자를 거칩니다.',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    '이 빌드에는 포함되지 않았습니다. 패키징된 macOS 빌드 전용입니다.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': '등록',
  'workbench.settings.proxyTrustPane.helper.serverLabel': '서버',
  'workbench.settings.proxyTrustPane.helper.state.enabled': '등록됨',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': '승인 대기 중',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': '등록 안 됨',
  'workbench.settings.proxyTrustPane.helper.state.notFound': '찾을 수 없음. macOS에 기록이 없습니다. 다시 등록하세요',
  'workbench.settings.proxyTrustPane.helper.state.unknown': '알 수 없음',
  'workbench.settings.proxyTrustPane.helper.probe.ok': '응답 중',
  'workbench.settings.proxyTrustPane.helper.probe.down': '응답 없음',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS가 승인을 기다리고 있습니다. 로그인 항목 › “백그라운드에서 허용”에서 OpenHeaders 앱을 활성화한 다음 다시 확인하세요.',
  'workbench.settings.proxyTrustPane.helper.registerButton': '등록',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': '등록 해제',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': '로그인 항목 열기',
  'workbench.settings.proxyTrustPane.helper.actionFailed': '도우미 작업 실패: {message}',

  // ── Git pane (workspace-tree binding card, the git-sync plan §9) ─────────
  'workbench.settings.gitPane.notBound.title': '바인딩된 폴더 없음',
  'workbench.settings.gitPane.notBound.body':
    '이 워크스페이스를 폴더에 바인딩하면 모든 규칙, 요청, 환경의 라이브 YAML 트리를 유지합니다. 백업, 차이 비교, 직접 편집, (곧) git 작업에 바로 쓸 수 있습니다.',
  'workbench.settings.gitPane.pathPlaceholder': '절대 폴더 경로',
  'workbench.settings.gitPane.chooseFolder': '폴더 선택…',
  'workbench.settings.gitPane.bindButton': '폴더 바인딩',
  'workbench.settings.gitPane.bound': '폴더를 바인딩했습니다.',
  'workbench.settings.gitPane.boundInitialized': '폴더를 새 워크스페이스 트리로 초기화했습니다.',
  'workbench.settings.gitPane.boundBody': '편집 내용이 이 폴더에 계속 기록되고, 파일에 가한 변경은 앱으로 돌아옵니다.',
  'workbench.settings.gitPane.unbindButton': '바인딩 해제',
  'workbench.settings.gitPane.unbindConfirm.title': '이 폴더의 바인딩을 해제하시겠습니까?',
  'workbench.settings.gitPane.unbindConfirm.body':
    '폴더는 디스크에서 유효한 워크스페이스 트리로 남습니다. 앱이 읽고 쓰기를 멈출 뿐입니다.',
  'workbench.settings.gitPane.unbindConfirm.ok': '바인딩 해제',
  'workbench.settings.gitPane.unbound': '폴더 바인딩을 해제했습니다.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '파일 {count}개를 읽을 수 없어 그대로 두었습니다' }),
  'workbench.settings.gitPane.refusal.locked':
    '이 폴더는 이미 실행 중인 다른 엔진 (프로세스 {pid})에 바인딩되어 있습니다.',
  'workbench.settings.gitPane.refusal.uuidCollision':
    '이 폴더에는 다른 소스를 통해 이 호스트에 이미 있는 워크스페이스가 있습니다.',
  'workbench.settings.gitPane.refusal.identityMismatch': '이 폴더는 다른 워크스페이스 ({uid})에 속합니다.',
  'workbench.settings.gitPane.refusal.invalidManifest': '폴더의 workspace.yaml 파일을 읽을 수 없습니다: {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': '이 워크스페이스는 이미 폴더에 바인딩되어 있습니다.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': '바인딩할 활성 워크스페이스가 없습니다.',
  'workbench.settings.gitPane.git.available': 'Git {version} 발견',
  'workbench.settings.gitPane.needsRepo':
    '이 페이지에는 리포지토리가 있는 바인딩된 폴더가 필요합니다. 다음 위치에서 바인딩하세요:',
  'workbench.settings.gitPane.section.workingTree': '작업 트리',
  'workbench.settings.gitPane.section.branches': '브랜치',
  'workbench.settings.gitPane.section.commit': '커밋',
  'workbench.settings.gitPane.section.history': '기록',
  'workbench.settings.gitPane.git.missing.title': 'Git 설치 안 됨',
  'workbench.settings.gitPane.git.missing.body':
    '이 폴더의 기록을 커밋하려면 git 도구를 설치하세요. 그 밖의 모든 것은 없어도 계속 동작합니다.',
  'workbench.settings.gitPane.git.belowFloor.body':
    '설치된 git 버전 ({version})이 이 기능에 너무 오래되었습니다. 커밋을 활성화하려면 git 도구를 업데이트하세요.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '커밋하지 않은 변경 {count}개' }),
  'workbench.settings.gitPane.git.clean': '작업 트리 깨끗함',
  'workbench.settings.gitPane.git.indexBusy':
    '내 git 인덱스에 스테이징된 변경이 있는 동안 자동 커밋이 일시 중지됩니다.',
  'workbench.settings.gitPane.git.messagePlaceholder': '커밋 메시지',
  'workbench.settings.gitPane.git.commitButton': '커밋',
  'workbench.settings.gitPane.git.committed': '{sha} 커밋했습니다.',
  'workbench.settings.gitPane.git.nothingToCommit': '커밋할 것이 없습니다. 트리가 마지막 커밋과 같습니다.',
  'workbench.settings.gitPane.git.commitFailed': '커밋 실패: {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': '자동 커밋',
  'workbench.settings.gitPane.git.cadenceDescription':
    '엔진이 편집을 스스로 커밋으로 기록하는 시점입니다. 끄면 모든 커밋이 명시적인 동작으로 남습니다.',
  'workbench.settings.gitPane.git.cadenceOff': '끔. 직접 커밋',
  'workbench.settings.gitPane.git.cadenceAuto': '편집이 잠잠해진 뒤',
  'workbench.settings.gitPane.git.cadenceOnBlur': '포커스가 앱을 떠날 때',
  'workbench.settings.gitPane.git.cadenceEvery': '{minutes}분마다',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'git 훅 우회',
  'workbench.settings.gitPane.git.bypassHooksDescription':
    '엔진의 커밋을 --no-verify 옵션으로 실행하여 pre-commit 및 commit-msg 훅을 건너뜁니다.',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    '켜져 있는 동안 엔진 커밋은 pre-commit 및 commit-msg 훅을 건너뜁니다.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}: 동기화됨',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}: {ahead}개 앞섬, {behind}개 뒤처짐',
  'workbench.settings.gitPane.git.noUpstream':
    '구성된 원격이 없습니다. git remote add 및 git push -u 명령으로 추가하면 Pull이 활성화됩니다.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': '{sha} 병합했습니다.',
  'workbench.settings.gitPane.git.upToDate': '이미 최신입니다.',
  'workbench.settings.gitPane.git.pullFailed': 'Pull 실패: {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': '{sha} 푸시했습니다.',
  'workbench.settings.gitPane.git.nothingToPush': '푸시할 것이 없습니다. 이미 동기화되어 있습니다.',
  'workbench.settings.gitPane.git.pushFailed': 'Push 실패: {detail}',
  'workbench.settings.gitPane.git.pushRejected': '원격에 새 커밋이 있습니다. 먼저 Pull 한 다음 다시 Push 하세요.',
  'workbench.settings.gitPane.git.pushNoPermission.title': '푸시 권한 없음',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    '이 원격은 내게 읽기 전용입니다. 커밋은 로컬에 남으며, 새 브랜치로 게시한 뒤 git 호스트에서 병합 요청을 열 수 있습니다.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.exportBranchButton': '새 브랜치로 Push',
  'workbench.settings.gitPane.git.exportedBranch': '{branch} 브랜치를 푸시했습니다.',
  'workbench.settings.gitPane.git.autoPushLabel': '커밋마다 Push',
  'workbench.settings.gitPane.git.autoPushDescription':
    '엔진이 커밋을 기록할 때마다 현재 브랜치를 업스트림에 바로 푸시합니다.',
  'workbench.settings.gitPane.git.branch.current': '{branch} 브랜치에 있음',
  'workbench.settings.gitPane.git.branch.detached': '분리된 HEAD 상태입니다. 이 기록을 유지하려면 브랜치를 만드세요.',
  'workbench.settings.gitPane.git.branch.switchLabel': '전환 대상',
  'workbench.settings.gitPane.git.branch.switched': '{branch} 브랜치로 전환했습니다.',
  'workbench.settings.gitPane.git.branch.switchFailed': '전환 실패: {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': '커밋하지 않은 변경이 있습니다',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        other: '{branch} 브랜치로 전환하기 전에 커밋하지 않은 변경 {count}개를 커밋, 스태시 또는 버리세요.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': '커밋 후 전환',
  'workbench.settings.gitPane.git.branch.dirtyStash': '스태시 후 전환',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': '변경 버리기',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': '커밋하지 않은 변경을 버리시겠습니까?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    '새 파일을 포함해 커밋하지 않은 모든 변경이 삭제됩니다. 되돌릴 수 없습니다.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': '버리기',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.branch.createButton': '만들고 전환',
  'workbench.settings.gitPane.git.branch.created': '{branch} 브랜치를 만들었습니다.',
  'workbench.settings.gitPane.git.branch.createFailed': '브랜치를 만들 수 없습니다: {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': '현재 브랜치로 병합',
  'workbench.settings.gitPane.git.branch.mergeButton': '병합',
  'workbench.settings.gitPane.git.branch.merged': '{sha} 병합했습니다.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': '이미 최신입니다.',
  'workbench.settings.gitPane.git.branch.mergeFailed': '병합 실패: {detail}',
  'workbench.settings.gitPane.git.forcePush.title': '원격 기록이 다시 쓰였습니다',
  'workbench.settings.gitPane.git.forcePush.body':
    '원격 브랜치에 마지막으로 동기화한 기록 ({sha})이 더 이상 없습니다. 진행 방법을 고르세요. 결정하기 전까지 아무것도 바뀌지 않습니다.',
  'workbench.settings.gitPane.git.forcePush.abandon': '로컬 변경 포기',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': '로컬 변경을 포기하시겠습니까?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    '마지막 동기화 이후의 로컬 커밋이 버려지고 다시 쓰인 원격 기록이 워크스페이스 상태가 됩니다.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': '포기',
  'workbench.settings.gitPane.git.forcePush.rescue': '구조 브랜치에 보존',
  'workbench.settings.gitPane.git.forcePush.reapply': '위에 다시 적용',
  'workbench.settings.gitPane.git.forcePush.resolved': '다시 쓰인 기록을 수락했습니다 ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': '로컬 기록을 {branch} 브랜치에 보존했습니다.',
  'workbench.settings.gitPane.git.forcePush.failed': '해결할 수 없습니다: {detail}',
  'workbench.settings.gitPane.git.history.show': '기록 표시',
  'workbench.settings.gitPane.git.history.hide': '숨기기',
  'workbench.settings.gitPane.git.history.empty': '아직 커밋이 없습니다.',
  'workbench.settings.gitPane.git.history.loadFailed': '기록을 읽을 수 없습니다: {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': '공동 작성자 {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': '기록 — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': '아직 이 파일을 건드린 커밋이 없습니다.',
} as const satisfies Catalog;
