/**
 * Desktop namespace — Korean. Mirrors `catalogs/en/desktop.ts` key for
 * key; the 'Open Headers' brand rides raw (with a head noun 앱 where a
 * particle follows). Menu rows are bare nouns / nominalized verbs;
 * macOS-style ellipsis rows keep `…`. Mints: 하드웨어 가속 = hardware
 * acceleration; 라이선스 약관 = license terms; 개인정보 처리방침 =
 * privacy policy; 다시 시작 = restart.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Open Headers 열기',
  'desktop.tray.quit': '종료',
  'desktop.menu.settings': '설정…',
  'desktop.menu.about': '{name} 정보',
  'desktop.menu.enableHardwareAcceleration': '하드웨어 가속 사용',
  'desktop.menu.disableHardwareAcceleration': '하드웨어 가속 사용 안 함',
  'desktop.menu.file': '파일',
  'desktop.menu.edit': '편집',
  'desktop.menu.view': '보기',
  'desktop.menu.window': '창',
  'desktop.menu.help': '도움말',
  'desktop.menu.newItem': '새로 만들기…',
  'desktop.menu.newTab': '새 탭',
  'desktop.menu.newWindow': '새 창',
  'desktop.menu.import': '가져오기…',
  'desktop.menu.closeTab': '탭 닫기',
  'desktop.menu.nextTab': '다음 탭',
  'desktop.menu.previousTab': '이전 탭',
  'desktop.menu.actualSize': '실제 크기',
  'desktop.menu.documentation': '문서',
  'desktop.menu.reportIssue': '문제 신고',
  'desktop.menu.licenseAgreement': '라이선스 계약',
  'desktop.update.check': '업데이트 확인…',
  'desktop.update.checking': '업데이트 확인 중…',
  'desktop.update.updateAndRestart': '{version} 버전으로 업데이트하고 다시 시작',
  'desktop.update.availableExternal': '{version} 버전 사용 가능…',
  'desktop.update.downloading': '업데이트 다운로드 중… {percent}%',
  'desktop.update.downloadingNoProgress': '업데이트 다운로드 중…',
  'desktop.update.restartToInstall': '다시 시작하여 {version} 설치',
  'desktop.dialog.hardwareAcceleration.title': '하드웨어 가속',
  'desktop.dialog.hardwareAcceleration.willBeDisabled': '다음에 {name} 앱을 시작할 때 하드웨어 가속이 비활성화됩니다.',
  'desktop.dialog.hardwareAcceleration.willBeEnabled': '다음에 {name} 앱을 시작할 때 하드웨어 가속이 활성화됩니다.',
  'desktop.dialog.hardwareAcceleration.detail': '변경 사항을 즉시 적용하려면 지금 다시 시작하세요.',
  'desktop.dialog.hardwareAcceleration.restartNow': '지금 다시 시작',
  'desktop.dialog.hardwareAcceleration.later': '나중에',
  'desktop.firstRunLegal.message':
    'Open Headers 앱을 계속 사용하면 라이선스 약관과 개인정보 처리방침에 동의하는 것으로 간주됩니다.',
  'desktop.firstRunLegal.license': '라이선스 약관',
  'desktop.firstRunLegal.privacy': '개인정보 처리방침',
  'desktop.firstRunLegal.acknowledge': '확인',
} as const satisfies Catalog;
