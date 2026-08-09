/**
 * PathsFilterModal — the Paths chip's Select… dialog: repo-relative
 * tree paths, one per line; the verb validates the shapes for real
 * (`invalid-filter`), this dialog only trims and drops empties.
 * Panel-centered like every Git tool window dialog.
 */

import { Input, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface PathsFilterModalProps {
  open: boolean;
  paths: readonly string[];
  /** The Git tool window element — dialogs center over the panel. */
  container: HTMLElement | null;
  onClose: () => void;
  onApply: (paths: string[]) => void;
}

const PathsFilterModal: React.FC<PathsFilterModalProps> = ({ open, paths, container, onClose, onApply }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue(paths.join('\n'));
  }, [open, paths]);

  const apply = (): void => {
    const next = value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    onApply(next);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t('workbench.gitLog.paths.title')}
      okText={t('workbench.gitLog.modal.ok')}
      cancelText={t('workbench.gitLog.modal.cancel')}
      onOk={apply}
      onCancel={onClose}
      width={440}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
        <Input.TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoSize={{ minRows: 4, maxRows: 10 }}
          style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}
          data-testid="git-tool-paths-input"
        />
        <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>{t('workbench.gitLog.paths.hint')}</span>
      </div>
    </Modal>
  );
};

export default PathsFilterModal;
