/**
 * ConsoleView — the Git tool window's read-only Console tab (the IDE
 * VCS-console precedent): every state-changing git command the engine
 * ran in this workspace's repo, timestamped, with its combined output
 * beneath — a transparency feed, never an input. Auto-follows the tail
 * like a terminal.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';

export interface ConsoleViewProps {
  rows: WorkspaceTreeGitConsoleRowWire[];
}

function timestamp(at: string, locale: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${ms}`;
}

const ConsoleView: React.FC<ConsoleViewProps> = ({ rows }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow the tail on every refresh, terminal-style.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows]);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '8px 14px',
        fontFamily: token.fontFamilyCode,
        fontSize: 11.5,
        lineHeight: 1.6,
      }}
      data-testid="git-tool-console"
    >
      {rows.length === 0 ? (
        <div style={{ color: token.colorTextSecondary, fontFamily: token.fontFamily, fontSize: 12 }}>
          {t('workbench.gitLog.console.empty')}
        </div>
      ) : (
        rows.map((row, index) => (
          <div key={`${row.at}:${index}`} data-testid="git-tool-console-row">
            <div style={{ color: token.colorText, overflowWrap: 'anywhere' }}>
              <span style={{ color: token.colorTextTertiary }}>{timestamp(row.at, locale)}: </span>
              <span style={{ color: token.colorTextSecondary }}>[{row.cwd}] </span>
              git {row.args.join(' ')}
              {row.code !== 0 && <span style={{ color: token.colorErrorText }}> → {row.code}</span>}
            </div>
            {row.output !== '' && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  color: row.code === 0 ? token.colorTextSecondary : token.colorErrorText,
                  margin: '0 0 4px',
                }}
              >
                {row.output}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ConsoleView;
