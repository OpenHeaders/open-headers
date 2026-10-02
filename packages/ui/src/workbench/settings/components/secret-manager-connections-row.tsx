/**
 * This device's secret-manager connections — custom editor for
 * `secretManagers.connections` on Secret Managers › Connections (the
 * Secret Providers plan): one row per account or server an external
 * secret manager is reached through. Where it is and as whom, never a
 * credential value. Rows commit on the gesture like every other
 * settings row — add (provider → fields → Save), edit in place, Test
 * (the provider's own prompt, the one gesture that may prompt),
 * remove. On a browser host the block is read-only: the desktop app's
 * connections over loopback with Test still live (the prompt appears
 * on this machine) and the note naming where they are managed, or the
 * empty list with the note to connect the desktop app while it is away.
 */

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  buildSecretConnectionConfig,
  describeSecretConnection,
  isSecretConnectionConfigComplete,
  SECRET_CONNECTION_FIELDS,
  SECRET_PROVIDER_IDS,
  secretConnectionConfigToFields,
} from '@openheaders/core/secret-providers';
import type { SecretManagerConnection, SecretProviderId } from '@openheaders/core/types';
import { useLocale, useT } from '@openheaders/ui/context/LocaleContext';
import { DesktopTeaser } from '@openheaders/ui/shared/desktop-teaser';
import { errorToastDuration } from '@openheaders/ui/shared/notifications';
import { isNodeRequestRuntime } from '@openheaders/ui/shared/device-trust';
import {
  addSecretManagerConnection,
  authorizeSecretManagerConnection,
  removeSecretManagerConnection,
  updateSecretManagerConnection,
  useSecretManagerConnections,
  useSecretManagerProbe,
} from '@openheaders/ui/shared/secret-manager';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type { MessageKey } from '@openheaders/i18n';
import { App, Button, Input, Select, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { Fragment, useCallback, useState } from 'react';
import {
  secretConnectionFieldInfo,
  secretConnectionLabelInfo,
  secretProviderInfo,
} from '../../components/panels/SecretManagerRowInfo';
import {
  REASON_LABEL,
  SM_FIELD_LABEL,
  SM_PROVIDER_LABEL,
  secretAvailableLabel,
  secretAvailableTone,
  secretAvailableTooltip,
  secretStatusGuidance,
  secretStatusTooltip,
} from '../../components/panels/SecretManagerStatusChip';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const GRID_COLUMNS = 'minmax(120px, 1fr) minmax(120px, 1fr) minmax(160px, 1.6fr) 150px 96px';

/** Picklist option copy — explicit keys so the union stays typecheckable. */
const OPTION_LABEL: Record<string, MessageKey> = {
  'auth.app': 'workbench.variables.table.smField.auth.app',
  'auth.service-account': 'workbench.variables.table.smField.auth.serviceAccount',
  'authMethod.token': 'workbench.variables.table.smField.authMethod.token',
  'authMethod.approle': 'workbench.variables.table.smField.authMethod.approle',
  'authMethod.oidc': 'workbench.variables.table.smField.authMethod.oidc',
};

/** A prerequisite a picklist value carries, read under its row —
 *  keyed `provider.field.value`, explicit for the same reason. */
const OPTION_HINT: Record<string, MessageKey> = {
  'onepassword.auth.app': 'workbench.variables.table.smField.auth.appHint',
};

interface FormState {
  uid: string | null;
  provider: SecretProviderId;
  label: string;
  fields: Record<string, string>;
}

function formFor(connection: SecretManagerConnection | null): FormState {
  return connection
    ? {
        uid: connection.uid,
        provider: connection.config.provider,
        label: connection.label,
        fields: secretConnectionConfigToFields(connection.config),
      }
    : { uid: null, provider: 'onepassword', label: '', fields: {} };
}

const StatusCell: React.FC<{ connection: SecretManagerConnection }> = ({ connection }) => {
  const { t, locale } = useLocale();
  const probe = useSecretManagerProbe(connection.uid);
  if (probe === null) return <Text type="secondary">…</Text>;
  if (probe.available) {
    const connected = <Tag color={secretAvailableTone(probe)}>{secretAvailableLabel(t, locale, probe)}</Tag>;
    const detail = secretAvailableTooltip(t, locale, connection.config.provider, probe);
    return detail !== null ? <Tooltip title={detail}>{connected}</Tooltip> : connected;
  }
  const chip = <Tag color="default">{t(REASON_LABEL[probe.reason])}</Tag>;
  const tooltip = secretStatusTooltip(t, connection.config.provider, probe);
  return tooltip !== null ? <Tooltip title={tooltip}>{chip}</Tooltip> : chip;
};

/** `label · (i)` in the form's label column; the (i) opens the row's
 *  slice of the provider's example (SecretManagerRowInfo). */
const FormLabel: React.FC<{ label: string; info?: InfoPopoverContent }> = ({ label, info }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <Text style={{ fontSize: 13 }}>{label}</Text>
    {info !== undefined && <InfoTrigger content={info} />}
  </div>
);

const ConnectionForm: React.FC<{
  initial: FormState;
  busy: boolean;
  onSave: (form: FormState) => void;
  onCancel: () => void;
}> = ({ initial, busy, onSave, onCancel }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [form, setForm] = useState<FormState>(initial);
  const config = buildSecretConnectionConfig(form.provider, form.fields);
  const complete = isSecretConnectionConfigComplete(config);
  return (
    <div
      data-testid="secret-manager-form"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center' }}>
        <FormLabel
          label={t('workbench.variables.secretManagers.form.provider')}
          info={secretProviderInfo(t, form.provider, form.fields)}
        />
        <Select
          size="small"
          value={form.provider}
          onChange={(provider: SecretProviderId) => setForm({ ...form, provider, fields: {} })}
          options={SECRET_PROVIDER_IDS.map((id) => ({ value: id, label: t(SM_PROVIDER_LABEL[id]) }))}
          disabled={form.uid !== null}
          data-testid="secret-manager-form-provider"
        />
        <FormLabel
          label={t('workbench.variables.secretManagers.form.label')}
          info={secretConnectionLabelInfo(t, form.provider, form.fields)}
        />
        <Input
          size="small"
          value={form.label}
          placeholder={t('workbench.variables.secretManagers.form.labelPlaceholder')}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          data-testid="secret-manager-form-label"
        />
        {SECRET_CONNECTION_FIELDS[form.provider].map((spec) => {
          const value = form.fields[spec.key] ?? spec.options?.[0] ?? '';
          const hint = spec.options !== undefined ? OPTION_HINT[`${form.provider}.${spec.key}.${value}`] : undefined;
          return (
            <Fragment key={spec.key}>
              <FormLabel
                label={
                  spec.required
                    ? t(SM_FIELD_LABEL[spec.key])
                    : t('workbench.variables.table.smFieldOptional', { label: t(SM_FIELD_LABEL[spec.key]) })
                }
                info={secretConnectionFieldInfo(t, form.provider, spec.key, form.fields)}
              />
              {spec.options ? (
                <Select
                  size="small"
                  value={value}
                  onChange={(next: string) => setForm({ ...form, fields: { ...form.fields, [spec.key]: next } })}
                  options={spec.options.map((option) => ({
                    value: option,
                    label: t(OPTION_LABEL[`${spec.key}.${option}`]),
                  }))}
                  data-testid={`secret-manager-form-${spec.key}`}
                />
              ) : (
                <Input
                  size="small"
                  value={value}
                  onChange={(e) => setForm({ ...form, fields: { ...form.fields, [spec.key]: e.target.value } })}
                  data-testid={`secret-manager-form-${spec.key}`}
                />
              )}
              {hint !== undefined && (
                <>
                  <span />
                  <Text type="secondary" style={{ fontSize: 11 }} data-testid={`secret-manager-form-${spec.key}-hint`}>
                    {t(hint)}
                  </Text>
                </>
              )}
            </Fragment>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button
          size="small"
          type="primary"
          disabled={!complete || busy}
          onClick={() => onSave(form)}
          data-testid="secret-manager-form-save"
        >
          {t('workbench.variables.secretManagers.form.save')}
        </Button>
        <Button size="small" onClick={onCancel} disabled={busy}>
          {t('workbench.variables.secretManagers.form.cancel')}
        </Button>
        {!complete && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.variables.secretManagers.form.incomplete')}
          </Text>
        )}
      </div>
    </div>
  );
};

const SecretManagerConnectionsRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const nodeHost = isNodeRequestRuntime();
  // An error stays long enough to be read and leaves on a click.
  const showError = useCallback(
    (content: string) => {
      const key = `secret-manager-error-${Date.now()}`;
      message.error({ key, content, duration: errorToastDuration(content), onClick: () => message.destroy(key) });
    },
    [message],
  );
  const { connections, broker } = useSecretManagerConnections();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  // Bumped after a save or a Test so every status cell remounts and re-probes.
  const [revision, setRevision] = useState(0);

  const handleSave = useCallback(
    async (form: FormState) => {
      setBusy(true);
      const config = buildSecretConnectionConfig(form.provider, form.fields);
      const result =
        form.uid === null
          ? await addSecretManagerConnection({ label: form.label, config })
          : await updateSecretManagerConnection({ uid: form.uid, label: form.label, config });
      setBusy(false);
      if (!result.ok) {
        showError(t('workbench.variables.secretManagers.saveFailedDetail', { message: result.error }));
        return;
      }
      setEditing(null);
      setRevision((n) => n + 1);
    },
    [showError, t],
  );

  const handleRemove = useCallback(
    async (uid: string) => {
      const result = await removeSecretManagerConnection(uid);
      if (!result.ok && result.error !== undefined) {
        showError(t('workbench.variables.secretManagers.saveFailedDetail', { message: result.error }));
      }
    },
    [showError, t],
  );

  const handleTest = useCallback(
    async (connection: SecretManagerConnection) => {
      setTesting(connection.uid);
      const result = await authorizeSecretManagerConnection(connection.uid);
      setTesting(null);
      setRevision((n) => n + 1);
      if (result.ok) {
        message.success(t('workbench.variables.secretManagers.test.ok', { label: connection.label }));
      } else {
        const guidance = secretStatusGuidance(connection.config.provider, result.reason);
        const failed = t('workbench.variables.secretManagers.test.failed', { detail: result.detail ?? '' });
        showError(guidance === null ? failed : `${failed} ${t(guidance)}`);
      }
    },
    [message, showError, t],
  );

  const headerCell = (label: string) => (
    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
      {label}
    </Text>
  );

  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Tooltip title={nodeHost ? undefined : t('workbench.variables.secretManagers.addDesktopOnly')}>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setEditing(formFor(null))}
              disabled={editing !== null || !nodeHost}
              data-testid="secret-manager-add"
            >
              {t('workbench.variables.secretManagers.add')}
            </Button>
          </Tooltip>
        </div>
        <div
          data-testid="secret-manager-table"
          style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_COLUMNS,
              gap: 12,
              padding: '6px 12px',
              background: token.colorFillQuaternary,
            }}
          >
            {headerCell(t('workbench.variables.secretManagers.header.label'))}
            {headerCell(t('workbench.variables.secretManagers.header.provider'))}
            {headerCell(t('workbench.variables.secretManagers.header.target'))}
            {headerCell(t('workbench.variables.secretManagers.header.status'))}
            <span />
          </div>
          {connections.length === 0 ? (
            <div
              data-testid="secret-manager-empty"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '16px 12px',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Text>{t('workbench.variables.secretManagers.empty')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.variables.secretManagers.emptyHint')}
              </Text>
            </div>
          ) : (
            connections.map((connection) => (
              <div
                key={connection.uid}
                data-testid="secret-manager-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID_COLUMNS,
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  fontSize: 13,
                }}
              >
                <Text ellipsis={{ tooltip: connection.label }} strong>
                  {connection.label}
                </Text>
                <Text ellipsis>{t(SM_PROVIDER_LABEL[connection.config.provider])}</Text>
                <Text
                  ellipsis={{ tooltip: describeSecretConnection(connection) }}
                  style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12 }}
                >
                  {describeSecretConnection(connection) || '—'}
                </Text>
                <StatusCell key={`${connection.uid}:${revision}`} connection={connection} />
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    type="text"
                    loading={testing === connection.uid}
                    disabled={broker === 'unreachable' || testing !== null}
                    onClick={() => void handleTest(connection)}
                    data-testid="secret-manager-test"
                  >
                    {t('workbench.variables.secretManagers.row.test')}
                  </Button>
                  <Tooltip title={nodeHost ? undefined : t('workbench.variables.secretManagers.editDesktopOnly')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      aria-label={t('workbench.variables.secretManagers.row.edit')}
                      disabled={!nodeHost || editing !== null}
                      onClick={() => setEditing(formFor(connection))}
                      data-testid="secret-manager-edit"
                    />
                  </Tooltip>
                  <Tooltip title={nodeHost ? undefined : t('workbench.variables.secretManagers.editDesktopOnly')}>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={t('workbench.variables.secretManagers.row.remove')}
                      disabled={!nodeHost}
                      onClick={() => void handleRemove(connection.uid)}
                      data-testid="secret-manager-remove"
                    />
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>
        {editing && (
          <ConnectionForm
            key={editing.uid ?? 'new'}
            initial={editing}
            busy={busy}
            onSave={(form) => void handleSave(form)}
            onCancel={() => setEditing(null)}
          />
        )}
        {!nodeHost && (
          <Text type="secondary" style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {broker === 'desktop-app'
              ? t('workbench.variables.secretManagers.browserNoteConnected')
              : t('workbench.variables.secretManagers.browserNote')}
          </Text>
        )}
        {!nodeHost && broker === 'unreachable' && (
          // The standalone teaser: the desktop app is away — open it
          // when it is installed here, else get it (the teaser's own
          // state-aware CTA; the Secret Providers plan's P2e).
          <DesktopTeaser feature="secretManagers" compact />
        )}
      </div>
    </FieldRow>
  );
};

export default SecretManagerConnectionsRow;
