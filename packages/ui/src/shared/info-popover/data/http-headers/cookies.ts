/**
 * HTTP-header docs — Cookies.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const COOKIES_HEADERS: HeaderInfoEntries = [
  [
    'cookie',
    {
      display: 'Cookie',
      direction: 'request',
      category: 'Cookies',
      summaryKey: 'shared.info.header.cookie.summary',
      bodyKeys: ['shared.info.header.cookie.body1'],
    },
  ],
  [
    'set-cookie',
    {
      display: 'Set-Cookie',
      direction: 'response',
      category: 'Cookies',
      summaryKey: 'shared.info.header.setCookie.summary',
      bodyKeys: ['shared.info.header.setCookie.body1', 'shared.info.header.setCookie.body2'],
      directives: [
        { key: 'Secure', descKey: 'shared.info.header.setCookie.directive.secure' },
        { key: 'HttpOnly', descKey: 'shared.info.header.setCookie.directive.httpOnly' },
        { key: 'SameSite=Strict|Lax|None', descKey: 'shared.info.header.setCookie.directive.sameSiteStrictLaxNone' },
        { key: 'Domain=host', descKey: 'shared.info.header.setCookie.directive.domainHost' },
        { key: 'Path=/path', descKey: 'shared.info.header.setCookie.directive.pathPath' },
        { key: 'Max-Age=N', descKey: 'shared.info.header.setCookie.directive.maxAgeN' },
        { key: 'Expires=date', descKey: 'shared.info.header.setCookie.directive.expiresDate' },
        { key: 'Partitioned', descKey: 'shared.info.header.setCookie.directive.partitioned' },
      ],
    },
  ],
];
