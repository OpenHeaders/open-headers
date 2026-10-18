/**
 * Shared footer for the value-editor modals — Cancel plus the accent
 * Save (icon + ⌘S/Ctrl+S tooltip hint, the variant's save accent only
 * while enabled, matching the editor-shell Save). Dirtiness is the
 * caller's derived state; this is presentation only.
 */

import { SaveOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useUiTheme } from '@openheaders/ui/context/ui-theme';
import { isMac } from '@openheaders/ui/shared/platform';
import { Button, Tooltip } from 'antd';
import type React from 'react';

export const SAVE_SHORTCUT = isMac ? '⌘S' : 'Ctrl+S';

interface EditorModalFooterProps {
  saveDisabled: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export const EditorModalFooter: React.FC<EditorModalFooterProps> = ({ saveDisabled, onSave, onCancel }) => {
  const t = useT();
  const { saveAccent } = useUiTheme();
  return (
    <>
      <Button onClick={onCancel}>{t('shared.action.cancel')}</Button>
      <Tooltip
        title={<ShortcutHintTitle label={SAVE_SHORTCUT}>{t('shared.action.save')}</ShortcutHintTitle>}
        placement="top"
      >
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={saveDisabled}
          onClick={onSave}
          style={saveDisabled ? undefined : { background: saveAccent, borderColor: saveAccent }}
        >
          {t('shared.action.save')}
        </Button>
      </Tooltip>
    </>
  );
};
