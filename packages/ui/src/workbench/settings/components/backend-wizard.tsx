/**
 * Add/edit wizard for one `OH.backends` record (MULTI_BACKEND_PLAN.md
 * §4) — the guided flow behind "Add back-end" and the row's Edit:
 * scenario → connect → pair → turn on.
 *
 * The wizard is a guided view over the SAME record-scoped field
 * components the inline editor used, not a staged draft: fields commit
 * on blur onto the disabled record, which is safe by the S4 staging
 * guarantee (a disabled record has no wire to move), and the final step
 * routes through `useBackendEnableSwitch` — the probe-gated enable is
 * the one activation path.
 *
 *   - Editing an ENABLED record goes disable-first, explicitly: the
 *     wizard opens on a gate pane whose one action is the kill-switch
 *     disable; connection fields never render for a live wire.
 *   - Cancelling a fresh add removes the just-created record (it was
 *     born disabled and unbound; nothing synced from it).
 *   - "Soon" scenarios preview their tier diagrams but can't proceed.
 */

import { removeBackend } from '@openheaders/core/backends';
import type { BackendConnection } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { App as AntApp, Button, Modal, Steps, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { describeProbeResult, probeBackendConnection, useBackends } from '../../../shared/backend';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { type BackendMode, deriveBackendMode } from '../schema/backend';
import BackendAuthTokenField from './backend-auth-token-field';
import { BackendDetailDiagram } from './backend-details';
import { BackendIcon } from './backend-icons';
import BackendLabelField from './backend-label-field';
import { BackendRecordProvider, backendDisplayLabel } from './backend-record-context';
import { type ScenarioDescriptor, scenariosForHost } from './backend-scenarios';
import { BackendTierCard } from './backend-tier-card';
import BackendUrlField from './backend-url-field';
import type { BackendEnableSwitchHandle } from './use-backend-enable-switch';

export interface BackendWizardTarget {
  recordId: string;
  mode: 'add' | 'edit';
}

const STEPS = [
  { title: 'Scenario' },
  { title: 'Connect' },
  { title: 'Pair' },
  { title: 'Turn on' },
] as const;

export const BackendWizard: React.FC<{
  target: BackendWizardTarget;
  enableSwitch: BackendEnableSwitchHandle;
  onClose: () => void;
}> = ({ target, enableSwitch, onClose }) => {
  const backends = useBackends();
  const record = backends.find((b) => b.id === target.recordId) ?? null;

  // The record vanished under the wizard (removed from another surface).
  useEffect(() => {
    if (!record) onClose();
  }, [record, onClose]);
  if (!record) return null;

  return <WizardDialog record={record} mode={target.mode} enableSwitch={enableSwitch} onClose={onClose} />;
};

const WizardDialog: React.FC<{
  record: BackendConnection;
  mode: 'add' | 'edit';
  enableSwitch: BackendEnableSwitchHandle;
  onClose: () => void;
}> = ({ record, mode, enableSwitch, onClose }) => {
  const host = getCurrentHost();
  const scenarios = scenariosForHost(host);
  const backends = useBackends();
  // An add beyond the first record (the fresh record itself counts) —
  // worth a word on what a second back-end changes.
  const isAdditionalBackend = mode === 'add' && backends.length > 1;
  // Edit lands on the connect step with the scenario derived from the
  // record; add starts at the scenario choice.
  const derivedMode = deriveBackendMode(host, { ...record, enabled: true });
  const [scenario, setScenario] = useState<BackendMode>(derivedMode);
  const [step, setStep] = useState(mode === 'add' ? 0 : 1);
  const [finishing, setFinishing] = useState(false);

  const label = backendDisplayLabel(record);
  const selected = scenarios.find((s) => s.mode === scenario) ?? null;
  const hasToken = record.authToken.trim().length > 0;

  const cancel = async (): Promise<void> => {
    // A fresh add that never connected leaves no trace behind; an edit's
    // blur-committed changes stand — the record is still disabled and
    // only the probe-gated enable can turn them into a wire.
    if (mode === 'add') await removeBackend(record.id);
    onClose();
  };

  const finish = async (connect: boolean): Promise<void> => {
    if (!connect) {
      onClose();
      return;
    }
    setFinishing(true);
    const committed = await enableSwitch.setEnabled(record, true);
    setFinishing(false);
    if (committed) onClose();
  };

  if (record.enabled) {
    return (
      <Modal title={`Edit ${label}`} open onCancel={onClose} width={520} footer={null}>
        <DisableFirstGate record={record} label={label} enableSwitch={enableSwitch} />
      </Modal>
    );
  }

  const nextDisabled = (step === 0 && (!selected || selected.soon)) || (step === 1 && !urlLooksComplete(record.url));

  return (
    <Modal
      title={mode === 'add' ? 'Add back-end' : `Edit ${label}`}
      open
      onCancel={() => void cancel()}
      maskClosable={false}
      width={720}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button onClick={() => void cancel()}>Cancel</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
            {step < STEPS.length - 1 ? (
              <Button type="primary" disabled={nextDisabled} onClick={() => setStep(step + 1)}>
                {step === 0 && selected?.soon ? 'Coming soon' : 'Next'}
              </Button>
            ) : (
              <>
                <Button onClick={() => void finish(false)} disabled={finishing}>
                  Finish without connecting
                </Button>
                <Button type="primary" loading={finishing} onClick={() => void finish(true)}>
                  Verify &amp; connect
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <Steps size="small" current={step} items={[...STEPS]} style={{ margin: '4px 0 16px' }} />
      {step === 0 && (
        <ScenarioStep scenarios={scenarios} selected={scenario} onSelect={setScenario} />
      )}
      {step === 1 && (
        <BackendRecordProvider record={record}>
          <StepIntro text="Where does this client dial the back-end? The connection stays off until the final step verifies it." />
          <BackendLabelField />
          <BackendUrlField />
        </BackendRecordProvider>
      )}
      {step === 2 && (
        <BackendRecordProvider record={record}>
          <StepIntro text="Prove this device to the back-end — pair with the code it displays, or paste a token. You can test the connection before turning it on." />
          <BackendAuthTokenField />
          <div style={{ padding: '8px 12px' }}>
            <TestConnectionButton record={record} label={label} />
          </div>
        </BackendRecordProvider>
      )}
      {step === 3 && (
        <div style={{ padding: '4px 2px' }}>
          <StepIntro
            text={`Ready: ${label} at ${record.url}${hasToken ? ', paired' : ' — NOT paired yet'}. Turning it on verifies reachability and authentication first; on success its workspaces sync down and stay usable offline.`}
          />
          {isAdditionalBackend && (
            <StepIntro text="This is an additional back-end. Its Orgs appear as new groups in the workspace switcher, the status popover gains a row per back-end, and each Org syncs from exactly one back-end — an Org already provided by another connection won't join twice." />
          )}
        </div>
      )}
    </Modal>
  );
};

/** Rough completeness check for the staged URL — scheme plus a host. */
function urlLooksComplete(raw: string): boolean {
  try {
    return new URL(raw).hostname.length > 0;
  } catch {
    return false;
  }
}

const StepIntro: React.FC<{ text: string }> = ({ text }) => {
  const { token } = theme.useToken();
  return <p style={{ fontSize: 12.5, color: token.colorTextSecondary, margin: '0 0 10px' }}>{text}</p>;
};

const ScenarioStep: React.FC<{
  scenarios: readonly ScenarioDescriptor[];
  selected: BackendMode;
  onSelect: (mode: BackendMode) => void;
}> = ({ scenarios, selected, onSelect }) => (
  <div>
    <StepIntro text="What kind of back-end is this? Pick a tile to see what the tier gives you." />
    <div
      role="radiogroup"
      aria-label="Back-end scenario"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(scenarios.length, 3)}, minmax(0, 1fr))`,
        gap: 8,
        marginBottom: 12,
      }}
    >
      {scenarios.map((s) => (
        <ScenarioTile key={s.mode} descriptor={s} selected={selected === s.mode} onSelect={() => onSelect(s.mode)} />
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 320px', minWidth: 300 }}>
        <BackendTierCard mode={selected} />
      </div>
      <div style={{ flex: '1 1 320px', minWidth: 300 }}>
        <BackendDetailDiagram mode={selected} />
      </div>
    </div>
  </div>
);

const ScenarioTile: React.FC<{
  descriptor: ScenarioDescriptor;
  selected: boolean;
  onSelect: () => void;
}> = ({ descriptor, selected, onSelect }) => {
  const { token } = theme.useToken();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
        fontFamily: 'inherit',
        color: token.colorText,
        textAlign: 'left',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          flex: 'none',
          display: 'inline-flex',
          filter: selected ? 'none' : 'grayscale(0.7) opacity(0.7)',
          transition: 'filter 120ms',
        }}
        aria-hidden
      >
        <BackendIcon kind={descriptor.icon} size={28} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 12.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {descriptor.title}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 10.5,
            color: token.colorTextTertiary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {descriptor.hint}
        </span>
      </span>
      {descriptor.soon && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            padding: '0 4px',
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            borderRadius: 999,
            background: token.colorWarningBg,
            color: token.colorWarningText,
            border: `1px solid ${token.colorWarningBorder}`,
            lineHeight: '11px',
            pointerEvents: 'none',
          }}
        >
          Soon
        </span>
      )}
    </button>
  );
};

/**
 * Disable-first gate for editing an ENABLED record — the wizard never
 * renders connection fields for a live wire. The one action is the
 * explicit kill-switch disable; the wizard re-renders into the steps.
 */
const DisableFirstGate: React.FC<{
  record: BackendConnection;
  label: string;
  enableSwitch: BackendEnableSwitchHandle;
}> = ({ record, label, enableSwitch }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ padding: '4px 2px' }}>
      <p style={{ fontSize: 12.5, color: token.colorTextSecondary, margin: '0 0 12px' }}>
        {label} is connected. Editing the connection means moving a live wire, so it disconnects first — your settings
        and pairing are kept, and turning it back on verifies the new configuration before anything connects.
      </p>
      <Button danger onClick={() => void enableSwitch.setEnabled(record, false)} disabled={enableSwitch.busy}>
        Disconnect and edit
      </Button>
    </div>
  );
};

/** Reachability + auth probe with the record's own URL and token. */
const TestConnectionButton: React.FC<{ record: BackendConnection; label: string }> = ({ record, label }) => {
  const { notification } = AntApp.useApp();
  const [testing, setTesting] = useState(false);
  const host = getCurrentHost();
  const role = host === 'desktop' ? 'desktop' : host === 'web' ? 'web' : 'extension';

  const test = async (): Promise<void> => {
    setTesting(true);
    const result = await probeBackendConnection(record.url, {
      agent: `${role}-wizard-probe`,
      nodeId: `probe-${generateUid()}`,
      workspaceId: `probe-${generateUid()}`,
      role,
      authToken: record.authToken,
    });
    setTesting(false);
    const notice = describeProbeResult(result, label);
    notification[notice.level]({ message: notice.message, description: notice.description });
  };

  return (
    <Button loading={testing} onClick={() => void test()}>
      Test connection
    </Button>
  );
};
