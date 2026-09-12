/**
 * Script-packages family — Korean. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key; `oh.require`
 * / `module.exports` ride raw with a head noun (호출, 구문) where a
 * particle would follow. The prefix / infix sandwich around the two
 * code chips keeps the infix dash as the structural chip separator.
 * Mints: 패키지 라이브러리 = Package Library; 재사용 = reuse; 버리기 =
 * Discard; 내보내기 = export.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': '패키지 라이브러리',
  'workbench.scriptPackages.new': '새로 만들기',
  'workbench.scriptPackages.searchPlaceholder': '패키지 찾기...',
  'workbench.scriptPackages.emptyNone': '아직 패키지가 없습니다',
  'workbench.scriptPackages.emptyNoMatch': '패키지를 찾을 수 없습니다',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': '패키지로 여러 요청에서 스크립트 재사용',
  'workbench.scriptPackages.primer.step1': '1. 재사용할 코드로 패키지를 만듭니다.',
  'workbench.scriptPackages.primer.step2': '2. 재사용할 함수를 내보냅니다.',
  'workbench.scriptPackages.primer.step3': '3. 요청 스크립트에서 oh.require 호출로 패키지를 불러옵니다.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': '패키지 이름',
  'workbench.scriptPackages.descriptionPlaceholder': '설명 (선택 사항)',
  'workbench.scriptPackages.descriptionAria': '패키지 설명',
  'workbench.scriptPackages.save': '저장',
  'workbench.scriptPackages.deleteTitle': '이 패키지를 삭제할까요?',
  'workbench.scriptPackages.deleteDescription': '이 패키지에 oh.require 호출을 하는 스크립트가 실패하기 시작합니다.',
  'workbench.scriptPackages.delete': '삭제',
  'workbench.scriptPackages.loadFromScriptPrefix': '스크립트에서는 다음과 같이 불러옵니다:',
  'workbench.scriptPackages.exportViaInfix': '— 공개할 기능은 다음과 같이 내보냅니다:',
  'workbench.scriptPackages.sourcePlaceholder':
    '재사용할 JavaScript 코드를 작성한 다음 module.exports 구문으로 내보내세요.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': '저장하지 않은 변경 사항을 버릴까요?',
  'workbench.scriptPackages.discardContent': '현재 패키지에 저장하지 않은 편집 내용이 있습니다. 전환하면 버려집니다.',
  'workbench.scriptPackages.discardOk': '버리기',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': '패키지 이름은 필수입니다. oh.require 호출의 키가 됩니다.',
  'workbench.scriptPackages.saved': '패키지 저장됨',
  'workbench.scriptPackages.duplicateName': '“{name}” 패키지가 이 워크스페이스에 이미 있습니다.',
  'workbench.scriptPackages.notFound': '패키지를 찾을 수 없습니다. 삭제되었을 수 있습니다.',
  'workbench.scriptPackages.saveFailed': '저장 실패',
  'workbench.scriptPackages.deleted': '패키지 삭제됨',
  'workbench.scriptPackages.deleteFailed': '삭제 실패',
} as const satisfies Catalog;
