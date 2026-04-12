/**
 * TestSessionModal — URL + wait-seconds prompt that launches a test session
 * against a scope (single rule, folder, or collection) and tracks it through
 * to completion.
 *
 * Flow:
 *   1. User opens the modal with a scope + rule uids snapshot.
 *   2. Inputs a URL and picks wait duration (3/5/10s).
 *   3. Clicks Test — sends `startTestSession` to the background.
 *   4. Modal shows "running" state with a count of fires so far.
 *   5. On resolution, shows "View results" which opens the workspace tab
 *      at `workspace.html#/test/<sessionId>`.
 *
 * If the user closes the popup mid-test, the background keeps running and
 * persists the result under `v5TestSessions` so the workspace can fetch it
 * later via `listTestSessions`.
 */

import { CheckCircleTwoTone, PlayCircleOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { runtime } from '@utils/browser-api';
import { Button, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getBrowserAPI } from '@/types/browser';

const { Text } = Typography;

export type TestScope = 'single' | 'folder' | 'collection';

interface TestResultSummary {
  id: string;
  ruleStatuses: Record<string, 'executed' | 'no-fire' | 'skipped'>;
  fires: Array<{ ruleUid: string }>;
}

interface TestSessionModalProps {
  open: boolean;
  onClose: () => void;
  /** What we're testing — label shown in the modal header. */
  scopeLabel: string;
  /** Scope kind for backend routing. */
  scope: TestScope;
  /** Rule uids under test (snapshot taken when modal opened). */
  ruleUids: string[];
  /** Optional default URL — e.g., the last URL used, or the tab url. */
  defaultUrl?: string;
  /** All V5 rules — used to show rule names in the running counter. */
  allRules: V5.Rule[];
}

type Phase = 'idle' | 'running' | 'done' | 'error';

const WAIT_OPTIONS = [
  { value: 3, label: '3s — quick' },
  { value: 5, label: '5s — default' },
  { value: 10, label: '10s — thorough' },
];

const TestSessionModal: React.FC<TestSessionModalProps> = ({
  open,
  onClose,
  scopeLabel,
  scope,
  ruleUids,
  defaultUrl,
  allRules,
}) => {
  const [url, setUrl] = useState(defaultUrl ?? '');
  const [waitSeconds, setWaitSeconds] = useState(5);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<TestResultSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl(defaultUrl ?? '');
      setPhase('idle');
      setResult(null);
      setError(null);
    }
  }, [open, defaultUrl]);

  const launch = useCallback(() => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('That URL doesn\u2019t look valid');
      return;
    }
    setError(null);
    setPhase('running');

    runtime.sendMessage(
      {
        type: 'startTestSession',
        scope,
        ruleUids,
        url,
        waitSeconds,
      },
      (response: unknown) => {
        const data = response as { success?: boolean; result?: TestResultSummary; error?: string } | null;
        if (data?.success && data.result) {
          setResult(data.result);
          setPhase('done');
        } else {
          setError(data?.error ?? 'Test failed');
          setPhase('error');
        }
      },
    );
  }, [url, scope, ruleUids, waitSeconds]);

  const openResults = useCallback(() => {
    if (!result) return;
    const api = getBrowserAPI();
    const resultUrl = api.runtime.getURL(`workspace.html#/test/${result.id}`);
    api.tabs.create({ url: resultUrl });
    onClose();
  }, [result, onClose]);

  const firedCount = result ? Object.values(result.ruleStatuses).filter((s) => s === 'executed').length : 0;
  const noFireCount = result ? Object.values(result.ruleStatuses).filter((s) => s === 'no-fire').length : 0;

  const title =
    phase === 'running'
      ? `Testing ${scopeLabel}…`
      : phase === 'done'
        ? 'Test complete'
        : `Test ${scopeLabel}`;

  return (
    <Modal
      open={open}
      onCancel={phase === 'running' ? undefined : onClose}
      title={title}
      footer={null}
      closable={phase !== 'running'}
      maskClosable={phase !== 'running'}
      width={440}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Opens a new tab, captures every rule fire for the wait window, then closes.
            <br />
            {ruleUids.length} rule{ruleUids.length !== 1 ? 's' : ''} in scope
            {allRules.length > 0 && ruleUids.length > 0 && (
              <>
                {' · '}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  snapshot taken now
                </Text>
              </>
            )}
          </Text>
        </div>

        {phase === 'idle' || phase === 'error' ? (
          <>
            <div>
              <Text style={{ fontSize: 12 }}>URL to test</Text>
              <Input
                placeholder="https://openheaders.io"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPressEnter={launch}
                autoFocus
                size="middle"
              />
            </div>
            <div>
              <Text style={{ fontSize: 12 }}>Capture window</Text>
              <Select
                value={waitSeconds}
                onChange={setWaitSeconds}
                options={WAIT_OPTIONS}
                style={{ width: '100%' }}
                size="middle"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                How long to capture network activity after the page loads.
              </Text>
            </div>
            {error && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {error}
              </Text>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={onClose}>Cancel</Button>
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={launch}>
                Run test
              </Button>
            </div>
          </>
        ) : phase === 'running' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Opened {url}
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12 }}>Capturing for {waitSeconds}s — please keep the popup open…</Text>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 18 }} />
              <Text strong>Completed</Text>
            </div>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Space>
                <Tag color="success">{firedCount} executed</Tag>
                <Tag>{noFireCount} no fire</Tag>
                <Tag color="default">{result?.fires.length ?? 0} fires</Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Open the workspace for the full drill-down: matched URLs, header diffs, shadowed rules, replay.
              </Text>
            </Space>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button onClick={onClose}>Close</Button>
              <Button type="primary" onClick={openResults}>
                View results
              </Button>
            </div>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default TestSessionModal;
