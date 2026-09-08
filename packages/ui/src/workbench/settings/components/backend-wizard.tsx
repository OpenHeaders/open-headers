/**
 * Add/edit wizard for one `OH.backends` record — the dialog behind the
 * Sync page's two verbs and the row's Edit (the Backup and Sync UX plan
 * §5.4): address → sign in → connect. No scenario step: what the place
 * is follows from its address (`providingBackendKind`), and the verb
 * that opened the wizard is its title.
 *
 * The wizard is a guided view over the SAME record-scoped field
 * components the row editor used, not a staged draft: fields commit on
 * blur onto the disabled record, which is safe by the S4 staging
 * guarantee (a disabled record has no wire to move), and the final step
 * routes through `useBackendEnableSwitch` — the probe-gated enable is
 * the one activation path.
 *
 *   - The sign-in step reads its verdict off the same probe: the server
 *     asks this device to pair (`auth-required`), or the credential
 *     already signs in (the WELCOME names the place), or nothing
 *     answered. Entering the step probes; a pairing that lands a token
 *     probes again, so the line flips to "Signed in" on its own.
 *   - Editing an ENABLED record goes disable-first, explicitly: the
 *     wizard opens on a gate pane whose one action is the kill-switch
 *     disable; connection fields never render for a live wire.
 *   - Cancelling a fresh add removes the just-created record (it was
 *     born disabled and unbound; nothing synced from it).
 *   - The desktop verb's automatic pairing happens BEFORE the wizard
 *     (`use-connect-desktop-app.ts`); the wizard is its fallback, and
 *     `autoPairFailed` puts the explanation on the address step.
 */

import { removeBackend } from '@openheaders/core/backends';
import { type ProvidingBackendKind, providingBackendKind } from '@openheaders/core/identity';
import type { BackendConnection } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Alert, Button, Modal, Steps, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  describeProbeResult,
  type ProbeConnectionResult,
  type ProbeNotice,
  probeBackendConnection,
  urlHost,
  useBackends,
} from '../../../shared/backend';
import { getCurrentHost, viewerHostKind } from '../../../shared/host-vocabulary';
import BackendAuthTokenField from './backend-auth-token-field';
import BackendLabelField from './backend-label-field';
import { BackendRecordProvider, backendDisplayLabel } from './backend-record-context';
import BackendUrlField from './backend-url-field';
import type { BackendEnableSwitchHandle } from './use-backend-enable-switch';

export interface BackendWizardTarget {
  recordId: string;
  mode: 'add' | 'edit';
  /** The verb a fresh add stands for; an edit derives the kind from the record. */
  kind?: ProvidingBackendKind;
  /** What the row calls the place — an edit's title. */
  place?: string;
  /** The desktop verb's automatic pairing already failed — the address step says so. */
  autoPairFailed?: boolean;
}

/**
 * What the sign-in step says about the address, read off one probe:
 * the server asks this device to pair, the credential already signs in
 * (named by the WELCOME's Org when it carries one), or nothing usable
 * answered (the probe's own notice, reachable-but or unreachable).
 */
export type SignInVerdict =
  | { kind: 'needs-pairing' }
  | { kind: 'signed-in'; name: string | null }
  | { kind: 'unanswered'; notice: ProbeNotice };

export function signInVerdict(result: ProbeConnectionResult, label: string, t: Translate): SignInVerdict {
  if (result.ok) return { kind: 'signed-in', name: result.orgName };
  if (result.reason === 'handshake-rejected' && result.rejectReason === 'auth-required') {
    return { kind: 'needs-pairing' };
  }
  return { kind: 'unanswered', notice: describeProbeResult(result, label, t) };
}

const STEPS = [
  { titleKey: 'workbench.settings.backendPane.wizard.step.address' },
  { titleKey: 'workbench.settings.backendPane.wizard.step.signIn' },
  { titleKey: 'workbench.settings.backendPane.wizard.step.connect' },
] as const;

const ADDRESS_STEP = 0;
const SIGN_IN_STEP = 1;
const CONNECT_STEP = 2;

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

  return <WizardDialog record={record} target={target} enableSwitch={enableSwitch} onClose={onClose} />;
};

