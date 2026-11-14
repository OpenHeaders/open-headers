/**
 * console-menu — the Console feed's right-click menu (the reference
 * design on this product's vocabulary): Copy (what is selected, as the
 * text was — live while something is), then Clear All (the gutter's
 * own verb). The reference's other rows have no surface here or leave
 * the app, and are not carried. Pure over (t, state, handlers).
 */

import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { menuLabel } from './git-menu-label';

export interface ConsoleMenuState {
  /** Something is selected in the feed. */
  canCopy: boolean;
  /** The feed holds rows. */
  canClear: boolean;
  /** The platform's copy chord, as a hint. */
  copyHint: string;
}

export interface ConsoleMenuHandlers {
  onCopy: () => void;
  onClear: () => void;
}

export function buildConsoleMenu(t: Translate, state: ConsoleMenuState, h: ConsoleMenuHandlers): MenuProps {
  return {
    items: [
      {
        key: 'copy',
        label: menuLabel(<CopyOutlined />, t('shared.action.copy'), state.copyHint, 'git-tool-console-menu-copy'),
        disabled: !state.canCopy,
        onClick: h.onCopy,
      },
      { type: 'divider' },
      {
        key: 'clear',
        label: menuLabel(
          <DeleteOutlined />,
          t('workbench.gitLog.console.clearAll'),
          undefined,
          'git-tool-console-menu-clear',
        ),
        disabled: !state.canClear,
        onClick: h.onClear,
      },
    ],
  };
}
