/**
 * TUI namespace — Korean. Mirrors `catalogs/en/tui.ts` key for key.
 * Data stays data: workspace / environment / rule names, uids, URLs,
 * kinds, and daemon-provided copy render verbatim in the composers;
 * `OpenHeaders`, `env: {name}`, `{count} vars`, `uid`, `oh status`, the
 * `r` key ride raw (ja parity) with 키 / 명령 as head nouns. Quotes the
 * shipped ko mints: 데몬 = daemon (wire noun), oh TUI 도구 (settings
 * panes), 명령 팔레트, 워크스페이스 / 환경 / 규칙, 켜짐 / 꺼짐 = on /
 * off, 초안 = draft, 게시 = publish, 전환 = switch, 새로 고침, 연결됨.
 * MINTS: 대시보드 carried; 마스킹됨 = masked; 게시 해제 = unpublish;
 * 대기 화면 = the park screen. Footer legend verbs stay bare nouns.
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: 없음',
  'tui.header.connected': '연결됨',
  'tui.header.unreachable': '데몬에 연결할 수 없음',
  'tui.header.synced': '{ago} 전 동기화',
  'tui.header.syncedJustNow': '방금 동기화',
  'tui.header.syncing': '동기화 중…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': '워크스페이스',
  'tui.pane.environments': '환경',
  'tui.pane.rules': '규칙',
  'tui.pane.rules.summary': '{on} 켜짐 {sep} {off} 꺼짐 {sep} {draft} 초안',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': '켜짐',
  'tui.row.off': '꺼짐',
  'tui.row.draft': '(초안)',
  'tui.row.notLoaded': '불러오지 않음',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': '환경 없음',
  'tui.row.masked': '(마스킹됨)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': '이동',
  'tui.footer.open': '열기',
  'tui.footer.filter': '필터',
  'tui.footer.refresh': '새로 고침',
  'tui.footer.yank': 'uid 복사',
  'tui.footer.quit': '종료',
  'tui.footer.back': '뒤로',
  'tui.footer.scroll': '스크롤',
  'tui.footer.retryNow': '지금 재시도',
  'tui.footer.palette': '팔레트',
  'tui.footer.help': '도움말',
  'tui.footer.toggle': '전환',
  'tui.footer.publish': '게시',
  'tui.footer.switch': '전환',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': '키보드',
  'tui.help.group.navigate': '이동',
  'tui.help.group.act': '동작',
  'tui.help.group.find': '찾기',
  'tui.help.group.session': '세션',
  'tui.help.topBottom': '맨 위 / 맨 아래',
  'tui.help.page': '페이지',
  'tui.help.focusPane': '창 포커스',
  'tui.help.backClear': '뒤로 / 지우기',
  'tui.help.filterPane': '창 필터',
  'tui.help.thisHelp': '이 도움말',
  'tui.help.palette': '명령 팔레트',
  'tui.help.openSwitch': '열기 / 전환',
  'tui.help.toggleRule': '규칙 전환',
  'tui.help.publish': '게시 / 게시 해제',
  'tui.help.note': '터미널이 허용하는 한 앱과 같은 키입니다.',
  'tui.help.close': '닫기',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': '지금 새로 고침',
  'tui.palette.action.help': '도움말 열기',
  'tui.palette.action.switchWorkspace': '워크스페이스 전환…',
  'tui.palette.action.switchEnvironment': '환경 전환…',
  'tui.palette.action.toggleRule': '규칙 활성 전환',
  'tui.palette.action.publishRule': '규칙 게시 / 게시 해제',
  'tui.palette.picker.workspace': '워크스페이스 전환',
  'tui.palette.picker.environment': '환경 전환',
  'tui.palette.empty': '일치하는 명령 없음',
  'tui.palette.run': '실행',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': '필터: /{query} {sep} {count}개 일치',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid 값을 클립보드에 복사했습니다',
  'tui.notice.staleData': '마지막으로 알려진 데이터를 표시 중. 다시 연결하는 중…',
  'tui.notice.writeLost': '변경이 적용되지 않음. 데몬에 연결할 수 없음',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': '이 워크스페이스에 아직 규칙이 없습니다.',
  'tui.empty.rules.body':
    '규칙은 OpenHeaders 앱에서 만듭니다. 만들어지는 즉시 대시보드에 나타납니다. r 키를 눌러 새로 고치세요.',
  'tui.empty.environments.title': '이 워크스페이스에 아직 환경이 없습니다.',
  'tui.empty.environments.body': '환경은 OpenHeaders 앱에서 만듭니다. 그동안에는 “환경 없음”을 선택할 수 있습니다.',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': '규칙: {name}',
  'tui.detail.state': '상태',
  'tui.detail.type': '유형',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': '게시됨. 연결된 브라우저 확장 프로그램에서 라이브',
  'tui.detail.state.draft': '초안. 라이브 트래픽에 영향 없음',
  'tui.detail.editingNote': '편집은 OpenHeaders 앱에서 합니다. TUI 도구는 읽고 전환합니다.',
  'tui.detail.loading': '불러오는 중…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': '환경: {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': '데몬에 연결할 수 없거나 MCP 서버가 꺼져 있음',
  'tui.park.body1': 'OpenHeaders 데몬에 다음 주소로 연결할 수 없거나',
  'tui.park.body2': '{url}, 데몬의 MCP 서버가 꺼져 있습니다.',
  'tui.park.hint1': 'OpenHeaders 앱 (또는 데몬 호스트)을 시작하거나,',
  'tui.park.hint2': '다음 명령으로 상태를 확인하세요:  oh status',
  'tui.park.hint3': '그런 다음 r 키를 눌러 재시도하세요.',
  'tui.park.retryIn': '자동 재시도 중 {sep} 다음 시도까지 {seconds}초',
  'tui.park.retrying': '재시도 중…',
} as const satisfies Catalog;