const WizardDialog: React.FC<{
  record: BackendConnection;
  target: BackendWizardTarget;
  enableSwitch: BackendEnableSwitchHandle;
  onClose: () => void;
}> = ({ record, target, enableSwitch, onClose }) => {
  const t = useT();
  const host = getCurrentHost();
  const backends = useBackends();
  const { mode } = target;
  // An add beyond the first record (the fresh record itself counts) —
  // worth a word on what a second connection changes.
  const isAdditionalConnection = mode === 'add' && backends.length > 1;
  const kind = target.kind ?? providingBackendKind(viewerHostKind(host), record.url);
  const [step, setStep] = useState(ADDRESS_STEP);
  const [finishing, setFinishing] = useState(false);
  const [verdict, setVerdict] = useState<SignInVerdict | null>(null);
  const [probing, setProbing] = useState(false);
  // Only the latest probe may write the verdict — an address or token
  // edit while one is in flight starts another.
  const probeSeq = useRef(0);

  const label = backendDisplayLabel(record);
  const hasToken = record.authToken.trim().length > 0;

  const probe = async (): Promise<void> => {
    const seq = ++probeSeq.current;
    setProbing(true);
    const role = host === 'desktop' ? 'desktop' : host === 'web' ? 'web' : 'extension';
    const result = await probeBackendConnection(record.url, {
      agent: `${role}-wizard-probe`,
      nodeId: `probe-${generateUid()}`,
      workspaceId: `probe-${generateUid()}`,
      role,
      authToken: record.authToken,
    });
    if (seq !== probeSeq.current) return;
    setProbing(false);
    setVerdict(signInVerdict(result, label, t));
  };

  // Entering the sign-in step asks the address; a credential landing
  // while there (a pairing, a pasted token) asks again.
  useEffect(() => {
    if (step !== SIGN_IN_STEP) return;
    void probe();
  }, [step, record.authToken]);

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

  const title =
    mode === 'edit'
      ? t('workbench.settings.backendPane.wizard.editTitle', { label: target.place ?? label })
      : kind === 'desktop-app'
        ? t('workbench.settings.backendPane.wizard.title.desktop')
        : t('workbench.settings.backendPane.wizard.title.server');

  if (record.enabled) {
    return (
      <Modal title={title} open onCancel={onClose} width={520} footer={null}>
        <DisableFirstGate record={record} label={label} enableSwitch={enableSwitch} />
      </Modal>
    );
  }

  const nextDisabled = step === ADDRESS_STEP && !urlLooksComplete(record.url);

  return (
    <Modal
      title={title}
      open
      onCancel={() => void cancel()}
      mask={{ closable: false }}
      width={640}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button onClick={() => void cancel()}>{t('shared.action.cancel')}</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > ADDRESS_STEP && (
              <Button onClick={() => setStep(step - 1)}>{t('workbench.settings.backendPane.wizard.back')}</Button>
            )}
            {step < CONNECT_STEP ? (
              <Button type="primary" disabled={nextDisabled} onClick={() => setStep(step + 1)}>
                {t('workbench.settings.backendPane.wizard.next')}
              </Button>
            ) : (
              <>
                <Button onClick={() => void finish(false)} disabled={finishing}>
                  {t('workbench.settings.backendPane.wizard.finishWithoutConnecting')}
                </Button>
                <Button type="primary" loading={finishing} onClick={() => void finish(true)}>
                  {t('workbench.settings.backendPane.wizard.connect')}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <Steps
        size="small"
        current={step}
        items={STEPS.map((s) => ({ title: t(s.titleKey) }))}
        style={{ margin: '4px 0 16px' }}
      />
      {step === ADDRESS_STEP && (
        <BackendRecordProvider record={record}>
          {target.autoPairFailed && (
            <Alert
              type="info"
              showIcon
              title={t('workbench.settings.backendPane.wizard.autoPairFallback')}
              style={{ marginBottom: 10 }}
            />
          )}
          <StepIntro text={t('workbench.settings.backendPane.wizard.connectIntro')} />
          <BackendLabelField />
          <BackendUrlField />
        </BackendRecordProvider>
      )}
      {step === SIGN_IN_STEP && (
        <BackendRecordProvider record={record}>
          <SignInVerdictLine verdict={verdict} probing={probing} host={urlHost(record.url)} />
          <BackendAuthTokenField />
          <div style={{ padding: '8px 12px' }}>
            <Button loading={probing} onClick={() => void probe()}>
              {t('workbench.settings.backendPane.wizard.checkAgain')}
            </Button>
          </div>
        </BackendRecordProvider>
      )}
      {step === CONNECT_STEP && (
        <div style={{ padding: '4px 2px' }}>
          <StepIntro
            text={t(
              hasToken
                ? 'workbench.settings.backendPane.wizard.readyIntroPaired'
                : 'workbench.settings.backendPane.wizard.readyIntroNotPaired',
              { label, url: record.url },
            )}
          />
          {isAdditionalConnection && <StepIntro text={t('workbench.settings.backendPane.wizard.additionalBackend')} />}
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

/**
 * The sign-in step's one line: what the address answered. A probe in
 * flight reads as checking; an unanswered probe carries the shared
 * probe notice (the same copy Connect would fire), so the step never
 * blocks — the credential field stays usable underneath either way.
 */
const SignInVerdictLine: React.FC<{ verdict: SignInVerdict | null; probing: boolean; host: string }> = ({
  verdict,
  probing,
  host,
}) => {
  const t = useT();
  if (probing || !verdict) {
    return <StepIntro text={t('workbench.settings.backendPane.wizard.checking', { host })} />;
  }
  switch (verdict.kind) {
    case 'needs-pairing':
      return <StepIntro text={t('workbench.settings.backendPane.wizard.verdict.needsPairing', { host })} />;
    case 'signed-in':
      return (
        <Alert
          type="success"
          showIcon
          title={
            verdict.name
              ? t('workbench.settings.backendPane.wizard.verdict.signedIn', { name: verdict.name })
              : t('workbench.settings.backendPane.wizard.verdict.signedInUnnamed')
          }
          style={{ marginBottom: 10 }}
        />
      );
    case 'unanswered':
      return (
        <Alert
          type={verdict.notice.level}
          showIcon
          title={verdict.notice.message}
          description={verdict.notice.description}
          style={{ marginBottom: 10 }}
        />
      );
  }
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
  const t = useT();
  return (
    <div style={{ padding: '4px 2px' }}>
      <p style={{ fontSize: 12.5, color: token.colorTextSecondary, margin: '0 0 12px' }}>
        {t('workbench.settings.backendPane.wizard.disableFirst', { label })}
      </p>
      <Button danger onClick={() => void enableSwitch.setEnabled(record, false)} disabled={enableSwitch.busy}>
        {t('workbench.settings.backendPane.wizard.disconnectEdit')}
      </Button>
    </div>
  );
};
