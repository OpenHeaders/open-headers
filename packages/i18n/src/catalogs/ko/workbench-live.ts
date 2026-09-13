/**
 * Workbench live/workflows station — Korean. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Technical plane stays
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, policy
 * kind ids (expires-in / expires-at), duration values and relative-time
 * phrases interpolated as {when} / {countdown}, step ids / capture
 * names / workflow names, code examples ({"expires_in": 3600},
 * run_time + captured_seconds, epoch ms), MV3, `lead`, oh.* API names,
 * dependsOn, server error text ({error} / {message}); `id` / `Foreach`
 * / `Composite` / `AND` ride raw (ja parity). Quotes the shipped ko
 * mints: 서킷 브레이커 / 개방 = the circuit opens / 재시도 / 재설정
 * (workbench-chrome's workflowStatus info), 라이브 변수 / 워크플로 /
 * 단계 / 캡처 / 추출기 / 재시도 정책 (shared-conflicts, sidebar), 새로
 * 고침 = Refresh (the rule editor quotes it), 게시 = publish, 재정의 =
 * override, 유휴 = idle, 프로브 = probe, 지수 백오프 carried, 시간
 * 제한 = timeout (the settings-knob twin), 활성 / 비활성 = Enabled /
 * Disabled, 전송 = Send. MINTS: 선행 = lead (seconds before expiry);
 * 노출 = expose (a capture as a live variable); 조상 단계 = ancestor
 * step; 실행 조건 = run condition; 암시적 / 명시적 = implicit /
 * explicit; 사전순 = lexicographic; 절 = gate clause; 고정값 = the
 * pinned override value; 해석기 = resolver; 스케줄러; 정상 / 재시도 중 /
 * 프로빙 중 / 일시 중지됨 = the circuit pills. Plurals are `other`-only
 * with 개 (captures, variables, conditions) / 회 (failures, attempts).
 * The `{id}` / `{ref}` / `{stepId}` holes take 단계 / 항목 / 값 as head
 * nouns before any particle.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': '유휴',
  'workbench.editors.live.circuit.idleHint': '아직 캐시가 없습니다. 새로 고침을 실행해 채우세요.',
  'workbench.editors.live.circuit.pausedLabel': '일시 중지됨',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      other:
        '연속 {count}회 실패 후 서킷이 개방되었습니다. 자동 재시도는 미뤄집니다. 백오프를 건너뛰려면 “지금 재시도”를 누르세요.',
    }),
  'workbench.editors.live.circuit.probingLabel': '프로빙 중…',
  'workbench.editors.live.circuit.probingHint': '프로브 시도가 진행 중입니다. 한 번만 성공하면 서킷이 닫힙니다.',
  'workbench.editors.live.circuit.retryLabel': '재시도 {attempt} / 3',
  'workbench.editors.live.circuit.retryHint':
    '브레이커 전 재시도 단계입니다. 시도 사이에 5–10초 백오프를 두고 빠르게 재시도합니다. 연속 3회 실패하면 서킷이 개방됩니다.',
  'workbench.editors.live.circuit.healthyLabel': '정상',
  'workbench.editors.live.circuit.healthyHint': '서킷이 닫혀 있고 최근 실패가 없습니다.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': '마지막 {when}',
  'workbench.editors.live.schedule.manualOnly': '수동 새로 고침만',
  'workbench.editors.live.schedule.autoRefresh': '자동 새로 고침 {when}',
  'workbench.editors.live.schedule.expires': '만료 {when}',
  'workbench.editors.live.policy.interval': '{seconds}초마다',
  'workbench.editors.live.policy.expiresIn': '{source} 캡처의 expires-in (선행 {lead}초)',
  'workbench.editors.live.policy.expiresAt': '{source} 캡처의 expires-at (선행 {lead}초)',
  'workbench.editors.live.policy.manual': '수동 새로 고침',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': '마지막 실행에서 완료됨',
  'workbench.editors.live.stepRun.failed': '마지막 실행이 이 단계에서 실패함',
  'workbench.editors.live.stepRun.extractFailed': '가져왔지만 캡처 추출기가 일치하지 않음',
  'workbench.editors.live.stepRun.skipped': '마지막 실행에서 실행 조건에 의해 건너뜀',
  'workbench.editors.live.stepRun.notRun': '아직 성공한 실행에 포함되지 않음',
  'workbench.editors.live.maskEmpty': '(비어 있음)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': '이름',
  'workbench.editors.live.form.descriptionPlaceholder': '설명 (선택 사항)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': '소스를 찾을 수 없습니다.',
  'workbench.editors.live.variable.liveTag': '라이브',
  'workbench.editors.live.variable.disabledTag': '비활성',
  'workbench.editors.live.variable.overrideTag': '재정의',
  'workbench.editors.live.variable.refresh': '새로 고침',
  'workbench.editors.live.variable.valueLabel': '값',
  'workbench.editors.live.variable.neverRefreshed': '(새로 고친 적 없음)',
  'workbench.editors.live.variable.nameLabel': '이름',
  'workbench.editors.live.variable.nameHint': '참조 형식: {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': '설명',
  'workbench.editors.live.variable.bindingSection': '바인딩',
  'workbench.editors.live.variable.workflowLabel': '워크플로',
  'workbench.editors.live.variable.stepLabel': '단계',
  'workbench.editors.live.variable.captureLabel': '캡처',
  'workbench.editors.live.variable.selectWorkflow': '워크플로 선택',
  'workbench.editors.live.variable.selectStep': '단계 선택',
  'workbench.editors.live.variable.selectCapture': '캡처 선택',
  'workbench.editors.live.variable.stepOption': '{id} (캡처 {count}개)',
  'workbench.editors.live.variable.openFlow': '플로 열기',
  'workbench.editors.live.variable.overrideSection': '수동 재정의',
  'workbench.editors.live.variable.overrideValuePlaceholder': '고정 재정의 값',
  'workbench.editors.live.variable.overrideExpiresLabel': '만료 (ms)',
  'workbench.editors.live.variable.overrideExpiresHint': '벽시계 epoch ms 값입니다. 영구 재정의는 비워 두세요',
  'workbench.editors.live.variable.applyOverride': '재정의 적용',
  'workbench.editors.live.variable.clearOverride': '지우기',
  'workbench.editors.live.variable.setOverride': '수동 재정의 설정',
  'workbench.editors.live.variable.overrideNote':
    '해석기는 고정값을 제공하고, 스케줄러는 기반 워크플로를 계속 새로 고칩니다.',
  'workbench.editors.live.variable.deletedElsewhere': '소스가 다른 탭에서 삭제되었습니다',
  'workbench.editors.live.variable.saveFailed': '라이브 변수를 저장하지 못했습니다',
  'workbench.editors.live.variable.refreshFailed': '새로 고침 실패: {error}',
  'workbench.editors.live.variable.refreshed': '새로 고쳤습니다',
  'workbench.editors.live.variable.overrideSaveFailed': '재정의를 저장하지 못했습니다.',
  'workbench.editors.live.variable.overrideApplied': '재정의를 적용했습니다',
  'workbench.editors.live.variable.overrideCleared': '재정의를 지웠습니다',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': '새 라이브 변수',
  'workbench.editors.live.create.namePlaceholder': '이름 (예: accessToken)',
  'workbench.editors.live.create.referenceAs': '참조 형식: {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': '워크플로 만들기',
  'workbench.editors.live.create.noWorkflows': '아직 워크플로가 없습니다.',
  'workbench.editors.live.create.nameRequired': '이름은 필수입니다',
  'workbench.editors.live.create.bindingRequired': '워크플로, 단계, 캡처를 선택하세요',
  'workbench.editors.live.create.createFailed': '라이브 변수를 만들지 못했습니다',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': '활성',
  'workbench.editors.live.toggles.enabledTooltip':
    '끄면 규칙과 요청에서 {{live.NAME}} 참조가 더 이상 해석되지 않습니다.',
  'workbench.editors.live.toggles.waitForFresh': '최신 값 기다리기',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    '규칙을 적용하기 전에 기반 워크플로의 새로 고침이 끝나기를 기다립니다 (최대 약 5초). 끄면 규칙은 마지막 캐시 값을 쓰고 백그라운드에서 새로 고칩니다. 더 빠르지만 확장 프로그램이 깨어난 직후 잠시 오래된 값일 수 있습니다.',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': '수동만',
  'workbench.editors.live.refreshPolicy.interval': '고정 간격',
  'workbench.editors.live.refreshPolicy.expiresIn': 'N초 후 만료 (상대)',
  'workbench.editors.live.refreshPolicy.expiresAt': 'epoch ms 시점에 만료 (절대)',
  'workbench.editors.live.refreshPolicy.leadUnit': '선행 초',
  'workbench.editors.live.refreshPolicy.selectCapture': '캡처 선택',
  'workbench.editors.live.refreshPolicy.noCaptures': '아직 정의된 캡처가 없습니다.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    '1분 미만 간격은 MV3 환경의 알람 하한에 걸리며 할당량을 빠르게 소진합니다. 꼭 필요할 때만 쓰세요.',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix': '캡처 값 = 만료까지의 초 (예: OAuth 응답의',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': '). 새로 고침은 다음 시점보다 `lead`초 전에 실행됩니다:',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': '캡처 값 = 절대 unix epoch 시각, 단위는',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': '밀리초',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix': '). 새로 고침은 그 시각보다 `lead`초 전에 실행됩니다.',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    '만료 계산의 소스가 생기도록 먼저 워크플로에 캡처를 추가하세요.',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': '편집기',
  'workbench.editors.live.workflow.viewPreview': '미리 보기',
  'workbench.editors.live.workflow.refresh': '새로 고침',
  'workbench.editors.live.workflow.disabledTag': '비활성',
  'workbench.editors.live.workflow.notFound': '워크플로를 찾을 수 없습니다.',
  'workbench.editors.live.workflow.deletedElsewhere': '워크플로가 다른 탭에서 삭제되었습니다',
  'workbench.editors.live.workflow.saveFailed': '워크플로를 저장하지 못했습니다',
  'workbench.editors.live.workflow.createFailed': '워크플로를 만들지 못했습니다',
  'workbench.editors.live.workflow.refreshed': '새로 고쳤습니다',
  'workbench.editors.live.workflow.refreshFailed': '새로 고침 실패: {error}',
  'workbench.editors.live.workflow.defaultName': '워크플로',
  'workbench.editors.live.workflow.newDraftName': '새 워크플로',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': '워크플로에 구조적 문제가 있습니다',
  'workbench.editors.live.form.stepsTitle': '단계 ({count})',
  'workbench.editors.live.form.addStepButton': '단계',
  'workbench.editors.live.form.noSteps': '아직 단계가 없습니다. 단계를 추가해 요청 + 추출을 이 워크플로에 연결하세요.',
  'workbench.editors.live.form.enabledAria': '워크플로 활성',
  'workbench.editors.live.form.enabled': '활성',
  'workbench.editors.live.form.disabled': '비활성',
  'workbench.editors.live.form.parallelLabel': '독립 단계를 병렬로 실행',
  'workbench.editors.live.form.parallelTooltip':
    'v1에서는 순차 실행만 지원합니다. 병렬 실행은 향후 릴리스에서 제공됩니다.',
  'workbench.editors.live.form.refreshPolicySection': '새로 고침 정책',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': '{number}단계',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': '이름',
  'workbench.editors.live.step.typeTooltip':
    '단계 유형입니다. Foreach 유형과 Composite 유형은 향후 릴리스에서 제공됩니다.',
  'workbench.editors.live.step.typeRequest': '요청',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), { other: '조건 {count}개 충족 시 실행' }),
  'workbench.editors.live.step.priorityTag': '우선순위: {ref}',
  'workbench.editors.live.step.scriptsTag': '스크립트',
  'workbench.editors.live.step.selectRequest': '요청 선택',
  'workbench.editors.live.step.descriptionPlaceholder': '단계 설명 (선택 사항)',
  'workbench.editors.live.step.capturesHeader': '캡처 ({count})',
  'workbench.editors.live.step.addCapture': '+ 캡처',
  'workbench.editors.live.step.captureRequired': '라이브 변수가 이 단계에 바인딩되려면 캡처가 하나 이상 필요합니다.',
  'workbench.editors.live.step.removeCaptureAria': '캡처 {name} 제거',
  'workbench.editors.live.step.exposeAria': '캡처 {name} 항목을 라이브 변수로 노출',
  'workbench.editors.live.step.exposeAs': '노출 이름',
  'workbench.editors.live.step.exposeTooltip':
    '켜면 워크플로를 저장할 때 이 캡처에서 `{{live.<name>}}` 참조를 해석하는 라이브 변수가 만들어집니다. 캡처를 이 워크플로 안에서만 쓰려면 끄세요 (예: {{step.<stepId>.<captureName>}} 참조로).',
  'workbench.editors.live.step.afterChip': '↳ {parents} 다음',
  'workbench.editors.live.step.implicitMark': '(암시적)',
  'workbench.editors.live.step.implicitTooltip':
    '암시적인 이전 단계 의존입니다 (명시적 dependsOn 선언 없음). 관계를 고정하려면 명시적 dependsOn 값을 설정하세요.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': '의존 대상',
  'workbench.editors.live.sections.dependsOnImplicit': '(암시적: 이전 단계)',
  'workbench.editors.live.sections.dependsOnRoot': '(루트)',
  'workbench.editors.live.sections.dependsOnPlaceholder': '조상 단계 선택. 비우면 루트 단계',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    '명시적 dependsOn 선언이 없습니다. 선언 순서상 이전 단계에 암시적으로 의존합니다.',
  'workbench.editors.live.sections.dependsOnRootHint': '명시적 루트입니다. 워크플로가 시작되는 즉시 실행됩니다.',
  'workbench.editors.live.sections.useImplicit': '암시적 사용',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), { other: '단계는 조상 {count}개가 완료되거나 건너뛰어질 때까지 기다립니다.' }),
  'workbench.editors.live.sections.reset': '재설정',
  'workbench.editors.live.sections.runCondition': '실행 조건',
  'workbench.editors.live.sections.none': '(없음)',
  'workbench.editors.live.sections.priority': '우선순위',
  'workbench.editors.live.sections.priorityStepPlaceholder': '조상 단계',
  'workbench.editors.live.sections.priorityCapturePlaceholder': '캡처 이름',
  'workbench.editors.live.sections.sortNumeric': '숫자순',
  'workbench.editors.live.sections.sortLexicographic': '사전순',
  'workbench.editors.live.sections.priorityTooltip':
    '다음에 실행할 수 있는 단계가 여럿이면 우선순위 값이 가장 낮은 단계가 먼저 실행됩니다. 값이 없으면 맨 뒤로 정렬됩니다.',
  'workbench.editors.live.sections.clear': '지우기',
  'workbench.editors.live.sections.retryPolicy': '재시도 정책',
  'workbench.editors.live.sections.retrySummary': '({count}회 시도)',
  'workbench.editors.live.sections.retrySummaryExponential': '({count}회 시도, 지수)',
  'workbench.editors.live.sections.attemptsPlaceholder': '시도 횟수',
  'workbench.editors.live.sections.attemptsPrefix': '시도 횟수',
  'workbench.editors.live.sections.delayPrefix': '지연 ms',
  'workbench.editors.live.sections.backoffFixed': '고정',
  'workbench.editors.live.sections.backoffExponential': '지수',
  'workbench.editors.live.sections.retryOnNetwork': '네트워크 오류만',
  'workbench.editors.live.sections.retryOn5xx': '네트워크 + 5xx',
  'workbench.editors.live.sections.retryOn429': '네트워크 + 429',
  'workbench.editors.live.sections.retryOn4xx': '네트워크 + 4xx',
  'workbench.editors.live.sections.retryOnCustom': '사용자 지정 (데이터로 편집됨)',
  'workbench.editors.live.sections.retryTooltip':
    '네트워크 실패 (DNS, 연결, 시간 초과)는 시도 횟수가 남아 있는 한 항상 재시도합니다. 상태 일치를 추가하면 일치하는 응답도 재시도하며, 추출 오류는 절대 재시도하지 않습니다. 재시도를 끄려면 시도 횟수 필드를 비우세요.',
  'workbench.editors.live.sections.timeout': '시간 제한',
  'workbench.editors.live.sections.noTimeoutPlaceholder': '시간 제한 없음',
  'workbench.editors.live.sections.timeoutTooltip':
    '시도마다 적용됩니다. 요청 (본문 읽기 포함)이 이 상한을 넘으면 중단됩니다. 재시도하는 단계는 시도마다 전체 시간 제한을 다시 받습니다. 상한을 없애려면 필드를 비우세요.',
  'workbench.editors.live.sections.scripts': '스크립트',
  'workbench.editors.live.sections.scriptsOn': '(켜짐)',
  'workbench.editors.live.sections.scriptsOff': '(꺼짐)',
  'workbench.editors.live.sections.runScriptsAria': '이 단계에서 요청의 스크립트 실행',
  'workbench.editors.live.sections.runScriptsLabel': '요청의 요청 전 / 응답 후 스크립트 실행',
  'workbench.editors.live.sections.scriptsTooltip':
    '연쇄 시도마다 실행됩니다. 단계 스크립트는 읽기 전용 oh.* 표면을 받습니다 (oh.sendRequest 함수와 oh.variables.set 함수는 거부됩니다). 스크립트 오류나 실패한 oh.test 단언은 단계를 실패시키므로 마지막 정상 값이 보존됩니다. 단언이 이 워크플로가 게시하는 것을 거릅니다. 스크립트를 실행할 수 있는 런타임이 필요하며, 없는 호스트에서는 단계가 스크립트 없이 실행됩니다.',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': '상태',
  'workbench.editors.live.gate.kindCaptureExists': '캡처 존재',
  'workbench.editors.live.gate.kindCaptureEquals': '캡처 같음',
  'workbench.editors.live.gate.kindCaptureMatches': '캡처 일치',
  'workbench.editors.live.gate.kindNumericCompare': '캡처 숫자 비교',
  'workbench.editors.live.gate.kindInList': '캡처 목록 포함',
  'workbench.editors.live.gate.kindHeaderContains': '헤더 포함',
  'workbench.editors.live.gate.futureNumericCompare': '숫자 비교는 향후 릴리스에서 제공됩니다.',
  'workbench.editors.live.gate.futureInList': '목록 포함 일치는 향후 릴리스에서 제공됩니다.',
  'workbench.editors.live.gate.futureHeaderContains': '헤더 포함은 향후 릴리스에서 제공됩니다.',
  'workbench.editors.live.gate.status2xx': '2xx (모든 성공)',
  'workbench.editors.live.gate.status3xx': '3xx (리디렉션)',
  'workbench.editors.live.gate.status4xx': '4xx (클라이언트 오류)',
  'workbench.editors.live.gate.status5xx': '5xx (서버 오류)',
  'workbench.editors.live.gate.statusEquals': '같음…',
  'workbench.editors.live.gate.statusNotEquals': '같지 않음…',
  'workbench.editors.live.gate.statusOneOf': '다음 중 하나…',
  'workbench.editors.live.gate.allAnd': '모두 (AND)',
  'workbench.editors.live.gate.anyOr': '하나라도 (OR)',
  'workbench.editors.live.gate.orTooltip':
    'OR 논리는 향후 릴리스에서 제공됩니다. 지금은 서로 배타적인 조건을 가진 여러 단계를 쓰세요.',
  'workbench.editors.live.gate.matchModesAria': '일치 모드 정보',
  'workbench.editors.live.gate.noConditions': '조건이 없습니다. 의존 대상이 완료될 때마다 단계가 실행됩니다.',
  'workbench.editors.live.gate.conditionCount': '조건 {count}개',
  'workbench.editors.live.gate.addCondition': '조건 추가',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': '단계',
  'workbench.editors.live.gate.capturePlaceholder': '캡처 이름',
  'workbench.editors.live.gate.equalsPlaceholder': '비교할 값',
  'workbench.editors.live.gate.removeClauseAria': '{number}번 절 제거',
  'workbench.editors.live.gate.statusClassTooltip': '해당 부류의 모든 상태에 일치합니다 (예: 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': '{stepId} 단계의 상태가 {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': '{stepId} 단계의 상태가 {value} 아님',
  'workbench.editors.live.graph.clauseStatusIn': '{stepId} 단계의 상태가 [{list}] 중 하나',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} 항목 존재',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} 항목이 /{pattern}/ 패턴과 일치',
  'workbench.editors.live.graph.menuAddStep': '단계 추가',
  'workbench.editors.live.graph.menuEditStep': '단계 편집',
  'workbench.editors.live.graph.menuDeleteStep': '단계 삭제',
  'workbench.editors.live.graph.connectTitle': '다른 단계로 끌어 의존 관계 추가',
  'workbench.editors.live.graph.removeDependency': '의존 관계 제거',
  'workbench.editors.live.graph.zoomIn': '확대',
  'workbench.editors.live.graph.zoomOut': '축소',
  'workbench.editors.live.graph.recenter': '가운데로',
  'workbench.editors.live.graph.legendClick': '클릭',
  'workbench.editors.live.graph.legendSelect': '선택',
  'workbench.editors.live.graph.legendEditKeys': '2×클릭 / ⏎',
  'workbench.editors.live.graph.legendEdit': '편집',
  'workbench.editors.live.graph.legendDelete': '삭제',
  'workbench.editors.live.graph.legendConnectKeys': '○ 드래그',
  'workbench.editors.live.graph.legendConnect': '연결',
  'workbench.editors.live.graph.legendRightClick': '오른쪽 클릭',
  'workbench.editors.live.graph.legendMenu': '메뉴',
  'workbench.editors.live.graph.legendDragNode': '노드 드래그',
  'workbench.editors.live.graph.legendMove': '이동',
  'workbench.editors.live.graph.legendDragBg': '배경 드래그',
  'workbench.editors.live.graph.legendPan': '이동',
  'workbench.editors.live.graph.legendScroll': '스크롤',
  'workbench.editors.live.graph.legendZoom': '확대/축소',
  'workbench.editors.live.graph.editStepInForm': '폼에서 단계 편집',
  'workbench.editors.live.graph.requestNotFound': '요청을 찾을 수 없습니다',
  'workbench.editors.live.graph.noRequestSelected': '선택한 요청 없음',
  'workbench.editors.live.graph.noCaptures': '캡처 없음',
  'workbench.editors.live.graph.orderedBy': '정렬 기준: {ref}',
  'workbench.editors.live.graph.exposedAs': '노출 이름: {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending': '노출 이름: {{live.{name}}}. 첫 실행 대기 중',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': '워크플로 상태',
  'workbench.editors.live.status.noEnvironment': '환경 없음',
  'workbench.editors.live.status.unknownEnv': '알 수 없는 환경',
  'workbench.editors.live.status.activeSuffix': '(활성)',
  'workbench.editors.live.status.pillPaused': '일시 중지됨',
  'workbench.editors.live.status.pillProbing': '프로빙 중',
  'workbench.editors.live.status.pillRetrying': '재시도 중',
  'workbench.editors.live.status.pillHealthy': '정상',
  'workbench.editors.live.status.summaryHealthy': '정상 {count}개',
  'workbench.editors.live.status.summaryRetrying': '재시도 중 {count}개',
  'workbench.editors.live.status.summaryProbing': '프로빙 중 {count}개',
  'workbench.editors.live.status.summaryPaused': '일시 중지됨 {count}개',
  'workbench.editors.live.status.loading': '불러오는 중…',
  'workbench.editors.live.status.empty': '아직 워크플로 실행이 없습니다. 워크플로를 만들고 새로 고침을 눌러 채우세요.',
  'workbench.editors.live.status.failuresCount': '실패: {count}',
  'workbench.editors.live.status.failuresTooltip': '마지막으로 성공한 새로 고침 이후의 연속 실패 횟수입니다.',
  'workbench.editors.live.status.openingsCount': '개방: {count}',
  'workbench.editors.live.status.openingsTooltip':
    '현재 주기에서 서킷이 개방 상태로 전환된 횟수입니다. 충분히 오래된 복구에서는 절반으로, 최근 복구에서는 하나씩 줄어듭니다.',
  'workbench.editors.live.status.nextAttempt': '다음 시도 {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    '다음 자동 프로브가 실행될 벽시계 시각입니다. 건너뛰려면 “지금 새로 고침”을 누르세요.',
  'workbench.editors.live.status.refreshNow': '지금 새로 고침',
  'workbench.editors.live.status.resetCircuit': '서킷 재설정',
  'workbench.editors.live.status.resetCircuitTooltip':
    '실패 카운터와 대기 중인 백오프를 지웁니다. 프로브는 실행하지 않습니다.',
  'workbench.editors.live.status.circuitReset': '서킷을 재설정했습니다',
  'workbench.editors.live.status.resetFailed': '재설정 실패: {error}',
  'workbench.editors.live.status.dragToResize': '끌어서 크기 조절',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '바인딩: 변수 {count}개' }),
  'workbench.editors.live.status.needsReRun': '다시 실행 필요',
  'workbench.editors.live.status.needsReRunTooltip':
    '이 값을 추출한 뒤 워크플로나 워크플로가 해석하는 입력이 바뀌었습니다. 새로 고침을 실행해 다시 추출하세요.',
  'workbench.editors.live.status.neverRunForEnv': '이 환경에서 실행된 적 없음. 새로 고침을 눌러 채우세요',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': '이전 실행의 값이 보존됨',
  'workbench.editors.live.runOverlay.responseBytes': '응답 {bytes}바이트',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': '“{name}”에서 워크플로 만들기',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), { other: '워크플로 만들기 (단계 {count}개)' }),
  'workbench.editors.live.fromRequests.empty': '이 컨테이너에는 워크플로를 만들 요청이 없습니다.',
  'workbench.editors.live.fromRequests.hint': '선택한 각 요청이 표시된 순서대로 워크플로 단계가 됩니다.',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': '그룹',
  'workbench.editors.live.extractor.groupBody': '응답 본문',
  'workbench.editors.live.extractor.groupResponse': '응답',
  'workbench.editors.live.extractor.wholeBody': '본문 전체',
  'workbench.editors.live.extractor.jsonPath': 'JSON 경로',
  'workbench.editors.live.extractor.regex': '정규식',
  'workbench.editors.live.extractor.header': '헤더',
  'workbench.editors.live.extractor.statusCode': '상태 코드',
} as const satisfies Catalog;
