/**
 * HTTP status-code docs registry — powers the response meta strip's
 * status-chip popover. Same in-app-docs discipline as the http-headers
 * corpus: `getStatusCodeInfoContent` always returns content — curated
 * codes get specific copy, everything else gets an honest range-level
 * fallback. Prose lives in the i18n catalog (`shared.info.status.*`);
 * codes and canonical reason phrases are wire vocabulary and stay raw.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '../../types';

interface StatusInfoEntry {
  /** Canonical reason phrase, shown even when the server sent none. */
  display: string;
  /** One-sentence meaning. */
  summaryKey: MessageKey;
  /** Optional extra guidance — what to look at next. */
  bodyKey?: MessageKey;
}

const STATUS_INFO: ReadonlyMap<number, StatusInfoEntry> = new Map<number, StatusInfoEntry>([
  [
    100,
    {
      display: 'Continue',
      summaryKey: 'shared.info.status.s100.summary',
    },
  ],
  [
    101,
    {
      display: 'Switching Protocols',
      summaryKey: 'shared.info.status.s101.summary',
    },
  ],
  [
    102,
    {
      display: 'Processing',
      summaryKey: 'shared.info.status.s102.summary',
    },
  ],
  [
    103,
    {
      display: 'Early Hints',
      summaryKey: 'shared.info.status.s103.summary',
    },
  ],
  [
    200,
    {
      display: 'OK',
      summaryKey: 'shared.info.status.s200.summary',
    },
  ],
  [
    201,
    {
      display: 'Created',
      summaryKey: 'shared.info.status.s201.summary',
      bodyKey: 'shared.info.status.s201.body',
    },
  ],
  [
    202,
    {
      display: 'Accepted',
      summaryKey: 'shared.info.status.s202.summary',
      bodyKey: 'shared.info.status.s202.body',
    },
  ],
  [
    203,
    {
      display: 'Non-Authoritative Information',
      summaryKey: 'shared.info.status.s203.summary',
    },
  ],
  [
    204,
    {
      display: 'No Content',
      summaryKey: 'shared.info.status.s204.summary',
      bodyKey: 'shared.info.status.s204.body',
    },
  ],
  [
    205,
    {
      display: 'Reset Content',
      summaryKey: 'shared.info.status.s205.summary',
    },
  ],
  [
    206,
    {
      display: 'Partial Content',
      summaryKey: 'shared.info.status.s206.summary',
      bodyKey: 'shared.info.status.s206.body',
    },
  ],
  [
    207,
    {
      display: 'Multi-Status',
      summaryKey: 'shared.info.status.s207.summary',
    },
  ],
  [
    208,
    {
      display: 'Already Reported',
      summaryKey: 'shared.info.status.s208.summary',
    },
  ],
  [
    226,
    {
      display: 'IM Used',
      summaryKey: 'shared.info.status.s226.summary',
    },
  ],
  [
    300,
    {
      display: 'Multiple Choices',
      summaryKey: 'shared.info.status.s300.summary',
    },
  ],
  [
    301,
    {
      display: 'Moved Permanently',
      summaryKey: 'shared.info.status.s301.summary',
      bodyKey: 'shared.info.status.s301.body',
    },
  ],
  [
    302,
    {
      display: 'Found',
      summaryKey: 'shared.info.status.s302.summary',
      bodyKey: 'shared.info.status.s302.body',
    },
  ],
  [
    303,
    {
      display: 'See Other',
      summaryKey: 'shared.info.status.s303.summary',
      bodyKey: 'shared.info.status.s303.body',
    },
  ],
  [
    304,
    {
      display: 'Not Modified',
      summaryKey: 'shared.info.status.s304.summary',
      bodyKey: 'shared.info.status.s304.body',
    },
  ],
  [
    305,
    {
      display: 'Use Proxy',
      summaryKey: 'shared.info.status.s305.summary',
    },
  ],
  [
    307,
    {
      display: 'Temporary Redirect',
      summaryKey: 'shared.info.status.s307.summary',
    },
  ],
  [
    308,
    {
      display: 'Permanent Redirect',
      summaryKey: 'shared.info.status.s308.summary',
    },
  ],
  [
    400,
    {
      display: 'Bad Request',
      summaryKey: 'shared.info.status.s400.summary',
      bodyKey: 'shared.info.status.s400.body',
    },
  ],
  [
    401,
    {
      display: 'Unauthorized',
      summaryKey: 'shared.info.status.s401.summary',
      bodyKey: 'shared.info.status.s401.body',
    },
  ],
  [
    402,
    {
      display: 'Payment Required',
      summaryKey: 'shared.info.status.s402.summary',
    },
  ],
  [
    403,
    {
      display: 'Forbidden',
      summaryKey: 'shared.info.status.s403.summary',
      bodyKey: 'shared.info.status.s403.body',
    },
  ],
  [
    404,
    {
      display: 'Not Found',
      summaryKey: 'shared.info.status.s404.summary',
      bodyKey: 'shared.info.status.s404.body',
    },
  ],
  [
    405,
    {
      display: 'Method Not Allowed',
      summaryKey: 'shared.info.status.s405.summary',
      bodyKey: 'shared.info.status.s405.body',
    },
  ],
  [
    406,
    {
      display: 'Not Acceptable',
      summaryKey: 'shared.info.status.s406.summary',
    },
  ],
  [
    407,
    {
      display: 'Proxy Authentication Required',
      summaryKey: 'shared.info.status.s407.summary',
    },
  ],
  [
    408,
    {
      display: 'Request Timeout',
      summaryKey: 'shared.info.status.s408.summary',
    },
  ],
  [
    409,
    {
      display: 'Conflict',
      summaryKey: 'shared.info.status.s409.summary',
      bodyKey: 'shared.info.status.s409.body',
    },
  ],
  [
    410,
    {
      display: 'Gone',
      summaryKey: 'shared.info.status.s410.summary',
    },
  ],
  [
    411,
    {
      display: 'Length Required',
      summaryKey: 'shared.info.status.s411.summary',
    },
  ],
  [
    412,
    {
      display: 'Precondition Failed',
      summaryKey: 'shared.info.status.s412.summary',
    },
  ],
  [
    413,
    {
      display: 'Payload Too Large',
      summaryKey: 'shared.info.status.s413.summary',
    },
  ],
  [
    414,
    {
      display: 'URI Too Long',
      summaryKey: 'shared.info.status.s414.summary',
    },
  ],
  [
    415,
    {
      display: 'Unsupported Media Type',
      summaryKey: 'shared.info.status.s415.summary',
      bodyKey: 'shared.info.status.s415.body',
    },
  ],
  [
    416,
    {
      display: 'Range Not Satisfiable',
      summaryKey: 'shared.info.status.s416.summary',
    },
  ],
  [
    417,
    {
      display: 'Expectation Failed',
      summaryKey: 'shared.info.status.s417.summary',
    },
  ],
  [
    418,
    {
      display: "I'm a Teapot",
      summaryKey: 'shared.info.status.s418.summary',
    },
  ],
  [
    421,
    {
      display: 'Misdirected Request',
      summaryKey: 'shared.info.status.s421.summary',
    },
  ],
  [
    422,
    {
      display: 'Unprocessable Entity',
      summaryKey: 'shared.info.status.s422.summary',
      bodyKey: 'shared.info.status.s422.body',
    },
  ],
  [
    423,
    {
      display: 'Locked',
      summaryKey: 'shared.info.status.s423.summary',
    },
  ],
  [
    424,
    {
      display: 'Failed Dependency',
      summaryKey: 'shared.info.status.s424.summary',
    },
  ],
  [
    425,
    {
      display: 'Too Early',
      summaryKey: 'shared.info.status.s425.summary',
    },
  ],
  [
    426,
    {
      display: 'Upgrade Required',
      summaryKey: 'shared.info.status.s426.summary',
    },
  ],
  [
    428,
    {
      display: 'Precondition Required',
      summaryKey: 'shared.info.status.s428.summary',
    },
  ],
  [
    429,
    {
      display: 'Too Many Requests',
      summaryKey: 'shared.info.status.s429.summary',
      bodyKey: 'shared.info.status.s429.body',
    },
  ],
  [
    431,
    {
      display: 'Request Header Fields Too Large',
      summaryKey: 'shared.info.status.s431.summary',
    },
  ],
  [
    451,
    {
      display: 'Unavailable For Legal Reasons',
      summaryKey: 'shared.info.status.s451.summary',
    },
  ],
  [
    500,
    {
      display: 'Internal Server Error',
      summaryKey: 'shared.info.status.s500.summary',
      bodyKey: 'shared.info.status.s500.body',
    },
  ],
  [
    501,
    {
      display: 'Not Implemented',
      summaryKey: 'shared.info.status.s501.summary',
    },
  ],
  [
    502,
    {
      display: 'Bad Gateway',
      summaryKey: 'shared.info.status.s502.summary',
      bodyKey: 'shared.info.status.s502.body',
    },
  ],
  [
    503,
    {
      display: 'Service Unavailable',
      summaryKey: 'shared.info.status.s503.summary',
      bodyKey: 'shared.info.status.s503.body',
    },
  ],
  [
    504,
    {
      display: 'Gateway Timeout',
      summaryKey: 'shared.info.status.s504.summary',
    },
  ],
  [
    505,
    {
      display: 'HTTP Version Not Supported',
      summaryKey: 'shared.info.status.s505.summary',
    },
  ],
  [
    506,
    {
      display: 'Variant Also Negotiates',
      summaryKey: 'shared.info.status.s506.summary',
    },
  ],
  [
    507,
    {
      display: 'Insufficient Storage',
      summaryKey: 'shared.info.status.s507.summary',
    },
  ],
  [
    508,
    {
      display: 'Loop Detected',
      summaryKey: 'shared.info.status.s508.summary',
    },
  ],
  [
    510,
    {
      display: 'Not Extended',
      summaryKey: 'shared.info.status.s510.summary',
    },
  ],
  [
    511,
    {
      display: 'Network Authentication Required',
      summaryKey: 'shared.info.status.s511.summary',
    },
  ],
]);

