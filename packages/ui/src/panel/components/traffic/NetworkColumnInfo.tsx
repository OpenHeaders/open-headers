/**
 * Per-column `(i)` info-popover content for the network table. Same
 * pattern as the Cookies tab's `CookieColumnInfo` and the Headers tab's
 * `GeneralRow` — a hover-revealed glyph that opens an `<InfoPopover>`.
 *
 * Every popover leads with the same canonical example request rendered
 * as a compact card; the column's own slice of that request is the
 * highlighted token, so reading across all the popovers builds one
 * coherent picture of a single request seen column by column.
 *
 * Titles are the raw column names (they name the raw header cells —
 * network-table parity vocabulary); item labels are wire vocabulary
 * (GET, 2xx, h2, (pending), net::ERR_…, ST/RT/…) and ride raw, while
 * the summaries, descriptions, and section headings key.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { ColumnKey } from './columns';

/** The single request every column popover illustrates. Holding one
 * example fixed across all popovers lets the user map each column onto
 * the same concrete row. */
const EX = {
  num: '7',
  method: 'GET',
  scheme: 'https',
  domain: 'api.openheaders.com',
  pathDir: '/v1/',
  name: 'users?page=2',
  status: '200',
  protocol: 'h2',
  type: 'fetch',
  remote: '203.0.113.42',
  initiator: 'app.js:128',
  size: '1.2 kB',
  time: '45 ms',
  priority: 'High',
  cookies: '3 cookies',
  setCookies: '1 set-cookie',
} as const;

type TokenId =
  | 'num'
  | 'method'
  | 'scheme'
  | 'domain'
  | 'pathDir'
  | 'name'
  | 'status'
  | 'protocol'
  | 'type'
  | 'remote'
  | 'initiator'
  | 'size'
  | 'time'
  | 'priority'
  | 'cookies'
  | 'setCookies';

/** Which token(s) of the example each column lights up. Path/URL/name
 * overlap inside the URL, so they highlight a group. Waterfall plots
 * timing, so it lights the Time token. */
const HIGHLIGHT: Record<ColumnKey, readonly TokenId[]> = {
  name: ['name'],
  path: ['pathDir', 'name'],
  url: ['scheme', 'domain', 'pathDir', 'name'],
  requestNumber: ['num'],
  method: ['method'],
  status: ['status'],
  protocol: ['protocol'],
  scheme: ['scheme'],
  domain: ['domain'],
  remoteAddress: ['remote'],
  type: ['type'],
  initiator: ['initiator'],
  cookies: ['cookies'],
  setCookies: ['setCookies'],
  size: ['size'],
  time: ['time'],
  priority: ['priority'],
  waterfall: ['time'],
};

