import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';

type GeneralInfoKey =
  | 'request-url'
  | 'request-method'
  | 'status-code'
  | 'remote-address'
  | 'http-version'
  | 'compression'
  | 'transferred'
  | 'referrer-policy';

// Row labels double as the (i) popover titles (names-its-control).
// Range / protocol / encoding item labels are wire vocabulary — raw.
function generalInfo(t: Translate, key: GeneralInfoKey): { label: string; content: InfoPopoverContent } {
  const kicker = t('panel.inspector.headers.generalSection');
  switch (key) {
    case 'request-url': {
      const label = t('panel.inspector.headers.general.requestUrl');
      return {
        label,
        content: { title: label, kicker, summary: t('panel.inspector.headers.generalInfo.requestUrl.summary') },
      };
    }
    case 'request-method': {
      const label = t('panel.inspector.headers.general.requestMethod');
      return {
        label,
        content: { title: label, kicker, summary: t('panel.inspector.headers.generalInfo.requestMethod.summary') },
      };
    }
    case 'status-code': {
      const label = t('panel.inspector.headers.general.statusCode');
      return {
        label,
        content: {
          title: label,
          kicker,
          summary: t('panel.inspector.headers.generalInfo.statusCode.summary'),
          sections: [
            {
              heading: t('panel.inspector.headers.generalInfo.statusCode.ranges'),
              items: [
                { label: '1xx', desc: t('panel.inspector.headers.generalInfo.statusCode.r1xx') },
                { label: '2xx', desc: t('panel.inspector.headers.generalInfo.statusCode.r2xx') },
                { label: '3xx', desc: t('panel.inspector.headers.generalInfo.statusCode.r3xx') },
                { label: '4xx', desc: t('panel.inspector.headers.generalInfo.statusCode.r4xx') },
                { label: '5xx', desc: t('panel.inspector.headers.generalInfo.statusCode.r5xx') },
              ],
            },
          ],
        },
      };
    }
    case 'remote-address': {
      const label = t('panel.inspector.headers.general.remoteAddress');
      return {
        label,
        content: {
          title: label,
          kicker,
          summary: t('panel.inspector.headers.generalInfo.remoteAddress.summary'),
          description: t('panel.inspector.headers.generalInfo.remoteAddress.description'),
        },
      };
    }
    case 'http-version': {
      const label = t('panel.inspector.headers.general.httpVersion');
      return {
        label,
        content: {
          title: label,
          kicker,
          summary: t('panel.inspector.headers.generalInfo.httpVersion.summary'),
          description: t('panel.inspector.headers.generalInfo.httpVersion.description'),
          sections: [
            {
              heading: t('shared.info.header.section.commonValues'),
              items: [
                { label: 'HTTP/1.1', desc: t('panel.inspector.headers.generalInfo.httpVersion.http11') },
                { label: 'HTTP/2', desc: t('panel.inspector.headers.generalInfo.httpVersion.http2') },
                { label: 'HTTP/3', desc: t('panel.inspector.headers.generalInfo.httpVersion.http3') },
              ],
            },
          ],
        },
      };
    }
    case 'compression': {
      const label = t('panel.inspector.headers.general.compression');
      return {
        label,
        content: {
          title: label,
          kicker,
          summary: t('panel.inspector.headers.generalInfo.compression.summary'),
          sections: [
            {
              heading: t('shared.info.header.section.commonValues'),
              items: [
                { label: 'gzip', desc: t('panel.inspector.headers.generalInfo.compression.gzip') },
                { label: 'br', desc: t('panel.inspector.headers.generalInfo.compression.br') },
                { label: 'zstd', desc: t('panel.inspector.headers.generalInfo.compression.zstd') },
                { label: 'deflate', desc: t('panel.inspector.headers.generalInfo.compression.deflate') },
              ],
            },
          ],
        },
      };
    }
    case 'transferred': {
      const label = t('panel.inspector.headers.general.transferred');
      return {
        label,
        content: {
          title: label,
          kicker,
          summary: t('panel.inspector.headers.generalInfo.transferred.summary'),
          description: t('panel.inspector.headers.generalInfo.transferred.description'),
        },
      };
    }
    case 'referrer-policy': {
      const label = t('panel.inspector.headers.general.referrerPolicy');
      return {
        label,
        content: {
          title: label,
          kicker,
          summary: t('panel.inspector.headers.generalInfo.referrerPolicy.summary'),
          description: t('panel.inspector.headers.generalInfo.referrerPolicy.description'),
        },
      };
    }
  }
}

export function GeneralRow({
  infoKey,
  children,
}: {
  infoKey: GeneralInfoKey;
  children: React.ReactNode;
}) {
  const t = useT();
  const { label, content } = useMemo(() => generalInfo(t, infoKey), [t, infoKey]);
  return (
    <div className="dt-kv">
      <span className="dt-kv-key">
        <InfoTrigger content={content} className="dt-header-info-trigger" />
        {label}:
      </span>
      {children}
    </div>
  );
}
