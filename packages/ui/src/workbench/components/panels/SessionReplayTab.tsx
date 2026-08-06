/**
 * SessionReplayTab — an archived traffic session opened as a main
 * editor tab (mode `session-replay`, AGENT_TRAFFIC_PLAN.md §11.1 C6):
 * the SAME network view the Traffic Monitor drives live, fed by the
 * sessions archive's replay lifeline (`oh-replay:<archiveId>`) instead
 * of a live wire. Parity is by construction — the sealed event log IS
 * the reducer input the live pass folded, and bodies resolve from the
 * archive's blob store on the panel's ordinary lazy pull.
 *
 * The archive is immutable through this path: closing the tab tears
 * down the lifeline and nothing else. A session that cannot be opened
 * (missing key, corrupt artifact) surfaces the honest
 * `replay-unavailable` banner instead of an empty list.
 */

import { replayLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { NetworkCaptureView } from '../../../panel/components/NetworkCaptureView';
import type { InspectorRowWithFires } from '../../../panel/data/inspector-row-projection';
import { extractName } from '../../../panel/components/traffic/formatters';

export interface SessionReplayTabProps {
  /** Archive-wide session identity — the directory basename. */
  sessionId: string;
  /** The lifecycle partition the recorded envelopes address. */
  partitionTabId: number;
  onInspectRequest: (requestId: string, label: string) => void;
}

const SessionReplayTab: React.FC<SessionReplayTabProps> = ({ sessionId, partitionTabId, onInspectRequest }) => {
  const t = useT();
  const portName = useMemo(() => () => replayLifecyclePortName(sessionId), [sessionId]);
  const inspectRequest = useCallback(
    (row: InspectorRowWithFires) => {
      const { name } = extractName(row.lifecycle.url);
      onInspectRequest(row.lifecycle.requestId, `${row.lifecycle.method} ${name}`);
    },
    [onInspectRequest],
  );
  const watchRefusedCopy = useMemo(
    () => ({ title: t('workbench.sessionReplay.unavailableTitle'), body: t('workbench.sessionReplay.unavailableBody') }),
    [t],
  );
  return (
    <div style={{ height: '100%', minHeight: 0 }} data-testid="session-replay-tab">
      <NetworkCaptureView
        tabId={partitionTabId}
        portName={portName}
        onInspectRequest={inspectRequest}
        watchRefusedCopy={watchRefusedCopy}
        emptyHero={
          <div className="dt-empty-hero">
            <strong>{t('workbench.sessionReplay.empty')}</strong>
            <span className="dt-empty-hero-sub">{t('workbench.sessionReplay.emptyHint')}</span>
          </div>
        }
      />
    </div>
  );
};

export default SessionReplayTab;
