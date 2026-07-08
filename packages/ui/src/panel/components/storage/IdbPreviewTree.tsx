/**
 * IdbPreviewTree — collapsible tree over a record's host-serialized
 * preview nodes (`IdbRecordPreviewNode`), the Preview mode for values
 * that can't ship as JSON. Same native-`<details>` idiom and syntax
 * colors as `JsonTree`; `tag` atoms (Date, binary, Map labels, cap
 * stubs) render muted, mirroring the browser's own object-tree view.
 */

import { memo } from 'react';
import type { IdbRecordPreviewNode } from '../../data/storage/storage-inspector-host';

const KEY_STYLE = { color: '#7b61ff' } as const;
const STRING_STYLE = { color: '#1a7f37' } as const;
const NUMBER_STYLE = { color: '#0969da' } as const;
const ATOM_STYLE = { color: '#a371f7' } as const;
const MUTED_STYLE = { color: '#8c8c8c' } as const;

function AtomValue({ node }: { node: Extract<IdbRecordPreviewNode, { kind: 'atom' }> }) {
  if (node.type === 'string') return <span style={STRING_STYLE}>&quot;{node.text}&quot;</span>;
  if (node.type === 'number') return <span style={NUMBER_STYLE}>{node.text}</span>;
  if (node.type === 'boolean' || node.type === 'null') return <span style={ATOM_STYLE}>{node.text}</span>;
  return <span style={MUTED_STYLE}>{node.text}</span>;
}

interface IdbPreviewTreeProps {
  node: IdbRecordPreviewNode;
  /** Display prefix rendered before the node (host-side key text). */
  prefix?: string;
  /** Expand by default up to this depth. */
  defaultExpandedDepth?: number;
  depth?: number;
}

export const IdbPreviewTree = memo(function IdbPreviewTree({
  node,
  prefix,
  defaultExpandedDepth = 2,
  depth = 0,
}: IdbPreviewTreeProps) {
  const label = prefix ? <span style={KEY_STYLE}>{prefix}</span> : null;
  if (node.kind === 'atom') {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        {label}
        <AtomValue node={node} />
      </div>
    );
  }
  if (node.entries.length === 0) {
    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        {label}
        <span style={MUTED_STYLE}>{node.label}</span>
      </div>
    );
  }
  return (
    <details open={depth < defaultExpandedDepth} style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <summary style={{ cursor: 'pointer' }}>
        {label}
        <span style={MUTED_STYLE}>{node.label}</span>
      </summary>
      {node.entries.map((entry, i) => (
        <IdbPreviewTree
          // biome-ignore lint/suspicious/noArrayIndexKey: entries are positional and immutable per document fetch
          key={i}
          node={entry.node}
          prefix={entry.key}
          depth={depth + 1}
          defaultExpandedDepth={defaultExpandedDepth}
        />
      ))}
    </details>
  );
});
