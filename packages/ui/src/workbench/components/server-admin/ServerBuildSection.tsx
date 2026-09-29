/**
 * ServerBuildSection — the admin console's Server domain: the switch
 * for requests from connected devices, then the build this console
 * administers, then its release notes.
 *
 * The switch is the egress opt-in's remote tier (`oh.daemon.peerExecute.*`):
 * whether devices on other machines may run their requests on this
 * server — on by default on a standalone server, the operator's
 * kill-switch. It renders on every host but the desktop app, whose
 * own Settings rows (Backup and Sync › Your devices) are that door and
 * whose default is off; two rows over one record on one host would
 * disagree in their defaults' words.
 *
 * Build and notes ride one call, `oh.daemon.changelog.get`: every host
 * answers its own running version, so the version line renders
 * unconditionally; the notes are the server build's own
 * `changelog/daemon` entry, embedded at build (the changelog plan
 * §4.3), so the browser renders them without ever dialing the feed.
 * Null notes — an entry-less build (entry-existence law), a host that
 * embeds none (the desktop), or a failed call — render an honest empty
 * state, never a blank tab. Images demote to links: a render must not
 * fetch, and offline they stay honest click-to-open pointers.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { App as AntApp, Empty, Spin, Switch, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { demoteImagesToLinks } from '../../../shared/markdown/demote-images';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';
import { SectionHeader } from './section-chrome';

interface BuildEntry {
  readonly version: string | null;
  readonly notes: string | null;
}

const UNANSWERED: BuildEntry = { version: null, notes: null };

const cardStyle = (token: ReturnType<typeof theme.useToken>['token']): React.CSSProperties => ({
  background: token.colorBgContainer,
  border: `1px solid ${token.colorBorderSecondary}`,
  borderRadius: 10,
  padding: 12,
});

/** The requests-from-devices switch — reads the effective value on
 *  mount, writes the record on a flip, re-reads after either outcome
 *  so the row never shows a value the server did not confirm. */
const PeerRequestsCard: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [remote, setRemote] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async (): Promise<void> => {
    try {
      const resp = await hostBridge.call('oh.daemon.peerExecute.get');
      setRemote(resp.remote);
    } catch {
      setRemote(null);
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  const flip = async (next: boolean): Promise<void> => {
    setBusy(true);
    try {
      const resp = await hostBridge.call('oh.daemon.peerExecute.set', { remote: next });
      if (!resp.ok) throw new Error(resp.error);
      message.success(
        next ? t('workbench.serverAdmin.requests.enabledDone') : t('workbench.serverAdmin.requests.disabledDone'),
      );
    } catch (err) {
      message.error(t('workbench.serverAdmin.requests.updateFailed', { message: (err as Error).message }));
    } finally {
      await read();
      setBusy(false);
    }
  };

  return (
    <section style={{ marginBottom: 12 }} data-testid="server-admin-requests">
      <SectionHeader
        title={t('workbench.serverAdmin.requests.sectionTitle')}
        hint={t('workbench.serverAdmin.requests.sectionHint')}
      />
      <div className="settings-card" style={cardStyle(token)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>
              {t('workbench.serverAdmin.requests.allowLabel')}
            </Typography.Text>
            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
              {t('workbench.serverAdmin.requests.allowDescription')}
            </div>
          </div>
          <Switch
            size="small"
            checked={remote === true}
            disabled={remote === null || busy}
            loading={busy}
            onChange={(next) => void flip(next)}
            aria-label={t('workbench.serverAdmin.requests.allowLabel')}
            data-testid="server-admin-requests-switch"
          />
        </div>
      </div>
    </section>
  );
};

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

  return (
    <>
      {getCurrentHost() !== 'desktop' && <PeerRequestsCard />}
      <section style={{ marginBottom: 12 }} data-testid="server-admin-build">
        <SectionHeader
          title={t('workbench.serverAdmin.build.sectionTitle')}
          hint={t('workbench.serverAdmin.build.sectionHint')}
        />
        <div className="settings-card" style={cardStyle(token)}>
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
        <div className="settings-card" style={cardStyle(token)}>
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
