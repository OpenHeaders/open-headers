/**
 * Shared chrome of the server-admin domain tabs: the uppercase section
 * header (title + hint line) the Users and Git surfaces render above
 * their cards, and the timestamp formatter the directory rows read.
 */

import { theme } from 'antd';
import type React from 'react';
import { getDateTimeFormat } from '@openheaders/i18n';

export const SectionHeader: React.FC<{ title: string; hint: string }> = ({ title, hint }) => {
  const { token } = theme.useToken();
  return (
    <header style={{ marginBottom: 6, padding: '0 2px' }}>
      <h3
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: token.colorTextSecondary,
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>{hint}</div>
    </header>
  );
};

export function formatTimestamp(locale: string, ms: number | null | undefined): string {
  if (!ms) return '—';
  try {
    return getDateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(ms));
  } catch {
    return '—';
  }
}
