/**
 * ForcePushBanner — the §16 incident face, shared by the Git and
 * Commit tool windows: a detected remote history rewrite is an EVENT
 * the status frame carries (`forcePush`), and pull, push and merge
 * stay refused until the trichotomy resolves it — Abandon (converge
 * onto the rewrite; danger-confirmed), Preserve on a rescue branch
 * (`oh-rescue-<ts>`, never a history edit), Re-apply on top (local
 * work re-lands as a fresh commit). The verb answers on the chain and
 * publishes the frame that drops the banner; the resolution toast
 * rides the app message channel.
 */

import { hostBridge, type WorkspaceTreeForcePushStateWire } from '@openheaders/core/bridge';
import { Alert, App as AntApp, Button, Popconfirm, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { committedLocalNotice, refusalDetail } from './kept-local';

type ForcePushChoice = 'abandon' | 'rescue' | 'reapply';

export interface ForcePushBannerProps {
  workspaceId: string;
  state: WorkspaceTreeForcePushStateWire;
  /** `git-tool` / `commit-tool` — the host window's id prefix. */
  testidPrefix: string;
}

const ForcePushBanner: React.FC<ForcePushBannerProps> = ({ workspaceId, state, testidPrefix }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [resolving, setResolving] = useState<ForcePushChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = async (choice: ForcePushChoice): Promise<void> => {
    setResolving(choice);
    setError(null);
    try {
      const result = await hostBridge.call('oh.workspaceTree.resolveForcePush', { workspaceId, choice });
      if (result.ok) {
        message.success(
          result.rescueBranch !== null
            ? t('workbench.gitLog.forcePush.rescued', { branch: result.rescueBranch })
            : t('workbench.gitLog.forcePush.resolved', { sha: result.sha.slice(0, 8) }),
        );
        const first = committedLocalNotice(result.committedLocal, t);
        if (first !== null) message.info(first, 8);
      } else {
        setError(t('workbench.gitLog.forcePush.failed', { detail: refusalDetail(result, t) }));
      }
    } catch (err) {
      setError(t('workbench.gitLog.forcePush.failed', { detail: (err as Error).message }));
    } finally {
      setResolving(null);
    }
  };

  const choiceButton = (choice: ForcePushChoice, label: string): React.ReactNode => (
    <Button
      size="small"
      danger={choice === 'abandon'}
      loading={resolving === choice}
      disabled={resolving !== null && resolving !== choice}
      {...(choice === 'abandon' ? {} : { onClick: () => void resolve(choice) })}
      data-testid={`${testidPrefix}-force-push-${choice}`}
    >
      {label}
    </Button>
  );

  return (
    <Alert
      type="error"
      showIcon
      style={{ borderRadius: 0 }}
      title={<span style={{ fontSize: 12 }}>{t('workbench.gitLog.forcePush.title')}</span>}
      description={
        <div style={{ fontSize: 11.5 }}>
          <p style={{ margin: '0 0 8px' }}>
            {t('workbench.gitLog.forcePush.body', { sha: state.lastSyncedSha.slice(0, 8) })}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Popconfirm
              title={t('workbench.gitLog.forcePush.abandonConfirm.title')}
              description={t('workbench.gitLog.forcePush.abandonConfirm.body')}
              okText={t('workbench.gitLog.forcePush.abandonConfirm.ok')}
              okButtonProps={{ danger: true }}
              onConfirm={() => void resolve('abandon')}
            >
              {choiceButton('abandon', t('workbench.gitLog.forcePush.abandon'))}
            </Popconfirm>
            {choiceButton('rescue', t('workbench.gitLog.forcePush.rescue'))}
            {choiceButton('reapply', t('workbench.gitLog.forcePush.reapply'))}
          </div>
          {error !== null && (
            <div style={{ marginTop: 6, color: token.colorError }} data-testid={`${testidPrefix}-force-push-error`}>
              {error}
            </div>
          )}
        </div>
      }
      data-testid={`${testidPrefix}-force-push`}
    />
  );
};

export default ForcePushBanner;
