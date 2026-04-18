/**
 * EnvironmentEditor — tab body for editing one environment's variables.
 *
 * Controlled by a local draft: edits are live in UI, committed to the
 * SW via `updateEnvironmentVariables` on Save. Dirty tracking piggybacks
 * on the draft vs persisted fingerprint so the breadcrumb bar renders
 * the save cue consistently with every other editor tab.
 */

import { CheckCircleTwoTone, GlobalOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import type { V5 } from '@openheaders/core/types';
import { Button, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VariableTable from './panels/VariableTable';

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
  const { environments, activeEnvironmentId, updateEnvironmentVariables, setActiveEnvironment } = useEnvironments();

  const env = useMemo(() => environments.find((e) => e.uid === environmentUid) ?? null, [environments, environmentUid]);

  const [draft, setDraft] = useState<V5.Variable[]>(() => env?.variables ?? []);
  const persistedFpRef = useRef<string>(fingerprint(env?.variables ?? []));

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

  const handleSave = useCallback(() => {
    if (!env || !isDirty) return;
    void updateEnvironmentVariables(env.uid, draft).then((ok) => {
      if (ok) {
        persistedFpRef.current = fingerprint(draft);
        onDirtyChange?.(false);
      }
    });
  }, [env, isDirty, draft, updateEnvironmentVariables, onDirtyChange]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  if (!env) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Environment not found.</Text>
      </div>
    );
  }

  const isActive = activeEnvironmentId === env.uid;
  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
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
          </div>
          <div>
            {!isActive && (
              <Button size="small" icon={<CheckCircleTwoTone />} onClick={() => void setActiveEnvironment(env.uid)}>
                Set active
              </Button>
            )}
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
