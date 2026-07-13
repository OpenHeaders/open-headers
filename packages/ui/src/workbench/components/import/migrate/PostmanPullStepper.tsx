/**
 * PostmanPullStepper — the inline account-pull stepper (S14 UI law:
 * steps render inside the one modal, never modal-over-modal).
 *
 * Step "key": a compact credential row. The key is component state
 * only — it crosses the bridge per call (`listWorkspaces`, `start`)
 * and never reaches app state, events, reports, or logs; the whole
 * stepper unmounts on collapse/close, taking the key with it.
 *
 * Step "pick": the enumeration-only preflight's workspace list as a
 * checkbox picker (names + item counts, everything pre-selected).
 * "Import selected" starts the unattended background pull narrowed to
 * the chosen `workspaceIds`; the caller closes the modal and the
 * corner task takes over.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { PostmanWorkspacePreview } from '@openheaders/core/import';
import { Alert, Button, Checkbox, Input, Typography } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';

const { Text, Paragraph } = Typography;

interface PostmanPullStepperProps {
  /** The pull was accepted — close the surface; progress rides the corner task. */
  onStarted: () => void;
}

const PostmanPullStepper: React.FC<PostmanPullStepperProps> = ({ onStarted }) => {
  const [apiKey, setApiKey] = useState('');
  const [listing, setListing] = useState(false);
  const [listReason, setListReason] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<PostmanWorkspacePreview[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [startReason, setStartReason] = useState<string | null>(null);

  const listAccountWorkspaces = useCallback(() => {
    const key = apiKey.trim();
    if (!key) return;
    setListing(true);
    setListReason(null);
    void hostBridge
      .call('oh.migration.postmanPull.listWorkspaces', { apiKey: key })
      .then((result) => {
        if (result.ok) {
          setWorkspaces(result.workspaces);
          setSelected(result.workspaces.map((workspace) => workspace.id));
        } else {
          setListReason(result.reason);
        }
      })
      .catch(() => setListReason('The workspaces could not be listed.'))
      .finally(() => setListing(false));
  }, [apiKey]);

  const startPull = useCallback(() => {
    const key = apiKey.trim();
    if (!key || selected.length === 0) return;
    setStarting(true);
    setStartReason(null);
    void hostBridge
      .call('oh.migration.postmanPull.start', { apiKey: key, workspaceIds: selected })
      .then((result) => {
        if (result.started) {
          setApiKey('');
          onStarted();
        } else {
          setStartReason(result.reason ?? 'The import could not start.');
        }
      })
      .catch(() => setStartReason('The import could not start.'))
      .finally(() => setStarting(false));
  }, [apiKey, selected, onStarted]);

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));
  }, []);

  if (workspaces === null) {
    return (
      <div>
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
          Paste a Postman API key (Settings → API keys) to list your workspaces and pick which ones to import. The key
          is used for this run only — it is never stored or logged.
        </Paragraph>
        <div style={{ display: 'flex', gap: 8, maxWidth: 520 }}>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onPressEnter={listAccountWorkspaces}
            placeholder="PMAK-…"
            autoComplete="off"
            aria-label="Postman API key"
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            loading={listing}
            disabled={apiKey.trim().length === 0}
            onClick={listAccountWorkspaces}
          >
            Start import
          </Button>
        </div>
        {listReason && <Alert type="error" showIcon message={listReason} style={{ marginTop: 8 }} />}
      </div>
    );
  }

  return (
    <div>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
        Each selected Postman workspace lands in its own workspace, keeping its exact name, with an end-of-run report.
      </Paragraph>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {workspaces.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No workspaces found on this account.
          </Text>
        ) : (
          workspaces.map((workspace) => (
            <Checkbox
              key={workspace.id}
              checked={selected.includes(workspace.id)}
              onChange={(e) => toggle(workspace.id, e.target.checked)}
            >
              <Text strong>{workspace.name}</Text>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {workspace.collections} collections · {workspace.environments} environments
              </Text>
            </Checkbox>
          ))
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button type="primary" loading={starting} disabled={selected.length === 0} onClick={startPull}>
          Import selected
        </Button>
        <Button type="text" onClick={() => setWorkspaces(null)}>
          Back
        </Button>
      </div>
      {startReason && <Alert type="error" showIcon message={startReason} style={{ marginTop: 8 }} />}
    </div>
  );
};

export default PostmanPullStepper;
