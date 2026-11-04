/**
 * ConsoleRow — one invocation in the Console tab: the timestamp, the
 * working tree in brackets, `git`, the pinned options run (a chip
 * while folded, a click lays it open and folds it back), the command
 * with its operands, a non-zero exit, and the captured output beneath.
 * Tokens with more to say than they show carry `data-full` for the
 * feed's one hover title.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { theme } from 'antd';

const { useToken } = theme;
import type React from 'react';
import { type ConsoleLinePosture, type ConsoleToken, consoleCommandLine, consoleToken } from './git-console-line-model';

export interface ConsoleRowProps {
  row: WorkspaceTreeGitConsoleRowWire;
  posture: ConsoleLinePosture;
  locale: string;
  lineStyle: React.CSSProperties;
  onToggleExpanded: (seq: number) => void;
}

function timestamp(at: string, locale: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${ms}`;
}

/** A shortened path paints its elision as a marker in the chip's fill — the fold announces itself. */
const Token: React.FC<{ token: ConsoleToken }> = ({ token }) => {
  const { token: tokens } = useToken();
  if (token.kind !== 'path') return <>{token.text}</>;
  return (
    <span data-full={token.full}>
      {token.head}
      <span style={{ background: tokens.colorFillTertiary, borderRadius: tokens.borderRadiusXS, padding: '0 2px' }}>…</span>
      {token.tail}
    </span>
  );
};

/** Tokens joined by single spaces, each a span so a path keeps its own hover title. */
const Tokens: React.FC<{ tokens: readonly ConsoleToken[] }> = ({ tokens }) => (
  <>
    {tokens.map((token, index) => (
      <span key={index}>
        {index > 0 ? ' ' : ''}
        <Token token={token} />
      </span>
    ))}
  </>
);

const ConsoleRow: React.FC<ConsoleRowProps> = ({ row, posture, locale, lineStyle, onToggleExpanded }) => {
  const { token } = theme.useToken();
  const line = consoleCommandLine(row, posture);
  const cwd = consoleToken(row.cwd, posture.shortenPaths);
  const toggle = (): void => onToggleExpanded(row.seq);
  const runStyle: React.CSSProperties = {
    borderRadius: token.borderRadiusSM,
    padding: '0 4px',
    cursor: 'pointer',
  };

  return (
    <div data-testid="git-tool-console-row" data-seq={row.seq}>
      <div style={{ color: token.colorText, ...lineStyle }}>
        <span style={{ color: token.colorTextTertiary }}>{timestamp(row.at, locale)}: </span>
        <span style={{ color: token.colorTextSecondary }}>
          [<Token token={cwd} />]{' '}
        </span>
        <code style={{ fontFamily: 'inherit' }}>
          git{' '}
          {line.options !== null &&
            (line.options.state === 'folded' ? (
              <span
                role="button"
                tabIndex={0}
                data-testid="git-tool-console-fold"
                data-full={line.options.full}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggle();
                }}
                style={{ ...runStyle, background: token.colorFillTertiary, color: token.colorTextSecondary }}
              >
                {line.options.text}
              </span>
            ) : line.options.collapsible ? (
              <span
                role="button"
                tabIndex={0}
                data-testid="git-tool-console-fold"
                data-open=""
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggle();
                }}
                style={{ ...runStyle, background: token.colorFillQuaternary }}
              >
                <Tokens tokens={line.options.tokens} />
              </span>
            ) : (
              <Tokens tokens={line.options.tokens} />
            ))}
          {line.options !== null && line.command.length > 0 ? ' ' : ''}
          <Tokens tokens={line.command} />
        </code>
        {row.code !== 0 && <span style={{ color: token.colorErrorText }}> → {row.code}</span>}
      </div>
      {row.output !== '' && (
        <div
          style={{
            ...lineStyle,
            color: row.code === 0 ? token.colorTextSecondary : token.colorErrorText,
            margin: '0 0 4px',
          }}
        >
          {row.output}
        </div>
      )}
    </div>
  );
};

export default ConsoleRow;
