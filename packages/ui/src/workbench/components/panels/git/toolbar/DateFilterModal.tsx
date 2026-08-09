/**
 * DateFilterModal — the Date chip's Select… dialog: an explicit
 * since/until range (either side optional, inclusive), panel-centered
 * like every Git tool window dialog. Values are plain `YYYY-MM-DD`
 * strings — exactly the wire shape the log verb validates.
 */

import { Input, Modal } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface DateFilterModalProps {
  open: boolean;
  since: string | null;
  until: string | null;
  /** The Git tool window element — dialogs center over the panel. */
  container: HTMLElement | null;
  onClose: () => void;
  onApply: (since: string | null, until: string | null) => void;
}

const DateFilterModal: React.FC<DateFilterModalProps> = ({ open, since, until, container, onClose, onApply }) => {
  const t = useT();
  const [sinceValue, setSinceValue] = useState('');
  const [untilValue, setUntilValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setSinceValue(since ?? '');
    setUntilValue(until ?? '');
  }, [open, since, until]);

  const apply = (): void => {
    onApply(sinceValue === '' ? null : sinceValue, untilValue === '' ? null : untilValue);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t('workbench.gitLog.date.title')}
      okText={t('workbench.gitLog.modal.ok')}
      cancelText={t('workbench.gitLog.modal.cancel')}
      okButtonProps={{ disabled: sinceValue === '' && untilValue === '' }}
      onOk={apply}
      onCancel={onClose}
      width={380}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: '0 0 52px' }}>{t('workbench.gitLog.date.since')}</span>
          <Input
            type="date"
            value={sinceValue}
            onChange={(e) => setSinceValue(e.target.value)}
            data-testid="git-tool-date-since"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: '0 0 52px' }}>{t('workbench.gitLog.date.until')}</span>
          <Input
            type="date"
            value={untilValue}
            onChange={(e) => setUntilValue(e.target.value)}
            data-testid="git-tool-date-until"
          />
        </div>
      </div>
    </Modal>
  );
};

export default DateFilterModal;
