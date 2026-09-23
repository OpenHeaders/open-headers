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
 *     asks this device to sign in (`auth-required`), or the credential
 *     already signs in (the WELCOME names the person and the place), or
 *     nothing answered. Entering the step probes; a credential landing
 *     there — the person's own sign-in on the server's page, a pairing
 *     code, a pasted token — probes again, so the line flips to "Signed
 *     in as …" on its own. The step's body is `BackendSignInStep`.
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
  useBackends,
} from '../../../shared/backend';
import { backendPlace } from '../../../shared/backend/backend-place';
import { getCurrentHost, viewerHostKind } from '../../../shared/host-vocabulary';
import BackendLabelField from './backend-label-field';
import { BackendRecordProvider, backendDisplayLabel } from './backend-record-context';
import BackendSignInStep from './backend-sign-in-step';
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
 * the server asks this device to sign in, the credential already signs
 * in (the WELCOME names the person for a bound credential, the Org when
 * it carries one), or nothing usable answered (the probe's own notice,
 * reachable-but or unreachable).
 */
export type SignInVerdict =
  | { kind: 'needs-pairing' }
  | { kind: 'signed-in'; name: string | null; person: string | null }
  | { kind: 'unanswered'; notice: ProbeNotice };

export function signInVerdict(result: ProbeConnectionResult, label: string, t: Translate): SignInVerdict {
  if (result.ok) return { kind: 'signed-in', name: result.orgName, person: result.user?.displayName ?? null };
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
  // The last step names the place the way its row will: the label,
  // else the group the WELCOME named, else the host — the URL beside.
  const place = backendPlace(host, record, verdict?.kind === 'signed-in' && verdict.name ? [verdict.name] : []);

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

  const finish = async (): Promise<void> => {
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
  const nextIsPrimary = step !== SIGN_IN_STEP || verdict?.kind === 'signed-in';

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
              // One primary per view: while the sign-in step still offers
              // its own action, Next steps back to a plain button.
              <Button
                type={nextIsPrimary ? 'primary' : 'default'}
                disabled={nextDisabled}
                onClick={() => setStep(step + 1)}
              >
                {t('workbench.settings.backendPane.wizard.next')}
              </Button>
            ) : (
              <Button type="primary" loading={finishing} onClick={() => void finish()}>
                {t('workbench.settings.backendPane.wizard.connect')}
              </Button>
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
          <BackendSignInStep verdict={verdict} probing={probing} onProbe={() => void probe()} />
        </BackendRecordProvider>
      )}
      {step === CONNECT_STEP && (
        <div style={{ padding: '4px 2px' }}>
          <StepIntro text={readyIntro(place.name, record.url, hasToken, t)} />
          {isAdditionalConnection && <StepIntro text={t('workbench.settings.backendPane.wizard.additionalConnection')} />}
        </div>
      )}
    </Modal>
  );
};

/** The last step's line: the place at its address, or the address alone for a place with no name. */
function readyIntro(placeName: string | null, url: string, signedIn: boolean, t: Translate): string {
  if (placeName === null) {
    return t(
      signedIn
        ? 'workbench.settings.backendPane.wizard.readyIntroPairedUnnamed'
        : 'workbench.settings.backendPane.wizard.readyIntroNotPairedUnnamed',
      { url },
    );
  }
  return t(
    signedIn
      ? 'workbench.settings.backendPane.wizard.readyIntroPaired'
      : 'workbench.settings.backendPane.wizard.readyIntroNotPaired',
    { label: placeName, url },
  );
}

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
