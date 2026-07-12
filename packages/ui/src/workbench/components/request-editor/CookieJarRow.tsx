/**
 * CookieJarRow — the quiet inspection line under the "Use cookie jar"
 * knob: how many cookies the workspace's in-memory jar holds right now,
 * a popover listing them, and a Clear action so starting clean doesn't
 * take an app restart.
 *
 * The jar lives host-side with the node transport, so both the read and
 * the clear ride bridge RPCs (`getCookieJarSummary` / `clearCookieJar`).
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
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const { Text } = Typography;

/** One popover row per cookie: where the entry matches and when it goes. */
function describeEntry(entry: CookieJarEntryWire): string {
  const scope = entry.hostOnly ? entry.domain : `.${entry.domain}`;
  const expiry = entry.expiresAt !== undefined ? `expires ${new Date(entry.expiresAt).toLocaleString()}` : 'session';
  return `${scope}${entry.path} · ${expiry}${entry.secure ? ' · https only' : ''}`;
}

const CookieJarRow: React.FC = () => {
  // `null` = summary unavailable (host answered nothing yet, or the
  // channel is unsupported here) — the row renders nothing.
  const [cookies, setCookies] = useState<CookieJarEntryWire[] | null>(null);

  const refresh = useCallback(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    bridge
      .call('getCookieJarSummary', {})
      .then((res) => setCookies(res.cookies))
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

  if (cookies === null) return null;

  const count = cookies.length;
  const label = count === 1 ? '1 cookie in this workspace’s jar' : `${count} cookies in this workspace’s jar`;
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
          title: 'Cookie jar contents',
          summary:
            'Cookies currently held by this workspace’s in-memory jar — stored by jar-enabled sends, attached to jar-enabled sends that match, and gone when the app quits. Values are session credentials and stay inside the app’s network runtime; only name, scope, and expiry are shown.',
          ...(count > 0
            ? {
                sections: [
                  {
                    heading: 'Stored cookies',
                    layout: 'stacked' as const,
                    items: cookies.map((entry) => ({
                      label: entry.name,
                      desc: describeEntry(entry),
                    })),
                  },
                ],
              }
            : {}),
        }}
      />
      <span style={{ flex: 1 }} />
      <Button size="small" type="text" disabled={count === 0} onClick={clear} style={{ fontSize: 11 }}>
        Clear
      </Button>
    </div>
  );
};

export default CookieJarRow;
