/**
 * The tabs a settled response opens to — Body · Headers, then Cookies,
 * Assertions and Console when the response carries that data. One list
 * for every surface that shows an exchange: the request editor's
 * response panel and a workflow run's step.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { TabsProps } from 'antd';
import { useMemo } from 'react';
import type { SseStreamSession } from '../useLiveSendStream';
import ResponseAssertionsView from './ResponseAssertionsView';
import ResponseBodyView from './ResponseBodyView';
import ResponseConsoleView from './ResponseConsoleView';
import ResponseCookiesView from './ResponseCookiesView';
import ResponseHeadersView from './ResponseHeadersView';
import { setCookieLinesOf } from './response-cookies';
import { withWireCookieHeaders } from './response-headers';

export type ResponseTabKey = 'body' | 'headers' | 'cookies' | 'assertions' | 'script-log';

export function useResponseTabs(
  response: ExecutedRequestSnapshot | null,
  sseSession?: SseStreamSession | null,
): NonNullable<TabsProps['items']> {
  const t = useT();
  // The Headers grid shows the wire-captured Set-Cookie lines too —
  // fetch strips them from the snapshot (forbidden response header),
  // but they were genuinely on the wire. Memoized: the view's
  // filter-reset effect keys on row identity.
  const headerRows = useMemo(
    () => (response ? withWireCookieHeaders(response.headers, response.wire?.setCookieHeaders) : []),
    [response],
  );
  if (!response) return [];

  const scripts = response.scripts ?? null;
  const assertions = scripts?.postResponse?.assertions ?? [];
  const assertionsPassed = assertions.filter((a) => a.passed).length;
  const assertionsFailed = assertions.length - assertionsPassed;
  const preLog = scripts?.preRequest?.consoleLog ?? [];
  const postLog = scripts?.postResponse?.consoleLog ?? [];
  const setCookieCount = setCookieLinesOf(response).length;

  return [
    {
      key: 'body',
      label: t('workbench.editors.request.response.tab.body'),
      children: <ResponseBodyView response={response} sseSession={sseSession} />,
    },
    {
      key: 'headers',
      label: t('workbench.editors.request.response.tab.headers', {
        count: headerRows.length + (response.trailers?.length ?? 0),
      }),
      children: <ResponseHeadersView headers={headerRows} trailers={response.trailers} />,
    },
    ...(setCookieCount > 0
      ? [
          {
            key: 'cookies',
            label: t('workbench.editors.request.response.tab.cookies', { count: setCookieCount }),
            children: <ResponseCookiesView response={response} />,
          },
        ]
      : []),
    ...(assertions.length > 0
      ? [
          {
            key: 'assertions',
            label:
              assertionsFailed > 0
                ? t('workbench.editors.request.response.tab.assertionsFailed', { count: assertionsFailed })
                : assertionsPassed > 0
                  ? t('workbench.editors.request.response.tab.assertionsPassed', { count: assertionsPassed })
                  : t('workbench.editors.request.response.tab.assertions'),
            children: <ResponseAssertionsView assertions={assertions} />,
          },
        ]
      : []),
    ...(preLog.length > 0 || postLog.length > 0
      ? [
          {
            key: 'script-log',
            label: t('workbench.editors.request.response.tab.console', { count: preLog.length + postLog.length }),
            children: <ResponseConsoleView preLog={preLog} postLog={postLog} />,
          },
        ]
      : []),
  ];
}
