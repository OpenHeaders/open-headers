/**
 * TestRunModal — URL + wait-seconds prompt that launches a test run
 * against a scope (single rule, folder, collection, or the whole
 * workspace). The modal is a pure launcher: it sends `startTestRun` and
 * closes immediately. All running UI lives in the in-page widget that
 * the background mounts on the test tab, so the popup is free to close
 * (which Chrome does on blur anyway).
 */

import { PlayCircleOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { parseTestTargetUrl } from '@openheaders/core/utils';
import { runtime } from '@utils/browser-api';
import { App, AutoComplete, Button, Input, Modal, Space, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const { Text } = Typography;

export type TestRunOwnerType = 'rule' | 'folder' | 'collection' | 'workspace';

interface TestRunModalProps {
  open: boolean;
  onClose: () => void;
  /** What we're testing — label shown in the modal header and the in-page widget. */
  scopeLabel: string;
  /** Owner type — keys storage so results live under the right entity. */
  ownerType: TestRunOwnerType;
  /** Owner id — uid of the rule, folder, or collection the test belongs to. */
  ownerId: string;
  /** Rule uids under test (snapshot taken when modal opened). */
  ruleUids: string[];
  /** Optional default URL — e.g., the last URL used, or the tab url. */
  defaultUrl?: string;
  /** All V5 rules — kept in props for symmetry with other launchers. */
  allRules: V5.Rule[];
}

/**
 * Capture-window bounds. The lower bound is 1s because anything shorter
 * is below the round-trip latency of a typical request and would give
 * misleading "no fire" results. The upper bound is 5 minutes — beyond
 * that the test loses most of its point (you may as well just use the
 * extension live), and the background hard-ceiling watchdog sits a
 * fixed slack above this so a 5-minute capture won't get truncated.
 */
const MIN_WAIT_SECONDS = 1;
const MAX_WAIT_SECONDS = 300;
const DEFAULT_WAIT_SECONDS = 5;

/**
 * Preset capture-window options shown in the AutoComplete dropdown.
 * Free typing is also allowed (1–300s); these are just shortcuts for
 * the common cases. Labels are human-friendly — durations under a
 * minute use seconds, durations of a minute or more use minutes — so
 * the user doesn't have to do the arithmetic to know what 300s means.
 */
const WAIT_PRESETS = [
  { value: '3', label: '3s — quick smoke test' },
  { value: '5', label: '5s — default' },
  { value: '10', label: '10s — thorough' },
  { value: '30', label: '30s — slow page or many sub-resources' },
  { value: '60', label: '1 min — long-running XHR / SPA boot' },
  { value: '120', label: '2 min' },
  { value: '300', label: '5 min — maximum' },
];

const TestRunModal: React.FC<TestRunModalProps> = ({
  open,
  onClose,
  scopeLabel,
  ownerType,
  ownerId,
  ruleUids,
  defaultUrl,
}) => {
  const { message } = App.useApp();
  const [url, setUrl] = useState(defaultUrl ?? '');
  // Raw input value backing the AutoComplete. Stored as a string so the
  // user can type freely (including transient empty / partial states)
  // without us coercing on every keystroke. Parsed + clamped at launch
  // time. Re-seeded with the default whenever the modal opens.
  const [waitInput, setWaitInput] = useState(String(DEFAULT_WAIT_SECONDS));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl(defaultUrl ?? '');
      setWaitInput(String(DEFAULT_WAIT_SECONDS));
      setError(null);
    }
  }, [open, defaultUrl]);

  const launch = useCallback(() => {
    // Single source of truth for URL trim / scheme-prepend / parse /
    // protocol-check, shared with the background test-runner so a
    // caller bypassing the popup can't sneak an invalid URL through.
    const urlResult = parseTestTargetUrl(url);
    if (!urlResult.ok) {
      setError(urlResult.error);
      return;
    }
    const targetUrl = urlResult.url;

    // Parse + validate the capture window. We accept any integer in
    // [MIN_WAIT_SECONDS, MAX_WAIT_SECONDS]; anything else is rejected
    // with an explicit error rather than silently clamped — silent
    // clamping at launch time would surprise the user.
    const waitNumber = Number(waitInput.trim());
    if (!Number.isFinite(waitNumber) || !Number.isInteger(waitNumber)) {
      setError(`Capture window must be a whole number of seconds (${MIN_WAIT_SECONDS}–${MAX_WAIT_SECONDS})`);
      return;
    }
    if (waitNumber < MIN_WAIT_SECONDS || waitNumber > MAX_WAIT_SECONDS) {
      setError(`Capture window must be between ${MIN_WAIT_SECONDS}s and ${MAX_WAIT_SECONDS}s`);
      return;
    }

    setError(null);

    // Fire-and-forget: the response callback won't fire if Chrome closes the
    // popup before the capture window ends, but the background still runs the
    // test and persists the result. The in-page widget on the test tab is
    // the primary feedback surface.
    runtime.sendMessage({
      type: 'startTestRun',
      ownerType,
      ownerId,
      scopeLabel,
      ruleUids,
      // Send the scheme-qualified URL so the background's `tabs.update`
      // gets a value Chrome will navigate to verbatim. Bare hosts like
      // `127.0.0.1:3000` would otherwise be interpreted as a file path.
      url: targetUrl,
      waitSeconds: waitNumber,
    });

    message.success({
      content: 'Test running — see the floating panel on the new tab',
      duration: 3,
    });
    onClose();
  }, [url, ownerType, ownerId, scopeLabel, ruleUids, waitInput, onClose, message]);

  return (
    <Modal open={open} onCancel={onClose} title={`Test ${scopeLabel}`} footer={null} width={440}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Opens the URL in a new tab, isolates the test scope, and shows a floating panel with live fire counts and a
            link to the full report.
            <br />
            {ruleUids.length} rule{ruleUids.length !== 1 ? 's' : ''} in scope · snapshot taken now
          </Text>
        </div>

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
          <AutoComplete
            value={waitInput}
            onChange={(value) => setWaitInput(value)}
            options={WAIT_PRESETS}
            style={{ width: '100%' }}
            // Show all presets regardless of typed value — the user is
            // browsing options, not narrowing them. Default filterOption
            // would hide presets as soon as the value didn't substring-
            // match, which is wrong for a numeric picker.
            filterOption={false}
            backfill={false}
          >
            <Input
              size="middle"
              suffix="seconds"
              inputMode="numeric"
              placeholder={`${MIN_WAIT_SECONDS}–${MAX_WAIT_SECONDS}`}
              onPressEnter={launch}
            />
          </AutoComplete>
          <Text type="secondary" style={{ fontSize: 11 }}>
            How long to capture network activity after the page loads. Any value from {MIN_WAIT_SECONDS}s to{' '}
            {MAX_WAIT_SECONDS}s.
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
      </Space>
    </Modal>
  );
};

export default TestRunModal;
