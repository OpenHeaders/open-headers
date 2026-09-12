/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — Korean. Mirrors `catalogs/en/panel-quick-editor.ts` key for
 * key; compact mirrors of workbench controls reuse the
 * `workbench.editors.rule.fields.*` keys (S35). Raw by design: names,
 * URLs, `{{template}}` chips, status codes, MIME values, code / JSON
 * placeholders, the CSS / JS / GraphQL / cURL proper nouns, core
 * validator sentences, the req / res wire chips and op glyphs, `Mock`
 * (raw tag) beside 수정 = Modify. Mints: 팝오버 = popover (never 팝업,
 * which stays the extension popup); 대상 변경 = retarget; 리스너 =
 * listener; 페이로드 = payload; 프레임 = frame; 수정 항목 = the
 * modification (mod); 병합 구분자 = merge separator; 초안 = draft; 원본 /
 * 현재 / 향후 = Original / Now / Future; 지연 참조 = deferred ref.
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': '규칙 이름 지우기',
  'panel.quickEditor.renameTitle': '{name}: 클릭하여 이름 바꾸기',
  'panel.quickEditor.enabledOn': '활성',
  'panel.quickEditor.enabledOff': '비활성',
  'panel.quickEditor.ruleEnabledAria': '규칙 활성',
  'panel.quickEditor.openInTab': '탭에서 열기',
  'panel.quickEditor.openInWorkspace': '워크스페이스에서 열기 →',
  'panel.quickEditor.saveButton': '저장',
  'panel.quickEditor.openToInspect': '이 규칙을 검사하거나 변경하려면 워크스페이스에서 여세요.',
  'panel.quickEditor.variableMissing': '변수 누락: 빨간색 참조에 마우스를 올려 변수를 만들면 저장이 활성화됩니다.',
  'panel.quickEditor.retargetHint': '아래 조건을 조정해 규칙의 대상을 바꾸세요.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': '규칙 업데이트됨',
  'panel.quickEditor.toast.ruleNotFound': '규칙을 찾을 수 없습니다. 삭제되었을 수 있습니다.',
  'panel.quickEditor.toast.saveFailed': '저장 실패',
  'panel.quickEditor.toast.toggleFailed': '규칙을 전환할 수 없습니다',
  'panel.quickEditor.toast.changedElsewhere': '규칙이 다른 곳에서 변경되었습니다. 팝오버를 닫았다가 다시 여세요.',
  'panel.quickEditor.toast.noWorkspace': '활성 워크스페이스 없음',
  'panel.quickEditor.toast.collectionCreateFailed': '규칙을 위한 컬렉션을 만들지 못했습니다',
  'panel.quickEditor.toast.folderCreateFailed': '“{name}” 폴더를 만들 수 없습니다. 컬렉션 루트에 저장합니다.',
  'panel.quickEditor.toast.createFailed': '규칙을 만들지 못했습니다',
  'panel.quickEditor.toast.createdDraft': '규칙이 초안으로 생성되었습니다. 워크스페이스에서 게시하세요.',
  'panel.quickEditor.toast.created': '규칙 생성됨',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': '규칙을 저장할 위치 선택',
  'panel.quickEditor.destination.savingTo': '저장 위치',
  'panel.quickEditor.destination.newTag': '신규',
  'panel.quickEditor.destination.autoNamed': '자동: {folder}',
  'panel.quickEditor.destination.autoRoot': '자동: 컬렉션 루트',
  'panel.quickEditor.destination.root': '컬렉션 루트',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': '이 규칙이 실행되는 조건 보기 및 편집',
  'panel.quickEditor.conditions.label': '조건',
  'panel.quickEditor.conditions.none': '없음: 어떤 요청과도 일치하지 않음',

  // Header quick editors (single-mod hover + whole-list + create).
  'panel.quickEditor.header.addHeader': '헤더 추가',
  'panel.quickEditor.header.mergeSeparatorTitle': '병합 구분자',
  'panel.quickEditor.header.directionRequest': '요청',
  'panel.quickEditor.header.directionResponse': '응답',
  'panel.quickEditor.validation.nameRequired': '헤더 이름은 필수입니다.',
  'panel.quickEditor.validation.invalidName': '잘못된 헤더 이름입니다.',
  'panel.quickEditor.validation.invalidValue': '잘못된 헤더 값입니다.',
  'panel.quickEditor.validation.switchTo': '{operation} 작업으로 전환',

  // Typed bodies — popover-only copy.
  'panel.quickEditor.redirect.targetPlaceholder': '예: https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint': '일치하는 요청은 네트워크에 도달하기 전에 이 URL 주소로 전송됩니다.',
  'panel.quickEditor.delay.hint':
    '탐색은 최대 30,000 ms, XHR/fetch 요청은 최대 5,000 ms 동안 지연됩니다. 하위 리소스는 지연되지 않습니다.',
  'panel.quickEditor.block.editHint': '일치하는 요청은 네트워크에 도달하기 전에 차단됩니다.',
  'panel.quickEditor.block.blockRequestsTo': '차단할 요청 대상',
  'panel.quickEditor.block.createHint':
    '일치하는 요청은 브라우저를 떠나기 전에 취소됩니다. 페이지에는 네트워크 오류로 보입니다.',
  'panel.quickEditor.response.tagModify': '수정',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    '이 규칙은 JavaScript 코드로 응답을 만듭니다. 스크립트를 편집하려면 워크스페이스에서 여세요.',
  'panel.quickEditor.requestBody.hint': '일치하는 요청은 페이지의 본문 대신 이 본문과 함께 전송됩니다.',
  'panel.quickEditor.requestBody.dynamicBody':
    '이 규칙은 JavaScript 코드로 본문을 만듭니다. 스크립트를 편집하려면 워크스페이스에서 여세요.',
  'panel.quickEditor.inject.sourceUrlLabel': '소스 URL',
  'panel.quickEditor.inject.loadsStylesheetHint': '일치하는 페이지는 로드될 때 이 스타일시트를 불러옵니다.',
  'panel.quickEditor.inject.loadsScriptHint': '일치하는 페이지는 로드될 때 이 스크립트를 불러옵니다.',
  'panel.quickEditor.inject.injectedHint': '일치하는 페이지가 로드될 때 삽입됩니다.',
  'panel.quickEditor.message.incoming': '수신 ⬇',
  'panel.quickEditor.message.outgoing': '송신 ⬆',
  'panel.quickEditor.message.injectedConnectionsHint': '리스너가 보기 전에 일치하는 연결에 삽입됩니다.',
  'panel.quickEditor.message.injectedStreamsHint': '리스너가 보기 전에 일치하는 스트림에 삽입됩니다.',
  'panel.quickEditor.message.replacedFramesHint': '일치하는 프레임은 보이기 전에 이 페이로드로 교체됩니다.',
  'panel.quickEditor.message.replacedEventsHint': '일치하는 이벤트는 보이기 전에 이 페이로드로 교체됩니다.',
  'panel.quickEditor.message.droppedFramesHint': '일치하는 프레임은 보이기 전에 폐기됩니다.',
  'panel.quickEditor.message.droppedEventsHint': '일치하는 이벤트는 보이기 전에 폐기됩니다.',
  'panel.quickEditor.queryParam.addAction': '작업 추가',
  'panel.quickEditor.queryParam.removeAllWarning':
    '모두 제거는 쿼리 문자열 전체를 제거합니다. 이 규칙의 다른 작업은 무시됩니다.',
  'panel.quickEditor.auth.challengesHint': '일치하는 요청에서 서버(401) 및 프록시(407) 인증 챌린지에 응답합니다.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  'panel.ruleHover.tagRuleEdited': '규칙 편집됨',
  'panel.ruleHover.tagVariableChanged': '변수 변경됨',
  'panel.ruleHover.tagDeleted': '삭제됨',
  'panel.ruleHover.tagDisabled': '비활성',
  'panel.ruleHover.tagModRemoved': '수정 항목 제거됨',
  'panel.ruleHover.tagConditionsMismatch': '조건 불일치',
  'panel.ruleHover.tagWontFire': '실행되지 않음',
  'panel.ruleHover.tagTitle.ruleDisabled':
    '규칙의 활성 플래그가 꺼져 있습니다. 앞으로 어떤 요청에서도 실행되지 않습니다.',
  'panel.ruleHover.tagTitle.modGone': '일치하는 수정 항목이 규칙에서 제거되었습니다.',
  'panel.ruleHover.tagTitle.conditionsMismatch': '규칙의 조건이 더 이상 이 URL 주소를 포함하지 않습니다.',
  'panel.ruleHover.tagTitle.nameUnresolved':
    '헤더 이름 템플릿을 완전히 해결할 수 없습니다 (예: TOTP 참조). DNR 엔진은 헤더 이름의 리터럴 템플릿 문자를 거부합니다.',
  'panel.ruleHover.tagTitle.valueUnresolved': '헤더 값 템플릿을 완전히 해결할 수 없습니다.',
  'panel.ruleHover.tagTitle.separatorUnresolved': '병합 구분자 템플릿을 완전히 해결할 수 없습니다.',
  'panel.ruleHover.deletedBody': '이 규칙은 삭제되었습니다. 위의 캡처는 실행 당시 규칙이 한 일을 보여 줍니다.',
  'panel.ruleHover.modRemovedBody':
    '일치하는 수정 항목이 규칙에서 제거되었습니다. 다시 만들거나 조정하려면 워크스페이스에서 여세요.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': '삽입',
  'panel.ruleHover.snapshot.opOverride': '재정의',
  'panel.ruleHover.snapshot.opAppend': '덧붙이기',
  'panel.ruleHover.snapshot.opMerge': '병합',
  'panel.ruleHover.snapshot.opRemove': '제거',
  'panel.ruleHover.snapshot.templateTitle': '실행 시점의 변수 해결 전 템플릿',
  'panel.ruleHover.snapshot.nameDriftTitle': '같은 템플릿이지만 참조된 변수가 이제 다른 헤더 이름으로 해결됩니다',
  'panel.ruleHover.snapshot.cancels': '“{rule}” 규칙을 취소',
  'panel.ruleHover.snapshot.original': '원본',
  'panel.ruleHover.snapshot.now': '현재',
  'panel.ruleHover.snapshot.future': '향후',
  'panel.ruleHover.snapshot.futureTitle': '다음 일치 요청이 받게 될 내용',
  'panel.ruleHover.snapshot.removed': '제거됨',
  'panel.ruleHover.snapshot.empty': '(비어 있음)',
  'panel.ruleHover.snapshot.totpNote': 'TOTP / 지연 참조는 요청 시점에 해결되며 여기에는 캡처되지 않습니다.',
  'panel.ruleHover.snapshot.alsoByRule': '이 요청에서 이 규칙이 적용한 다른 항목',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': '규칙이 삭제됨. 실행되지 않음',
  'panel.ruleHover.future.ruleDisabled': '규칙이 비활성 상태. 실행되지 않음',
  'panel.ruleHover.future.modGone': '이 수정 항목이 규칙에서 제거됨',
  'panel.ruleHover.future.conditionsMismatch': '규칙의 조건이 더 이상 이 URL 주소와 일치하지 않음',
  'panel.ruleHover.future.nameUnresolved': '헤더 이름 템플릿을 해결할 수 없음. 규칙이 실행되지 않음',
  'panel.ruleHover.future.valueUnresolved': '값 템플릿을 해결할 수 없음. 규칙이 실행되지 않음',
  'panel.ruleHover.future.separatorUnresolved': 'mergeSeparator 템플릿을 해결할 수 없음. 규칙이 실행되지 않음',
  'panel.ruleHover.future.templateTitle': '템플릿: {template}',
} as const satisfies Catalog;
