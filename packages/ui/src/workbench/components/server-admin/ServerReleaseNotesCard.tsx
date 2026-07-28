/**
 * ServerReleaseNotesCard — the admin console's release-notes section:
 * the server build's own `changelog/daemon` entry, embedded at build
 * and answered over `oh.daemon.changelog.get`, so the browser renders
 * it without ever dialing the feed (CHANGELOG_PLAN.md §4.3). Null
 * notes — an entry-less build (entry-existence law), a host that
 * embeds none (the desktop), or a failed call — render nothing.
 * Images demote to links: a render must not fetch, and offline they
 * stay honest click-to-open pointers.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { Typography, theme } from 'antd';
import { useEffect, useState } from 'react';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { demoteImagesToLinks } from '../../../shared/markdown/demote-images';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';

const ServerReleaseNotesCard: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const [entry, setEntry] = useState<{ version: string | null; notes: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hostBridge
      .call('oh.daemon.changelog.get')
      .then((resp) => {
        if (!cancelled && resp.notes !== null) setEntry({ version: resp.version, notes: resp.notes });
      })
      .catch(() => {
        // Enhancement-only: no card, no error surface.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entry === null) return null;

  return (
    <section style={{ marginBottom: 12 }} data-testid="server-admin-release-notes">
      <header style={{ marginBottom: 6, padding: '0 2px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: token.colorTextSecondary,
          }}
        >
          {t('workbench.serverAdmin.notes.sectionTitle')}
        </h3>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
          {t('workbench.serverAdmin.notes.sectionHint')}
        </div>
      </header>
      <div
        className="settings-card"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        {entry.version !== null && (
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('workbench.serverAdmin.notes.versionLine', { version: entry.version })}
          </Typography.Text>
        )}
        <MarkdownView>{demoteImagesToLinks(entry.notes)}</MarkdownView>
      </div>
    </section>
  );
};

export default ServerReleaseNotesCard;
