/**
 * EnvironmentEditor — tab body for editing one environment's variables.
 *
 * Controlled by a local draft: edits are live in UI, committed to the
 * SW via `updateEnvironmentVariables` on Save. Dirty tracking piggybacks
 * on the draft vs persisted fingerprint so the breadcrumb bar renders
 * the save cue consistently with every other editor tab.
 */

import { CheckCircleTwoTone, GlobalOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VariableTable from './panels/VariableTable';
import StaleDraftBanner from './StaleDraftBanner';

const { Text, Title } = Typography;

interface EnvironmentEditorProps {
  environmentUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}

const EnvironmentEditor: React.FC<EnvironmentEditorProps> = ({ environmentUid, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const {
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    updateEnvironmentVariables,
    setActiveEnvironment,
    setDefaultEnvironment,
  } = useEnvironments();

  const env = useMemo(() => environments.find((e) => e.uid === environmentUid) ?? null, [environments, environmentUid]);

  const [draft, setDraft] = useState<V5.Variable[]>(() => env?.variables ?? []);
  const persistedFpRef = useRef<string>(fingerprint(env?.variables ?? []));

  // ── Phase 10 stale-draft tracking ─────────────────────────────────
  //
  // Same pattern as `RuleEditor`: snapshot `env.version` at first
  // arrival, send it as `expectedVersion` on save, show the
  // `StaleDraftBanner` on `reason: 'stale-draft'` rejection.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);

  useEffect(() => {
    if (loadedVersion !== null) return;
    if (typeof env?.version !== 'number') return;
    setLoadedVersion(env.version);
  }, [env?.version, loadedVersion]);

  // Re-sync local draft when the environment identity or persisted
  // content changes externally (save round-trip, other-workspace load,
  // concurrent tab edit).
  useEffect(() => {
    if (!env) return;
    const fp = fingerprint(env.variables);
    if (fp !== persistedFpRef.current) {
      persistedFpRef.current = fp;
      setDraft(env.variables);
    }
  }, [env]);

  const isDirty = useMemo(() => fingerprint(draft) !== persistedFpRef.current, [draft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!env || !isDirty) return;
    const result = await updateEnvironmentVariables(env.uid, draft, loadedVersion ?? undefined);
    if (result.ok) {
      persistedFpRef.current = fingerprint(draft);
      setLoadedVersion(result.version);
      setStaleDraft(null);
      onDirtyChange?.(false);
    } else if (result.reason === 'stale-draft') {
      setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
    } else if (result.reason === 'not-found') {
      message.error('Environment was deleted from another tab');
    } else {
      message.error(`Failed to update environment${'message' in result ? `: ${result.message}` : ''}`);
    }
  }, [env, isDirty, draft, updateEnvironmentVariables, onDirtyChange, loadedVersion, message]);

  const handleStaleDraftReload = useCallback(() => {
    // Discard this tab's in-memory edits; snap loadedVersion to the
    // server's current version (the live `env` is broadcast-refreshed
    // by the winning save's `environmentsChanged` event).
    if (!env) return;
    persistedFpRef.current = fingerprint(env.variables);
    setDraft(env.variables);
    setLoadedVersion(env.version);
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [env, onDirtyChange]);

  const handleStaleDraftKeepEditing = useCallback(() => {
    // Snap loadedVersion forward so the next save's expectedVersion
    // matches the server and isn't rejected. This tab's draft wins
    // last-write-wins on the next Save click.
    if (!env) return;
    setLoadedVersion(env.version);
    setStaleDraft(null);
  }, [env]);

  // registerSaveRef takes a sync callback; wrap our async handler so
  // the breadcrumb Save button kicks off the save without awaiting.
  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  if (!env) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Environment not found.</Text>
      </div>
    );
  }

  const isActive = activeEnvironmentId === env.uid;
  const isDefault = defaultEnvironmentId === env.uid;
  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {staleDraft && (
          <StaleDraftBanner
            entityLabel="environment"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={handleStaleDraftReload}
            onKeepEditing={handleStaleDraftKeepEditing}
          />
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GlobalOutlined style={{ fontSize: 18, color: isActive ? token.colorPrimary : token.colorTextTertiary }} />
            <Title level={4} style={{ margin: 0 }}>
              {env.name}
            </Title>
            {isActive && <Tag color="blue">Active</Tag>}
            {isDefault && (
              <Tooltip title="Resolver falls back here when the active env is missing a variable.">
                <Tag color="gold" icon={<StarFilled />}>
                  Default
                </Tag>
              </Tooltip>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isActive && (
              <Button size="small" icon={<CheckCircleTwoTone />} onClick={() => void setActiveEnvironment(env.uid)}>
                Set active
              </Button>
            )}
            <Tooltip
              title={
                isDefault
                  ? 'Unset as default — resolver will stop falling back to this env.'
                  : 'Set as default — resolver falls back here when the active env is missing a variable.'
              }
            >
              <Button
                size="small"
                icon={isDefault ? <StarFilled style={{ color: token.colorWarning }} /> : <StarOutlined />}
                onClick={() => void setDefaultEnvironment(isDefault ? null : env.uid)}
              >
                {isDefault ? 'Unset default' : 'Set as default'}
              </Button>
            </Tooltip>
          </div>
        </div>

        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
          VARIABLES ({nonEmptyCount})
        </Text>

        <VariableTable variables={draft} onChange={setDraft} allowSecrets />
      </div>
    </div>
  );
};

export default EnvironmentEditor;
