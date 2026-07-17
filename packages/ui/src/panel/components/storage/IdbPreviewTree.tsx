/**
 * IdbPreviewTree — collapsible tree over a record's host-serialized
 * preview nodes (`IdbRecordPreviewNode`), the Preview mode for values
 * that can't ship as JSON. Same native-`<details>` idiom and syntax
 * colors as `JsonTree`, mirroring the browser's own object-tree view:
 * only the root starts expanded, and every container's summary line
 * carries an inline first-level preview (`Map(1) {"a" => 1}`,
 * `Blob(…) {size: 10, type: "text/plain"}`) — arrays drop index names
 * and bracket with `[…]`, buffers show their description only, nested
 * containers render as their label, overflow appends `…`.
 */

import { Fragment, memo } from 'react';
import type { IdbRecordPreviewNode } from '../../data/storage/storage-inspector-host';

const KEY_STYLE = { color: '#7b61ff' } as const;
const STRING_STYLE = { color: '#1a7f37' } as const;
const NUMBER_STYLE = { color: '#0969da' } as const;
const ATOM_STYLE = { color: '#a371f7' } as const;
const MUTED_STYLE = { color: '#8c8c8c' } as const;

/** Entries shown in a container's inline summary before `…`. */
const INLINE_ENTRIES_MAX = 5;
/** Inline string-atom clip — full strings live on the entry's own row. */
const INLINE_STRING_MAX = 50;

type ContainerNode = Extract<IdbRecordPreviewNode, { kind: 'container' }>;

function AtomValue({ node, clip }: { node: Extract<IdbRecordPreviewNode, { kind: 'atom' }>; clip?: boolean }) {
  if (node.type === 'string') {
    const text = clip && node.text.length > INLINE_STRING_MAX ? `${node.text.slice(0, INLINE_STRING_MAX)}…` : node.text;
    return <span style={STRING_STYLE}>{`"${text}"`}</span>;
  }
  if (node.type === 'number') return <span style={NUMBER_STYLE}>{node.text}</span>;
  if (node.type === 'boolean' || node.type === 'null') return <span style={ATOM_STYLE}>{node.text}</span>;
  return <span style={MUTED_STYLE}>{node.text}</span>;
}

function isArrayLike(label: string): boolean {
  return /^(?:\w+)?Array\(/.test(label);
}

/** ArrayBuffer/DataView summaries carry no value preview — description
 *  only, like the browser's console previews. */
function hasNoInlinePreview(label: string): boolean {
  return /^(?:ArrayBuffer|DataView)\(/.test(label);
}

function isOverflowStub(entry: ContainerNode['entries'][number]): boolean {
  return entry.key === '' && entry.node.kind === 'atom' && entry.node.text.startsWith('… +');
}

/** Inline display key: index names drop inside array brackets, object
 *  prop names lose their quotes, Map `k => ` prefixes stay verbatim. */
function inlineKey(key: string, arrayLike: boolean): string {
  if (key === '') return '';
  if (/^\d+: $/.test(key)) return arrayLike ? '' : key;
  const prop = key.match(/^"(.*)": $/);
  return prop ? `${prop[1]}: ` : key;
}

function InlinePreview({ node }: { node: ContainerNode }) {
  if (hasNoInlinePreview(node.label)) return null;
  const arrayLike = isArrayLike(node.label);
  const visible = node.entries.filter((e) => !isOverflowStub(e));
  const shown = visible.slice(0, INLINE_ENTRIES_MAX);
  const overflow = visible.length > shown.length || visible.length !== node.entries.length;
  return (
    // The class hides the summary while the node is expanded — the
    // children replace it (`details[open]` rule in panel-storage.css).
    <span className="dt-idbpreview-inline" style={MUTED_STYLE}>
      {' '}
      {arrayLike ? '[' : '{'}
      {shown.map((entry, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: entries are positional and immutable per document fetch
        <Fragment key={i}>
          {i > 0 && ', '}
          {inlineKey(entry.key, arrayLike)}
          {entry.node.kind === 'atom' ? (
            <AtomValue node={entry.node} clip />
          ) : (
            <span style={MUTED_STYLE}>{entry.node.label}</span>
          )}
        </Fragment>
      ))}
      {overflow && (shown.length > 0 ? ', …' : '…')}
      {arrayLike ? ']' : '}'}
    </span>
  );
}

interface IdbPreviewTreeProps {
  node: IdbRecordPreviewNode;
  /** Display prefix rendered before the node (host-side key text). */
  prefix?: string;
  /** Expand by default up to this depth (root only, like the browser). */
  defaultExpandedDepth?: number;
  depth?: number;
}

export const IdbPreviewTree = memo(function IdbPreviewTree({
  node,
  prefix,
  defaultExpandedDepth = 1,
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
        <InlinePreview node={node} />
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
