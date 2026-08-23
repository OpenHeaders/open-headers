/**
 * Rendered INSTEAD of booting when the tab is not a secure context —
 * a plain-http origin that isn't loopback.
 *
 * The cause is worth stating precisely, because the obvious guess is
 * wrong: this tab is not a thin client of the server. It runs the same
 * engine the desktop app and the extension run, against an origin-scoped
 * replica, and joins the serving daemon as a sync peer — so it must mint
 * an identity for this device (`crypto.randomUUID` + a `crypto.subtle`
 * digest, see `ensureSyntheticIdentity`), and browsers withhold both on
 * insecure origins. Nothing about storing data drives this.
 *
 * Every way out is spelled with the reader's ACTUAL address — the port
 * they are on, the host they typed — because a placeholder is one more
 * thing to work out on a page that already stopped them. The one value
 * this page cannot know is the domain a TLS proxy would answer as; the
 * docs link carries that. Link text IS the URL: a reader may only be
 * able to retype it on another machine.
 */

import { bootTranslator } from '@/boot-locale';

const DOCS_LAN_VS_TLS = 'docs.openheaders.com/server/lan-vs-tls';
const DOCS_QUICKSTART = 'docs.openheaders.com/quickstart/server';

const WRAP_STYLE: React.CSSProperties = {
  maxWidth: 460,
  margin: '18vh auto 0',
  padding: '32px 36px',
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.6,
};

const DocsLink: React.FC<{ path: string }> = ({ path }) => (
  <>
    {' → '}
    <a href={`https://${path}`} target="_blank" rel="noreferrer" style={{ whiteSpace: 'nowrap' }}>
      {path}
    </a>
  </>
);

export function InsecureContextNotice(): React.JSX.Element {
  const t = bootTranslator();
  // The server answers on the port this tab reached it at, so the
  // loopback way in is that same port on 127.0.0.1; the native clients
  // dial the exact host:port already in the address bar.
  const port = window.location.port === '' ? '' : `:${window.location.port}`;
  return (
    <div style={WRAP_STYLE} data-testid="insecure-context-notice">
      <h3 style={{ marginTop: 0 }}>{t('web.insecure.title')}</h3>
      <p>{t('web.insecure.intro')}</p>
      <ul>
        <li>
          {t('web.insecure.optionLocal')} <code>{`http://127.0.0.1${port}/`}</code>
        </li>
        <li>
          {t('web.insecure.optionTls')}
          <DocsLink path={DOCS_LAN_VS_TLS} />
        </li>
        <li>
          {t('web.insecure.optionClients')} <code>{`ws://${window.location.host}`}</code>
          <DocsLink path={DOCS_QUICKSTART} />
        </li>
      </ul>
    </div>
  );
}