interface StatusRange {
  kickerKey: MessageKey;
  fallbackSummaryKey: MessageKey;
}

function rangeFor(status: number): StatusRange {
  if (status >= 100 && status < 200)
    return {
      kickerKey: 'shared.info.status.range1xx.kicker',
      fallbackSummaryKey: 'shared.info.status.range1xx.fallback',
    };
  if (status >= 200 && status < 300)
    return {
      kickerKey: 'shared.info.status.range2xx.kicker',
      fallbackSummaryKey: 'shared.info.status.range2xx.fallback',
    };
  if (status >= 300 && status < 400)
    return {
      kickerKey: 'shared.info.status.range3xx.kicker',
      fallbackSummaryKey: 'shared.info.status.range3xx.fallback',
    };
  if (status >= 400 && status < 500)
    return {
      kickerKey: 'shared.info.status.range4xx.kicker',
      fallbackSummaryKey: 'shared.info.status.range4xx.fallback',
    };
  if (status >= 500 && status < 600)
    return {
      kickerKey: 'shared.info.status.range5xx.kicker',
      fallbackSummaryKey: 'shared.info.status.range5xx.fallback',
    };
  return {
    kickerKey: 'shared.info.status.rangeOther.kicker',
    fallbackSummaryKey: 'shared.info.status.rangeOther.fallback',
  };
}

