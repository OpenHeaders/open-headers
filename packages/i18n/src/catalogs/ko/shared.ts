/**
 * Shared namespace — Korean. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules. Register contract for the
 * ko catalogs (pattern-setter): formal polite 합니다체 in every sentence
 * (～합니다 / ～됩니다 / ～없습니다 — never 해요체 or plain 한다체);
 * labels, buttons and menu rows are bare nouns or nominalized verbs
 * (저장, 닫기, 복사), never imperatives; requests to the user read
 * ～하세요 (never ～해 주세요 / ～하십시오). Punctuation is half-width
 * ASCII `. , : ? ! ( )` with a following space, as Korean writes it;
 * the en aside dash restructures into `.` or `:` and is never kept;
 * ellipsis is `…`. Korean spaces between words; a half-width space
 * separates every Latin/digit token from Hangul (zh-CN / ja law
 * carries) EXCEPT counters and units, which attach to their figure
 * ({count}개, {digits}자리, 2초, {period}s마다). UI labels quoted in
 * prose use “ ” (en's “” and "" alike); JSON-wire quotes stay ASCII.
 * Particles: the lint's glossary boundary treats Hangul as a letter,
 * so a particle or copula NEVER attaches to a raw token (`URL이`
 * reads as a dropped term) — give the token a Korean head noun and
 * attach the particle there (URL 형식이, token 값을, DevTools 창을,
 * Vault 항목이, WebSocket 연결을); a `{placeholder}` takes only an
 * invariant particle attached directly (에, 에서, 의, 도) and never a
 * consonant-dependent one (은/는, 이/가, 을/를, 와/과, 로/으로) —
 * restructure with a head noun ({algorithm} 알고리즘으로) instead.
 * Loanword ledger (국립국어원 spellings): 서버, 헤더, 브라우저, 사용자,
 * 편집기 (never 에디터), 폴더, 워크스페이스, 백엔드, 핸드셰이크,
 * 페어링, 데스크톱 앱, 팝업, 프로브, 클립보드, 컬렉션, 시크릿, 프록시,
 * 스크립트, 프레임, 스트림, 도메인, 캐시, 플래그, 패널, 도크, 탭, 셸,
 * 커밋. Native / Sino-Korean for the domain nouns: 규칙 = rule, 요청 =
 * request, 응답 = response, 변수 = variable, 환경 = environment, 범위 =
 * scope, 재정의 = Override (덮어쓰기 stays file overwrite), 병합 = Merge,
 * 덧붙이기 = Append, 전환 = Switch, 설정 = Settings, 활성 / 비활성 =
 * Enabled / Disabled, 라이브 = Live (never 실시간 for the product
 * noun), 동적 = Dynamic, 단계 = Step, 확장 프로그램 = extension
 * (Chrome's own ko UI word). Plurals are `other`-only (CLDR ko);
 * counters mint per noun — 개 for rules and items, 건 for events.
 * Dev nouns retain English liberally: the glossary raw-token laws
 * carry over unchanged (WebSocket, URL, token lowercase raw). The
 * diagram width helper is codepoint-based (>U+2E7F ⇒ 1.85 units), so
 * Hangul needs no per-locale knob.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': '저장',
  'shared.action.cancel': '취소',
  'shared.action.close': '닫기',
  'shared.action.copy': '복사',
  'shared.action.remove': '제거',
  'shared.toast.copiedToClipboard': '클립보드에 복사했습니다',
  'shared.toast.copyFailed': '클립보드 접근이 거부되었습니다. 값을 직접 복사하세요',
  'shared.count.rules': ({ count }, locale) => plural(locale, Number(count), { other: '규칙 {count}개' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': '문제가 발생했습니다',
  'shared.errorBoundary.subtitle': '팝업을 불러오는 중 오류가 발생했습니다. 닫았다가 다시 열어 보세요.',
  'shared.errorBoundary.reload': '다시 불러오기',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Open Headers 확장 프로그램이 업데이트되었거나 다시 로드되었습니다',
  'shared.contextInvalidated.body': '계속하려면 DevTools 창을 닫았다가 다시 여세요.',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': '연결 OK',
  'shared.probe.reachableDescription': '{label}에 연결할 수 있습니다.',
  'shared.probe.notReachable': '연결할 수 없음',
  'shared.probe.title.authRequired': '연결은 되지만 인증이 필요합니다',
  'shared.probe.title.workspaceUnknown': '연결은 되지만 워크스페이스가 공유되지 않았습니다',
  'shared.probe.title.versionMismatch': '연결은 되지만 버전이 일치하지 않습니다',
  'shared.probe.title.notReady': '연결은 되지만 아직 준비되지 않았습니다',
  'shared.probe.fail.invalidUrl': 'URL 형식이 잘못되었습니다.',
  'shared.probe.fail.invalidUrlDetail': 'URL 형식이 잘못되었습니다. {detail}',
  'shared.probe.fail.timeout': '응답을 기다리다 시간이 초과되었습니다. 백엔드가 실행 중인가요?',
  'shared.probe.fail.closedBeforeWelcome':
    '핸드셰이크 전에 연결이 닫혔습니다. 해당 포트에서 백엔드가 실행되고 있지 않은 것 같습니다.',
  'shared.probe.fail.openFailed': 'WebSocket 연결을 열 수 없습니다.',
  'shared.probe.fail.openFailedDetail': 'WebSocket 연결을 열 수 없습니다: {detail}.',
  'shared.probe.fail.protocolMismatch': '연결은 되지만 프로토콜 버전이 호환되지 않습니다. 두 앱을 모두 업데이트하세요.',
  'shared.probe.fail.workspaceUnknown':
    '연결은 됩니다. 백엔드는 실행 중이지만 아직 이 워크스페이스를 공유하지 않습니다. 전환하면 둘이 페어링됩니다.',
  'shared.probe.fail.protocolTooOld': '연결은 되지만 이 앱이 백엔드보다 오래된 버전입니다. 이쪽을 업데이트하세요.',
  'shared.probe.fail.protocolTooNew': '연결은 되지만 백엔드가 이 앱보다 오래된 버전입니다. 백엔드를 업데이트하세요.',
  'shared.probe.fail.authRequired':
    '연결은 되지만 이 기기는 아직 인증되지 않았습니다. 코드로 페어링하거나 위에 token 값을 붙여넣은 다음 “전환”을 누르세요.',
  'shared.probe.fail.rejected': '거부됨: {reason}',
  'shared.probe.fail.rejectedUnknown': '거부됨: 원인 불명',
  'shared.probe.fail.malformedWelcome': '서버에 연결했지만 Open Headers 프로토콜을 사용하지 않습니다.',
  'shared.probe.fail.generic': '프로브에 실패했습니다.',
} as const satisfies Catalog;
