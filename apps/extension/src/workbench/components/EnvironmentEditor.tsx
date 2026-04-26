/**
 * EnvironmentEditor — tab body for editing one environment's variables.
 *
 * Controlled by a local draft: edits are live in UI, committed to the
 * SW via `updateEnvironmentVariables` on Save. Dirty tracking piggybacks
 * on the draft vs persisted fingerprint so the breadcrumb bar renders
 * the save cue consistently with every other editor tab.
 */

import { CheckCircleTwoTone, StarFilled, StarOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useVariableMutator } from '@hooks/useVariableMutator';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import { useEnvSwitcher } from '../services/env-switcher';
import EditorHeader from './EditorHeader';
import VariableTable from './panels/VariableTable';
import StaleDraftBanner from './StaleDraftBanner';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;

interface EnvironmentEditorProps {
  environmentUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

// Module-level — `useDirtyDraft` requires a stable fingerprint reference.
function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}
// Shared empty-fallback — ensures identity stability so the hook's
// initial-state factory never sees a fresh `[]` per render.
const EMPTY_VARS: V5.Variable[] = [];

const EnvironmentEditor: React.FC<EnvironmentEditorProps> = ({ environmentUid, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { environments, activeEnvironmentId, defaultEnvironmentId, setDefaultEnvironment } = useEnvironments();
  const { pickActiveEnvironment } = useEnvSwitcher();
  const { replaceEnvironmentVariables } = useVariableMutator();

  const env = useMemo(() => environments.find((e) => e.uid === environmentUid) ?? null, [environments, environmentUid]);

  const { draft, setDraft, isDirty, markPersisted, resetToServer } = useDirtyDraft<V5.Variable[]>({
    serverDraft: env?.variables ?? null,
    fingerprint,
    empty: EMPTY_VARS,
  });

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

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!env || !isDirty) return;
    const result = await replaceEnvironmentVariables(env.uid, draft, loadedVersion ?? undefined);
    if (result.ok) {
      markPersisted(draft);
      setLoadedVersion(result.version);
      setStaleDraft(null);
      onDirtyChange?.(false);
    } else if (result.reason === 'stale-draft') {
      setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
    } else if (result.reason === 'not-found') {
      message.error('Environment was deleted from another tab');
    } else {
      message.error(`Failed to update environment${result.message ? `: ${result.message}` : ''}`);
    }
  }, [env, isDirty, draft, replaceEnvironmentVariables, onDirtyChange, loadedVersion, message, markPersisted]);

  const handleStaleDraftReload = useCallback(() => {
    // Discard this tab's in-memory edits; snap loadedVersion to the
    // server's current version (the live `env` is broadcast-refreshed
    // by the winning save's `environmentsChanged` event).
    if (!env) return;
    resetToServer();
    setLoadedVersion(env.version);
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [env, onDirtyChange, resetToServer]);

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

  const headerTitle = (
    <>
      {scopeBadge('environment', 20)}
      <Title level={5} style={{ margin: 0 }}>
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
    </>
  );

  const headerActions = (
    <>
      {!isActive && (
        <Button size="small" icon={<CheckCircleTwoTone />} onClick={() => pickActiveEnvironment(env.uid)}>
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
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={headerTitle} actions={headerActions} isDirty={isDirty} onSave={handleSaveSync} />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
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
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
            VARIABLES ({nonEmptyCount})
          </Text>

          <VariableTable variables={draft} onChange={setDraft} allowSecrets />
        </div>
      </div>
    </div>
  );
};

export default EnvironmentEditor;
