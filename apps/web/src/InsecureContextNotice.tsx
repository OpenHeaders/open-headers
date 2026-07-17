/**
 * Rendered INSTEAD of booting when the tab is not a secure context —
 * a plain-http origin that isn't loopback. The web platform withholds
 * `crypto.subtle` / `crypto.randomUUID` there, so the tab oracle
 * cannot mint its identity or derive UUIDs; rather than dying on a
 * blank page, explain the two supported ways in.
 */

import { bootTranslator } from '@/boot-locale';

const WRAP_STYLE: React.CSSProperties = {
  maxWidth: 460,
  margin: '18vh auto 0',
  padding: '32px 36px',
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.6,
};

export function InsecureContextNotice(): React.JSX.Element {
  const t = bootTranslator();
  return (
    <div style={WRAP_STYLE} data-testid="insecure-context-notice">
      <h3 style={{ marginTop: 0 }}>{t('web.insecure.title')}</h3>
      <p>{t('web.insecure.intro')}</p>
      <p>{t('web.insecure.waysIn')}</p>
      <ul>
        <li>
          {t('web.insecure.httpsPrefix')} <code>https://&lt;your-host&gt;/</code>
          {t('web.insecure.httpsSuffix')}
        </li>
        <li>
          {t('web.insecure.loopbackPrefix')} <code>http://127.0.0.1:&lt;port&gt;/</code>
          {t('web.insecure.loopbackSuffix')}
        </li>
      </ul>
    </div>
  );
}
