/**
 * WhatsNewHistory — the What's New tab's "Previous releases" section,
 * fed by the host's `whatsNewHistory` capability (the static changelog
 * feed's per-stream view). Enhancement-only per the offline law: the
 * bundled current entry above never depends on it, so a missing
 * capability, an unreachable feed, and an empty history all render
 * nothing. Only releases older than the running build list; prose rows
 * expand in place, fetching the entry body lazily, with images demoted
 * to links (the desktop renderer's CSP blocks remote images, and a
 * render must not dial the feed).
 */

import { getCapability } from '@openheaders/core/capabilities';
import { type ChangelogIndexRow, compareChangelogVersions } from '@openheaders/core/changelog-feed';
import { Button, Divider, Spin, Tag, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { getDateTimeFormat } from '@openheaders/i18n';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { getBuildInfo } from '../../../shared/build-info';
import { demoteImagesToLinks } from '../../../shared/markdown/demote-images';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';

const { Title, Text } = Typography;

function formatDate(locale: string, isoDate: string): string {
  try {
    return getDateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

const WhatsNewHistory: React.FC = () => {
  const { t, locale } = useLocale();
  const { token } = theme.useToken();
  const api = useMemo(() => getCapability('whatsNewHistory')?.(), []);
  const [rows, setRows] = useState<readonly ChangelogIndexRow[] | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [bodies, setBodies] = useState<Readonly<Record<string, string | null | 'loading'>>>({});

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const currentBase = getBuildInfo().version.replace(/-beta\.\d+$/, '');
    void api.list().then((fetched) => {
      if (cancelled || fetched === null) return;
      setRows(fetched.filter((row) => compareChangelogVersions(row.version, currentBase) < 0));
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!api || rows === null || rows.length === 0) return null;

  function toggle(row: ChangelogIndexRow): void {
    const next = new Set(expanded);
    if (next.has(row.version)) {
      next.delete(row.version);
    } else {
      next.add(row.version);
      if (bodies[row.version] === undefined) {
        setBodies((prev) => ({ ...prev, [row.version]: 'loading' }));
        void api?.entryBody(row.version).then((body) => {
          setBodies((prev) => ({ ...prev, [row.version]: body }));
        });
      }
    }
    setExpanded(next);
  }

  return (
    <div style={{ marginTop: 40 }} data-testid="whats-new-history">
      <Divider style={{ margin: '0 0 20px' }} />
      <Title level={4} style={{ marginBottom: 12 }}>
        {t('workbench.whatsNew.historyTitle')}
      </Title>
      {rows.map((row) => {
        const open = expanded.has(row.version);
        const body = bodies[row.version];
        return (
          <div key={row.version} style={{ marginBottom: 16 }} data-testid={`whats-new-history-${row.version}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text strong>{row.version}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatDate(locale, row.date)}
              </Text>
              {row.channel === 'beta' && <Tag style={{ marginInlineEnd: 0 }}>{t('workbench.whatsNew.historyBetaTag')}</Tag>}
              {row.severity === 'security' && (
                <Tag color="red" style={{ marginInlineEnd: 0 }}>
                  {t('workbench.whatsNew.historySecurityTag')}
                </Tag>
              )}
              {row.hasNotes && (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => toggle(row)}>
                  {open ? t('workbench.whatsNew.historyHideNotes') : t('workbench.whatsNew.historyShowNotes')}
                </Button>
              )}
            </div>
            {row.highlights !== undefined && !open && (
              <ul style={{ margin: '4px 0 0', paddingInlineStart: 20, color: token.colorTextSecondary, fontSize: 12 }}>
                {row.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}
            {open && (
              <div style={{ marginTop: 8 }}>
                {body === 'loading' ? (
                  <Spin size="small" />
                ) : typeof body === 'string' ? (
                  <MarkdownView>{demoteImagesToLinks(body)}</MarkdownView>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('workbench.whatsNew.historyNotesUnavailable')}
                  </Text>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WhatsNewHistory;