function ExampleCard({ column }: { column: ColumnKey }) {
  const t = useT();
  const lit = new Set<TokenId>(HIGHLIGHT[column]);
  const tok = (id: TokenId, text: string, extra = '') => (
    <span className={`dt-col-eg-tok${extra ? ` ${extra}` : ''}${lit.has(id) ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{t('panel.network.colInfo.exampleCaption')}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('num', `#${EX.num}`)}
          {' · '}
          {tok('method', EX.method, 'dt-col-eg-method')}
          {' · '}
          {tok('status', EX.status, 'dt-col-eg-status')}
        </div>
        <div className="dt-col-eg-line dt-col-eg-url">
          {tok('scheme', EX.scheme)}
          <span className="dt-col-eg-sep">://</span>
          {tok('domain', EX.domain)}
          {tok('pathDir', EX.pathDir)}
          {tok('name', EX.name)}
        </div>
        <div className="dt-col-eg-line dt-col-eg-meta">
          {tok('protocol', EX.protocol)}
          {' · '}
          {tok('type', EX.type)}
          {' · '}
          {tok('remote', EX.remote)}
          {' · '}
          {tok('initiator', EX.initiator)}
          {' · '}
          {tok('size', EX.size)}
          {' · '}
          {tok('time', EX.time)}
          {' · '}
          {tok('priority', EX.priority)}
          {' · '}
          {tok('cookies', EX.cookies)}
          {' · '}
          {tok('setCookies', EX.setCookies)}
        </div>
      </div>
    </div>
  );
}

function networkColumnInfo(t: Translate, infoKey: ColumnKey): InfoPopoverContent {
  const kicker = t('panel.toolWindows.network');
  const diagram = <ExampleCard column={infoKey} />;
  switch (infoKey) {
    case 'name':
      return {
        title: 'Name',
        kicker,
        summary: t('panel.network.colInfo.name.summary'),
        description: t('panel.network.colInfo.name.description'),
        diagram,
      };
    case 'path':
      return { title: 'Path', kicker, summary: t('panel.network.colInfo.path.summary'), diagram };
    case 'url':
      return { title: 'URL', kicker, summary: t('panel.network.colInfo.url.summary'), diagram };
    case 'requestNumber':
      return {
        title: 'Request #',
        kicker,
        summary: t('panel.network.colInfo.requestNumber.summary'),
        description: t('panel.network.colInfo.requestNumber.description'),
        diagram,
      };
    case 'method':
      return {
        title: 'Method',
        kicker,
        summary: t('panel.network.colInfo.method.summary'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.method.commonVerbsHeading'),
            items: [
              { label: 'GET', desc: t('panel.network.colInfo.method.getDesc') },
              { label: 'POST', desc: t('panel.network.colInfo.method.postDesc') },
              { label: 'PUT / PATCH', desc: t('panel.network.colInfo.method.putPatchDesc') },
              { label: 'DELETE', desc: t('panel.network.colInfo.method.deleteDesc') },
            ],
          },
        ],
      };
    case 'status':
      return {
        title: 'Status',
        kicker,
        summary: t('panel.network.colInfo.status.summary'),
        description: t('panel.network.colInfo.status.description'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.status.codeRangesHeading'),
            items: [
              { label: '2xx', desc: t('panel.network.colInfo.status.s2xxDesc') },
              { label: '3xx', desc: t('panel.network.colInfo.status.s3xxDesc') },
              {
                label: '4xx',
                desc: t('panel.network.colInfo.status.s4xxDesc'),
                labelClassName: 'dt-col-status--error',
              },
              {
                label: '5xx',
                desc: t('panel.network.colInfo.status.s5xxDesc'),
                labelClassName: 'dt-col-status--error',
              },
            ],
          },
          {
            heading: t('panel.network.colInfo.status.insteadHeading'),
            items: [
              {
                label: '(pending)',
                desc: t('panel.network.colInfo.status.pendingDesc'),
                labelClassName: 'dt-col-status--dim',
              },
              {
                label: '(failed) net::ERR_…',
                desc: t('panel.network.colInfo.status.failedDesc'),
                labelClassName: 'dt-col-status--error',
              },
              {
                label: '(canceled)',
                desc: t('panel.network.colInfo.status.canceledDesc'),
                labelClassName: 'dt-col-status--error',
              },
              {
                label: '(blocked:reason)',
                desc: t('panel.network.colInfo.status.blockedDesc'),
                labelClassName: 'dt-col-status--error',
              },
              {
                label: 'CORS error',
                desc: t('panel.network.colInfo.status.corsDesc'),
                labelClassName: 'dt-col-status--error',
              },
              {
                label: '(data)',
                desc: t('panel.network.colInfo.status.dataDesc'),
                labelClassName: 'dt-col-status--dim',
              },
              {
                label: 'Finished',
                desc: t('panel.network.colInfo.status.finishedDesc'),
                labelClassName: 'dt-col-status--dim',
              },
            ],
          },
        ],
      };
    case 'protocol':
      return {
        title: 'Protocol',
        kicker,
        summary: t('panel.network.colInfo.protocol.summary'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.protocol.valuesHeading'),
            items: [
              { label: 'http/1.1', desc: t('panel.network.colInfo.protocol.http11Desc') },
              { label: 'h2', desc: t('panel.network.colInfo.protocol.h2Desc') },
              { label: 'h3', desc: t('panel.network.colInfo.protocol.h3Desc') },
            ],
          },
        ],
      };
    case 'scheme':
      return { title: 'Scheme', kicker, summary: t('panel.network.colInfo.scheme.summary'), diagram };
    case 'domain':
      return { title: 'Domain', kicker, summary: t('panel.network.colInfo.domain.summary'), diagram };
    case 'remoteAddress':
      return {
        title: 'Remote address',
        kicker,
        summary: t('panel.network.colInfo.remoteAddress.summary'),
        description: t('panel.network.colInfo.remoteAddress.description'),
        diagram,
      };
    case 'type':
      return {
        title: 'Type',
        kicker,
        summary: t('panel.network.colInfo.type.summary'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.type.examplesHeading'),
            items: [
              { label: 'document', desc: t('panel.network.colInfo.type.documentDesc') },
              { label: 'fetch / xhr', desc: t('panel.network.colInfo.type.fetchXhrDesc') },
              { label: 'script / css', desc: t('panel.network.colInfo.type.scriptCssDesc') },
              { label: 'img / font / media', desc: t('panel.network.colInfo.type.imgFontMediaDesc') },
            ],
          },
        ],
      };
    case 'initiator':
      return {
        title: 'Initiator',
        kicker,
        summary: t('panel.network.colInfo.initiator.summary'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.initiator.kindsHeading'),
            items: [
              { label: 'script', desc: t('panel.network.colInfo.initiator.scriptDesc') },
              { label: 'parser', desc: t('panel.network.colInfo.initiator.parserDesc') },
              { label: 'redirect', desc: t('panel.network.colInfo.initiator.redirectDesc') },
              { label: 'other', desc: t('panel.network.colInfo.initiator.otherDesc') },
            ],
          },
        ],
      };
    case 'cookies':
      return { title: 'Cookies', kicker, summary: t('panel.network.colInfo.cookies.summary'), diagram };
    case 'setCookies':
      return {
        title: 'Set Cookies',
        kicker,
        summary: t('panel.network.colInfo.setCookies.summary'),
        description: t('panel.network.colInfo.setCookies.description'),
        diagram,
      };
    case 'size':
      return {
        title: 'Size',
        kicker,
        summary: t('panel.network.colInfo.size.summary'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.size.insteadHeading'),
            items: [
              { label: '(disk cache)', desc: t('panel.network.colInfo.size.diskCacheDesc') },
              { label: '(memory cache)', desc: t('panel.network.colInfo.size.memoryCacheDesc') },
              { label: 'Pending', desc: t('panel.network.colInfo.size.pendingDesc') },
            ],
          },
        ],
      };
    case 'time':
      return {
        title: 'Time',
        kicker,
        summary: t('panel.network.colInfo.time.summary'),
        description: t('panel.network.colInfo.time.description'),
        diagram,
      };
    case 'priority':
      return {
        title: 'Priority',
        kicker,
        summary: t('panel.network.colInfo.priority.summary'),
        description: t('panel.network.colInfo.priority.description'),
        diagram,
      };
    case 'waterfall':
      return {
        title: 'Waterfall',
        kicker,
        summary: t('panel.network.colInfo.waterfall.summary'),
        diagram,
        sections: [
          {
            heading: t('panel.network.colInfo.waterfall.metricTagsHeading'),
            items: [
              { label: 'ST', desc: t('panel.network.colInfo.waterfall.stDesc') },
              { label: 'RT', desc: t('panel.network.colInfo.waterfall.rtDesc') },
              { label: 'ET', desc: t('panel.network.colInfo.waterfall.etDesc') },
              { label: 'TD', desc: t('panel.network.colInfo.waterfall.tdDesc') },
              { label: 'L', desc: t('panel.network.colInfo.waterfall.lDesc') },
            ],
          },
        ],
      };
  }
}

export function NetworkColumnInfo({ infoKey }: { infoKey: ColumnKey }) {
  const t = useT();
  return (
    <InfoTrigger
      content={networkColumnInfo(t, infoKey)}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}
