/**
 * Extension namespace — Korean. Mirrors `catalogs/en/extension.ts`
 * key for key; the 'Open Headers' brand prefix and its ` - ` state
 * separator ride raw inside the values. State words: 활성 = Active
 * (shared mint); 일시 중지됨 = Paused; 연결 끊김 = Disconnected.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - 일시 중지됨\n규칙 실행이 일시 중지되었습니다',
  'extension.badge.disconnected': 'Open Headers - 연결 끊김\n데스크톱 앱에 연결할 수 없습니다',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - 활성\n${plural(locale, Number(configured), {
      other: '규칙 {count}개',
    })} 중 ${matched}개가 이 페이지의 요청과 일치했습니다`,
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    '브라우저 확장 프로그램 안의 오픈 소스 DevToolkit. 실시간 브라우저 요청 수정. API 컬렉션 관리. 팀 협업.',
  'extension.manifest.actionDescription': 'Open Headers 팝업 열기',
} as const satisfies Catalog;
