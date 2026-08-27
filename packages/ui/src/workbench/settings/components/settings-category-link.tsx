/**
 * SettingsCategoryLink — an inline link to another settings page,
 * labelled with that page's own category label. Rides the shell's
 * navigation context; outside the shell (the Server Admin console
 * embeds) it renders disabled rather than dead.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { resolveLabel } from '../localize';
import { useSelectSettingsCategory } from '../NavigationContext';
import { getCategory } from '../registry';

const SettingsCategoryLink: React.FC<{ categoryId: string; testid?: string }> = ({ categoryId, testid }) => {
  const { token } = theme.useToken();
  const t = useT();
  const selectCategory = useSelectSettingsCategory();
  const target = getCategory(categoryId);
  if (!target) return null;
  return (
    <button
      type="button"
      onClick={() => selectCategory?.(target.id)}
      disabled={selectCategory === null}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        font: 'inherit',
        color: token.colorPrimary,
        cursor: 'pointer',
      }}
      data-testid={testid}
    >
      {resolveLabel(target, t)}
    </button>
  );
};

export default SettingsCategoryLink;
