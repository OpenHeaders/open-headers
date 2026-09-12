/**
 * DevTools panel — console tool window — Korean. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level wire
 * names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context labels
 * (top / frame names / script URLs), source locations, "(anonymous)",
 * the browser's synthesized network phrasing quoted verbatim
 * ("finished loading", "Access to fetch at …"), key names (Tab /
 * Enter / arrows ride raw), and the example-transcript rows in the (i)
 * corpora. Network 패널 keeps the raw panel name (zh-CN precedent).
 * Mints: 프롬프트 = prompt (REPL); 즉시 평가 = eager evaluation; 평가 =
 * evaluate; 트랜스크립트 = transcript; 캡처 = capture (carried); 스택
 * 추적 = stack trace; 고정 = pin (carried); 범위 = the debug-reach scope
 * (S19 law); 보존 = preserve. OH's own setting labels quoted in prose
 * copy this file's mints in “ ”.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': '콘솔 지우기',
  'panel.console.collapseAll': '모두 접기',
  'panel.console.expandAll': '모두 펼치기',
  'panel.console.filterAria': '콘솔 메시지 필터',
  'panel.console.levelTitle': '로그 수준: {label}',
  'panel.console.settings': '콘솔 설정',
  'panel.console.settingsPaneAria': '콘솔 설정',
  'panel.console.contextTitle': 'JavaScript 컨텍스트: 콘솔 명령이 평가되는 위치',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': '상세',
  'panel.console.levels.info': '정보',
  'panel.console.levels.warnings': '경고',
  'panel.console.levels.errors': '오류',
  'panel.console.levels.all': '모든 수준',
  'panel.console.levels.defaultLevels': '기본 수준',
  'panel.console.levels.hideAll': '모두 숨기기',
  'panel.console.levels.only': '{level}만',
  'panel.console.levels.custom': '사용자 지정 수준',
  'panel.console.levels.default': '기본값',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': '네트워크 숨기기',
  'panel.console.setting.hideNetworkTitle': '브라우저의 네트워크 로그 항목(실패 및 차단된 요청)을 숨깁니다',
  'panel.console.setting.logXhr': 'XMLHttpRequest 기록',
  'panel.console.setting.logXhrTitle': 'XHR, fetch 또는 EventSource 요청이 완료되거나 실패할 때 메시지를 기록합니다',
  'panel.console.setting.preserveLog': '로그 보존',
  'panel.console.setting.preserveLogTitle': '탐색 시 로그를 지우지 않습니다',
  'panel.console.setting.eagerEval': '즉시 평가',
  'panel.console.setting.eagerEvalTitle': '프롬프트의 텍스트를 즉시 평가합니다 (부작용 없는 미리보기)',
  'panel.console.setting.selectedContextOnly': '선택한 컨텍스트만',
  'panel.console.setting.selectedContextOnlyTitle': '선택한 컨텍스트의 메시지만 표시합니다',
  'panel.console.setting.autocompleteHistory': '기록에서 자동 완성',
  'panel.console.setting.autocompleteHistoryTitle': '프롬프트에 입력하는 동안 이전에 실행한 명령을 제안합니다',
  'panel.console.setting.groupSimilar': '콘솔에서 유사한 메시지 그룹화',
  'panel.console.setting.groupSimilarTitle': '반복되는 동일 메시지를 개수가 표시된 한 행으로 접습니다',
  'panel.console.setting.evalUserGesture': '코드 평가를 사용자 작업으로 처리',
  'panel.console.setting.evalUserGestureTitle':
    '사용자 제스처와 함께 평가하므로 사용자 활성화가 필요한 API 호출이 프롬프트에서 작동합니다',
  'panel.console.setting.showCorsErrors': '콘솔에 CORS 오류 표시',
  'panel.console.setting.showCorsErrorsTitle': '페이지 자체 출력과 함께 CORS 정책 오류를 표시합니다',

  // Per-setting (i) info corpora
  'panel.console.info.exampleCaption': '콘솔 예시',
  'panel.console.info.hideNetwork.summary':
    '페이지의 콘솔 출력은 항상 유지하면서 브라우저 자체의 네트워크 로그 항목(실패 및 차단된 요청)을 숨깁니다.',
  'panel.console.info.hideNetwork.description':
    '“XMLHttpRequest 기록”이 합성하는 "finished loading" 행도 함께 숨깁니다. 이 행도 네트워크 출처 메시지입니다.',
  'panel.console.info.logXhr.summary': 'XHR, fetch 또는 EventSource 요청이 완료되거나 실패할 때마다 행을 기록합니다.',
  'panel.console.info.logXhr.description':
    '행은 실패를 포함해 정보 수준으로 기록되며, URL 링크는 Network 패널의 해당 요청 행으로 연결됩니다. “네트워크 숨기기”를 켜면 이 행도 숨겨집니다.',
  'panel.console.info.preserveLog.summary': '페이지 탐색 시 로그를 지우지 않고 유지합니다.',
  'panel.console.info.preserveLog.description':
    '끄면 탐색(페이지의 최상위 컨텍스트가 다시 만들어지는 시점) 이후에 도착한 항목만 보이도록 보기가 잘립니다.',
  'panel.console.info.eagerEval.summary': '입력 중인 표현식의 결과를 프롬프트 아래 회색 줄에 미리 보여 줍니다.',
  'panel.console.info.eagerEval.description':
    '미리보기는 부작용 없이 평가됩니다. 페이지 상태를 바꿀 표현식은 실행되는 대신 아무것도 표시하지 않으며, Enter 키를 누르기 전까지 로그에는 아무것도 기록되지 않습니다.',
  'panel.console.info.selectedContextOnly.summary':
    '도구 모음의 컨텍스트 선택기에서 고른 JavaScript 컨텍스트의 메시지만 표시합니다.',
  'panel.console.info.selectedContextOnly.description':
    '컨텍스트가 없는 항목(브라우저 자체의 로그 항목)은 항상 표시됩니다.',
  'panel.console.info.autocompleteHistory.summary':
    '입력한 내용을 확장하는 가장 최근 명령을 프롬프트에 흐린 완성 텍스트로 제안합니다.',
  'panel.console.info.autocompleteHistory.description':
    'Tab 키(또는 입력 끝에서 → 키)로 수락하고, ↑/↓ 키는 여전히 기록을 탐색합니다. 기록은 현재 패널 세션 동안 유지됩니다.',
  'panel.console.info.groupSimilar.title': '유사한 메시지 그룹화',
  'panel.console.info.groupSimilar.summary': '연속된 동일 메시지를 개수 배지가 있는 한 행으로 접습니다.',
  'panel.console.info.groupSimilar.description':
    '입력한 명령과 그 결과는 그룹화되지 않습니다. 트랜스크립트는 그대로 유지됩니다.',
  'panel.console.info.evalUserGesture.summary': '프롬프트 명령을 사용자 제스처가 발생시킨 것처럼 실행합니다.',
  'panel.console.info.evalUserGesture.description':
    '이 설정을 켜면 사용자 활성화가 필요한 API 호출(창 열기, 클립보드 쓰기, 전체 화면)이 프롬프트에서 성공합니다.',
  'panel.console.info.showCorsErrors.summary':
    '브라우저의 CORS 설명("Access to fetch at … has been blocked by CORS policy: …")을 페이지 출력과 함께 표시합니다.',
  'panel.console.info.showCorsErrors.description':
    '끄면 해당 설명 메시지만 숨겨집니다. 차단된 요청 자체는 Network 패널에 계속 표시됩니다.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    '캡처 중지됨: 이 탭이 디버그 모드 범위를 벗어났습니다. 마지막으로 캡처한 출력을 표시합니다.',
  'panel.console.banner.debugOff': '캡처 중지됨: 디버그 모드가 꺼져 있습니다. 마지막으로 캡처한 출력을 표시합니다.',
  'panel.console.enableDebug': '디버그 모드 활성화',
  'panel.console.empty.noCdp.title': '콘솔 캡처에는 디버그 모드가 필요합니다',
  'panel.console.empty.noCdp.sub': '이 브라우저에서는 디버그 모드 검사를 사용할 수 없습니다.',
  'panel.console.empty.capturing.title': '아직 콘솔 출력 없음',
  'panel.console.empty.capturing.sub': '이 탭의 로그 메시지와 처리되지 않은 예외가 발생하는 대로 여기에 표시됩니다.',
  'panel.console.empty.debugOff.title': '콘솔 로그를 보려면 디버그 모드를 활성화하세요',
  'panel.console.empty.debugOff.sub':
    '디버그 모드가 켜져 있는 동안 Open Headers 확장 프로그램이 이 탭의 콘솔 출력과 처리되지 않은 예외를 캡처합니다.',
  'panel.console.empty.outOfScope.title': '이 탭은 디버그 모드 범위 밖에 있습니다',
  'panel.console.empty.outOfScope.sub':
    '콘솔 출력을 캡처하려면 디버그 모드에서 범위를 바꾸거나 이 탭을 고정해 범위 안으로 가져오세요.',
  'panel.console.noMatch': '필터와 일치하는 콘솔 항목이 없습니다.',
  'panel.console.revealedHidden': '표시하려는 메시지가 활성 필터에 의해 숨겨져 있습니다',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) => plural(locale, Number(count), { other: '동일 메시지 {count}개' }),
  'panel.console.expandStack': '스택 추적 펼치기',
  'panel.console.collapseStack': '스택 추적 접기',

  // REPL prompt
  'panel.console.prompt.waiting': 'JavaScript 컨텍스트를 기다리는 중…',
  'panel.console.prompt.placeholder': '선택한 컨텍스트에서 JavaScript 코드 실행',
  'panel.console.prompt.aria': '콘솔 프롬프트',
  'panel.console.prompt.previewAria': '즉시 평가 미리보기',
} as const satisfies Catalog;
