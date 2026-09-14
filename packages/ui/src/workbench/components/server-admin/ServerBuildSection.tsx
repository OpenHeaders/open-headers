/**
 * ServerBuildSection — the admin console's Server domain: the build
 * this console administers, then its release notes. Both ride one
 * call, `oh.daemon.changelog.get`: every host answers its own running
 * version, so the version line renders unconditionally; the notes are
 * the server build's own `changelog/daemon` entry, embedded at build
 * (the changelog plan §4.3), so the browser renders them without ever
 * dialing the feed. Null notes — an entry-less build (entry-existence
 * law), a host that embeds none (the desktop), or a failed call —
 * render an honest empty state, never a blank tab. Images demote to
 * links: a render must not fetch, and offline they stay honest
 * click-to-open pointers.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { Empty, Spin, Typography, theme } from 'antd';
import { useEffect, useState } from 'react';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { demoteImagesToLinks } from '../../../shared/markdown/demote-images';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';
import { SectionHeader } from './section-chrome';

interface BuildEntry {
  readonly version: string | null;
  readonly notes: string | null;
}

const UNANSWERED: BuildEntry = { version: null, notes: null };

const ServerBuildSection: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const [entry, setEntry] = useState<BuildEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hostBridge
      .call('oh.daemon.changelog.get')
      .then((resp) => {
        if (!cancelled) setEntry({ version: resp.version, notes: resp.notes });
      })
      .catch(() => {
        if (!cancelled) setEntry(UNANSWERED);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entry === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 10,
    padding: 12,
  };

  return (
    <>
      <section style={{ marginBottom: 12 }} data-testid="server-admin-build">
        <SectionHeader
          title={t('workbench.serverAdmin.build.sectionTitle')}
          hint={t('workbench.serverAdmin.build.sectionHint')}
        />
        <div className="settings-card" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 11.5, color: token.colorTextSecondary, minWidth: 80 }}>
              {t('workbench.serverAdmin.build.versionLabel')}
            </span>
            <Typography.Text strong data-testid="server-admin-build-version">
              {entry.version ?? t('workbench.serverAdmin.build.versionUnknown')}
            </Typography.Text>
          </div>
        </div>
      </section>
      <section style={{ marginBottom: 12 }} data-testid="server-admin-release-notes">
        <SectionHeader
          title={t('workbench.serverAdmin.notes.sectionTitle')}
          hint={t('workbench.serverAdmin.notes.sectionHint')}
        />
        <div className="settings-card" style={cardStyle}>
          {entry.notes === null ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('workbench.serverAdmin.notes.empty')}
              style={{ margin: '8px 0' }}
            />
          ) : (
            <MarkdownView>{demoteImagesToLinks(entry.notes)}</MarkdownView>
          )}
        </div>
      </section>
    </>
  );
};

export default ServerBuildSection;
