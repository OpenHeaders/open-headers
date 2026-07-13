/**
 * ResponseJsonPreview — collapsible key/value tree over a parsed JSON
 * body, the Preview mode for JSON responses (HTML keeps the sandboxed
 * iframe). Containers render as a row with a `{n}` / `[n]` count badge
 * and expand on click; primitives render inline. Only the visible rows
 * hit the DOM, so a large body with collapsed groups stays cheap.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { useState } from 'react';

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function entriesOf(value: Record<string, unknown> | unknown[]): Array<[string, unknown]> {
  return Array.isArray(value) ? value.map((item, i): [string, unknown] => [String(i), item]) : Object.entries(value);
}

function countBadge(value: Record<string, unknown> | unknown[]): string {
  return Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'null';
  return String(value);
}

function JsonEntryRow({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  const container = isContainer(value);
  const expandable = container && entriesOf(value).length > 0;

  const row = (
    <div
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
      onClick={expandable ? () => setExpanded((prev) => !prev) : undefined}
      onKeyDown={
        expandable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setExpanded((prev) => !prev);
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: `5px 10px 5px ${10 + depth * 16}px`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        cursor: expandable ? 'pointer' : 'default',
      }}
    >
      <CaretRightOutlined
        style={{
          fontSize: 10,
          color: token.colorTextTertiary,
          transform: expanded ? 'rotate(90deg)' : undefined,
          transition: 'transform 0.15s',
          visibility: expandable ? 'visible' : 'hidden',
        }}
      />
      <span style={{ ...cellFont, fontWeight: 600, color: token.colorText, wordBreak: 'break-all' }}>{name}</span>
      {container ? (
        <span
          style={{
            ...cellFont,
            fontSize: 11,
            color: token.colorTextSecondary,
            background: token.colorFillSecondary,
            borderRadius: 4,
            padding: '0 5px',
          }}
        >
          {countBadge(value)}
        </span>
      ) : (
        <span style={{ ...cellFont, color: token.colorTextSecondary, wordBreak: 'break-all', minWidth: 0 }}>
          {formatPrimitive(value)}
        </span>
      )}
    </div>
  );

  return (
    <>
      {row}
      {expandable &&
        expanded &&
        entriesOf(value).map(([childName, childValue]) => (
          <JsonEntryRow key={childName} name={childName} value={childValue} depth={depth + 1} />
        ))}
    </>
  );
}

const ResponseJsonPreview: React.FC<{ value: unknown }> = ({ value }) => {
  const { token } = theme.useToken();

  return (
    <div
      data-testid="oh-response-json-preview"
      style={{
        flex: 1,
        overflow: 'auto', overscrollBehavior: 'none',
        minHeight: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
      }}
    >
      {isContainer(value) ? (
        entriesOf(value).map(([name, childValue]) => (
          <JsonEntryRow key={name} name={name} value={childValue} depth={0} />
        ))
      ) : (
        <div style={{ ...cellFont, padding: '5px 10px', color: token.colorTextSecondary }}>
          {formatPrimitive(value)}
        </div>
      )}
    </div>
  );
};

export default ResponseJsonPreview;