/** True when we have curated copy for this exact code. */
export function hasStatusCodeInfo(status: number): boolean {
  return STATUS_INFO.has(status);
}

/**
 * Always-returns lookup for the status-chip popover. Curated codes get
 * specific copy; anything else gets the honest range-level fallback.
 * `statusText` is what the server actually sent — shown when it
 * differs from the canonical reason phrase.
 */
export function getStatusCodeInfoContent(t: Translate, status: number, statusText: string): InfoPopoverContent {
  const range = rangeFor(status);
  const entry = STATUS_INFO.get(status);
  if (!entry) {
    return {
      title: `${status}${statusText ? ` ${statusText}` : ''}`,
      kicker: t('shared.info.status.kicker', { range: t(range.kickerKey) }),
      summary: t(range.fallbackSummaryKey),
      description: t('shared.info.status.undocumented'),
    };
  }
  const serverPhraseDiffers = statusText !== '' && statusText.toLowerCase() !== entry.display.toLowerCase();
  const body = entry.bodyKey === undefined ? undefined : t(entry.bodyKey);
  return {
    title: `${status} ${entry.display}`,
    kicker: t('shared.info.status.kicker', { range: t(range.kickerKey) }),
    summary: t(entry.summaryKey),
    description:
      body !== undefined || serverPhraseDiffers
        ? [body, serverPhraseDiffers ? t('shared.info.status.serverPhrase', { statusText }) : undefined]
            .filter(Boolean)
            .join(' ')
        : undefined,
  };
}

/** Count of curated codes, exposed for tests + sanity checks. */
export function statusCodeInfoCount(): number {
  return STATUS_INFO.size;
}

/** Canonical reason phrase for a curated code, null otherwise. */
export function statusCodePhrase(status: number): string | null {
  return STATUS_INFO.get(status)?.display ?? null;
}

/**
 * Every curated code with its canonical phrase, ascending — feeds
 * status-code pickers (e.g. the example editor's editable status chip).
 */
export function listStatusCodes(): ReadonlyArray<{ code: number; phrase: string }> {
  return Array.from(STATUS_INFO, ([code, entry]) => ({ code, phrase: entry.display })).sort((a, b) => a.code - b.code);
}
