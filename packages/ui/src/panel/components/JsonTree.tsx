/**
 * Minimal collapsible JSON tree viewer for HAR detail panes. No
 * external dependency; built on native `<details>` so keyboard nav
 * and text selection work out of the box.
 *
 * Values render with type-hinted colors:
 *   - strings → green
 *   - numbers → blue
 *   - booleans / null → purple
 *   - objects / arrays → collapsible disclosure with child count
 *
 * Handles the three edge cases in our HAR payloads explicitly:
 *   - empty objects / arrays render inline (no disclosure triangle)
 *   - long strings wrap instead of overflowing the container
 *   - circular refs (not expected from HAR but defensive) show `[Circular]`
 */

import { memo } from 'react';

interface JsonTreeProps {
  value: unknown;
  name?: string;
  /** Expand by default up to this depth. */
  defaultExpandedDepth?: number;
  depth?: number;
  seen?: WeakSet<object>;
}

// JSON syntax tokens — rendered verbatim, never localized.
const NULL_TEXT = 'null';
const CIRCULAR_TEXT = '[Circular]';

const KEY_STYLE = { color: '#7b61ff' } as const;
const STRING_STYLE = { color: '#1a7f37' } as const;
const NUMBER_STYLE = { color: '#0969da' } as const;
const ATOM_STYLE = { color: '#a371f7' } as const;
const MUTED_STYLE = { color: '#8c8c8c' } as const;

function LabelKey({ name }: { name?: string }) {
  if (name == null) return null;
  return (
    <>
      <span style={KEY_STYLE}>{`"${name}"`}</span>
      <span>: </span>
    </>
  );
}

export const JsonTree = memo(function JsonTree({
  value,
  name,
  defaultExpandedDepth = 1,
  depth = 0,
  seen,
}: JsonTreeProps) {
  if (value === null) {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={ATOM_STYLE}>{NULL_TEXT}</span>
      </div>
    );
  }
  if (typeof value === 'string') {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={STRING_STYLE}>{`"${value}"`}</span>
      </div>
    );
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={NUMBER_STYLE}>{String(value)}</span>
      </div>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={ATOM_STYLE}>{String(value)}</span>
      </div>
    );
  }
  if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol') {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={MUTED_STYLE}>{typeof value}</span>
      </div>
    );
  }

  const seenSet = seen ?? new WeakSet<object>();
  if (seenSet.has(value as object)) {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={MUTED_STYLE}>{CIRCULAR_TEXT}</span>
      </div>
    );
  }
  seenSet.add(value as object);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
          <LabelKey name={name} />
          <span style={MUTED_STYLE}>[]</span>
        </div>
      );
    }
    return (
      <details open={depth < defaultExpandedDepth} style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <summary style={{ cursor: 'pointer' }}>
          <LabelKey name={name} />
          <span style={MUTED_STYLE}>{`[${value.length}]`}</span>
        </summary>
        {value.map((item, i) => (
          <JsonTree
            key={i}
            value={item}
            name={String(i)}
            depth={depth + 1}
            defaultExpandedDepth={defaultExpandedDepth}
            seen={seenSet}
          />
        ))}
      </details>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <LabelKey name={name} />
        <span style={MUTED_STYLE}>{'{}'}</span>
      </div>
    );
  }
  return (
    <details open={depth < defaultExpandedDepth} style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <summary style={{ cursor: 'pointer' }}>
        <LabelKey name={name} />
        <span style={MUTED_STYLE}>{`{${entries.length}}`}</span>
      </summary>
      {entries.map(([k, v]) => (
        <JsonTree
          key={k}
          value={v}
          name={k}
          depth={depth + 1}
          defaultExpandedDepth={defaultExpandedDepth}
          seen={seenSet}
        />
      ))}
    </details>
  );
});
