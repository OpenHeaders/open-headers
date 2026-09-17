/**
 * Workbench editors — the API request editor — Korean. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key. Raw by
 * design: HTTP methods, header names, MIME types, auth scheme names
 * (Basic / Bearer / OAuth 2.0 …), OAuth / PKCE / JWT parameter names
 * (code_verifier, kid, alg, iat / exp …), the `<calculated…>`
 * placeholders, the phase tokens DNS / TCP / TLS / TTFB, `{{ns.NAME}}`
 * refs and every example value. Quoted verbatim from the shipped ko
 * files: the editor tab family (인가 / 헤더 / 본문 / 스크립트 / 설정;
 * `Docs` / `Params` raw — the S102 tab-noun decision), 상속 = Inherit,
 * 추가 / 바꾸기 / 바꾸기만, 전송 = Send, the settings-knob scalar twins
 * from `shared-conflicts.ts` (TLS 최소 버전 / TLS 최대 버전 / TLS 암호
 * 스위트 / SNI 서버 이름 / HTTP 버전 / 확인 대상 주소 / 클라이언트 인증서 /
 * 프록시 URL / 프록시 자격 증명 / Unix 소켓 / Cookie 저장소 / 요청 시간
 * 제한 / 응답 크기 제한 / 최대 리디렉션 수 / 원래 HTTP 메서드 유지 /
 * Authorization 헤더 유지 / SSL 검증 / 요청 전 스크립트 / 응답 후
 * 스크립트), 신뢰된 인증서 / 인증 기관 / 지문, 인가 스킴 / 클레임, 시스템
 * 프록시, 이유 구문, 캡처 / 워크플로 / 단계 / 라이브 변수, 단언 =
 * assertion, 논스 = nonce, 검증기 = verifier, 다이얼 = dial, 하트비트,
 * 유휴, 재연결, 트레일러, 패키지 라이브러리, 프리셋, 스크래치, 정리 =
 * Format, Hex 뷰어, 전송선 = wire, `cURL 형식으로 복사` / `fetch
 * 형식으로 복사`. MINTS: 안전 모드 / 개발자 모드 = the script execution
 * modes; TLS 하한 = TLS floor (상한 = cap carried); 샌드박스 carried;
 * 서명 = signature / signing; 자격 증명 carried; 대상 구성 요소 =
 * covered components; 전달 = delivery group; 챌린지 carried; 그랜트 =
 * the OAuth grant type (부여 stays a server grant); 소비자 = consumer;
 * 통과 / 실패 = the PASS / FAIL verdicts; 단언 = a test assertion (the
 * shipped mint) vs 어서션 = the OAuth / JWT client assertion (S19 split);
 * 실립니다 = rides (on the wire). Browser interstitial
 * paths quote the browsers' own ko UI (Chrome 고급 → …(안전하지
 * 않음)(으)로 이동, Firefox 고급… → 위험을 감수하고 계속). Particle law:
 * every raw token takes a Korean head noun before a particle (URL
 * 주소를, Bearer 스킴 뒤에, exp 클레임, POST 메서드로, 401 응답을).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': '요청을 찾을 수 없습니다.',
  'workbench.editors.request.loading': '요청을 불러오는 중…',
  'workbench.editors.request.toast.deletedOtherTab': '요청이 다른 탭에서 삭제되었습니다',
  'workbench.editors.request.toast.updateFailed': '요청을 업데이트하지 못했습니다',
  'workbench.editors.request.toast.updateFailedDetail': '요청을 업데이트하지 못했습니다: {message}',
  'workbench.editors.request.toast.invalidSetting': '{label} 항목이 잘못되었습니다. 저장하기 전에 설정에서 고치세요.',
  'workbench.editors.request.toast.savedExample': '예시 “{name}” 항목을 저장했습니다',
  'workbench.editors.request.toast.saveExampleFailed': '예시를 저장하지 못했습니다',
  'workbench.editors.request.toast.saveExampleFailedDetail': '예시를 저장하지 못했습니다: {message}',
  'workbench.editors.request.send.label': '전송',
  'workbench.editors.request.send.sending': '전송 중…',
  'workbench.editors.request.send.unresolvedTooltip':
    '요청에 해석되지 않은 변수가 있습니다. 보내기 전에 vault 저장소, 환경, 컬렉션, 워크스페이스 또는 라이브 워크플로에서 정의하세요.',
  'workbench.editors.request.send.stop': '중지',
  'workbench.editors.request.send.stopTooltip': '요청을 중지하고 지금까지 도착한 내용을 유지합니다',
  'workbench.editors.request.menu.copyAsCurl': 'cURL 형식으로 복사',
  'workbench.editors.request.menu.copyAsFetch': 'fetch 형식으로 복사',
  'workbench.editors.request.convert.menu': 'GraphQL 요청으로 변환',
  'workbench.editors.request.convert.title': 'GRAPHQL 요청으로 변환',
  'workbench.editors.request.convert.body':
    '“{name}” 요청이 같은 자리에서 GraphQL 요청이 됩니다. 헤더, 인증, 스크립트, 설정, 문서는 그대로 넘어가고 HTTP 요청은 제거됩니다.',
  'workbench.editors.request.convert.noteParamsFolded': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '쿼리 매개변수 {count}개가 URL 주소에 접혀 들어갑니다.',
    }),
  'workbench.editors.request.convert.noteDisabledParamsDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '비활성 쿼리 매개변수 {count}개는 버려집니다. GraphQL 요청은 아무것도 유지하지 않습니다.',
    }),
  'workbench.editors.request.convert.noteMethodChanged':
    '{method} 메서드는 POST 메서드로 바뀝니다. 모든 GraphQL 작업은 POST 방식으로 보냅니다.',
  'workbench.editors.request.convert.noteExamples': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '저장된 응답 {count}개가 새 요청 아래로 이동합니다.',
    }),
  'workbench.editors.request.convert.ok': '변환',
  'workbench.editors.request.convert.notConvertible': '본문이 GraphQL 형식인 요청만 변환할 수 있습니다.',
  'workbench.editors.request.convert.saveFirst': '변환하기 전에 요청을 저장하세요.',
  'workbench.editors.request.convert.failed': '요청을 변환할 수 없습니다.',
  'workbench.editors.request.convert.failedDetail': '요청을 변환할 수 없습니다: {message}',
  'workbench.editors.request.convert.done': '“{name}” 요청을 GraphQL 요청으로 변환했습니다.',
  'workbench.editors.request.schemeHint':
    'URL 주소에 스킴이 없습니다. https:// 스킴으로 보내집니다. URL 표시줄을 클릭하고 Tab 또는 Enter 키를 눌러 확정하세요.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': '인가',
  'workbench.editors.request.tab.headers': '헤더',
  'workbench.editors.request.tab.body': '본문',
  'workbench.editors.request.tab.scripts': '스크립트',
  'workbench.editors.request.tab.settings': '설정',
  'workbench.editors.request.spec.selectLabel': 'OpenAPI 사양',
  'workbench.editors.request.spec.none': '이 요청에 연결된 OpenAPI 사양이 없습니다.',
  'workbench.editors.request.spec.selectPlaceholder': 'OpenAPI 사양 연결…',
  'workbench.editors.request.spec.inheritedPlaceholder': '컬렉션에서 상속됨: {name}',
  'workbench.editors.request.spec.fromCollection': '{name} 컬렉션에서',
  'workbench.editors.request.spec.missing': '연결된 사양이 더 이상 이 워크스페이스에 없습니다.',
  'workbench.editors.request.spec.parseFailure': '사양을 해석하지 못했습니다: {message}',
  'workbench.editors.request.spec.drifted': '이 컬렉션이 생성된 뒤에 사양이 바뀌었습니다.',
  'workbench.editors.request.spec.operation': '작업',
  'workbench.editors.request.spec.noOperation': '사양에 {method} {url} 요청과 일치하는 작업이 없습니다.',
  'workbench.editors.request.spec.inSync': '사양과 동기화되어 있습니다.',
  'workbench.editors.request.spec.fieldDiffers': '{field} 항목이 사양과 다릅니다.',
  'workbench.editors.request.spec.apply': '적용',
  'workbench.editors.request.spec.applyAll': '모두 적용',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'URL 주소를 입력하거나 텍스트를 붙여넣으세요',
  'workbench.editors.request.url.socketCta':
    '소켓 형식 URL 주소입니다. Unix 소켓 설정을 통해 {path} 경로로 다이얼합니다.',
  'workbench.editors.request.url.socketCtaApply': '적용',
  'workbench.editors.request.method.customGroup': '사용자 지정',
  'workbench.editors.request.method.usePrefix': '사용:',
  'workbench.editors.request.method.forbiddenSuffix': '메서드는 브라우저에서 보낼 수 없습니다.',
  'workbench.editors.request.method.invalidHint': '메서드는 영문자, 숫자, 하이픈만 사용합니다 (최대 32자).',
  'workbench.editors.request.method.removeCustomAria': '사용자 지정 메서드 {method} 제거',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': '인가로 이동',
  'workbench.editors.request.goToBody': '본문으로 이동',
  'workbench.editors.request.headers.keyPlaceholder': '헤더',
  'workbench.editors.request.headers.hideAuto': '자동 생성 헤더 숨기기',
  'workbench.editors.request.headers.hiddenCount': '{count}개 숨김',
  'workbench.editors.request.headers.autoInfo':
    '이 헤더들은 자동으로 추가되어 요청과 함께 전송됩니다. 행의 정보 아이콘을 클릭하면 헤더별 세부 정보를 볼 수 있습니다.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    '중복된 헤더이며, 인가 설정이 생성하는 {header} 헤더로 재정의됩니다.',
  'workbench.editors.request.headers.calculated': '<calculated when request is sent>',
  'workbench.editors.request.headers.browserUserAgent': '<browser user agent>',
  'workbench.editors.request.headers.hint.cacheControl':
    '브라우저 호스트에서 보낼 때마다 “Cache-Control: no-cache” 헤더가 함께 나가므로, 요청을 반복해도 서버가 오래된 캐시로 응답하지 않습니다. 다른 값을 보내려면 직접 Cache-Control 행을 추가하세요.',
  'workbench.editors.request.headers.hint.contentType':
    '런타임이 본문 인코딩에서 Content-Type 헤더를 계산합니다 (form-data → 경계가 붙은 multipart/form-data, x-www-form-urlencoded → application/x-www-form-urlencoded, raw JSON → application/json 등). 재정의하려면 직접 헤더를 설정하세요.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length 헤더는 요청을 보내기 전에 직렬화된 본문의 바이트 크기에서 계산됩니다. 브라우저는 실제 본문 길이와 맞지 않는 사용자 지정 Content-Length 헤더를 따르지 않습니다.',
  'workbench.editors.request.headers.hint.host':
    '브라우저가 대상 URL 주소에서 Host 헤더를 도출하며, 사용자 코드가 이를 재정의하도록 허용하지 않습니다.',
  'workbench.editors.request.headers.hint.userAgent':
    'User-Agent 헤더는 클라이언트를 식별합니다. 요청은 브라우저 자체의 User-Agent 값으로 나갑니다. 재정의하려면 아래에 직접 User-Agent 행을 추가하세요.',
  'workbench.editors.request.headers.hint.accept':
    'Accept 헤더는 클라이언트가 해석할 수 있는 미디어 유형을 서버에 알립니다. `*/*` 값이면 서버가 고릅니다. 응답을 제한하려면 더 좁은 집합 (예: `application/json`)으로 재정의하세요.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    '브라우저가 지원하는 압축 알고리즘입니다. 브라우저가 설정하고 연결마다 협상하므로 사용자 코드에서 재정의할 수 없습니다.',
  'workbench.editors.request.headers.hint.connection':
    'HTTP/1.1 연결 재사용입니다. 브라우저가 연결 풀을 관리하며 사용자 코드가 이 헤더를 재정의하도록 허용하지 않습니다.',
  'workbench.editors.request.headers.hint.node.host':
    '요청을 보낼 때 대상 URL 주소에서 도출됩니다. 직접 추가한 Host 행이 전송선에서 이를 대체합니다.',
  'workbench.editors.request.headers.hint.node.connection':
    'node 런타임은 연결을 살려 두고 출처별로 풀링합니다. 직접 추가한 Connection 행이 이를 대체합니다.',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'node 런타임의 fetch 클라이언트는 와일드카드를 보냅니다. 직접 추가한 행이 이를 대체합니다.',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    'node 런타임의 fetch 클라이언트가 보낼 때마다 찍습니다. 직접 추가한 행이 이를 대체합니다.',
  'workbench.editors.request.headers.hint.node.userAgent':
    'node 런타임은 보낼 때마다 이 앱을 식별합니다. 다른 값을 보내려면 직접 User-Agent 행을 추가하세요.',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'node 런타임이 받아들여 대신 디코딩하는 압축입니다. 직접 추가한 행이 이를 대체하며, 그러면 응답 본문은 보낸 그대로 도착합니다.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <credentials>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<value>',
  'workbench.editors.request.authPreview.accessTokenValue': '<access token>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <access token>',
  'workbench.editors.request.authPreview.basicHint':
    '인가 탭 (Basic Auth)에서 생성됩니다. 요청을 보낼 때 사용자 이름과 비밀번호가 base64 인코딩되어 이 헤더에 들어갑니다.',
  'workbench.editors.request.authPreview.bearerHint':
    '인가 탭 (Bearer Token)에서 생성됩니다. 요청을 보낼 때 토큰이 이 헤더에 추가됩니다.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    '인가 탭 (API Key)에서 생성됩니다. 요청을 보낼 때 값이 이 헤더에 추가됩니다.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    '인가 탭 (API Key)에서 생성됩니다. 요청을 보낼 때 값이 이 쿼리 매개변수에 추가됩니다.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    '인가 탭 (OAuth 2.0)에서 생성됩니다. 요청을 보낼 때 액세스 토큰이 이 헤더에 추가됩니다.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    '인가 탭 (OAuth 2.0)에서 생성됩니다. 요청을 보낼 때 액세스 토큰이 요청 URL 주소에 덧붙습니다.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <signature>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<request timestamp>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    '인가 탭 (AWS Signature v4)에서 생성됩니다. 요청을 보낼 때 자격 증명으로 서명됩니다.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    '인가 탭 (AWS Signature v4)에서 생성됩니다. 요청을 보낼 때 서명 타임스탬프가 이 헤더에 추가됩니다.',
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    '인가 탭 (AWS Signature v4)에서 생성됩니다. 요청을 보낼 때 X-Amz-* 매개변수가 URL 쿼리에 추가됩니다.',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <signed parameters>',
  'workbench.editors.request.authPreview.edgeGridHint':
    '인가 탭 (Akamai EdgeGrid)에서 생성됩니다. 요청을 보낼 때 자격 증명으로 서명됩니다.',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <signed JWT>',
  'workbench.editors.request.authPreview.asapHint':
    '인가 탭 (ASAP)에서 생성됩니다. 요청을 보낼 때 개인 키로 새 토큰을 서명해 이 헤더에 추가합니다.',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<covered components>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<signature>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    '인가 탭 (HTTP Message Signature)에서 생성됩니다. 요청을 보낼 때 키로 서명됩니다.',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<digest of the body>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    '인가 탭 (HTTP Message Signature)에서 생성됩니다. 요청을 보낼 때 본문 다이제스트가 계산됩니다.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <challenge response>',
  'workbench.editors.request.authPreview.digestHint':
    '인가 탭 (Digest Auth)에서 생성됩니다. 요청을 보낼 때 서버의 챌린지로부터 값을 계산한 다음, 그 값으로 요청을 다시 보냅니다.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <signed parameters>',
  'workbench.editors.request.authPreview.oauth1Hint':
    '인가 탭 (OAuth 1.0)에서 생성됩니다. 요청을 보낼 때 자격 증명으로 서명됩니다.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    '인가 탭 (OAuth 1.0)에서 생성됩니다. 요청을 보낼 때 oauth_* 매개변수가 URL 쿼리에 추가됩니다.',
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <signed parameters>',
  'workbench.editors.request.authPreview.hawkHint':
    '인가 탭 (Hawk Authentication)에서 생성됩니다. 요청을 보낼 때 자격 증명으로 서명됩니다.',
  'workbench.editors.request.authPreview.jwtValue': '<signed JWT>',
  'workbench.editors.request.authPreview.jwtHint':
    '인가 탭 (JWT Bearer)에서 생성됩니다. 요청을 보낼 때 토큰을 서명해 이 헤더에 추가합니다.',
  'workbench.editors.request.authPreview.jwtQueryHint':
    '인가 탭 (JWT Bearer)에서 생성됩니다. 요청을 보낼 때 토큰을 서명해 이 쿼리 매개변수에 추가합니다.',
  'workbench.editors.request.authPreview.inheritedFrom': '{source}에서 상속됨. 상위 항목에서 편집하세요.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': '인증 유형',
  'workbench.editors.request.auth.group.credentials': '자격 증명',
  'workbench.editors.request.auth.group.token': '토큰',
  'workbench.editors.request.auth.group.signing': '서명',
  'workbench.editors.request.auth.group.consumer': '소비자',
  'workbench.editors.request.auth.group.attributes': '속성',
  'workbench.editors.request.auth.group.delivery': '전달',
  'workbench.editors.request.auth.group.challenge': '챌린지',
  'workbench.editors.request.auth.group.grant': '그랜트',
  'workbench.editors.request.auth.group.advanced': '고급',
  'workbench.editors.request.auth.group.coverage': '서명 범위',
  'workbench.editors.request.auth.group.parameters': '매개변수',
  'workbench.editors.request.auth.typeInfo.none':
    '아무것도 추가되지 않습니다. 요청은 헤더 탭과 Params 탭에 보이는 그대로 나갑니다.',
  'workbench.editors.request.auth.typeInfo.basic':
    '사용자 이름과 비밀번호를 콜론으로 이어 base64 인코딩한 뒤, 보낼 때마다 Authorization: Basic 헤더로 전송합니다. 암호화가 아니라 인코딩이므로 HTTPS 연결에서만 쓰세요.',
  'workbench.editors.request.auth.typeInfo.bearer':
    '보낼 때마다 Authorization 헤더의 Bearer 스킴 뒤에 토큰을 그대로 전송합니다.',
  'workbench.editors.request.auth.typeInfo.apiKey':
    '키가 헤더나 쿼리 매개변수의 이름이 되고 값이 그 안에 실립니다. 대부분의 공개 API 서비스가 쓰는 평문 자격 증명 스킴입니다.',
  'workbench.editors.request.auth.typeInfo.digest':
    '첫 전송이 서버의 401 챌린지 (realm, nonce, qop)를 받아 오고, 자격 증명을 그 값과 함께 해시해 response= 값에 넣어 요청을 다시 보냅니다. 비밀번호 자체는 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.typeInfo.oauth1':
    '소비자 자격 증명과 토큰 자격 증명이 메서드, URL 주소, 매개변수의 기준 문자열에 서명합니다. 서명된 oauth_* 매개변수는 Authorization 헤더나 URL 주소에 실리며, nonce, timestamp, version 값은 보낼 때마다 새로 발급됩니다.',
  'workbench.editors.request.auth.typeInfo.hawk':
    '메서드, URL 주소, 타임스탬프, 논스, 선택적 속성에 대한 MAC 값이 Authorization: Hawk 헤더에 실립니다. 타임스탬프와 논스는 보낼 때마다 새로 발급됩니다.',
  'workbench.editors.request.auth.typeInfo.jwt':
    '여기의 키 자료 (아래의 헤더, 페이로드, 서명)로 보낼 때마다 새 JWT 토큰을 발급해 서명하고, bearer 토큰이나 쿼리 매개변수로 전달합니다.',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    'base64 자격 증명이 되는 쌍입니다. 둘 다 인코딩만 된 채 암호화 없이 전송됩니다.',
  'workbench.editors.request.auth.groupInfo.bearer.token':
    '서버가 발급한 그대로의 토큰입니다. 전송선에서는 Bearer 스킴이 앞에 붙습니다.',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    '이름과 시크릿입니다. 이름은 헤더 또는 매개변수이고, 값은 그 안에 실리는 내용입니다.',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery':
    '키가 놓이는 곳입니다. 요청 헤더, 또는 URL 주소에 덧붙는 쿼리 매개변수입니다.',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    '챌린지 응답을 계산하는 쌍입니다. 사용자 이름은 실리고, 비밀번호는 응답 해시의 일부로만 쓰입니다.',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    '데스크톱 앱과 CLI 도구에서 보낼 때 401 구간을 처리하는 방식입니다. 비활성화하지 않으면 자동으로 응답하고 다시 보냅니다.',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    '기준 문자열에 서명하는 방식입니다. 시크릿을 쓰는 HMAC 방식, 개인 키를 쓰는 RSA 방식, 또는 PLAINTEXT 방식이며, 본문을 해시에 포함할지도 정합니다.',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    '애플리케이션의 자격 증명입니다. 키는 oauth_consumer_key 값으로 실리고, 시크릿 (또는 개인 키)은 oauth_signature 값을 통해서만 쓰입니다.',
  'workbench.editors.request.auth.groupInfo.oauth1.token':
    '3-legged 흐름에서 받은 사용자의 액세스 토큰 쌍입니다. 1-legged 호출이면 둘 다 비워 두세요.',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'oauth_* 매개변수가 놓이는 곳입니다. Authorization 헤더 (선택적 realm 값 포함) 또는 URL 주소의 쿼리 문자열입니다.',
  'workbench.editors.request.auth.groupInfo.hawk.credentials':
    'id 값은 헤더에 실리고, 키는 그것이 계산하는 MAC 값을 통해서만 쓰입니다.',
  'workbench.editors.request.auth.groupInfo.hawk.signing':
    'MAC 값의 다이제스트와, 요청 본문을 hash= 값으로 해시해 포함할지 여부입니다.',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    '스킴의 선택적 속성입니다. 애플리케이션 데이터 (ext), 애플리케이션 id (app), 위임한 애플리케이션 (dlg)이며, 있으면 서명됩니다.',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'JWT 헤더에 명시되는 알고리즘과 서명하는 키 자료입니다. HS 계열은 공유 시크릿, RS / PS / ES 계열은 개인 키입니다.',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'JWT 토큰이 담는 내용입니다. 페이로드 클레임, 추가 보호 헤더, 그리고 iat / exp 클레임으로 찍히는 선택적 수명입니다.',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    '서명된 JWT 토큰이 놓이는 곳입니다. 접두사 뒤의 Authorization 헤더, 또는 token 쿼리 매개변수입니다.',
  'workbench.editors.request.auth.rowInfo.basicUsername': 'base64 자격 증명에서 콜론 앞에 실립니다.',
  'workbench.editors.request.auth.rowInfo.basicPassword':
    '콜론 뒤에 실립니다. 암호화가 아니라 인코딩이므로 HTTPS 연결에서만 쓰세요.',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    'Bearer 스킴 뒤에 그대로 전송됩니다. “Bearer …” 형태로 붙여넣으면 여기서 접두사가 떨어집니다.',
  'workbench.editors.request.auth.rowInfo.apiKeyKey': '값이 실리는 헤더 이름 또는 쿼리 매개변수 이름입니다.',
  'workbench.editors.request.auth.rowInfo.apiKeyValue': '헤더 값이나 매개변수 값으로 전송되는 시크릿입니다.',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    '헤더는 키를 요청에 싣고, 쿼리 매개변수는 URL 주소에 덧붙여 로그에 남게 합니다.',
  'workbench.editors.request.auth.rowInfo.digestUsername': '챌린지 응답에 username= 값으로 실립니다.',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    '전송선에 실리지 않습니다. realm, nonce, 메서드와 함께 해시되어 response= 값이 됩니다.',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry':
    '자동 두 번째 구간을 멈춥니다. 401 응답에 답하는 대신 그 응답을 그대로 돌려줍니다.',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    'oauth_signature_method 값에 서명 알고리즘을 명시하고 아래의 자격 증명 집합을 고릅니다.',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    '폼이 아닌 본문을 이 방식의 해시로 다이제스트해 oauth_body_hash 값에 넣고 나머지와 함께 서명합니다.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey':
    '애플리케이션을 식별합니다. oauth_consumer_key 값으로 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    '토큰 시크릿과 함께 요청에 서명합니다. 전송선에는 실리지 않고 oauth_signature 값만 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'RSA 방식에서 기준 문자열에 서명하는 PEM 키입니다. 서명만 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth1Token':
    '사용자의 액세스 토큰이며 oauth_token 값으로 전송됩니다. 1-legged 호출이면 비워 둡니다.',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    '서명 키의 나머지 절반입니다. 전송선에는 실리지 않고 oauth_signature 값만 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    '헤더는 oauth_* 매개변수를 Authorization 헤더에 싣고, 쿼리 매개변수는 URL 주소에 덧붙입니다.',
  'workbench.editors.request.auth.rowInfo.oauth1Realm': '헤더 맨 앞에 realm= 값으로 되풀이되며 보호 공간을 명시합니다.',
  'workbench.editors.request.auth.rowInfo.hawkAuthId': '자격 증명을 식별합니다. 헤더에 id= 값으로 실립니다.',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey':
    'mac= 값을 계산하는 공유 시크릿입니다. 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm': 'MAC 값과 페이로드 해시가 쓰는 HMAC 다이제스트입니다.',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash':
    '본문과 그 콘텐츠 유형을 hash= 값으로 해시해 페이로드를 서명에 묶습니다.',
  'workbench.editors.request.auth.rowInfo.hawkExt': '애플리케이션별 데이터입니다. ext= 값으로 실리며 서명됩니다.',
  'workbench.editors.request.auth.rowInfo.hawkApp': '애플리케이션 id 값입니다. app= 값으로 실리며 서명됩니다.',
  'workbench.editors.request.auth.rowInfo.hawkDlg':
    '위임한 애플리케이션 id 값입니다. app= 값 뒤에 dlg= 값으로 실리며 서명됩니다.',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm': '보호 헤더에 alg 값으로 기록되며 아래의 키 필드를 고릅니다.',
  'workbench.editors.request.auth.rowInfo.jwtSecret': '서명을 만드는 공유 HMAC 시크릿입니다. 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64':
    '서명하기 전에 시크릿을 base64 형식에서 디코딩합니다. 그 형태로 발급된 시크릿에 쓰세요.',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey':
    'RS / PS / ES 계열의 서명을 만드는 PEM 개인 키입니다. 서명만 실립니다.',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'JSON 형식의 클레임입니다. 템플릿은 보낼 때마다 해석되며, 여기에 설정한 iat 또는 exp 클레임이 수명 설정보다 우선합니다.',
  'workbench.editors.request.auth.rowInfo.jwtHeaders':
    'JSON 형식의 추가 보호 헤더입니다 (보통 kid 헤더). alg 헤더와 typ 헤더는 자동으로 추가됩니다.',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn':
    '서명 시점에 iat 클레임과 exp 클레임을 페이로드에 찍어, 보낼 때마다 새 수명을 담습니다.',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    '헤더는 JWT 토큰을 Authorization 헤더로 보내고, 쿼리 매개변수는 URL 주소에 token= 값으로 덧붙입니다.',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'Authorization 헤더에서 JWT 토큰 앞에 오는 스킴입니다. 기본값은 Bearer 스킴이며, 비우면 토큰만 보냅니다.',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    '시크릿 키가 메서드, 경로, 쿼리, 헤더, 페이로드 해시에 서명합니다. 서명은 X-Amz-Date 헤더와 함께 Authorization: AWS4-HMAC-SHA256 헤더에 실리거나 X-Amz-* 쿼리 매개변수로 실립니다. 비밀 값은 아무것도 실리지 않습니다.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    '액세스 키는 Credential= 값에 실리고, 시크릿 키는 그것이 계산하는 서명을 통해서만 쓰입니다. 임시 자격 증명이면 세션 토큰이 X-Amz-Security-Token 헤더로 실립니다.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    '서명 키를 도출하는 자격 증명 범위입니다. 서비스와 리전이며, 어느 쪽이든 비워 두면 AWS 호스트 이름에서 도출합니다 (리전은 us-east-1 값으로 대체됩니다).',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    '서명이 놓이는 곳입니다. X-Amz-Date 헤더와 함께 Authorization 헤더에 싣거나, 헤더를 받을 수 없는 엔드포인트를 위해 X-Amz-* 쿼리 매개변수로 싣습니다.',
  'workbench.editors.request.auth.rowInfo.awsAccessKey': '키 쌍을 식별합니다. 범위 앞의 Credential= 값에 실립니다.',
  'workbench.editors.request.auth.rowInfo.awsSecretKey': '서명 키를 도출하는 키 자료입니다. 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'STS 세션 토큰입니다. X-Amz-Security-Token 헤더로 실리고 서명되며, 임시 자격 증명에만 쓰입니다.',
  'workbench.editors.request.auth.rowInfo.awsService':
    '자격 증명 범위의 서비스입니다 (s3, execute-api, …). 비우면 AWS 호스트 이름에서 도출합니다. s3 서비스는 페이로드 해시도 헤더로 서명합니다.',
  'workbench.editors.request.auth.rowInfo.awsRegion':
    '자격 증명 범위의 리전입니다. 비우면 AWS 호스트 이름에서 도출하고, 없으면 us-east-1 값을 씁니다.',
  'workbench.editors.request.auth.rowInfo.awsAddTo':
    '헤더 (기본값) 또는 URL 쿼리입니다. 후자는 헤더를 받을 수 없는 엔드포인트를 위한 미리 서명된 형태입니다.',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    '클라이언트 시크릿이 메서드, 스킴, 호스트, 경로, 지정한 헤더, POST 본문 해시에 서명합니다. 토큰, 보낼 때마다 새로 만드는 타임스탬프와 논스, 서명이 Authorization: EG1-HMAC-SHA256 헤더에 실립니다. 시크릿은 실리지 않습니다.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    '두 토큰은 client_token= 값과 access_token= 값으로 헤더에 실리고, 클라이언트 시크릿은 그것이 도출하는 서명을 통해서만 쓰입니다.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    '요청 줄 너머로 서명이 포함하는 범위입니다. API 서비스가 지정한 헤더를 그 순서대로, 그리고 바이트 창 (API 서비스가 달리 정하지 않으면 스킴의 128 KiB)으로 제한한 POST 본문 해시입니다.',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken':
    'API 클라이언트를 식별합니다. client_token= 값으로 실립니다.',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken':
    '자격 증명을 식별합니다. access_token= 값으로 실립니다.',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret':
    '보낼 때마다 서명 키를 도출하는 키 자료입니다. 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    '서명에 접어 넣을 헤더 이름을 쉼표로 구분해 서명 순서대로 적습니다. 요청에 없는 지정 헤더는 건너뛰고, 지정하지 않은 헤더는 서명되지 않습니다.',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    '콘텐츠 해시가 포함하는 POST 본문의 바이트 창입니다. 비우면 스킴의 131072 바이트입니다.',
  'workbench.editors.request.auth.typeInfo.asap':
    '보낼 때마다 새 JWT 토큰을 발급합니다. 발급자, 대상, 주체를 클레임으로, iat / exp 클레임을 시계에서, 고유한 jti 논스를 넣고 kid 헤더 아래 개인 키로 서명해 bearer 토큰으로 전달합니다. 키는 실리지 않습니다.',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'JWT 헤더에 명시되는 비대칭 계열, 수신자가 공개 키를 찾는 데 쓰는 키 id, 그리고 서명하는 개인 키입니다.',
  'workbench.editors.request.auth.groupInfo.asap.token':
    '토큰이 주장하는 내용입니다. 누가 발급했는지, 누구를 위한 것인지, 누구를 대신하는지, 추가 클레임, 그리고 수명 (기본값은 스킴의 1시간 상한)입니다.',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm':
    '헤더에 서명 계열을 명시합니다. 스킴은 HS 계열을 허용하지 않습니다.',
  'workbench.editors.request.auth.rowInfo.asapKeyId':
    'kid 헤더로 실립니다. 스킴의 배치대로 issuer/key-name 형식이며, 수신자는 이 값으로 공개 키를 가져옵니다.',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    '서명하는 PEM 키 (또는 Atlassian의 data:application/pkcs8 형식)입니다. 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.asapIssuer': '등록된 서비스 식별자입니다. iss 클레임으로 실립니다.',
  'workbench.editors.request.auth.rowInfo.asapAudience':
    '토큰의 대상입니다. aud 클레임으로 실리며, 배열은 추가 클레임으로 넣습니다.',
  'workbench.editors.request.auth.rowInfo.asapSubject':
    '누구를 대신하는지입니다. sub 클레임으로 실리며, 비우면 발급자를 보냅니다.',
  'workbench.editors.request.auth.rowInfo.asapClaims':
    '마지막에 병합되는 추가 클레임입니다. jti / iat / exp 클레임을 포함해 구성된 모든 클레임보다 우선합니다.',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn':
    'exp − iat 값으로 찍히는 수명입니다. 비우면 스킴의 상한인 3600초입니다.',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    '요청은 보낼 때 서명됩니다 (RFC 9421). 대상 구성 요소 (메서드, 대상, 지정한 헤더, 본문의 Content-Digest 값)와 서명 매개변수로 서명 기준을 만들어 키로 서명하고, Signature-Input 헤더와 Signature 헤더로 전달합니다. 키는 실리지 않습니다.',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    '등록된 알고리즘, 검증기가 키를 찾는 데 쓰는 키 id, 그리고 서명하는 키입니다. PEM 개인 키이거나, hmac-sha256 방식이면 공유 시크릿입니다.',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    '서명이 포함하는 범위입니다. 서명 순서대로의 구성 요소 (@method, @target-uri 같은 도출 요소와 이름으로 지정한 헤더 필드)와, 본문의 Content-Digest 값을 발급해 포함할지 여부입니다.',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    '@signature-params 메타데이터입니다. 두 헤더가 함께 담는 레이블, created / expires 시각, 보낼 때마다 새로 만드는 논스, alg 매개변수, 애플리케이션 태그입니다.',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    '등록된 여섯 알고리즘 중 하나입니다. 검증기가 맞는 키를 갖고 있어야 합니다. RFC 문서의 예시는 rsa-pss-sha512 알고리즘을 앞세웁니다.',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    'keyid 매개변수로 실립니다. 검증기는 이 값으로 공개 키 (또는 시크릿)를 가져옵니다. 비우면 매개변수를 생략합니다.',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey':
    '서명하는 PEM 키입니다. PKCS#8, PKCS#1 또는 SEC1 형식이며 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.httpSigSecret':
    '검증기와 공유하는 시크릿입니다. HMAC 값의 키가 되며 전송선에 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64':
    '시크릿이 base64 텍스트입니다. 서명하기 전에 원시 키 바이트로 디코딩합니다.',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    '공백으로 구분해 서명 순서대로 적습니다. @method, @target-uri, @authority, @scheme, @request-target, @path, @query와 헤더 이름입니다. 요청에 없는 헤더를 포함하면 전송이 실패합니다.',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    '본문 바이트에 대한 Content-Digest 헤더를 발급해 (RFC 9530) content-digest 항목을 포함할 수 있게 합니다. 본문 없는 전송은 빈 콘텐츠를 다이제스트합니다. 멀티파트 본문은 다이제스트할 수 없습니다.',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'Signature-Input 헤더와 Signature 헤더가 이 서명을 담는 사전 키입니다. 비우면 sig1 값입니다.',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    'created 매개변수를 서명 시각으로 기록합니다. 검증기는 이 값으로 오래된 서명을 거부합니다. 끄면 매개변수를 (그리고 expires 매개변수도) 뺍니다.',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn':
    'expires 매개변수를 created 값 + 이 초 수로 기록합니다. 비우면 만료를 기록하지 않습니다.',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    '보낼 때마다 새 무작위 논스를 기록합니다. 논스를 추적하는 검증기를 위한 재생 방지 장치입니다.',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    '알고리즘을 명시하는 alg 매개변수를 기록합니다. 끄면 검증기가 해석하는 키에 맡깁니다 (RFC 문서의 기본값).',
  'workbench.editors.request.auth.rowInfo.httpSigTag':
    '검증기가 서명을 구별할 수 있게 하는 애플리케이션별 tag 매개변수입니다. 비우면 생략합니다.',
  'workbench.editors.request.auth.typeInfo.oauth2':
    '클라이언트가 공급자에게서 액세스 토큰을 얻습니다. 브라우저 인가 뒤 토큰 교환, 또는 머신 그랜트와 비밀번호 그랜트의 직접 교환입니다. 보낼 때마다 그 토큰을 bearer 토큰으로 담으며, 리프레시 토큰이 발급되었으면 만료 시 갱신합니다.',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    '이 구성이 지금 갖고 있는 토큰입니다. 전송 시 Bearer 스킴 뒤에 담기는 값과, 스스로 갱신할지 여부입니다.',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    '새 토큰을 얻는 방법입니다. 그랜트, 공급자의 엔드포인트, 클라이언트의 신원, 그리고 요청하는 범위입니다.',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced':
    '갱신 구간과, 세 가지 공급자 요청 각각이 담는 추가 매개변수입니다.',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    '이 구성이 발급하는 JWT 토큰입니다. 모든 토큰 요청의 클라이언트 어서션으로, 또는 JWT bearer 그랜트 자체로 쓰입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    '마지막 흐름이 저장한 액세스 토큰입니다. 보낼 때마다 Bearer 스킴 뒤에 전송되며, 흐름이 실행되기 전까지는 비어 있습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP (RFC 9449)는 교환 시 생성한 키 쌍에 토큰을 묶습니다. 모든 토큰 요청과 모든 전송이 그 요청의 메서드와 URL 주소에 대해 서명된 증명을 담고, 공급자는 토큰을 DPoP 유형으로 발급하며 토큰은 그 스킴으로 전송됩니다. 헤더 접두사와 URL 모드는 물러납니다. 키는 저장된 토큰 곁에 남고 구성에는 들어가지 않습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    '증명의 서명 계열입니다. 키 쌍은 여기에 맞춰 생성됩니다. ES256 알고리즘은 모든 DPoP 배포가 받아들입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'Authorization 헤더에서 토큰 앞에 오는 스킴입니다. 비우면 공급자가 발급한 token_type 값 (기본값 Bearer)을 보내고, 설정하면 전송선에서 이 값이 우선합니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    '만료된 액세스 토큰을 보내기 전에 갱신합니다. 공급자가 리프레시 토큰을 발급했으면 그것으로, 아니면 브라우저가 필요 없는 그랜트를 다시 실행해서 갱신합니다.',
  'workbench.editors.request.auth.rowInfo.oauth2Status':
    '저장된 토큰이 유효한 기간입니다. 새로 고침은 지금 교환하고, 연결 해제는 토큰을 잊습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName':
    '앱 안에서 이 토큰을 부르는 레이블입니다. 전송선에는 아무것도 실리지 않습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    '토큰 교환의 grant_type 값과 그 전에 실행되는 구간입니다. 코드 그랜트는 브라우저 인가를 거치고, 클라이언트 자격 증명, 비밀번호, JWT bearer 자격 증명은 거치지 않습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    '공급자가 코드와 함께 브라우저를 되돌려 보내는 redirect_uri 값입니다. 공급자에 등록하세요.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl': '브라우저가 먼저 보내지는 공급자의 인가 엔드포인트입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    '공급자의 기기 인가 엔드포인트 (RFC 8628)입니다. 사용자 코드와 확인 URL 주소를 돌려주며, 이 호스트가 토큰 엔드포인트를 폴링하는 동안 아무 기기에서나 승인할 수 있습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    '공급자의 발급자 식별자 또는 그 /.well-known/ 메타데이터 URL 주소입니다. 검색은 메타데이터 문서 (RFC 8414 / OpenID Connect Discovery)를 읽어 아래의 엔드포인트 행을 채우고, 문서가 선택한 항목에 대해 말하는 내용을 나열합니다. 그 밖에는 아무것도 바뀌지 않으며, 이후에도 행은 사용자의 것입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl':
    '코드 (또는 자격 증명)를 교환하는 공급자의 토큰 엔드포인트입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    '토큰 요청 본문에 전송되는 리소스 소유자의 사용자 이름입니다. 비밀번호 그랜트에만 쓰입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    '토큰 요청 본문에 전송되는 리소스 소유자의 비밀번호입니다. 비밀번호 그랜트에만 쓰입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId':
    '애플리케이션을 식별합니다. 인가 URL 주소와 토큰 요청에 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    '토큰 엔드포인트에서 애플리케이션을 인증합니다. 클라이언트 인증 설정에 따라 본문에 넣거나 Basic 헤더로 보냅니다.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE 방식: 인가 URL 주소의 code_challenge 값은 흐름마다 새로 만드는 검증 값의 S256 다이제스트입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    '흐름마다 새로 만들어 토큰 교환에 code_verifier 값으로 보내며, 같은 클라이언트가 흐름을 시작했음을 증명합니다.',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    '요청하는 범위입니다. 인가 URL 주소나 토큰 요청에 공백으로 구분한 scope 값으로 전송됩니다.',
  'workbench.editors.request.auth.rowInfo.oauth2State':
    '흐름마다 새로 만들고 공급자가 되돌려 보내므로, 콜백이 이 인가와 짝지어집니다.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    '토큰 요청에서 클라이언트가 자신을 증명하는 방법입니다. 폼 본문의 자격 증명이나 Authorization: Basic 헤더, 또는 시크릿 대신 서명된 client_assertion 값입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    '그랜트 어서션의 iss 클레임입니다. 공급자가 등록한 서비스 계정 또는 소비자 키입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    '선택적 sub 클레임입니다. 토큰이 대신 행동하는 사용자 (도메인 전체 위임, 가장)이며, 비우면 보내지 않습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    '그랜트 어서션에 병합되는 추가 클레임이며 구성된 클레임보다 우선합니다. 공급자별 클레임이나 직접 정한 scope 값입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    '어서션에 서명하는 JWS 계열입니다. 개인 키에는 비대칭 계열, 클라이언트 시크릿에는 HS256/384/512 알고리즘입니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId':
    '등록된 키를 명시하는 kid 헤더입니다. 공급자가 맞는 공개 키 절반을 고르게 합니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    '서명 키입니다. PEM, 순수 DER 또는 data:application/pkcs8 형식이며 절대 내보내지지 않습니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'aud 클레임입니다. 비우면 액세스 토큰 URL 주소를 보냅니다. FAPI 프로필과 Keycloak 서버는 대신 발급자 식별자를 요구합니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    'exp 클레임에서 iat 클레임을 뺀 값으로 서명 시 찍힙니다. 기본값은 300초이며 공급자가 상한을 둘 수 있습니다 (Google: 1시간).',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    '어서션에 병합되는 추가 보호 헤더 JSON 데이터입니다. 예: Azure 서비스의 x5t#S256 인증서 지문.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl':
    '갱신 교환을 보내는 엔드포인트입니다. 비우면 액세스 토큰 URL 주소를 뜻합니다.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest':
    '인가 URL 주소에 덧붙는 추가 매개변수입니다 (audience, prompt, …).',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    '토큰 요청의 추가 매개변수입니다. 각각 전송 위치에 따라 폼 본문, 헤더 또는 URL 주소에 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    '갱신 요청의 추가 매개변수입니다. 각각 전송 위치에 따라 폼 본문, 헤더 또는 URL 주소에 실립니다.',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    '요청 헤더는 토큰을 Authorization 헤더의 Bearer 스킴 뒤에 보내고, 요청 URL 옵션은 access_token 값으로 덧붙입니다. 후자는 사용 중단된 방식으로 구형 공급자에만 쓰세요.',
  'workbench.editors.request.auth.type.inherit': '상위 항목의 인증 상속',
  'workbench.editors.request.auth.type.none': '인증 없음',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'HTTP Message Signature',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Access Token',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': '선택 사항. 1-legged 호출이면 비워 둡니다',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': '선택 사항. 1-legged 호출이면 비워 둡니다',
  'workbench.editors.request.auth.oauth1SignatureMethod': '서명 방식',
  'workbench.editors.request.auth.oauth1PrivateKey': '개인 키',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} 또는 PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': '본문 해시 포함',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': '선택 사항',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'hawk auth id',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'hawk auth key',
  'workbench.editors.request.auth.hawkAlgorithm': '알고리즘',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': '선택 사항. 앱별 데이터',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': '선택 사항. 애플리케이션 ID',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': '선택 사항. 위임한 애플리케이션 ID',
  'workbench.editors.request.auth.hawkIncludePayloadHash': '페이로드 해시 포함',
  'workbench.editors.request.auth.jwtAddTo': 'JWT 토큰 추가 위치',
  'workbench.editors.request.auth.jwtAlgorithm': '알고리즘',
  'workbench.editors.request.auth.jwtSecret': '시크릿',
  'workbench.editors.request.auth.jwtSecretPlaceholder': 'secret',
  'workbench.editors.request.auth.jwtSecretBase64': 'Base64 인코딩된 시크릿',
  'workbench.editors.request.auth.jwtPrivateKey': '개인 키',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} 또는 PEM',
  'workbench.editors.request.auth.jwtPayload': 'Payload',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'JWT 헤더',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': '알고리즘에 따른 헤더는 자동으로 추가됩니다.',
  'workbench.editors.request.auth.jwtHeaderPrefix': '요청 헤더 접두사',
  'workbench.editors.request.auth.jwtExpiresIn': '만료 (초)',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': '선택 사항',
  'workbench.editors.request.auth.jwtExpiresInNote':
    '설정하면 보낼 때 iat 클레임과 exp 클레임이 페이로드에 찍힙니다. 페이로드에 설정한 클레임이 우선합니다.',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth 방식은 서버의 챌린지에 두 번째 요청으로 답하며, 이는 데스크톱 앱과 CLI 도구에서 실행됩니다. 이 화면에서 보내는 요청은 그 과정 없이 나가므로 서버가 401 응답을 돌려줍니다.',
  'workbench.editors.request.auth.digestRetryNote':
    '기본적으로 401 챌린지에 응답하고 요청을 자동으로 다시 보냅니다. 이 동작을 비활성화하시겠습니까?',
  'workbench.editors.request.auth.digestDisableRetry': '예, 요청 재시도를 비활성화합니다',
  'workbench.editors.request.auth.authAutoGeneratedNote': '요청을 보낼 때 인가 헤더가 자동으로 생성됩니다.',
  'workbench.editors.request.auth.inheritNote': '요청을 보낼 때 인가 헤더가 자동으로 생성됩니다.',
  'workbench.editors.request.auth.noneNote': '이 요청은 인가를 사용하지 않습니다.',
  'workbench.editors.request.auth.inheritDetail':
    '이 요청은 상위 컬렉션의 인가 도우미를 사용합니다. 바꾸려면 컬렉션의 인가 탭을 편집하세요.',
  'workbench.editors.request.auth.inheritedNone': '인증 없음. 폴더에도 컬렉션에도 설정된 것이 없습니다.',
  'workbench.editors.request.auth.sourceCollection': '컬렉션 ‘{name}’',
  'workbench.editors.request.auth.sourceFolder': '폴더 ‘{name}’',
  'workbench.editors.request.auth.groupInherited': '상속됨',
  'workbench.editors.request.auth.refusalQualifier.inQuery': '쿼리에',
  'workbench.editors.request.auth.refusalQualifier.inHeader': '헤더에',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': 'DPoP 키에 묶임',
  'workbench.editors.request.auth.groupOwn': '이 요청',
  'workbench.editors.request.auth.groupOwnFolder': '이 폴더',
  'workbench.editors.request.auth.optionMissingEntry': '없는 항목',
  'workbench.editors.request.auth.danglingPick':
    '이 요청이 고른 항목이 더 이상 없습니다. 대신 가장 가까운 기본 항목이 적용됩니다.',
  'workbench.editors.request.auth.editInParent': '상위 항목에서 편집',
  // The settings rows' inherited line — {source} is the level label
  // above (Collection ‘X’ / Folder ‘X’).
  'workbench.editors.request.settings.inheritedFrom': '{source}에서 상속됨',
  'workbench.editors.request.settings.overridesSource': '{source} 설정을 재정의 ({value})',
  'workbench.editors.request.settings.settingChainTitle': '이 설정이 정해지는 곳',
  'workbench.editors.request.settings.settingChainSummary':
    '이 항목을 설정하는 모든 수준을 바깥쪽부터 나열합니다. 가장 안쪽 값이 실제로 적용되는 값입니다.',
  'workbench.editors.request.settings.settingChainHeading': '수준',
  'workbench.editors.request.settings.thisRequest': '이 요청',
  'workbench.editors.request.settings.thisFolder': '이 폴더',
  'workbench.editors.request.auth.resetToInheritedAuth': '상속된 인증으로 재설정',
  'workbench.editors.request.auth.resizeRailAria': '인증 유형 레일 크기 조절',
  'workbench.editors.request.auth.username': '사용자 이름',
  'workbench.editors.request.auth.password': '비밀번호',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': '키',
  'workbench.editors.request.auth.keyPlaceholder': '예: X-API-Key',
  'workbench.editors.request.auth.value': '값',
  'workbench.editors.request.auth.addTo': '추가 위치',
  'workbench.editors.request.auth.addToHeader': '헤더',
  'workbench.editors.request.auth.addToQuery': '쿼리 매개변수',
  'workbench.editors.request.auth.usernamePlaceholder': 'username',
  'workbench.editors.request.auth.passwordPlaceholder': 'password',
  'workbench.editors.request.auth.tokenPlaceholder': 'bearer token',
  'workbench.editors.request.auth.valuePlaceholder': 'api key value',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': '서비스 이름',
  'workbench.editors.request.auth.awsRegion': '리전',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': '예: AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'secret access key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': '선택 사항. 임시 (STS) 자격 증명에만',
  'workbench.editors.request.auth.awsServicePlaceholder': 'AWS 호스트에서 자동 도출. 예: s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'AWS 호스트에서 자동 도출, 없으면 us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Client Token',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Access Token',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Client Secret',
  'workbench.editors.request.auth.edgeGridHeadersToSign': '서명할 헤더',
  'workbench.editors.request.auth.edgeGridMaxBodySize': '최대 본문 크기',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': '예: akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': '예: akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'client secret',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder': '선택 사항. 쉼표로 구분, 예: X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': '알고리즘',
  'workbench.editors.request.auth.asapKeyId': 'Key ID',
  'workbench.editors.request.auth.asapPrivateKey': '개인 키',
  'workbench.editors.request.auth.asapIssuer': '발급자',
  'workbench.editors.request.auth.asapAudience': '대상',
  'workbench.editors.request.auth.asapSubject': '주체',
  'workbench.editors.request.auth.asapClaims': '추가 클레임',
  'workbench.editors.request.auth.asapExpiresIn': '만료 (초)',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': '예: my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … 또는 data:application/pkcs8 형식',
  'workbench.editors.request.auth.asapIssuerPlaceholder': '예: my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': '예: api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': '선택 사항. 비우면 발급자를 보냅니다',
  'workbench.editors.request.auth.asapClaimsPlaceholder': '선택 사항. JSON 형식, 예: {"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': '알고리즘',
  'workbench.editors.request.auth.httpSigKeyId': 'Key ID',
  'workbench.editors.request.auth.httpSigPrivateKey': '개인 키',
  'workbench.editors.request.auth.httpSigSecret': '공유 시크릿',
  'workbench.editors.request.auth.httpSigSecretBase64': '시크릿이 base64 인코딩됨',
  'workbench.editors.request.auth.httpSigComponents': '대상 구성 요소',
  'workbench.editors.request.auth.httpSigContentDigest': 'Content Digest',
  'workbench.editors.request.auth.httpSigDigestNone': '없음',
  'workbench.editors.request.auth.httpSigLabel': '레이블',
  'workbench.editors.request.auth.httpSigCreated': '생성 타임스탬프',
  'workbench.editors.request.auth.httpSigExpiresIn': '만료 시간 (초)',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': '알고리즘 매개변수 (alg)',
  'workbench.editors.request.auth.httpSigTag': 'Tag',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': '예: my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': '검증기와 공유하는 시크릿',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': '선택 사항. 예: 300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': '선택 사항. 애플리케이션 태그',
  'workbench.editors.request.auth.sendAsLabel': '인가 데이터 추가 위치',
  'workbench.editors.request.auth.sendAsHeaders': '요청 헤더',
  'workbench.editors.request.auth.sendAsUrl': '요청 URL',
  'workbench.editors.request.auth.presetLabel': '공급자 프리셋',
  'workbench.editors.request.auth.presetInfo':
    '공급자를 고르면 인가/토큰 엔드포인트, 기본 범위, 권장 흐름이 미리 채워집니다. 모두 직접 구성하려면 사용자 지정을 고르세요.',
  'workbench.editors.request.auth.presetCustom': '사용자 지정 (프리셋 없음)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'URL 주소로 액세스 토큰을 보내는 방식은 사용 중단되었습니다',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 조항은 URI 쿼리 매개변수 방식을 남겨 두면서도 경고합니다. 토큰이 서버 로그, HTTP `Referer` 헤더, 브라우저 기록, 중간 캐시로 새어 나갑니다. 공급자가 쿼리 형식을 요구하지 않는 한 기본값인',
  'workbench.editors.request.oauth.queryWarningAfter': '헤더를 쓰세요.',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': '아직 토큰이 없습니다. 아래의 새 액세스 토큰 받기를 쓰세요',
  'workbench.editors.request.oauth.headerPrefix': '헤더 접두사',
  'workbench.editors.request.oauth.tokenBinding': '토큰 바인딩',
  'workbench.editors.request.oauth.tokenBindingNone': '없음 (bearer)',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': '증명 알고리즘',
  'workbench.editors.request.oauth.autoRefresh': '토큰 자동 갱신',
  'workbench.editors.request.oauth.autoRefreshDesc': '만료된 토큰은 요청을 보내기 전에 자동으로 갱신됩니다.',
  'workbench.editors.request.oauth.status': '상태',
  'workbench.editors.request.oauth.statusExpired':
    '만료됨. refresh_token 값이 저장되어 있으면 다음 전송 때 자동으로 갱신됩니다.',
  'workbench.editors.request.oauth.statusValid': '유효 · {duration}',
  'workbench.editors.request.oauth.refreshNow': '지금 새로 고침',
  'workbench.editors.request.oauth.disconnect': '연결 해제',
  'workbench.editors.request.oauth.tokenName': '토큰 이름',
  'workbench.editors.request.oauth.tokenNameDesc':
    '자유 형식 레이블입니다. 워크스페이스에 같은 공급자의 토큰이 여럿일 때 자격 증명 목록에 표시됩니다.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': '토큰 이름 입력…',
  'workbench.editors.request.oauth.grantType': '그랜트 유형',
  'workbench.editors.request.oauth.callbackUrl': '콜백 URL',
  'workbench.editors.request.oauth.detecting': '감지 중…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl': '이 URL 주소를 OAuth 공급자에 등록하세요. 주소 표시줄의',
  'workbench.editors.request.oauth.callbackTipBeforeHost': 'URL 주소와 달라 보이는 이유는 Chrome 브라우저가',
  'workbench.editors.request.oauth.callbackTipBeforeApi':
    '전용 리디렉션 호스트를 다음 함수를 위해 노출하기 때문입니다:',
  'workbench.editors.request.oauth.callbackTipAfterApi': '. 확장 프로그램 ID 값은 같고, 호스트와 스킴만 다릅니다.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': '브라우저로 인가',
  'workbench.editors.request.oauth.noTokenNote':
    '아직 토큰이 없습니다. 아래의 흐름을 실행해 받으세요. 별도로 발급받은 토큰이 있으면 대신 Bearer Token 인증을 쓰세요.',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    '로그인은 기본 브라우저에서 열립니다. 브라우저에는 공급자 세션, 비밀번호 관리자, 패스키가 있고, ID 공급자는 앱 안에 내장된 로그인을 차단합니다 (RFC 8252).',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    '공급자는 앱 백엔드 포트의 콜백 URL 주소로 브라우저를 되돌려 보냅니다. 설정에서 포트를 바꾸면 등록할 URL 주소도 바뀝니다.',
  'workbench.editors.request.oauth.authUrl': 'Auth URL',
  'workbench.editors.request.oauth.accessTokenUrl': 'Access Token URL',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': '비워 두면 자동으로 생성됩니다',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': '예: read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': '인가 요청마다 자동으로 생성됩니다',
  'workbench.editors.request.oauth.clientAuthentication': '클라이언트 인증',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    '토큰 POST 요청에서 클라이언트가 자신을 증명하는 방법입니다. 본문의 id 값과 시크릿이나 Basic 헤더, 또는 개인 키로 서명한 JWT 토큰 (private_key_jwt)이나 시크릿으로 서명한 JWT 토큰 (client_secret_jwt)입니다.',
  'workbench.editors.request.oauth.clientAuthBody': '클라이언트 자격 증명을 본문으로 전송',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Basic Auth 헤더로 전송',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': '서명된 JWT 토큰 전송 (private_key_jwt)',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': 'HMAC JWT 토큰 전송 (client_secret_jwt)',
  'workbench.editors.request.oauth.assertionIssuer': '발급자',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': '예: service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': '주체',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder': '선택 사항. 토큰이 대신 행동하는 사용자',
  'workbench.editors.request.oauth.assertionClaims': '추가 클레임',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder':
    '선택 사항. JSON 형식, 예: {"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': '알고리즘',
  'workbench.editors.request.oauth.assertionKeyId': 'Key ID',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': '선택 사항. kid 헤더, 예: key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': '개인 키',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … (PEM 또는 data:application/pkcs8 형식)',
  'workbench.editors.request.oauth.assertionAudience': '대상',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': '비우면 액세스 토큰 URL 주소',
  'workbench.editors.request.oauth.assertionLifetime': '수명 (초)',
  'workbench.editors.request.oauth.assertionHeaders': '추가 헤더',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': '선택 사항. JSON 형식, 예: {"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro': '여기서 OAuth2 요청을 더 세밀하게 사용자 지정할 수 있습니다.',
  'workbench.editors.request.oauth.advancedLearnMore': '구성에 대해 자세히 알아보기',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh Token URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    '대부분의 공급자는 갱신에도 액세스 토큰 URL 주소를 재사용합니다. 공급자가 별도 경로를 제공할 때만 재정의 값을 넣으세요.',
  'workbench.editors.request.oauth.sendInColumn': '전송 위치',
  'workbench.editors.request.oauth.sendInBody': '본문',
  'workbench.editors.request.oauth.sendInHeader': '헤더',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
  'workbench.editors.request.oauth.authRequest': '인가 요청',
  'workbench.editors.request.oauth.tokenRequest': '토큰 요청',
  'workbench.editors.request.oauth.refreshRequest': '갱신 요청',
  'workbench.editors.request.oauth.getNewToken': '새 액세스 토큰 받기',
  'workbench.editors.request.oauth.clearCookies': '쿠키 지우기',
  'workbench.editors.request.oauth.storedFootnoteBefore': '토큰은 워크스페이스별로 다음 위치에 저장됩니다:',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. 완전히 지우려면 워크스페이스를 삭제하세요.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: 토큰을 받았습니다',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: 인가 완료',
  'workbench.editors.request.oauth.toast.failed': 'OAuth 실패: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: 액세스 토큰을 갱신했습니다',
  'workbench.editors.request.oauth.toast.refreshFailed': '갱신 실패: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: 연결 해제됨',
  'workbench.editors.request.oauth.toast.callbackCopied': '콜백 URL 주소를 복사했습니다',
  'workbench.editors.request.oauth.toast.copyUnsupported': '복사가 지원되지 않습니다. URL 주소를 직접 선택하세요',
  'workbench.editors.request.oauth.deviceAuthUrl': 'Device Authorization URL',
  'workbench.editors.request.oauth.deviceWaitingTitle': '{host}에서 승인하기를 기다리는 중',
  'workbench.editors.request.oauth.deviceWaitingDesc':
    '아무 기기에서나 링크를 열고 코드를 입력한 뒤 승인하세요. 이 페이지는 자동으로 업데이트됩니다.',
  'workbench.editors.request.oauth.deviceCode': '코드',
  'workbench.editors.request.oauth.deviceOpen': '열기',
  'workbench.editors.request.oauth.deviceCancel': '취소',
  'workbench.editors.request.oauth.deviceExpiresIn': '{duration} 후 만료',
  'workbench.editors.request.oauth.deviceCheckEvery': '{seconds}초마다 확인',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth: {host}에서 코드 {code} 항목으로 승인하세요',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth: 기기 인가가 승인되었습니다',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth: 인가가 거부되었습니다. {error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth: 기기 코드가 만료되었습니다. {error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'OAuth 기기 인가 실패: {error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth: 기기 인가를 취소했습니다',
  'workbench.editors.request.oauth.toast.codeCopied': '코드를 복사했습니다',
  'workbench.editors.request.oauth.issuerUrl': 'Issuer URL',
  'workbench.editors.request.oauth.issuerUrlPlaceholder':
    'https://accounts.example.com 또는 /.well-known/… 메타데이터 URL 주소',
  'workbench.editors.request.oauth.discover': '검색',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth: 엔드포인트를 검색했습니다',
  'workbench.editors.request.oauth.toast.discoveryFailed': '검색 실패: {error}',
  'workbench.editors.request.oauth.discoveryTitle': '{url}에서 검색됨',
  'workbench.editors.request.oauth.discoveryFilled': '{rows} 항목을 채웠습니다',
  'workbench.editors.request.oauth.discoveryFilledNone': '문서에 엔드포인트가 없어 아무것도 채우지 않았습니다',
  'workbench.editors.request.oauth.discoveryListed': '{pick} 항목은 공급자 목록에 있습니다',
  'workbench.editors.request.oauth.discoveryUnlisted': '{pick} 항목은 목록에 없습니다. 공급자 목록: {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': '클라이언트 인증 {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': '그랜트 {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'DPoP 알고리즘 {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': '어서션 알고리즘 {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    '발급자 식별자는 {issuer} 값입니다. 일부 공급자는 액세스 토큰 URL 주소 대신 이 값을 어서션 대상으로 요구합니다',
  'workbench.editors.request.oauth.discoveryScopes': '제공되는 범위: {supported}. Scope 행에 제안됩니다',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': '이 요청에는 본문이 없습니다',
  'workbench.editors.request.body.modeNoneInfo':
    '요청이 페이로드 없이 전송됩니다. 본문 바이트도 Content-Type 헤더도 없습니다.',
  'workbench.editors.request.body.modeFormDataInfo':
    '파트를 하나의 multipart/form-data 페이로드로 보냅니다. 각 행은 텍스트 필드이거나 파일 파트입니다.',
  'workbench.editors.request.body.modeFormDataDescription':
    '경계가 붙은 Content-Type 헤더는 보낼 때 발급됩니다. 직접 설정한 multipart Content-Type 헤더는 경계가 항상 페이로드와 맞도록 대체됩니다.',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    '필드를 퍼센트 인코딩된 key=value 쌍으로, application/x-www-form-urlencoded Content-Type 헤더와 함께 보냅니다. 비활성 행은 편집기에 남지만 전송선에는 실리지 않습니다.',
  'workbench.editors.request.body.modeRawInfo':
    '편집기 내용을 그대로 보냅니다. 전송선의 바이트는 입력한 것과 정확히 같습니다.',
  'workbench.editors.request.body.modeRawDescription':
    '형식 선택기는 구문 강조와 기본 Content-Type 헤더 (application/json, application/xml, text/plain, text/javascript, text/html)를 정합니다. 헤더 탭에 설정한 Content-Type 헤더가 우선합니다.',
  'workbench.editors.request.body.modeGraphqlInfo':
    'GraphQL HTTP 전송 규약에 따라 쿼리와 변수를 하나의 application/json 페이로드 ({ query, variables })로 보냅니다.',
  'workbench.editors.request.body.modeGraphqlDescription':
    '변수는 유효한 JSON 형식이어야 합니다. 해석할 수 없는 변수 창은 전송 본문에서 빠지고 쿼리만 전송됩니다.',
  'workbench.editors.request.body.format': '정리',
  'workbench.editors.request.body.formatAria': '본문 정리',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'GraphQL 쿼리',
  'workbench.editors.request.body.queryInfoSummary':
    '{ query, variables } 형태의 JSON 본문을 담은 일반 POST 요청으로 전송됩니다. 스키마 인트로스펙션과 쿼리 자동 완성은 아직 지원되지 않습니다.',
  'workbench.editors.request.body.variablesTitle': 'GraphQL Variables',
  'workbench.editors.request.body.variablesInfoTitle': 'GraphQL 변수',
  'workbench.editors.request.body.variablesInfoSummary': '쿼리에서 참조할 변수를 JSON 형식으로 정의합니다 (예: $id).',
  'workbench.editors.request.body.kindText': '텍스트',
  'workbench.editors.request.body.kindFile': '파일',
  'workbench.editors.request.body.newFile': '이 컴퓨터에서 새 파일',
  'workbench.editors.request.body.uploadedFiles': '업로드된 파일',
  'workbench.editors.request.body.allAttached': '업로드된 파일이 모두 이미 첨부되어 있습니다',
  'workbench.editors.request.body.selectFiles': '파일 선택',
  'workbench.editors.request.body.loadingFiles': '파일을 불러오는 중…',
  'workbench.editors.request.body.addFile': '+ 파일 추가',
  'workbench.editors.request.body.uploadRequired': '업로드 필요',
  'workbench.editors.request.body.deleteFileAria': '워크스페이스에서 {filename} 삭제',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': '쓰기',
  'workbench.editors.request.docs.preview': '미리 보기',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    '이 요청을 문서화하세요. 왜 있는지, 언제 실행하는지, 기대하는 인증 범위 등입니다. Markdown 문법을 지원합니다: 제목, 목록, 표, 코드 블록, 링크. {{variable}} 참조는 미리 보기에서 칩으로 표시됩니다.',
  'workbench.editors.request.docs.placeholder':
    '이 요청은 무엇을 하나요?\n왜 있는지, 언제 실행하는지, 기대하는 인증 범위.',
  'workbench.editors.request.docs.empty': '아직 문서화된 내용이 없습니다. 메모를 추가하려면 쓰기로 전환하세요.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': '요청 전',
  'workbench.editors.request.scripts.postResponse': '응답 후',
  'workbench.editors.request.scripts.preInfoTitle': '요청 전 스크립트',
  'workbench.editors.request.scripts.preInfoSummary':
    '요청이 나가기 전에 한 번 실행됩니다. oh API 기능으로 URL 주소, 헤더, 매개변수, 본문을 다시 씁니다.',
  'workbench.editors.request.scripts.postInfoTitle': '응답 후 스크립트',
  'workbench.editors.request.scripts.postInfoSummary':
    '응답이 도착한 뒤 한 번 실행됩니다. 상태, 헤더, 본문을 읽으며, 단언 결과는 응답 패널에 표시됩니다.',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': '헤더 추가 또는 바꾸기',
  'workbench.editors.request.scripts.apiSetQueryParam': '쿼리 매개변수 추가 또는 바꾸기',
  'workbench.editors.request.scripts.apiSetUrl': '대상 URL 주소 다시 쓰기',
  'workbench.editors.request.scripts.apiSetBody': '요청 본문 바꾸기',
  'workbench.editors.request.scripts.apiRequire': '패키지 라이브러리에서 스크립트 패키지 불러오기',
  'workbench.editors.request.scripts.apiTest': '단언 등록',
  'workbench.editors.request.scripts.runsAfter': '스크립트 {count}개 뒤에 실행:',
  'workbench.editors.request.scripts.runsAfterOne': '스크립트 1개 뒤에 실행:',
  'workbench.editors.request.scripts.prePlaceholderContainer':
    '각 HTTP 요청을 보내기 전에 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.postPlaceholderContainer': '각 HTTP 응답이 끝날 때 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.prePlaceholder': 'JavaScript 코드로 이 요청을 보내기 전에 수정합니다.',
  'workbench.editors.request.scripts.postPlaceholder': 'JavaScript 코드로 이 응답이 도착한 뒤 검사하고 읽습니다.',
  // ── Session script slots (gRPC · WebSocket · MQTT) ─────────────────
  'workbench.editors.request.scripts.grpcBeforeInvoke': '호출 전',
  'workbench.editors.request.scripts.grpcOnMessage': '메시지 수신 시',
  'workbench.editors.request.scripts.grpcAfterResponse': '응답 후',
  'workbench.editors.request.scripts.wsBeforeConnect': '연결 전',
  'workbench.editors.request.scripts.wsBeforeSend': '전송 전',
  'workbench.editors.request.scripts.wsOnMessage': '메시지 수신 시',
  'workbench.editors.request.scripts.wsAfterClose': '종료 후',
  'workbench.editors.request.scripts.mqttBeforeConnect': '연결 전',
  'workbench.editors.request.scripts.mqttBeforePublish': '게시 전',
  'workbench.editors.request.scripts.mqttOnMessage': '메시지 수신 시',
  'workbench.editors.request.scripts.mqttAfterClose': '종료 후',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder':
    'JavaScript 코드로 이 호출을 실행하기 전에 메타데이터와 메시지를 수정합니다.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholder':
    'JavaScript 코드로 도착하는 각 메시지 프레임을 읽습니다.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholder':
    'JavaScript 코드로 이 호출이 끝난 뒤 응답을 검사하고 읽습니다.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholder':
    'JavaScript 코드로 이 세션이 연결되기 전에 핸드셰이크를 수정합니다.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholder':
    'JavaScript 코드로 각 메시지를 보내기 전에 수정하거나 폐기합니다.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholder': 'JavaScript 코드로 도착하는 각 메시지에 반응합니다.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholder': 'JavaScript 코드로 이 세션이 닫힌 뒤 검사하고 읽습니다.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder':
    'JavaScript 코드로 이 세션이 연결되기 전에 CONNECT 패킷을 수정합니다.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholder':
    'JavaScript 코드로 각 메시지를 게시하기 전에 수정하거나 폐기합니다.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholder': 'JavaScript 코드로 도착하는 각 메시지에 반응합니다.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholder':
    'JavaScript 코드로 이 세션의 연결이 끊긴 뒤 검사하고 읽습니다.',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer':
    '각 gRPC 호출을 실행하기 전에 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer':
    '각 gRPC 메시지 프레임마다 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer':
    '각 gRPC 호출이 끝날 때 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer':
    '각 WebSocket 세션이 연결되기 전에 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer':
    '각 WebSocket 메시지를 보내기 전에 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer':
    '각 WebSocket 메시지를 받을 때 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer':
    '각 WebSocket 세션이 닫힌 뒤 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer':
    '각 MQTT 세션이 연결되기 전에 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer':
    '각 MQTT 메시지를 게시하기 전에 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer':
    '각 MQTT 메시지를 받을 때 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer':
    '각 MQTT 세션의 연결이 끊긴 뒤 실행할 스크립트를 작성합니다.',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle': '호출 전 스크립트',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary':
    '호출을 실행하기 전에 한 번 실행됩니다. oh API 기능으로 메타데이터와 요청 메시지를 다시 쓰며, oh.session 객체가 호출의 이후 훅으로 상태를 전달합니다.',
  'workbench.editors.request.scripts.grpcOnMessageInfoTitle': '메시지 수신 시 스크립트',
  'workbench.editors.request.scripts.grpcOnMessageInfoSummary':
    '호출이 캡처하는 모든 메시지 프레임마다 양방향으로, 캡처 뒤에 실행됩니다. 디코딩된 메시지를 읽으며, 캡처는 지연되지 않습니다.',
  'workbench.editors.request.scripts.grpcAfterResponseInfoTitle': '응답 후 스크립트',
  'workbench.editors.request.scripts.grpcAfterResponseInfoSummary':
    '호출이 끝나면 한 번 실행됩니다. 상태, 헤더, 트레일러, 메시지를 읽으며, 단언 결과는 응답 창에 표시됩니다.',
  'workbench.editors.request.scripts.wsBeforeConnectInfoTitle': '연결 전 스크립트',
  'workbench.editors.request.scripts.wsBeforeConnectInfoSummary':
    '재연결을 포함해 다이얼할 때마다 실행됩니다. oh API 기능으로 URL 주소, 헤더, 매개변수, 하위 프로토콜을 다시 씁니다. 실패하면 기록되고 다이얼은 바뀌지 않은 채 진행됩니다.',
  'workbench.editors.request.scripts.wsBeforeSendInfoTitle': '전송 전 스크립트',
  'workbench.editors.request.scripts.wsBeforeSendInfoSummary':
    '메시지를 보낼 때마다 그 전에 실행됩니다. 나가는 메시지를 다시 쓰거나 폐기합니다. 하트비트와 프로토콜 프레임은 여기를 거치지 않습니다.',
  'workbench.editors.request.scripts.wsOnMessageInfoTitle': '메시지 수신 시 스크립트',
  'workbench.editors.request.scripts.wsOnMessageInfoSummary':
    '메시지를 받을 때마다 캡처 뒤에 실행됩니다. 반응하세요: oh.send 함수로 답하고, oh.session 객체에 상태를 유지하고, 단언을 등록합니다.',
  'workbench.editors.request.scripts.wsAfterCloseInfoTitle': '종료 후 스크립트',
  'workbench.editors.request.scripts.wsAfterCloseInfoSummary':
    '세션이 열린 뒤 끝나면 한 번 실행됩니다. 종료 기록과 세션 집계를 읽으며, 단언 결과는 세션 창에 표시됩니다.',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle': '연결 전 스크립트',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary':
    '재연결을 포함해 다이얼할 때마다 실행됩니다. oh API 기능으로 클라이언트 id, 자격 증명, 유언, 구독을 다시 씁니다. 실패하면 기록되고 다이얼은 바뀌지 않은 채 진행됩니다.',
  'workbench.editors.request.scripts.mqttBeforePublishInfoTitle': '게시 전 스크립트',
  'workbench.editors.request.scripts.mqttBeforePublishInfoSummary':
    '메시지를 게시할 때마다 그 전에 실행됩니다. 토픽, 페이로드, QoS 값, 보존 플래그, 속성을 다시 쓰거나 게시를 폐기합니다.',
  'workbench.editors.request.scripts.mqttOnMessageInfoTitle': '메시지 수신 시 스크립트',
  'workbench.editors.request.scripts.mqttOnMessageInfoSummary':
    '메시지를 받을 때마다 캡처 뒤에 실행됩니다. 반응하세요: oh.publish 함수로 답하고, oh.session 객체에 상태를 유지하고, 단언을 등록합니다.',
  'workbench.editors.request.scripts.mqttAfterCloseInfoTitle': '종료 후 스크립트',
  'workbench.editors.request.scripts.mqttAfterCloseInfoSummary':
    '세션이 열린 뒤 끝나면 한 번 실행됩니다. 종료 기록, CONNACK 패킷, 세션 집계를 읽으며, 단언 결과는 세션 창에 표시됩니다.',
  'workbench.editors.request.scripts.apiConnect': '구성된 다이얼. URL 주소, 헤더, 매개변수, 하위 프로토콜, 시도',
  'workbench.editors.request.scripts.apiSetSubprotocols': '하위 프로토콜 제안 바꾸기',
  'workbench.editors.request.scripts.apiMessage': '메시지. 텍스트, 프레임 유형, 캡처 인덱스',
  'workbench.editors.request.scripts.apiSetMessage': '나가는 텍스트 바꾸기',
  'workbench.editors.request.scripts.apiSetEvent': 'Socket.IO 이벤트 이름 바꾸기',
  'workbench.editors.request.scripts.apiDrop': '메시지 폐기. 전송선에 아무것도 실리지 않음',
  'workbench.editors.request.scripts.apiSend': '세션에 텍스트 프레임 보내기',
  'workbench.editors.request.scripts.apiSendBinary': '바이너리 프레임 보내기 (base64)',
  'workbench.editors.request.scripts.apiEmit': 'Socket.IO 이벤트 발생',
  'workbench.editors.request.scripts.apiClose': '종료 기록. 종료 코드, 사유, 집계, 소요 시간',
  'workbench.editors.request.scripts.apiSession': '이 세션의 모든 훅이 공유하는 상태',
  'workbench.editors.request.scripts.apiMqttConnect':
    '구성된 CONNECT 패킷. 클라이언트 id, 자격 증명, 유언, 구독, 사용자 속성, 시도',
  'workbench.editors.request.scripts.apiSetClientId': '클라이언트 id 바꾸기',
  'workbench.editors.request.scripts.apiSetUsername': '사용자 이름 바꾸기',
  'workbench.editors.request.scripts.apiSetPassword': '비밀번호 바꾸기',
  'workbench.editors.request.scripts.apiSetWill': '유언 바꾸기 (null 값이면 등록 안 함)',
  'workbench.editors.request.scripts.apiAddSubscription': '열 때 토픽 필터 구독',
  'workbench.editors.request.scripts.apiSetUserProperty': '5.0 사용자 속성 설정',
  'workbench.editors.request.scripts.apiMqttMessage': '메시지. 토픽, 페이로드, QoS 값, 보존, 캡처 인덱스',
  'workbench.editors.request.scripts.apiSetTopic': '게시 대상 바꾸기',
  'workbench.editors.request.scripts.apiSetPayload': '페이로드 바꾸기 (텍스트 또는 base64 바이트)',
  'workbench.editors.request.scripts.apiSetQos': 'QoS 값 설정',
  'workbench.editors.request.scripts.apiSetRetain': 'RETAIN 플래그 설정',
  'workbench.editors.request.scripts.apiPublish': '세션에 메시지 게시',
  'workbench.editors.request.scripts.apiMqttClose': '종료 기록. 종료 방식, CONNACK 패킷, 집계, 소요 시간',
  'workbench.editors.request.scripts.apiInvoke': '구성된 호출. 대상, 메서드, 호출 형태, 메타데이터, 메시지 텍스트',
  'workbench.editors.request.scripts.apiSetMetadata': '메타데이터 쌍 설정',
  'workbench.editors.request.scripts.apiRemoveMetadata': '메타데이터 쌍 제거',
  'workbench.editors.request.scripts.apiGrpcSetMessage': '메시지 텍스트 바꾸기 (JSON)',
  'workbench.editors.request.scripts.apiGrpcMessage': '캡처된 프레임. 방향, 유형, 디코딩된 메시지, 캡처 인덱스',
  'workbench.editors.request.scripts.apiGrpcResponse': '종료 기록. 상태, 메타데이터, 트레일러, 양방향 집계, 소요 시간',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.followRedirects': '리디렉션 자동 따라가기',
  'workbench.editors.request.settings.followRedirectsInfo':
    'HTTP 3xx 응답을 대상까지 따라갑니다. 끄면 리디렉션 자체에서 멈추며, 응답은 헤더도 본문도 없는 불투명한 리디렉션으로 표시됩니다. 리디렉션이 일어나는지만 확인할 때 유용합니다.',
  'workbench.editors.request.settings.maxRedirects': '최대 리디렉션 수',
  'workbench.editors.request.settings.maxRedirectsInfo':
    '전송이 실패하기 전에 따라갈 수 있는 리디렉션 횟수이며, 실패 시 한도를 명시한 오류가 납니다. 비우면 기본값 20회입니다. 0회로 설정하면 어떤 리디렉션에서도 실패합니다.',
  'workbench.editors.request.settings.followOriginalMethod': '원래 HTTP 메서드 유지',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    '301, 302, 303 리디렉션이 보통 요청을 GET 메서드로 바꿀 때에도 원래 메서드와 본문을 유지합니다. 307 및 308 리디렉션은 어느 쪽이든 항상 메서드를 유지합니다.',
  'workbench.editors.request.settings.followAuthHeader': 'Authorization 헤더 유지',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    '리디렉션이 다른 출처로 넘어갈 때도 Authorization 헤더를 유지합니다. 보통은 교차 출처 홉에서 헤더가 제거되어, 요청이 지정하지 않은 호스트로 자격 증명이 가지 않습니다.',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    '리디렉션 체인이 닿는 어떤 호스트로든 자격 증명이 전달됩니다. 체인이 실제로 출처를 넘은 응답에는 표시가 붙습니다.',
  'workbench.editors.request.settings.sendBrowserCookies': '브라우저 쿠키 전송',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    '대상 사이트에 대한 브라우저의 기존 쿠키를 이 요청에 첨부합니다. 끄는 것이 안전한 기본값입니다. 요청이 쿠키 없이 전송되므로 결과가 브라우저의 로그인 상태에 좌우되지 않습니다.',
  'workbench.editors.request.settings.sslVerification': 'SSL 인증서 검증',
  'workbench.editors.request.settings.sslVerificationSummary':
    '서버의 TLS 인증서를 런타임의 신뢰된 CA 저장소로 검증합니다. 기본값은 켜짐입니다.',
  'workbench.editors.request.settings.sslVerificationDescription':
    '자체 서명, 만료 또는 그 밖의 이유로 신뢰되지 않는 인증서를 가진 호스트는 TLS 인증서 오류로 실패합니다. 그래도 접속하려면 검증을 끄세요. 예: 자체 서명 인증서를 쓰는 개발 서버.',
  'workbench.editors.request.settings.sslVerificationWarning':
    '전송이 서버 신원 확인을 건너뜁니다. 자체 서명과 만료된 것을 포함해 어떤 인증서든 받아들입니다.',
  'workbench.editors.request.settings.tlsMin': 'TLS 최소 버전',
  'workbench.editors.request.settings.tlsMinSummary':
    '전송이 협상할 수 있는 가장 낮은 TLS 프로토콜 버전입니다. 비우면 런타임 기본값인 TLS 1.2 버전을 유지합니다.',
  'workbench.editors.request.settings.tlsMinDescription':
    '1.0 또는 1.1 버전을 고르면 구형 서버에 닿기 위해 하한을 기본값 아래로 낮춥니다. 낮춘 하한으로 보낸 응답에는 표시가 붙습니다.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (기본값)',
  'workbench.editors.request.settings.tlsMinWarning':
    '전송이 1.2 버전 아래의 TLS 버전을 협상할 수 있습니다. 알려진 약점이 있는 프로토콜 버전입니다. 응답에 표시가 붙습니다.',
  'workbench.editors.request.settings.tlsMax': 'TLS 최대 버전',
  'workbench.editors.request.settings.tlsMaxSummary':
    '전송이 협상할 수 있는 가장 높은 TLS 프로토콜 버전입니다. 비우면 런타임 기본값인 TLS 1.3 버전을 유지합니다.',
  'workbench.editors.request.settings.tlsMaxDescription':
    '낮추면 서버가 이전 프로토콜에서 어떻게 동작하는지 확인할 수 있습니다. 최소 버전도 낮춰야 할 수 있습니다. 그렇지 않으면 둘이 겹치지 않습니다.',
  'workbench.editors.request.settings.tlsVersionsHeading': '버전',
  'workbench.editors.request.settings.tlsVersionLegacyDesc': '구형이며 알려진 약점이 있습니다. 전송에 표시가 붙습니다.',
  'workbench.editors.request.settings.tlsVersion12Desc': '기본 하한입니다.',
  'workbench.editors.request.settings.tlsVersion13Desc': '기본 상한이며 현재 모범 사례입니다.',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (기본값)',
  'workbench.editors.request.settings.tlsCipherSuites': 'TLS 암호 스위트',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'TLS 핸드셰이크에서 제시하는 암호 스위트를 콜론으로 구분한 하나의 목록입니다. 비우면 런타임 기본 스위트를 제시합니다.',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    '서버가 제시된 것 중에서 자신의 선호 순서대로 스위트를 고릅니다.',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': '형식',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'IANA 이름으로 적은 TLS 1.3 스위트입니다.',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'OpenSSL 이름으로 적은 이전 스위트입니다. 두 종류 모두 하나의 목록에 넣습니다.',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': '항목을 잇습니다. 공백은 넣지 않습니다.',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': '런타임 기본 스위트',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    '콜론으로 구분한 OpenSSL 스위트 이름만 가능합니다. 공백은 넣지 않습니다.',
  'workbench.editors.request.settings.tlsCipherSuitesExample': '예: TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20홉 (기본값)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count}홉' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (기본값)',
  'workbench.editors.request.settings.resetToDefault': '기본값으로 재설정',
  'workbench.editors.request.settings.group.redirects': '리디렉션',
  'workbench.editors.request.settings.group.tls': 'TLS 및 신뢰',
  'workbench.editors.request.settings.group.connection': '연결',
  'workbench.editors.request.settings.group.cookies': '쿠키',
  'workbench.editors.request.settings.group.execution': '실행 및 제한',
  'workbench.editors.request.settings.groupInfo.connection':
    '전송이 서버에 닿는 방식입니다. 사용하는 HTTP 프로토콜과 다이얼하는 구간 (직접, 프록시 경유, 고정 주소, 로컬 소켓)입니다.',
  'workbench.editors.request.settings.groupInfo.tls':
    'TLS 핸드셰이크에서 전송이 신뢰하고 제시하는 것입니다. 인증서 검증, 프로토콜 범위, 암호 스위트, 클라이언트 인증서입니다.',
  'workbench.editors.request.settings.groupInfo.redirects':
    '서버가 리디렉션으로 응답할 때 일어나는 일입니다. 체인을 따라갈지, 얼마나 멀리, 후속 요청이 무엇을 담는지입니다.',
  'workbench.editors.request.settings.groupInfo.cookies':
    '쿠키가 전송에 실리는지 여부입니다. 기본값은 꺼짐이므로 결과가 주변 로그인 상태에 좌우되지 않습니다.',
  'workbench.editors.request.settings.groupInfo.execution':
    '실행 자체를 제한하는 방식입니다. 스크립트 모드, 시간 예산, 응답 크기 상한입니다.',
  'workbench.editors.request.settings.httpVersion': 'HTTP 버전',
  'workbench.editors.request.settings.httpVersionSummary':
    '전송이 HTTP 프로토콜을 사용하는 방식입니다. 자동 (기본값)은 HTTP/1.1 버전과 함께 HTTP/2 버전을 제시하고 서버가 고릅니다.',
  'workbench.editors.request.settings.httpVersionDescription':
    '서버가 쓸 수 없는 버전을 고정하면 조용히 대체되지 않고 명확한 오류로 실패합니다. 응답의 네트워크 팝오버는 전송선에서 실제로 협상된 프로토콜을 항상 보여 줍니다.',
  'workbench.editors.request.settings.httpVersionValuesHeading': '값',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'TLS 핸드셰이크에서 HTTP/2 + HTTP/1.1 버전을 제시하고 서버가 고릅니다. 평문 http:// 연결은 HTTP/1.1 버전을 유지합니다.',
  'workbench.editors.request.settings.httpVersion11Desc': '고전적인 HTTP/1.1 의미론으로 고정합니다.',
  'workbench.editors.request.settings.httpVersion2Desc': '핸드셰이크 제시를 통해 HTTP/2 버전으로 고정합니다.',
  'workbench.editors.request.settings.httpVersionPkDesc':
    '협상 없이 즉시 HTTP/2 프로토콜을 사용합니다. 평문 HTTP/2 서버로 가는 경로입니다.',
  'workbench.editors.request.settings.httpVersion3Desc':
    'QUIC 프로토콜로 서버에 직접 다이얼하며 TCP 연결로 대체하지 않습니다.',
  'workbench.editors.request.settings.exampleCaption': '전송 예',
  'workbench.editors.request.settings.httpVersionPlaceholder': '자동. 서버가 고릅니다',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (사전 지식)',
  'workbench.editors.request.settings.resolveToAddress': '확인 대상 주소',
  'workbench.editors.request.settings.resolveToAddressInfo':
    'DNS 응답 대신 특정 서버 주소로 이 요청을 보냅니다. URL 주소의 호스트 이름은 여전히 TLS 연결과 Host 헤더에 쓰이므로, 검증이 켜져 있으면 인증서가 그 이름과 일치해야 합니다. 로드 밸런서 뒤의 특정 백엔드 하나를 시험할 때 유용합니다. URL 주소의 포트는 그대로 쓰이며, 다른 호스트로의 리디렉션도 이 주소로 갑니다. 비우면 평소처럼 DNS 서비스로 확인합니다.',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': '시스템 DNS',
  'workbench.editors.request.settings.resolveToAddressError':
    'IPv4 또는 IPv6 주소만 가능합니다. 호스트 이름과 포트는 넣지 않습니다.',
  'workbench.editors.request.settings.resolveToAddressExample': '예: 10.0.0.12 또는 2001:db8::1',
  'workbench.editors.request.settings.sni': 'SNI 서버 이름',
  'workbench.editors.request.settings.sniInfo':
    'URL 호스트 대신 TLS 핸드셰이크에서 제시하는 서버 이름입니다. 한 주소로 여러 호스트 이름을 받는 게이트웨이나, DNS 서비스가 답하지 않는 이름으로 발급된 인증서에 씁니다. 비우면 URL 호스트를 보냅니다.',
  'workbench.editors.request.settings.sniPlaceholder': '자동. URL 호스트',
  'workbench.editors.request.settings.sniExample': '예: api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': '클라이언트 인증서 (mTLS)',
  'workbench.editors.request.settings.clientCertificateInfo':
    'TLS 핸드셰이크에서 클라이언트 인증서를 제시합니다 (상호 TLS, mTLS). 인증서로 호출자를 인증하는 상호 TLS 게이트웨이 뒤의 API 서비스에 씁니다. vault 저장소에서 인증서 항목을 고르세요. 요청은 항목 이름만 저장하고, 각 기기는 그 이름의 자기 vault 항목을 제시하며, 인증서와 키는 vault 저장소를 떠나지 않습니다. 비우면 클라이언트 인증서 없이 연결합니다.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': '클라이언트 인증서 없음',
  'workbench.editors.request.settings.clientCertificateEmpty':
    '이 기기의 vault 저장소에 아직 클라이언트 인증서 항목이 없습니다.',
  'workbench.editors.request.settings.vaultManageCertificates': 'vault 저장소에서 인증서 관리',
  'workbench.editors.request.settings.clientCertificateDangling':
    '이 기기에 “{name}” 이름의 vault 인증서 항목이 없습니다. 항목이 생기거나 이 설정을 지울 때까지 전송이 실패합니다.',
  'workbench.editors.request.settings.proxy': '프록시',
  'workbench.editors.request.settings.proxySummary':
    '이 전송이 네트워크에 닿는 방식입니다. 기본적으로 실행하는 기기의 시스템 설정 (시스템 프록시 설정, PAC 스크립트, 프록시 환경 변수)을 상속하므로 회사 컴퓨터에 배포된 프록시가 그대로 동작합니다. 직접은 이 요청 하나를 주변 프록시에서 제외하고, 사용자 지정 URL 모드는 요청 자체의 프록시로 보냅니다.',
  'workbench.editors.request.settings.proxyDescription':
    '응답 메타는 전송이 실제로 거친 경로를 항상 기록합니다. 어느 프록시였는지, 요청과 시스템 중 무엇이 정했는지입니다. HTTP(S) 프록시와 SOCKS5 프록시를 지원합니다. socks5:// URL 주소는 사용자 지정 프록시로도 시스템 응답으로도 동작하며, SOCKS4 계열만 이를 명시한 명확한 오류가 납니다.',
  'workbench.editors.request.settings.proxyModesHeading': '모드',
  'workbench.editors.request.settings.proxyModePlaceholder': '상속. 시스템이 정합니다',
  'workbench.editors.request.settings.proxyModeDirect': '직접. 프록시 없음',
  'workbench.editors.request.settings.proxyModeCustom': '사용자 지정 URL',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    '실행하는 기기의 시스템이 URL 주소마다 정합니다. 컴퓨터에 프록시가 구성된 곳은 프록시, 그 밖에는 직접입니다. HTTP/3 버전을 고정하거나, 로컬 소켓으로 다이얼하거나, 고정 주소로 확인하는 전송에서는 상속된 프록시가 물러납니다.',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    '컴퓨터의 시스템 설정과 관계없이 이 요청에는 프록시를 쓰지 않습니다.',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    '이 요청 자체의 프록시 URL 주소로 터널링합니다. 요청과 함께 동기화되어 모든 기기에서 같은 경로를 씁니다.',
  'workbench.editors.request.settings.proxyUrl': '프록시 URL',
  'workbench.editors.request.settings.proxyUrlInfo':
    '이 요청을 이 HTTP(S) 프록시로 보냅니다. 대상으로의 연결은 프록시를 통해 터널링되므로 https 교환은 종단 간 암호화를 유지하고 인증서 검증도 대상에 대해 그대로 실행됩니다. 자격 증명은 이 URL 주소가 아니라 아래의 ‘프록시 자격 증명’ 설정에 넣습니다.',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    '사용자 지정 URL 모드에는 프록시 URL 주소가 필요합니다. 입력하거나 모드를 되돌리세요.',
  'workbench.editors.request.settings.proxyError':
    'http://, https:// 또는 socks5:// URL 주소에 호스트와 포트만 넣습니다. URL 주소에 자격 증명은 넣지 않습니다.',
  'workbench.editors.request.settings.proxyUrlExample': '예: http://127.0.0.1:8080 또는 socks5://127.0.0.1:1080',
  'workbench.editors.request.settings.proxyResolveConflict':
    '확인 대상 주소도 설정되어 있지만 프록시는 호스트 이름을 스스로 확인합니다. 둘 중 하나를 지울 때까지 전송이 실패합니다.',
  'workbench.editors.request.settings.proxyCredentials': '프록시 자격 증명',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    'vault 저장소의 자격 증명으로 프록시에 인증합니다. 문자열 항목에 user:password 형식으로 넣습니다. 요청은 항목 이름만 저장하고, 각 기기는 자기 로컬 vault 저장소에서 이를 해석합니다. 자격 증명은 vault 저장소를 떠나지 않으며 대상이 아니라 프록시에만 전송됩니다. 인증이 필요 없는 프록시면 비워 두세요.',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': '인증 없음',
  'workbench.editors.request.settings.proxyCredentialsEmpty': '이 기기의 vault 저장소에 아직 문자열 항목이 없습니다.',
  'workbench.editors.request.settings.vaultManageCredentials': 'vault 저장소에서 자격 증명 관리',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    '이 기기에 “{name}” 이름의 vault 문자열 항목이 없습니다. 항목이 생기거나 이 설정을 지울 때까지 전송이 실패합니다.',
  // ── Session resilience block (WebSocket / Socket.IO / MQTT) ─────────
  'workbench.editors.request.settings.autoReconnect': '자동 재연결',
  'workbench.editors.request.settings.autoReconnectInfo':
    '열린 연결이 끊기면 (소켓 절단, 서버 종료, 유휴 시간 초과) 세션을 다시 엽니다. 다시 열리거나 연결을 해제할 때까지 재연결 주기마다 다시 다이얼합니다. 실패한 첫 연결은 재시도하지 않습니다. 기본값은 꺼짐입니다.',
  'workbench.editors.request.settings.reconnectPeriod': '재연결 주기',
  'workbench.editors.request.settings.reconnectPeriodInfo':
    '재연결 시도 사이의 대기 시간입니다. 비우면 기본값 5초입니다.',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5초 (기본값)',
  'workbench.editors.request.settings.reconnectMaxAttempts': '재연결 시도 횟수',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    '한 번 끊긴 뒤 연속 재연결 시도의 상한입니다. 열리는 재연결은 횟수를 재설정하고, 상한을 다 쓰면 세션이 재연결 포기로 끝납니다. 비우면 서버가 돌아오거나 연결을 해제할 때까지 계속 시도합니다.',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': '무제한 (기본값)',
  'workbench.editors.request.settings.reconnectBackoff': '지수 백오프',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    '시도가 실패할 때마다 대기 시간을 두 배로 늘립니다. 주기, 그다음 2배, 4배 … 최대 60초까지이며, 클라이언트들이 발맞춰 다시 다이얼하지 않도록 약간의 무작위 지터를 더합니다. 기본값은 켜짐이며, 끄면 매번 정확히 주기만큼 기다립니다.',
  'workbench.editors.request.settings.idleTimeout': '유휴 시간 제한',
  'workbench.editors.request.settings.idleTimeoutInfo':
    '이 시간 동안 아무것도 도착하지 않으면 연결이 끊긴 것으로 보고 닫습니다. 클라이언트가 핑 프레임으로는 할 수 없는 생존 확인입니다. 자동 재연결이 켜져 있으면 세션이 다시 다이얼합니다. 비우면 유휴 기한이 없습니다.',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    '이 시간 동안 아무것도 도착하지 않으면 연결이 끊긴 것으로 보고 닫습니다. 자동 재연결이 켜져 있으면 세션이 다시 다이얼합니다. 비우면 서버의 핸드셰이크를 따릅니다. 핑은 pingInterval 주기마다 와야 하고 pingTimeout 시간만큼 늦을 수 있다는 공식 클라이언트의 규칙입니다.',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': '꺼짐 (기본값)',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': '서버 핑 주기 (기본값)',
  'workbench.editors.request.settings.heartbeatMessage': '하트비트 메시지',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    '유휴 세션이 로드 밸런서와 프록시를 거쳐 살아 있도록 하트비트 간격마다 보내는 텍스트 프레임입니다. 서버가 기대하는 무엇이든 됩니다. 어느 WebSocket 클라이언트도 프로토콜 핑 프레임을 보낼 수 없으므로 킵얼라이브는 애플리케이션 메시지이며, 보낸 프레임과 똑같이 캡처됩니다. 템플릿을 써도 됩니다. 비우면 하트비트를 보내지 않습니다.',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': '하트비트 없음',
  'workbench.editors.request.settings.heartbeatMessageExample': '예: ping 또는 {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': '하트비트 간격',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    '하트비트 메시지 사이의 대기 시간입니다. 비우면 기본값 30초이며, 대부분의 로드 밸런서가 적용하는 60초 유휴 차단보다 짧습니다.',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30초 (기본값)',
  'workbench.editors.request.settings.unixSocket': 'Unix 소켓',
  'workbench.editors.request.settings.unixSocketInfo':
    'TCP 연결을 여는 대신 이 로컬 소켓 (절대 Unix 소켓 경로, 또는 \\\\.\\pipe\\name 같은 Windows 명명된 파이프)으로 다이얼합니다. 예: Docker 데몬이나 소켓에서 수신 대기하는 로컬 개발 서비스. URL 주소의 호스트는 더 이상 연결이 가는 곳을 정하지 않지만 Host 헤더, TLS 서버 이름, 인증서 검증은 여전히 그 값을 쓰며, 다른 호스트로의 리디렉션도 이 같은 소켓으로 다이얼합니다. 비우면 일반 TCP 연결입니다.',
  'workbench.editors.request.settings.unixSocketPlaceholder': '소켓 없음. TCP 연결',
  'workbench.editors.request.settings.unixSocketError':
    '절대 Unix 소켓 경로 (/…) 또는 Windows 명명된 파이프 (\\\\.\\pipe\\…)만 가능합니다.',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    '프록시도 설정되어 있지만 프록시 터널은 로컬 소켓으로 다이얼할 수 없습니다. 둘 중 하나를 지울 때까지 전송이 실패합니다.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    '확인 대상 주소도 설정되어 있지만 소켓 다이얼은 호스트 이름을 확인하지 않습니다. 둘 중 하나를 지울 때까지 전송이 실패합니다.',
  'workbench.editors.request.settings.unixSocketExample': '예: /var/run/docker.sock',
  'workbench.editors.request.settings.cookieJar': '쿠키 저장소 사용',
  'workbench.editors.request.settings.cookieJarInfo':
    '이 요청의 Set-Cookie 응답을 앱 자체의 쿠키 저장소에 저장하고 일치하는 쿠키를 자동으로 첨부합니다. 로그인 요청 뒤에 인증된 호출이 쿠키 값을 손으로 복사하지 않아도 동작합니다. 저장소는 워크스페이스별 메모리에 있고, 이 설정이 켜진 요청만 쓰며, 동기화되지 않고, 앱이 종료되면 지워집니다. 직접 설정한 Cookie 헤더가 항상 우선합니다. 기본값은 꺼짐입니다. 쿠키를 첨부하지 않고 Set-Cookie 응답은 버립니다.',
  'workbench.editors.request.settings.timeout': '요청 시간 제한',
  'workbench.editors.request.settings.timeoutInfo':
    '요청 전체 (연결, 응답 대기, 본문 읽기)에 걸릴 수 있는 최대 시간입니다. 한도가 지나면 전송이 중단되고 이를 명시한 시간 초과 오류로 실패합니다. 비우면 요청별 제한이 없으며 네트워크 스택 자체의 시간 제한만 적용됩니다.',
  'workbench.editors.request.settings.timeoutPlaceholder': '제한 없음',
  'workbench.editors.request.settings.responseSizeLimit': '응답 크기 제한',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    '전송선에서 읽는 최대 응답 본문 크기입니다. 넘는 부분은 잘리고 응답에 잘림 표시가 붙습니다. 비우면 기본 제한인 2,048 KB (2 MB)입니다. 큰 페이로드에는 최대 10,240 KB (10 MB)까지 올리고, 잘린 응답이 어떻게 보이는지 시험하려면 낮추세요.',
  'workbench.editors.request.settings.executionPlace': '실행 위치',
  'workbench.editors.request.settings.executionPlaceInfo':
    '이 요청의 연결을 여는 곳: 이 기기, 데스크톱 앱 또는 워크스페이스 서버입니다. 요청은 여전히 여기에서 확인되며 연결만 이동합니다. 자동은 이 기기에서 가능하면 여기에서, 아니면 가능한 유일한 곳에서 실행합니다.',
  'workbench.editors.request.settings.executionPlacePlaceholder': '자동',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.maxMessageSize': '최대 메시지 크기',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    '세션이 받아들이는 가장 큰 수신 메시지입니다. 상한을 넘는 메시지는 캡처되지 않습니다. 세션은 두 크기를 명시한 코드 1009 (Message Too Big)로 닫히며, 클라이언트가 요청한 종료이므로 자동 재연결도 다시 열지 않습니다. 비우면 요청별 상한이 없습니다. 데스크톱 런타임은 128 MB까지 메시지를 조립하고, 브라우저는 제한을 두지 않습니다.',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': '제한 없음 (기본값)',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    '핸드셰이크에 대한 3xx 응답을 따라가 그 Location 헤더로 다이얼합니다. 인증 게이트웨이가 업그레이드를 튕겨 보내는 형태입니다. 기본값은 꺼짐이며, 이는 WebSocket 표준 자체의 규칙입니다. 리디렉션된 핸드셰이크는 리디렉션을 명시하며 실패합니다. 세션이 데스크톱 앱이나 서버에서 실행될 때 적용되며, 브라우저는 절대 따라가지 않습니다.',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    '연결이 실패하기 전에 따라갈 수 있는 핸드셰이크 리디렉션 횟수이며, 실패 시 한도를 명시한 오류가 납니다. 비우면 기본값 20회입니다.',
  'workbench.editors.request.settings.managed.browserKicker': '브라우저 관리',
  'workbench.editors.request.settings.managed.nodeKicker': '런타임 관리',
  'workbench.editors.request.settings.managed.browserIntro':
    '확장 프로그램에서 보내는 모든 요청에 대해 브라우저가 고정합니다. 조정할 수 없는 항목을 알 수 있도록 표시합니다.',
  'workbench.editors.request.settings.managed.nodeIntro':
    '모든 요청에 대해 앱의 네트워크 런타임이 고정합니다. 조정할 수 없는 항목을 알 수 있도록 표시합니다.',
  'workbench.editors.request.settings.managed.hideBrowser': '브라우저 관리 설정 숨기기',
  'workbench.editors.request.settings.managed.hideNode': '런타임 관리 설정 숨기기',
  'workbench.editors.request.settings.managed.countBrowser': '브라우저 관리 {count}개',
  'workbench.editors.request.settings.managed.countNode': '런타임 관리 {count}개',
  'workbench.editors.request.settings.managed.on': '켜짐',
  'workbench.editors.request.settings.managed.off': '꺼짐',
  'workbench.editors.request.settings.managed.auto': '자동',
  'workbench.editors.request.settings.managed.policy': '정책',
  'workbench.editors.request.settings.managed.browser': '브라우저',
  'workbench.editors.request.settings.managed.browserStore': '브라우저 저장소',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': '전송 안 함',
  'workbench.editors.request.settings.managed.offered': '제시됨',
  'workbench.editors.request.settings.managed.none': '없음',
  'workbench.editors.request.settings.managed.never': '항상 안 함',
  'workbench.editors.request.settings.managed.websocketOnly': 'WebSocket 전용',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': '압축',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    '모든 핸드셰이크에서 permessage-deflate 확장을 제시하고 프레임 압축 여부는 서버가 정합니다. 연결됨 행이 협상 결과를 보여 줍니다. 요청별로 제시를 보류할 수는 없습니다.',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    '메시지는 압축 없이 나가고 grpc-encoding 값은 협상되지 않습니다. 서버의 압축된 프레임은 디코딩되지 않고 압축된 상태로 표시됩니다.',
  'workbench.editors.request.settings.managed.transport': '전송 방식',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    '세션은 WebSocket 전송 방식으로 직접 다이얼하며, 공식 클라이언트가 시작해서 업그레이드하는 HTTP 롱 폴링 핸드셰이크를 건너뜁니다.',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC 프로토콜은 HTTP/2 버전만 씁니다. TLS 채널은 ALPN 확장으로 h2 프로토콜을 협상하고, 평문 채널은 사전 지식으로 h2 프로토콜을 사용합니다.',
  'workbench.editors.request.settings.managed.connectionReuse': '연결 재사용',
  'workbench.editors.request.settings.managed.onePerCall': '호출마다 하나',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    '모든 호출이 자기 HTTP/2 연결을 열고 호출이 끝나면 닫습니다. 호출 사이에 풀링되거나 살아 있는 것이 없으므로 킵얼라이브는 호출이 열려 있는 동안만 실행됩니다.',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    '브라우저는 리디렉션된 핸드셰이크를 절대 따라가지 않습니다. 3xx 응답은 연결을 실패시킵니다. 리디렉션을 따라가려면 세션을 데스크톱 앱이나 서버에서 실행하세요.',
  'workbench.editors.request.settings.managed.httpVersion': 'HTTP 버전',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    '브라우저가 연결마다 HTTP/1.1, HTTP/2 또는 HTTP/3 버전을 협상합니다. fetch API 기능은 버전 선택기를 노출하지 않습니다.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    '인증서는 브라우저 정책으로 검증됩니다. 잘못된 인증서를 가진 호스트로의 요청은 실패하며, 요청별로 검증을 끌 수 없습니다.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    '301/302/303 리디렉션에서 브라우저는 fetch 사양에 따라 GET 이외의 메서드를 GET 메서드로 바꿉니다. 307/308 리디렉션은 항상 메서드를 유지합니다.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    '리디렉션이 다른 출처로 넘어가면 브라우저가 Authorization 헤더를 제거합니다. 이 안전 동작은 재정의할 수 없습니다.',
  'workbench.editors.request.settings.managed.refererRedirect': '리디렉션 시 Referer 헤더 제거',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    '리디렉션을 거치는 Referer 처리는 확장 프로그램 컨텍스트의 브라우저 리퍼러 정책을 따릅니다.',
  'workbench.editors.request.settings.managed.strictParser': '엄격한 HTTP 파서',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    '브라우저 네트워크 스택은 잘못된 형식의 응답 헤더를 항상 거부합니다. 관대한 모드는 없습니다.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    '런타임의 HTTP 파서는 잘못된 형식의 응답 헤더를 거부합니다. 관대한 모드는 없습니다.',
  'workbench.editors.request.settings.managed.encodeUrl': 'URL 자동 인코딩',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    '요청이 전송선에 오르기 전에 URL 파서가 URL 경로와 쿼리를 퍼센트 인코딩합니다. 이미 인코딩된 시퀀스를 입력하면 그대로 유지됩니다.',
  'workbench.editors.request.settings.managed.cipherOrder': '서버 암호 스위트 순서',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'TLS 암호 협상은 브라우저가 담당합니다. 스위트 목록도 순서도 구성할 수 없습니다.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'fetch API 기능은 리디렉션 체인을 약 20홉으로 제한합니다. 요청별 상한은 구현할 수 없습니다. 수동 리디렉션 모드는 따라갈 헤더가 없는 불투명한 응답을 돌려줍니다.',
  'workbench.editors.request.settings.managed.tlsVersions': 'TLS/SSL 프로토콜 버전',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    '활성화된 TLS 프로토콜 버전은 브라우저가 고정합니다. 요청별 선택은 노출되지 않습니다.',
  'workbench.editors.request.settings.managed.referer': 'Referer 헤더',
  'workbench.editors.request.settings.managed.refererDesc':
    '런타임에는 페이지 컨텍스트가 없으므로 직접 헤더로 추가하지 않는 한 Referer 헤더는 전송선에 실리지 않습니다.',
  'workbench.editors.request.settings.managed.scripts': '요청 전 / 응답 후 스크립트',
  'workbench.editors.request.settings.managed.scriptsNotRun': '여기서 실행 안 함',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    '이 화면의 전송을 처리하는 호스트에는 스크립트 런타임이 없으므로 요청 전 / 응답 후 스크립트를 건너뛰고 응답에 스크립트 결과가 없습니다.',
  'workbench.editors.request.settings.managed.scriptsSafeHereDesc':
    '요청 전 / 응답 후 스크립트는 여기, 이 탭의 샌드박스된 안전 런타임에서 실행됩니다. oh.* 스크립트 API 기능만 있고 파일 시스템, 프로세스 접근, 모듈 로더는 없습니다. 브라우저 탭에는 개발자 모드가 없으며, 각 실행은 자신이 실행된 모드를 응답에 기록합니다.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': '안전 모드',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    '이 화면의 전송은 연결된 백엔드에서 실행되며, 백엔드는 요청 전 / 응답 후 스크립트를 샌드박스된 안전 런타임에서 실행합니다. oh.* 스크립트 API 기능만 있고 파일 시스템, 프로세스 접근, 모듈 로더는 없습니다. 전달된 전송은 절대 개발자 모드로 실행되지 않으며, 각 실행은 자신이 실행된 모드를 응답에 기록합니다.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': '스크립트 실행',
  'workbench.editors.request.settings.scriptModeSummary':
    '이 워크스페이스의 요청 전 / 응답 후 스크립트가 이 기기에서 실행되는 방식입니다.',
  'workbench.editors.request.settings.scriptModeDescription':
    '이 선택은 워크스페이스의 모든 요청에 적용되고, 이 기기에 머물며, 동기화되지 않습니다. 각 실행은 자신이 실행된 모드를 응답에 기록합니다.',
  'workbench.editors.request.settings.scriptModeModesHeading': '모드',
  'workbench.editors.request.settings.scriptModeSafe': '안전 모드',
  'workbench.editors.request.settings.scriptModeDeveloper': '개발자 모드',
  'workbench.editors.request.settings.scriptModeWarning':
    '개발자 모드는 이 워크스페이스의 스크립트를 파일 시스템, 프로세스, 네트워크까지 전체 시스템 접근 권한으로 실행합니다. 이 워크스페이스의 스크립트를 편집할 수 있는 모든 사람을 신뢰할 때만 활성화하세요. 워크플로 단계와 다른 기기에서 전달된 요청은 계속 안전 모드로 실행됩니다.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': '스크립트 실행: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': '권장',
  'workbench.editors.request.settings.scriptModeSafeCard':
    '스크립트가 앱의 샌드박스된 스크립트 런타임에서 실행됩니다. oh.* 스크립트 API 기능만 있고 파일 시스템이나 프로세스 접근, 모듈 로더는 없습니다.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    '스크립트가 전체 Node.js 런타임에서 실행됩니다. require 함수, 파일 시스템, 프로세스, 네트워크 접근이 가능합니다.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    '이 워크스페이스의 스크립트를 편집할 수 있는 모든 사람을 신뢰할 때만 사용하세요',
  'workbench.editors.request.settings.scriptModeScopeNote':
    '이 워크스페이스의 모든 요청에, 이 기기에서만 적용됩니다. 선택은 동기화되지 않습니다.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '이 워크스페이스 저장소의 쿠키 {count}개',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Cookie 저장소 내용',
  'workbench.editors.request.settings.jar.infoSummary':
    '이 워크스페이스의 메모리 내 저장소가 현재 갖고 있는 쿠키입니다. 저장소를 켠 전송이 저장하고, 일치하는 저장소를 켠 전송에 첨부되며, 앱이 종료되면 사라집니다. 값은 세션 자격 증명이므로 앱의 네트워크 런타임 안에 머물며, 이름, 범위, 만료만 표시합니다.',
  'workbench.editors.request.settings.jar.storedHeading': '저장된 쿠키',
  'workbench.editors.request.settings.jar.clear': '지우기',
  'workbench.editors.request.settings.jar.delete': '{name} 삭제',
  'workbench.editors.request.settings.jar.expires': '{date} 만료',
  'workbench.editors.request.settings.jar.session': '세션',
  'workbench.editors.request.settings.jar.httpsOnly': 'https 전용',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': '응답',
  'workbench.editors.request.response.clear': '지우기',
  'workbench.editors.request.response.saveResponse': '응답 저장',
  'workbench.editors.request.response.createWorkflow': '워크플로 만들기',
  'workbench.editors.request.response.createWorkflowNew': '새 워크플로 만들기',
  'workbench.editors.request.response.createWorkflowAttach': '기존 워크플로에 연결',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    '이 요청은 저장되지 않았습니다. 워크플로에 쓰려면 먼저 저장하세요',
  'workbench.editors.request.response.copyBody': '본문 복사',
  'workbench.editors.request.response.saveBodyToFile': '본문을 파일로 저장',
  'workbench.editors.request.response.saveBodyToFileTruncated': '본문을 파일로 저장 (잘림. 보관된 부분만 저장)',
  'workbench.editors.request.response.clearResponse': '응답 지우기',
  'workbench.editors.request.response.moreActionsAria': '응답 작업 더 보기',
  'workbench.editors.request.response.copied': '복사됨',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': '본문',
  'workbench.editors.request.response.tab.headers': '헤더 ({count})',
  'workbench.editors.request.response.tab.cookies': '쿠키 ({count})',
  'workbench.editors.request.response.tab.assertions': '단언',
  'workbench.editors.request.response.tab.assertionsFailed': '단언 ({count}건 실패)',
  'workbench.editors.request.response.tab.assertionsPassed': '단언 ({count}건 통과)',
  'workbench.editors.request.response.tab.console': '콘솔 ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': '응답 메타',
  'workbench.editors.request.response.meta.timingTitle': '타이밍',
  'workbench.editors.request.response.meta.timingSummary': 'fetch 호출 전후로 측정: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    '플랫폼이 이 요청의 리소스 타이밍 항목을 기록하지 않아 단계별 분석을 볼 수 없습니다.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    '네트워크 합계 {duration}. 서버가 이 교차 출처 요청에 타이밍 세부 정보를 노출하지 않아 (Timing-Allow-Origin 헤더 없음) DNS / 연결 / TTFB / 다운로드 단계가 숨겨집니다.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': '리디렉션',
  'workbench.editors.request.response.meta.phase.stalled': '정체',
  'workbench.editors.request.response.meta.phase.dns': 'DNS 조회',
  'workbench.editors.request.response.meta.phase.connect': 'TCP 연결',
  'workbench.editors.request.response.meta.phase.tls': 'TLS 핸드셰이크',
  'workbench.editors.request.response.meta.phase.waiting': '대기 (TTFB)',
  'workbench.editors.request.response.meta.phase.download': '콘텐츠 다운로드',
  'workbench.editors.request.response.meta.totalNetwork': '합계 (네트워크)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS, 연결, TLS 단계는 앱의 네트워크 런타임에서 전송별로 관측할 수 없어 대기에 포함됩니다.',
  'workbench.editors.request.response.meta.sizeTitle': '크기',
  'workbench.editors.request.response.meta.sizeSummary': '이 교환의 방향별 바이트입니다.',
  'workbench.editors.request.response.meta.responseSize': '응답 크기',
  'workbench.editors.request.response.meta.requestSize': '요청 크기',
  'workbench.editors.request.response.meta.rowHeaders': '헤더',
  'workbench.editors.request.response.meta.rowBody': '본문',
  'workbench.editors.request.response.meta.rowCompressed': '압축됨',
  'workbench.editors.request.response.meta.rowTransferred': '전송됨',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    '보이는 그대로의 헤더 바이트입니다. HTTP/2 이상은 전송선에서 압축합니다.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    '요청 헤더는 이 전송이 설정한 것만 셉니다. 브라우저는 자기 헤더 (Host, User-Agent, …)를 더합니다.',
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    '요청 헤더는 이 전송이 설정한 것만 셉니다. 런타임은 자기 헤더 (Host, Accept-Encoding, …)를 더합니다.',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    '본문이 응답 크기 제한 {cap}에서 잘렸습니다. 전체 크기를 셉니다.',
  'workbench.editors.request.response.meta.noteTruncated': '본문 보기가 잘렸습니다. 전체 크기를 셉니다.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    '요청 본문 크기는 근사치입니다. 멀티파트 경계는 브라우저가 생성합니다.',
  'workbench.editors.request.response.meta.noteWireHidden':
    '전송선 크기 (압축됨, 전송됨)가 숨겨졌습니다. 서버가 Timing-Allow-Origin 헤더를 보내지 않았습니다.',
  'workbench.editors.request.response.meta.networkTitle': '네트워크',
  'workbench.editors.request.response.meta.networkSummary': '이 교환의 연결 수준 사실입니다.',
  'workbench.editors.request.response.meta.httpVersion': 'HTTP 버전',
  'workbench.editors.request.response.meta.localAddress': '로컬 주소',
  'workbench.editors.request.response.meta.remoteAddress': '원격 주소',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'HTTP 버전이 숨겨졌습니다. 이 전송에서는 협상된 프로토콜을 관측할 수 없었습니다 (프록시를 거친 전송은 터널 안에서 협상합니다).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'HTTP 버전이 숨겨졌습니다. 플랫폼이 이 요청의 타이밍 항목을 기록하지 않았습니다.',
  'workbench.editors.request.response.meta.noteNoIp':
    '원격 주소를 알 수 없습니다. 전송선 캡처가 이 fetch 호출에서 아무것도 보지 못했습니다.',
  'workbench.editors.request.response.meta.tlsProtocol': 'TLS 프로토콜',
  'workbench.editors.request.response.meta.tlsCipher': '암호 이름',
  'workbench.editors.request.response.meta.tlsCertificate': '인증서 CN',
  'workbench.editors.request.response.meta.tlsIssuer': '발급자 CN',
  'workbench.editors.request.response.meta.tlsValidUntil': '유효 기한',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': '인증서 검증 안 됨 ({code})',
  'workbench.editors.request.response.meta.trustPinned': '이 기기에 인증서를 고정했습니다. 검증하려면 다시 보내세요.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Chromium 기반 브라우저에서는 로컬 주소, TLS 및 인증서 세부 정보가 확장 프로그램 코드에 노출되지 않습니다.',
  'workbench.editors.request.response.meta.tlsSelfSigned': '자체 서명 인증서',
  'workbench.editors.request.response.meta.tlsUnverified': '인증서 검증 안 됨',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'TLS 하한 낮춤',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    '이 요청은 설정의 TLS 최소 버전이 1.2 아래로 설정된 채 전송되어, 연결이 TLS 1.0 또는 1.1 버전을 협상할 수 있었습니다. 알려진 약점이 있어 런타임이 기본적으로 비활성화하는 프로토콜 버전입니다.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization 전달됨',
  'workbench.editors.request.response.meta.authForwardedSummary':
    '리디렉션이 이 요청을 다른 출처로 데려갔고, 설정이 출처를 넘어 Authorization 헤더를 유지하므로 자격 증명이 새 호스트로 다시 전송되었습니다. 보통은 리디렉션이 원래 출처를 떠나면 헤더가 제거됩니다.',
  'workbench.editors.request.response.meta.authTitle': '인가',
  'workbench.editors.request.response.meta.authSummaryRequest': '요청 자체의 {type} 구성으로 전송되었습니다.',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type}. {source}에서 상속되었습니다.',
  'workbench.editors.request.response.meta.authSummaryNone':
    '인가 없이 전송되었습니다. 요청 위에 설정된 것이 없습니다.',
  'workbench.editors.request.response.meta.authDangling':
    '요청이 고른 항목이 더 이상 없습니다. 대신 기본 항목이 적용되었습니다.',
  // The Inherited settings tag — the knobs the run took from the
  // levels above the request, each listed against its source.
  'workbench.editors.request.response.meta.inheritedSettingsTag': '상속된 설정 · {count}',
  'workbench.editors.request.response.meta.inheritedSettingsTitle': '상속된 설정',
  'workbench.editors.request.response.meta.inheritedSettingsSummary':
    '실행이 요청 위의 컬렉션이나 폴더에서 가져온 설정입니다. 설정 탭이 보여 주는 방식대로 해석되며, 요청 자체의 값이 체인보다 우선합니다.',
  'workbench.editors.request.response.meta.inheritedSettingsHeading': '설정 · 출처',
  'workbench.editors.request.response.meta.scriptsTag': '스크립트 · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': '스크립트 체인',
  'workbench.editors.request.response.meta.scriptsSummary':
    '체인의 모든 수준이 실행되어 성공했습니다. 요청 전과 응답 후 모두 컬렉션과 폴더의 스크립트가 요청 자체의 스크립트보다 앞섭니다. 실행이 실제로 한 일에서 기록되었습니다.',
  'workbench.editors.request.response.meta.scriptsSummaryFailed':
    '체인의 한 수준이 실패했습니다. 아래 행이 어느 수준이 왜 실패했는지 보여 줍니다.',
  'workbench.editors.request.response.meta.scriptsLevelRequest': '요청',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} ms',
  'workbench.editors.request.response.meta.executedOnTag': '{name}에서 전송됨',
  'workbench.editors.request.response.meta.executedOnTitle': '연결된 백엔드에서 실행됨',
  'workbench.editors.request.response.meta.executedOnSummary':
    '이 요청은 이 기기가 아니라 이 화면이 연결된 백엔드인 “{name}” 호스트에서 전송되었습니다. 대상 서버는 그 컴퓨터의 IP 주소와 네트워크 위치를 보았으므로, 지역이나 IP 주소 기반 동작은 백엔드가 실행되는 곳을 반영합니다. 실행한 호스트가 이 실행에 기록했습니다.',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie 저장소',
  'workbench.editors.request.response.meta.cookieJarSummary':
    '이 요청은 워크스페이스의 메모리 내 쿠키 저장소를 사용했습니다. 일치하는 저장된 쿠키가 자동으로 첨부되었고, Set-Cookie 응답은 이후 저장소를 켠 전송을 위해 보관되었습니다.',
  'workbench.editors.request.response.meta.jarAttachedLabel': '첫 요청에 첨부됨',
  'workbench.editors.request.response.meta.jarAttachedNone':
    '없음. 일치하는 저장된 쿠키가 없거나 요청에 설정한 Cookie 헤더가 우선했습니다.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Set-Cookie 응답에서 저장됨',
  'workbench.editors.request.response.meta.jarStoredNone': '없음. 쿠키를 설정한 응답이 없습니다.',
  'workbench.editors.request.response.meta.proxyTag': '프록시 경유',
  'workbench.editors.request.response.meta.proxyTitle': '프록시 경로',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    '이 실행은 요청 자체의 설정에 지정된 프록시로 터널링했습니다. 전송이 실제로 한 일에서 기록되었습니다.',
  'workbench.editors.request.response.meta.proxySummarySystem':
    '이 실행은 실행하는 기기의 시스템이 지정한 프록시로 터널링했습니다. 실시간 설정 읽기가 아니라 실행이 실제로 한 일에서 기록되었습니다.',
  'workbench.editors.request.response.meta.proxyRowUrl': '프록시',
  'workbench.editors.request.response.meta.proxyRowSource': '결정 주체',
  'workbench.editors.request.response.meta.proxySourceRequest': '요청 설정',
  'workbench.editors.request.response.meta.proxySourceDevice': '기기 프록시 설정',
  'workbench.editors.request.response.meta.proxySourceEnv': '환경 변수',
  'workbench.editors.request.response.meta.proxySourceSystem': '시스템 프록시 설정',
  'workbench.editors.request.response.meta.proxySourceManual': '수동 프록시 구성',
  'workbench.editors.request.response.meta.proxySourcePac': 'PAC 스크립트',
  'workbench.editors.request.response.meta.proxyStandDownTag': '프록시 우회',
  'workbench.editors.request.response.meta.proxyStandDownTitle': '시스템 프록시가 물러남',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    '시스템은 프록시를 지정하지만 이 실행은 프록시 터널이 다이얼할 수 없는 로컬 소켓을 대상으로 하므로 직접 진행했습니다.',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    '시스템은 프록시를 지정하지만 이 실행은 프록시가 재정의할 주소 확인을 스스로 고정하므로 직접 진행했습니다.',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    '시스템은 프록시를 지정하지만 이 실행은 자체 QUIC 경로로 다이얼하는 HTTP/3 버전으로 고정되어 있으므로 직접 진행했습니다.',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), { other: '리디렉션 {count}회' }),
  'workbench.editors.request.response.meta.redirectsTitle': '리디렉션 체인',
  'workbench.editors.request.response.meta.redirectsSummary':
    '최종 응답 전에 이 요청이 따라간 홉입니다. 각 홉은 보낸 요청과 그에 답한 리디렉션을 보여 주며, 전송이 실행될 때 기록되었습니다.',
  'workbench.editors.request.response.meta.redirectMethodChanged': '다음 요청의 메서드가 {method} 메서드로 바뀜',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Authorization 헤더 제거됨. 다음 요청이 다른 출처로 넘어갔습니다',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Authorization 헤더가 출처를 넘어 다시 전송됨. 이 요청의 설정이 유지했습니다',
  'workbench.editors.request.response.meta.redirectFinal': '최종 응답',
  'workbench.editors.request.response.meta.streamedEnd': '스트림 종료',
  'workbench.editors.request.response.meta.streamedStop': '중지됨',
  'workbench.editors.request.response.meta.streamedCap': '스트림 상한 도달',
  'workbench.editors.request.response.meta.streamedTimeout': '스트림 도중 시간 초과',
  'workbench.editors.request.response.meta.streamedError': '스트림 실패',
  'workbench.editors.request.response.meta.streamedEndSummary':
    '이 응답은 서버가 스트림을 닫을 때까지 실시간으로 스트리밍되었습니다. 아래 본문은 완전한 캡처입니다.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    '교환이 끝났을 때 응답이 아직 스트리밍 중이었으므로 아래 본문은 그 시점까지의 부분 캡처입니다. 도착한 것은 모두 보관되었습니다.',
  'workbench.editors.request.response.streamReceiving': '스트림 수신 중. {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': '{url}에 연결됨',
  'workbench.editors.request.response.sse.closed': '연결 종료됨',
  'workbench.editors.request.response.sse.stopped': '연결 중지됨',
  'workbench.editors.request.response.sse.capped': '캡처 상한 도달. 본문 제한에 이르렀습니다',
  'workbench.editors.request.response.sse.timedOut': '연결 시간 초과',
  'workbench.editors.request.response.sse.failed': '연결 실패',
  'workbench.editors.request.response.sse.searchEvents': '이벤트 검색',
  'workbench.editors.request.response.sse.noMatches': '일치하는 이벤트가 없습니다.',
  'workbench.editors.request.response.sse.waiting': '이벤트를 기다리는 중…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이벤트 {count}건' }),
  'workbench.editors.request.response.sse.clearEvents': '이벤트 지우기 (표시만)',
  'workbench.editors.request.response.sse.newEvents': '새 이벤트',
  'workbench.editors.request.response.sse.sortOrder': '정렬 순서',
  'workbench.editors.request.response.sse.newestFirst': '최신순',
  'workbench.editors.request.response.sse.oldestFirst': '오래된순',
  'workbench.editors.request.response.sse.groupByName': '이벤트 이름별 그룹화',
  'workbench.editors.request.response.sse.rowsPerGroup': '그룹당 행 수',
  'workbench.editors.request.response.sse.noLimit': '제한 없음',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': '크기',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': '이벤트 세부 정보',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': '응답이 {cap}에서 잘렸습니다 (원래 크기 {size}).',
  'workbench.editors.request.response.body.increaseLimit': '제한 늘리기',
  'workbench.editors.request.response.body.limitHint': '제한은 API 요청 설정에서 조정할 수 있습니다.',
  'workbench.editors.request.response.body.viewPickerAria': '본문 보기',
  'workbench.editors.request.response.body.preview': '미리 보기',
  'workbench.editors.request.response.body.wrapLines': '줄 바꿈',
  'workbench.editors.request.response.body.unwrapLines': '줄 바꿈 해제',
  'workbench.editors.request.response.body.renderAnsi': 'ANSI 색상 렌더링',
  'workbench.editors.request.response.body.plainAnsi': '일반 텍스트 표시',
  'workbench.editors.request.response.body.filterJsonPathTooltip': '본문 필터 (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': '본문 필터 (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': '본문 필터 (메트릭 패밀리)',
  'workbench.editors.request.response.body.filterAria': '본문 필터',
  'workbench.editors.request.response.body.invalidJsonPath': 'JSONPath 표현식이 잘못되었습니다.',
  'workbench.editors.request.response.body.invalidXPath': 'XPath 표현식이 잘못되었거나 문서를 해석할 수 없습니다.',
  'workbench.editors.request.response.body.invalidMetricsFilter': '메트릭 선택자가 잘못되었습니다.',
  'workbench.editors.request.response.body.noMatches': '이 경로와 일치하는 항목이 없습니다.',
  'workbench.editors.request.response.body.showingLastMatch': '마지막 일치 항목을 표시합니다.',
  'workbench.editors.request.response.body.hexCapNotice': 'Hex 뷰어는 전체 {total} 중 처음 {shown}만 표시합니다.',
  'workbench.editors.spec.tab': '사양',
  'workbench.editors.spec.noSpecs': '이 워크스페이스에 아직 {format} 사양이 없습니다.',
  'workbench.editors.spec.goToSpecs': '사양으로 이동',
  'workbench.editors.timelineViewer.format': '메시지 형식',
  'workbench.editors.timelineViewer.showMessage': '메시지 표시',
  'workbench.editors.timelineViewer.showHexdump': 'Hexdump 표시',
  'workbench.editors.request.response.body.previewIframeTitle': '응답 미리 보기',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'PDF 미리 보기',
  'workbench.editors.request.response.body.imagePreviewAlt': '응답 이미지',
  'workbench.editors.request.response.body.imagePreviewFailed':
    '이미지 데이터를 디코딩할 수 없습니다. 원시 바이트는 Hex 뷰어에서 확인하세요.',
  'workbench.editors.request.response.body.mediaPreviewAria': '미디어 미리 보기',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    '미디어 데이터를 디코딩할 수 없습니다. 원시 바이트는 Hex 뷰어에서 확인하세요.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    '요청 본문이 전송되지 않았습니다. 브라우저는 GET 또는 HEAD 요청에 본문을 붙일 수 없습니다.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    '중복된 JSON 키가 있어 마지막 값을 표시합니다: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    '잘린 본문입니다. 미리 보기와 필터는 완전히 캡처된 값만 표시합니다.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    '스키마 없는 디코딩 (최선 노력)입니다. 필드 번호를 표시하며 중첩과 텍스트는 전송선 바이트에서 추정합니다.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': '이름',
  'workbench.editors.request.response.headers.value': '값',
  'workbench.editors.request.response.headers.filterPlaceholder': '헤더 필터',
  'workbench.editors.request.response.headers.copyAll': '모든 헤더 복사',
  'workbench.editors.request.response.headers.copyAria': '{name} 복사',
  'workbench.editors.request.response.headers.copyTitle': '헤더 복사',
  'workbench.editors.request.response.headers.empty': '헤더 없음',
  'workbench.editors.request.response.headers.noMatch': '“{query}” 조건과 일치하는 헤더가 없습니다',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': '이름',
  'workbench.editors.request.response.cookies.value': '값',
  'workbench.editors.request.response.cookies.copyAria': '{name} 항목의 Set-Cookie 헤더 복사',
  'workbench.editors.request.response.cookies.copyTitle': 'Set-Cookie 줄 복사',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    '이 요청은 자격 증명을 포함해 실행되었으므로 브라우저가 이 쿠키들을 (각 쿠키의 속성에 따라) 저장했을 수 있으며, 이후 자격 증명을 포함하는 요청에 보냅니다.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    '서버가 이 쿠키들을 보냈지만, 이 요청은 자격 증명을 생략한 채 (기본값) 실행되었으므로 브라우저가 버렸습니다. 아무것도 저장되지 않았습니다.',
  'workbench.editors.request.response.cookies.noteJarOff':
    '이 쿠키들은 저장되지 않았습니다. 이 요청이 쿠키 저장소 없이 (기본값) 실행되었거나 저장소가 아무것도 받아들이지 않았습니다.',
  'workbench.editors.request.response.cookies.noteJarStored':
    '이 요청은 쿠키 저장소를 켠 채 실행되어 {names} 쿠키를 이후 저장소를 켠 요청을 위해 워크스페이스의 메모리 내 저장소에 저장했습니다.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    '이 요청은 쿠키 저장소를 켠 채 실행되어 {names} 쿠키를 이후 저장소를 켠 요청을 위해 워크스페이스의 메모리 내 저장소에 저장했습니다. 일부는 중간 리디렉션 홉에서 설정되어 그 Set-Cookie 줄은 여기에 없습니다. 최종 응답의 헤더만 표시됩니다.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': '통과',
  'workbench.editors.request.response.assertions.fail': '실패',
  'workbench.editors.request.response.console.preRequest': '요청 전',
  'workbench.editors.request.response.console.postResponse': '응답 후',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': '요청을 보내는 중…',
  'workbench.editors.request.response.empty.prompt': '요청을 보내면 여기에 응답이 표시됩니다.',
  'workbench.editors.request.response.error.title': '요청을 보낼 수 없습니다',
  'workbench.editors.request.response.error.openInTab': '새 탭에서 열기',
  'workbench.editors.request.response.error.trust.title': '{origin} 출처가 제시한 인증서 신뢰',
  'workbench.editors.request.response.error.trust.probing': '서버가 제시하는 인증서를 읽는 중…',
  'workbench.editors.request.response.error.trust.probeFailed': '서버의 인증서를 읽을 수 없습니다: {message}',
  'workbench.editors.request.response.error.trust.retryProbe': '다시 시도',
  'workbench.editors.request.response.error.trust.failure': '실패',
  'workbench.editors.request.response.error.trust.noAnchor':
    '서버가 루트 인증서를 제시하지 않아 여기서 고정할 수 있는 것이 없습니다. 설정 › API 요청 › TLS 항목에서 발급 CA 인증서를 추가하세요.',
  'workbench.editors.request.response.error.trust.trustOnDevice': '이 기기에서 신뢰',
  'workbench.editors.request.response.error.trust.addToWorkspace': '워크스페이스에 추가',
  'workbench.editors.request.response.error.certSteps.summary':
    '로컬 개발 서버는 보통 자체 서명 인증서로 실행되므로 직접 수락해야 합니다.',
  'workbench.editors.request.response.error.certSteps.step1': '새 탭에서 URL 주소 열기',
  'workbench.editors.request.response.error.certSteps.step2': '인증서 경고 수락',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': '고급 → …(안전하지 않음)(으)로 이동',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': '고급… → 위험을 감수하고 계속',
  'workbench.editors.request.response.error.certSteps.step3': '요청 다시 보내기',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': '새 탭',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': '고급',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ 전송',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': '…(안전하지 않음)(으)로 이동',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': '위험을 감수하고 계속',
} as const satisfies Catalog;
