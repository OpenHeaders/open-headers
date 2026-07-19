/**
 * Terminal-profiles row — custom editor for `terminal.profiles`.
 * Manages the profile list and the default choice as one value: the
 * "System default shell" entry stands for `defaultProfileId: null`
 * (the host's own resolution), and deleting the default profile
 * re-points the default in the same write, so the two can never tear.
 * Profiles resolve at spawn time — edits here apply to the next shell
 * a tab starts, never to running ones.
 */

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Radio, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useSetting } from '../hooks';
import { resolveDescription, resolveLabel } from '../localize';
import type { TerminalProfile } from '../schema/terminal';
import type { SettingDef } from '../types';

const { Text } = Typography;

interface ProfileDraft {
  /** Existing profile id being edited, or null for a new profile. */
  id: string | null;
  name: string;
  shell: string;
  /** Space-joined for editing; split back to argv on save. */
  args: string;
  cwd: string;
}

const EMPTY_DRAFT: ProfileDraft = { id: null, name: '', shell: '', args: '', cwd: '' };

function profileSummary(profile: TerminalProfile): string {
  const command = [profile.shell, ...profile.args].join(' ');
  return profile.cwd !== undefined && profile.cwd.length > 0 ? `${command} — ${profile.cwd}` : command;
}

const TerminalProfilesRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const [value, setValue] = useSetting('terminal.profiles');
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  const openAdd = (): void => setDraft(EMPTY_DRAFT);
  const openEdit = (profile: TerminalProfile): void =>
    setDraft({
      id: profile.id,
      name: profile.name,
      shell: profile.shell,
      args: profile.args.join(' '),
      cwd: profile.cwd ?? '',
    });

  const saveDraft = (): void => {
    if (draft === null) return;
    const name = draft.name.trim();
    const shell = draft.shell.trim();
    if (name.length === 0 || shell.length === 0) return;
    const cwd = draft.cwd.trim();
    const profile: TerminalProfile = {
      id: draft.id ?? crypto.randomUUID(),
      name,
      shell,
      args: draft.args.trim().length === 0 ? [] : draft.args.trim().split(/\s+/),
      ...(cwd.length > 0 ? { cwd } : {}),
    };
    const profiles =
      draft.id === null
        ? [...value.profiles, profile]
        : value.profiles.map((existing) => (existing.id === draft.id ? profile : existing));
    setValue({ ...value, profiles });
    setDraft(null);
  };

  const removeProfile = (id: string): void => {
    setValue({
      profiles: value.profiles.filter((profile) => profile.id !== id),
      defaultProfileId: value.defaultProfileId === id ? null : value.defaultProfileId,
    });
  };

  const setDefault = (id: string | null): void => setValue({ ...value, defaultProfileId: id });

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  };

  return (
    <FieldRow settingKey={def.key} label={resolveLabel(def, t)} description={resolveDescription(def, t)} block>
      <div data-testid="terminal-profiles">
        <div style={rowStyle} data-testid="terminal-profile-system">
          <Radio checked={value.defaultProfileId === null} onChange={() => setDefault(null)}>
            {t('workbench.settings.terminalProfiles.systemDefault')}
          </Radio>
        </div>
        {value.profiles.map((profile) => (
          <div key={profile.id} style={rowStyle} data-testid="terminal-profile-row">
            <Radio
              checked={value.defaultProfileId === profile.id}
              onChange={() => setDefault(profile.id)}
              style={{ minWidth: 0 }}
            >
              {profile.name}
            </Radio>
            <Text type="secondary" style={{ fontSize: 12, flex: 1, minWidth: 0 }} ellipsis={{ tooltip: true }}>
              {profileSummary(profile)}
            </Text>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              aria-label={t('workbench.settings.terminalProfiles.edit')}
              onClick={() => openEdit(profile)}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('workbench.settings.terminalProfiles.remove')}
              onClick={() => removeProfile(profile.id)}
            />
          </div>
        ))}
        <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 4 }} onClick={openAdd}>
          {t('workbench.settings.terminalProfiles.add')}
        </Button>
      </div>

      <Modal
        title={
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {draft?.id === null
              ? t('workbench.settings.terminalProfiles.addTitle')
              : t('workbench.settings.terminalProfiles.editTitle')}
          </span>
        }
        width={420}
        open={draft !== null}
        okText={t('workbench.settings.terminalProfiles.save')}
        okButtonProps={{
          size: 'small',
          disabled: draft === null || draft.name.trim().length === 0 || draft.shell.trim().length === 0,
        }}
        cancelButtonProps={{ size: 'small' }}
        onOk={saveDraft}
        onCancel={() => setDraft(null)}
        destroyOnHidden
      >
        {draft !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <div>
              <Text style={{ fontSize: 12 }}>{t('workbench.settings.terminalProfiles.name')}</Text>
              <Input
                size="small"
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12 }}>{t('workbench.settings.terminalProfiles.shell')}</Text>
              <Input
                size="small"
                placeholder="/bin/zsh"
                value={draft.shell}
                onChange={(e) => setDraft({ ...draft, shell: e.target.value })}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12 }}>{t('workbench.settings.terminalProfiles.args')}</Text>
              <Input
                size="small"
                placeholder="-l"
                value={draft.args}
                onChange={(e) => setDraft({ ...draft, args: e.target.value })}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12 }}>{t('workbench.settings.terminalProfiles.cwd')}</Text>
              <Input
                size="small"
                placeholder={t('workbench.settings.terminalProfiles.cwdPlaceholder')}
                value={draft.cwd}
                onChange={(e) => setDraft({ ...draft, cwd: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </FieldRow>
  );
};

export default TerminalProfilesRow;
