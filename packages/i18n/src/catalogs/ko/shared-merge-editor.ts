/**
 * Shared merge-editor family — Korean. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included, half-width ` · ` separator),
 * the ✕ ▶ ◀ ↘ ↙ · glyphs, the `+ − ~ =` kind-label prefixes and the
 * `Merge:` command-palette namespace prefix (de precedent) stay raw.
 * Mints: 헝크 = hunk (개 counter); 수신 = incoming / 현재 = current /
 * 베이스 = base / 결과 = result; 상대 측 = theirs / 내 것 = mine (carried
 * from shared-conflicts); 수락 = accept (a side); 창 = pane; 측면 여백
 * = side gutters; 해결 = resolve; 충돌 없음 = non-conflicting; 병합 =
 * merge (the register — the palette prefix stays raw); 공통 조상 =
 * common ancestor; 보류 = pending (carried); 압축 보기 = compact view.
 * `{scope}` takes 범위 as its head noun before 를 (the particle law).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': '이전 헝크 · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': '다음 헝크 · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': '모든 헝크가 해결됨',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), { other: '헝크 {count}개 남음' }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '충돌 {count}건' }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '충돌 없음 {count}개',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    '한쪽만 건드린 헝크를 모두 한 번의 실행 취소 단위로 적용합니다. 충돌은 수동 해결을 위해 남습니다. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': '충돌 없음 적용',
  'shared.mergeEditor.toolbar.acceptAll': '모두 수락',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': '수신 모두 수락 (이 파일)',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': '현재 모두 수락 (이 파일)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': '수신 모두 수락 (세션 전체)',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': '현재 모두 수락 (세션 전체)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': '수신 모두 수락',
  'shared.mergeEditor.toolbar.acceptAllCurrent': '현재 모두 수락',
  'shared.mergeEditor.toolbar.baseUnavailable': '베이스 보기를 사용할 수 없습니다. 이 세션에는 공통 조상이 없습니다.',
  'shared.mergeEditor.toolbar.resetLayout': '현재 레이아웃의 창 크기 초기화',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': '열',
  'shared.mergeEditor.layout.baseOnTop': '베이스 위',
  'shared.mergeEditor.layout.baseInCenter': '베이스 가운데',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': '충돌 없음 표시',
  'shared.mergeEditor.toggle.compactView': '압축 보기',
  'shared.mergeEditor.toggle.compactViewTooltip':
    '모든 창에서 바뀌지 않은 영역을 접습니다. 헝크 영역 (과 몇 줄의 문맥)만 보입니다. 대부분의 줄이 그대로인 파일에 유용합니다.',
  'shared.mergeEditor.toggle.singleClickResolve': '한 번 클릭으로 해결',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    '켜면 헝크의 한쪽을 수락할 때 다른 쪽이 자동으로 무시되어 한 번의 클릭으로 헝크가 해결됩니다. 끄면 대각선 덧붙이기 (↘ / ↙) 기능이 유지되어 양쪽을 쌓을 수 있습니다.',
  'shared.mergeEditor.toggle.inlineLabels': '인라인 레이블',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    "양쪽 창의 보류 중인 각 헝크 위에 '{accept} | {combine} | {ignore}' 레이블을 표시합니다. 레이아웃과 무관합니다.",
  'shared.mergeEditor.toggle.sideGutters': '측면 여백',
  'shared.mergeEditor.toggle.sideGuttersTooltip': '결과 편집기 양옆에 ✕ ▶ / ◀ ✕ 기호를 표시합니다.',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    '측면 여백은 열 레이아웃에서만 쓸 수 있습니다. 베이스 위 / 베이스 가운데 레이아웃은 결과를 상대 측 / 내 것과 다른 행에 둡니다.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': '수신 모두 수락 (세션)',
  'shared.mergeEditor.confirm.acceptCurrentTitle': '현재 모두 수락 (세션)',
  'shared.mergeEditor.confirm.replaceWithIncoming': '{scope} 범위를 수신 버전으로 바꿉니다.',
  'shared.mergeEditor.confirm.resetToCurrent': '{scope} 범위를 현재 버전으로 되돌립니다.',
  'shared.mergeEditor.confirm.discardsLocal': '세션의 모든 파일에서 내 로컬 편집을 버립니다.',
  'shared.mergeEditor.confirm.discardsIncoming': '세션의 모든 파일에서 모든 수신 변경을 버립니다.',
  'shared.mergeEditor.confirm.okIncoming': '수신 모두 수락',
  'shared.mergeEditor.confirm.okCurrent': '현재 모두 수락',
  'shared.mergeEditor.confirm.cancel': '취소',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), { other: '파일 {count}개' }),
  'shared.mergeEditor.groupOther': '기타',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': '적용 중 오류가 보고되었습니다:',
  'shared.mergeEditor.errors.unknown': '알 수 없는 오류',
  'shared.mergeEditor.emptySession': '이 병합 세션에 파일이 없습니다.',
  'shared.mergeEditor.footer.cancel': '취소',
  'shared.mergeEditor.footer.completeMerge': '병합 완료',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': '수신 (상대 측)',
  'shared.mergeEditor.pane.result': '결과',
  'shared.mergeEditor.pane.yoursEditHere': '내 버전 (내 것, 여기서 편집)',
  'shared.mergeEditor.pane.current': '현재 (내 것)',
  'shared.mergeEditor.pane.base': '베이스 (공통 조상)',
  'shared.mergeEditor.sash.columns12': '1열 / 2열 크기 조절',
  'shared.mergeEditor.sash.columns23': '2열 / 3열 크기 조절',
  'shared.mergeEditor.sash.rows': '위 행 / 아래 행 크기 조절',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': '추가됨',
  'shared.mergeEditor.fileList.kindModified': '수정됨',
  'shared.mergeEditor.fileList.kindRemoved': '제거됨',
  'shared.mergeEditor.fileList.statusUnresolved': '미해결',
  'shared.mergeEditor.fileList.statusPartial': '일부 해결',
  'shared.mergeEditor.fileList.statusResolved': '해결됨',
  'shared.mergeEditor.fileList.statusFailed': '실패',
  'shared.mergeEditor.fileList.pairedWith': '짝: {label}',
  'shared.mergeEditor.fileList.hunksRemaining': '헝크 {count}개 남음',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': '수신 수락',
  'shared.mergeEditor.zone.acceptCurrent': '현재 수락',
  'shared.mergeEditor.zone.acceptCombination': '조합 수락',
  'shared.mergeEditor.zone.ignore': '무시',
  'shared.mergeEditor.zone.combineTooltip': '양쪽을 쌓습니다. 수신이 먼저, 현재가 다음',
  'shared.mergeEditor.zone.removeIncoming': '수신 제거',
  'shared.mergeEditor.zone.removeCurrent': '현재 제거',
  'shared.mergeEditor.zone.revertIncomingTitle': '수신을 보류 상태로 되돌려 다시 결정',
  'shared.mergeEditor.zone.revertCurrentTitle': '현재를 보류 상태로 되돌려 다시 결정',
  'shared.mergeEditor.zone.statusNoChanges': '수락된 변경 없음',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': '수신 + 현재',
  'shared.mergeEditor.zone.statusIncoming': '수신',
  'shared.mergeEditor.zone.statusCurrent': '현재',
  'shared.mergeEditor.zone.statusIncomingSkipped': '수신 건너뜀',
  'shared.mergeEditor.zone.statusCurrentSkipped': '현재 건너뜀',
  'shared.mergeEditor.zone.kindAdds': '+ 추가',
  'shared.mergeEditor.zone.kindRemoves': '− 제거',
  'shared.mergeEditor.zone.kindModifies': '~ 수정',
  'shared.mergeEditor.zone.kindUnchanged': '= 변경 없음',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: 다음 헝크로 이동',
  'shared.mergeEditor.action.prevHunk': 'Merge: 이전 헝크로 이동',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: 커서 위치의 수신 헝크 수락',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: 커서 위치의 현재 헝크 수락',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: 충돌 없는 변경 적용',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: 수신 모두 수락',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: 현재 모두 수락',
  'shared.mergeEditor.action.undo': 'Merge: 실행 취소 (버퍼 + 선택 상태)',
  'shared.mergeEditor.action.redo': 'Merge: 다시 실행 (버퍼 + 선택 상태)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': '수신 수락',
  'shared.mergeEditor.gutter.acceptCurrent': '현재 수락',
  'shared.mergeEditor.gutter.appendIncoming': '현재 뒤에 수신도 덧붙이기',
  'shared.mergeEditor.gutter.appendCurrent': '수신 뒤에 현재도 덧붙이기',
  'shared.mergeEditor.gutter.skipIncoming': '이 헝크의 수신 건너뛰기',
  'shared.mergeEditor.gutter.skipCurrent': '이 헝크의 현재 건너뛰기',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': '모든 헝크가 해결되었습니다.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), { other: '헝크 {count}개가 남았습니다.' }),
  'shared.mergeEditor.announce.acceptedIncoming': '수신 헝크를 수락했습니다.',
  'shared.mergeEditor.announce.acceptedCurrent': '현재 헝크를 수락했습니다.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), { other: '충돌 없는 헝크 {count}개를 적용했습니다.' }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), { other: '수신 헝크 {count}개를 모두 수락했습니다.' }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), { other: '현재 헝크 {count}개를 모두 수락했습니다.' }),
} as const satisfies Catalog;
