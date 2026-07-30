/**
 * CookieJarRow — the quiet inspection line under the "Use cookie jar"
 * knob: how many cookies the workspace's in-memory jar holds right now,
 * a popover listing them (each row with a hover-revealed ✕ to drop just
 * that entry), and a Clear action so starting clean doesn't take an app
 * restart.
 *
 * The jar lives host-side with the node transport, so the read and both
 * management actions ride bridge RPCs (`getCookieJarSummary` /
 * `clearCookieJar` / `deleteCookieJarEntry`).
 * A host that doesn't answer them — no bridge installed, or a surface
 * whose node runtime hasn't wired the channel — rejects, and the row
 * hides itself instead of showing a control that can only fail.
 *
 * The summary is value-free by construction: cookie VALUES are session
 * credentials and never leave the transport. The popover shows only the
 * matching metadata (name, domain, path, expiry) a user needs to
 * recognize an entry.
 */

import { type CookieJarEntryWire, getHostBridge } from '@openheaders/core/bridge';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const { Text } = Typography;

/** One popover row per cookie: where the entry matches and when it goes.
 *  Timestamps keep `toLocaleString()` (browser-default locale) — same
 *  deferral as the settings ledger, revisit in Phase I. */
function describeEntry(entry: CookieJarEntryWire, t: Translate): string {
  const scope = entry.hostOnly ? entry.domain : `.${entry.domain}`;
  const expiry =
    entry.expiresAt !== undefined
      ? t('workbench.editors.request.settings.jar.expires', { date: new Date(entry.expiresAt).toLocaleString() })
      : t('workbench.editors.request.settings.jar.session');
  const httpsOnly = entry.secure ? ` · ${t('workbench.editors.request.settings.jar.httpsOnly')}` : '';
  return `${scope}${entry.path} · ${expiry}${httpsOnly}`;
}

const CookieJarRow: React.FC = () => {
  const t = useT();
  // `null` = summary unavailable (host answered nothing yet, or the
  // channel is unsupported here) — the row renders nothing.
  const [cookies, setCookies] = useState<CookieJarEntryWire[] | null>(null);

  const refresh = useCallback(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    bridge
      .call('getCookieJarSummary', {})
      .then((res) => setCookies(Array.isArray(res?.cookies) ? res.cookies : null))
      .catch(() => setCookies(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = useCallback(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    bridge
      .call('clearCookieJar', {})
      .then(() => setCookies([]))
      .catch(() => refresh());
  }, [refresh]);

  const deleteEntry = useCallback(
    (entry: CookieJarEntryWire) => {
      const bridge = getHostBridge();
      if (!bridge) return;
      bridge
        .call('deleteCookieJarEntry', { name: entry.name, domain: entry.domain, path: entry.path })
        .then(() => refresh())
        .catch(() => refresh());
    },
    [refresh],
  );

  if (cookies === null) return null;

  const count = cookies.length;
  const label = t('workbench.editors.request.settings.jar.count', { count });
  return (
    <div
      data-testid="oh-cookie-jar-row"
      style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 22, paddingLeft: 12 }}
    >
      <Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
      <InfoTrigger
        content={{
          title: t('workbench.editors.request.settings.jar.infoTitle'),
          summary: t('workbench.editors.request.settings.jar.infoSummary'),
          ...(count > 0
            ? {
                sections: [
                  {
                    heading: t('workbench.editors.request.settings.jar.storedHeading'),
                    layout: 'stacked' as const,
                    items: cookies.map((entry) => ({
                      key: `${entry.name}|${entry.domain}|${entry.path}`,
                      label: entry.name,
                      desc: describeEntry(entry, t),
                      action: {
                        label: t('workbench.editors.request.settings.jar.delete', { name: entry.name }),
                        onClick: () => deleteEntry(entry),
                      },
                    })),
                  },
                ],
              }
            : {}),
        }}
      />
      <span style={{ flex: 1 }} />
      <Button size="small" type="text" disabled={count === 0} onClick={clear} style={{ fontSize: 11 }}>
        {t('workbench.editors.request.settings.jar.clear')}
      </Button>
    </div>
  );
};

export default CookieJarRow;
