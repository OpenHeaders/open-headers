/**
 * Web namespace — Korean. Mirrors `catalogs/en/web.ts` key for key.
 * Brand ('OpenHeaders' / 'OpenHeaders Server' — the tier-neutral
 * server name, quoted from the ko settings panes), URLs, the
 * `oh-license.` key prefix and `{provider}` ride raw with 인스턴스 /
 * 계정 as head nouns — prefix/suffix fragments split around those
 * islands. Quotes the shipped ko mints: 로그인 / 로그아웃 = sign in /
 * sign out, 게이트웨이 (shared-chrome), 페어링된 기기 / 설정 = Settings,
 * 서버 관리자 = server admin, 개인 시트 / 시트 (server admin, settings
 * panes), ID 공급자 = identity provider, 단일 로그인 = single sign-on,
 * 워크벤치. MINTS: 설정 코드 = setup code; 리버스 프록시 = reverse
 * proxy; 보안 컨텍스트 / 보안 출처 = secure context / origin; 신원 =
 * identity (a device's). Plurals are `other`-only with 대 (devices).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': '이 서버에 로그인',
  'web.gate.titleSetup': '이 서버 설정',
  'web.gate.introSso': '{provider} 계정으로 로그인하면 이 OpenHeaders Server 인스턴스에 접근할 수 있습니다.',
  'web.gate.introPassword': '서버 관리자가 설정해 준 이메일과 비밀번호로 로그인하세요.',
  'web.gate.introSetup':
    '아직 아무도 이 OpenHeaders Server 인스턴스를 설정하지 않았습니다. 첫 계정을 만드세요. 이 계정이 서버를 관리하고 이미 서버에 있는 모든 것을 소유합니다.',
  'web.gate.introNoLogin':
    '이 서버에는 브라우저가 로그인할 방법이 없습니다: 단일 로그인이 구성되지 않았고, 비밀번호를 가진 계정도 없습니다. 서버를 운영하는 사람에게 비밀번호 설정을 요청하세요.',
  'web.gate.ssoButton': '{provider} 계정으로 로그인',
  'web.gate.emailPlaceholder': '이메일',
  'web.gate.passwordPlaceholder': '비밀번호',
  'web.gate.signIn': '로그인',
  'web.gate.setupNamePlaceholder': '이름',
  'web.gate.setupConfirmPlaceholder': '비밀번호 확인',
  'web.gate.setupPasswordHint': '{min}자 이상. 비밀번호 재설정은 없으니 안전한 곳에 보관하세요.',
  'web.gate.setupCodePlaceholder': '설정 코드',
  'web.gate.setupCodeHint': '서버가 시작할 때 로그에 출력됩니다. 다시 시작할 때마다 새 코드가 출력됩니다.',
  'web.gate.setupSubmit': '계정 만들기',
  'web.gate.setupDoneTitle': '이 서버가 설정되었습니다',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      other:
        '설정 과정에서 페어링된 기기 {count}대의 페어링이 해제되어, 새 계정을 우회해 이 서버를 계속 관리할 수 없습니다. 설정에서 다시 페어링하세요.',
    }),
  'web.gate.setupDoneContinue': '서버 관리로 계속',
  'web.gate.setupDoneReload': '다시 불러오기',
  'web.gate.setupErrorDisplayName': '계정에 넣을 이름을 입력하세요.',
  'web.gate.setupErrorEmail': '로그인에 쓸 이메일을 입력하세요.',
  'web.gate.setupErrorPasswordShort': '{min}자 이상 입력하세요.',
  'web.gate.setupErrorPasswordMismatch': '두 비밀번호가 일치하지 않습니다.',
  'web.gate.setupErrorMalformed': '서버가 폼을 읽을 수 없습니다. 페이지를 다시 불러온 뒤 다시 시도하세요.',
  'web.gate.setupErrorRefused':
    '서버가 설정을 거부했습니다. 이미 설정되어 있거나, 설정 코드가 틀렸거나 이전 시작 때의 코드일 수 있습니다. 서버는 다시 시작할 때마다 새 코드를 출력합니다.',
  'web.gate.setupErrorSessionRefused':
    '계정은 만들어졌지만 이 탭이 세션을 열 수 없습니다. 페이지를 다시 불러온 뒤 그 계정으로 로그인하세요.',
  'web.gate.clientsIntro':
    '이 탭만 클라이언트인 것은 아닙니다. 확장 프로그램과 데스크톱 앱은 이 서버에 다음 주소로 직접 접근합니다:',
  'web.gate.clientsExtension': '확장 프로그램 받기',
  'web.gate.clientsDesktop': '데스크톱 앱 받기',
  'web.gate.errorServerOffline': '서버가 응답하지 않았습니다. 실행 중인지 확인하고 다시 시도하세요.',
  'web.gate.errorPasswordRefused': '로그인에 실패했습니다. 이메일과 비밀번호를 확인하고 다시 시도하세요.',
  'web.gate.errorSessionRefused': '서버가 세션을 받아들이지 않았습니다. 다시 시도하세요.',
  'web.gate.seatIntroPrefix':
    '개인 시트가 있나요? 키를 붙여넣으면 빈 팀 시트를 기다리지 않고 로그인할 수 있습니다. 구매할 때 쓴 이메일을 입장시킵니다. 구매처:',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': '개인 시트 키 (oh-license.…)',
  'web.gate.seatSignIn': '개인 시트로 로그인',
  'web.overlay.signingIn': '로그인하는 중…',
  'web.overlay.takingYouTo': '{provider} 페이지로 이동하는 중…',
  'web.oidcError.unknownUser':
    '로그인은 되었지만 이 서버에 이 이메일의 사용자가 없습니다. 서버 관리자에게 추가를 요청하세요.',
  'web.oidcError.userDeactivated':
    '로그인은 되었지만 이 서버의 사용자가 비활성화되어 있습니다. 서버 관리자에게 문의하세요.',
  'web.oidcError.emailUnverified': 'ID 공급자가 이메일을 미확인으로 보고합니다. 확인한 뒤 다시 시도하세요.',
  'web.oidcError.providerUnavailable': 'ID 공급자에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
  'web.oidcError.seatLimitReached':
    '로그인은 되었지만 이 서버에 새 사용자를 위한 빈 시트가 없습니다. 서버 관리자에게 문의하거나, 자기 개인 시트로 지금 들어오세요.',
  'web.oidcError.personalSeatsDisabled':
    '이 서버에서는 개인 시트가 비활성화되어 있습니다. 서버 관리자에게 시트를 문의하세요.',
  'web.oidcError.personalLicenseInvalid':
    '그 개인 시트 키는 쓸 수 없습니다. 잘못되었거나, 만료되었거나, 개인 시트가 아닙니다. 키를 확인하고 다시 시도하세요.',
  'web.oidcError.personalLicenseIdentityMismatch':
    '그 개인 시트는 다른 이메일의 것입니다. 구매할 때 쓴 주소만 입장시킵니다.',
  'web.oidcError.personalLicenseNoIdentity':
    '로그인에 개인 시트와 대조할 이메일이 없었습니다. 서버 관리자에게 문의하세요.',
  'web.oidcError.failed':
    '단일 로그인에 실패했습니다. 다시 시도하거나, 서버를 운영하는 사람에게 공급자 확인을 요청하세요.',
  'web.access.title': '아직 부여된 워크스페이스가 없습니다',
  'web.access.intro':
    '{org} 조직에 로그인했지만 아직 부여된 워크스페이스가 없습니다. 관리자가 워크스페이스 접근 권한을 부여해야 합니다.',
  'web.access.introNoOrg':
    '이 서버에 로그인했지만 아직 부여된 워크스페이스가 없습니다. 관리자가 워크스페이스 접근 권한을 부여해야 합니다.',
  'web.access.signedInAs': '{name} 계정으로 로그인됨',
  'web.access.signedInAsWithEmail': '{name} ({email}) 계정으로 로그인됨',
  'web.access.waiting': '접근 권한이 부여되는 즉시 이 화면이 갱신됩니다. 다시 불러올 필요가 없습니다.',
  'web.access.signOut': '로그아웃',
  'web.insecure.title': '이 페이지에는 보안 연결이 필요합니다',
  'web.insecure.intro':
    '이 탭은 서버의 얇은 뷰가 아니라 워크벤치 전체를 실행하므로 이 기기의 신원을 만들어야 하는데, 브라우저는 보안 출처에서만 이를 허용합니다.',
  'web.insecure.optionLocal': '서버 자체에서:',
  'web.insecure.optionTls': '여기서 HTTPS 연결로: 앞에 TLS 종단 리버스 프록시를 두세요.',
  'web.insecure.optionClients': '여기서 TLS 없이: 확장 프로그램과 데스크톱 앱은 다음 주소에 곧바로 연결합니다:',
} as const satisfies Catalog;
