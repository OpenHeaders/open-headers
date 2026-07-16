/**
 * Spec outline derivation — the editor's structure pane, computed from
 * the source text and never stored (the spec text is the source of
 * truth; the outline recomputes on the parse-on-idle result).
 *
 * `yaml.parseDocument` is the single position source for BOTH
 * syntaxes: YAML 1.2 is a strict superset of JSON, so a `.json` root
 * file parses through the same AST and every node carries a
 * `range: [start, valueEnd, nodeEnd]` character offset the editor maps
 * to a line via `getPositionAt`. The vendor groups (Servers / Tags /
 * Paths / Components / Security) derive here from the document; the
 * Files group is entity data (`spec.files`), composed by the pane.
 */

import type { ProtoStreamingShape } from '@openheaders/core/proto';
import type { Pair, YAMLMap, YAMLSeq } from 'yaml';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

export type SpecOutlineKind =
  | 'group'
  | 'server'
  | 'tag'
  | 'path'
  | 'operation'
  | 'schema'
  | 'securityScheme'
  | 'securityRequirement'
  // Protobuf documents (`proto-outline.ts` derives these).
  | 'package'
  | 'import'
  | 'service'
  | 'rpc'
  | 'message'
  | 'enum';

export interface SpecOutlineNode {
  /** Stable tree key — kind-prefixed path so expansion survives recomputes. */
  key: string;
  label: string;
  kind: SpecOutlineKind;
  /** Character offset of the node's source position; null when the
   *  section is absent from the document (group header only). */
  offset: number | null;
  /** Character offset just past the node's source text — the editor's
   *  section highlight spans offset..end. Absent when the parser gives
   *  no end (protobuf census rows) — the highlight falls back to the
   *  node's own line. */
  end?: number;
  /** HTTP verb, uppercased — operation nodes only. */
  method?: string;
  /** Call shape from the `stream` keywords — rpc nodes only. */
  streaming?: ProtoStreamingShape;
  children: SpecOutlineNode[];
}

/** The five document-derived vendor groups, in vendor order. */
export interface SpecOutline {
  servers: SpecOutlineNode;
  tags: SpecOutlineNode;
  paths: SpecOutlineNode;
  components: SpecOutlineNode;
  security: SpecOutlineNode;
}

const OPERATION_KEYS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function nodeRange(node: unknown): [number, number, number] | null {
  if (node !== null && typeof node === 'object' && 'range' in node) {
    const range = (node as { range?: [number, number, number] | null }).range;
    if (Array.isArray(range)) return range;
  }
  return null;
}

function nodeOffset(node: unknown): number | null {
  return nodeRange(node)?.[0] ?? null;
}

/** End of the node's own source text (`range[2]` — past trailing content). */
function nodeEnd(node: unknown): number | null {
  return nodeRange(node)?.[2] ?? null;
}

function pairOffset(pair: Pair): number | null {
  return nodeOffset(pair.key) ?? nodeOffset(pair.value);
}

/** A pair's section spans key start → value end. */
function pairEnd(pair: Pair): number | null {
  return nodeEnd(pair.value) ?? nodeEnd(pair.key);
}

/** Spread-ready `end` — present only when the AST carries one. */
function endOf(end: number | null): { end?: number } {
  return end !== null ? { end } : {};
}

function keyString(pair: Pair): string | null {
  return isScalar(pair.key) && (typeof pair.key.value === 'string' || typeof pair.key.value === 'number')
    ? String(pair.key.value)
    : null;
}

/** The pair for `key` on a map, or null — offsets need the Pair, not the value. */
function findPair(map: YAMLMap, key: string): Pair | null {
  return map.items.find((item) => keyString(item) === key) ?? null;
}

/** Scalar string property of a map node, e.g. a server's `url`. */
function scalarProp(node: unknown, key: string): string | null {
  if (!isMap(node)) return null;
  const pair = findPair(node, key);
  if (!pair || !isScalar(pair.value)) return null;
  const value = pair.value.value;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function group(key: string, pair: Pair | null, children: SpecOutlineNode[]): SpecOutlineNode {
  return {
    key,
    label: key,
    kind: 'group',
    offset: pair ? pairOffset(pair) : null,
    ...endOf(pair ? pairEnd(pair) : null),
    children,
  };
}

function seqItems(pair: Pair | null): { seq: YAMLSeq; items: unknown[] } | null {
  if (!pair || !isSeq(pair.value)) return null;
  return { seq: pair.value, items: pair.value.items };
}

function buildServers(pair: Pair | null): SpecOutlineNode {
  const read = seqItems(pair);
  const children: SpecOutlineNode[] = [];
  read?.items.forEach((item, i) => {
    const url = scalarProp(item, 'url');
    children.push({
      key: `server:${i}`,
      label: url ?? `servers[${i}]`,
      kind: 'server',
      offset: nodeOffset(item),
      ...endOf(nodeEnd(item)),
      children: [],
    });
  });
  return group('servers', pair, children);
}

function buildTags(pair: Pair | null): SpecOutlineNode {
  const read = seqItems(pair);
  const children: SpecOutlineNode[] = [];
  read?.items.forEach((item, i) => {
    const name = scalarProp(item, 'name');
    children.push({
      key: `tag:${name ?? i}`,
      label: name ?? `tags[${i}]`,
      kind: 'tag',
      offset: nodeOffset(item),
      ...endOf(nodeEnd(item)),
      children: [],
    });
  });
  return group('tags', pair, children);
}

function buildPaths(pair: Pair | null): SpecOutlineNode {
  const children: SpecOutlineNode[] = [];
  if (pair && isMap(pair.value)) {
    for (const pathPair of pair.value.items) {
      const pathKey = keyString(pathPair);
      if (pathKey === null) continue;
      const operations: SpecOutlineNode[] = [];
      if (isMap(pathPair.value)) {
        for (const opPair of pathPair.value.items) {
          const opKey = keyString(opPair);
          if (opKey === null || !OPERATION_KEYS.has(opKey)) continue;
          operations.push({
            key: `operation:${pathKey}:${opKey}`,
            label: scalarProp(opPair.value, 'summary') ?? opKey.toUpperCase(),
            kind: 'operation',
            offset: pairOffset(opPair),
            ...endOf(pairEnd(opPair)),
            method: opKey.toUpperCase(),
            children: [],
          });
        }
      }
      children.push({
        key: `path:${pathKey}`,
        label: pathKey,
        kind: 'path',
        offset: pairOffset(pathPair),
        ...endOf(pairEnd(pathPair)),
        children: operations,
      });
    }
  }
  return group('paths', pair, children);
}

function buildNamedMapChildren(pair: Pair | null, kind: SpecOutlineKind, keyPrefix: string): SpecOutlineNode[] {
  const children: SpecOutlineNode[] = [];
  if (pair && isMap(pair.value)) {
    for (const entry of pair.value.items) {
      const name = keyString(entry);
      if (name === null) continue;
      children.push({
        key: `${keyPrefix}:${name}`,
        label: name,
        kind,
        offset: pairOffset(entry),
        ...endOf(pairEnd(entry)),
        children: [],
      });
    }
  }
  return children;
}

function buildComponents(pair: Pair | null): SpecOutlineNode {
  const map = pair && isMap(pair.value) ? pair.value : null;
  const schemasPair = map ? findPair(map, 'schemas') : null;
  const schemesPair = map ? findPair(map, 'securitySchemes') : null;
  const subgroups: SpecOutlineNode[] = [
    {
      key: 'components:schemas',
      label: 'schemas',
      kind: 'group',
      offset: schemasPair ? pairOffset(schemasPair) : null,
      ...endOf(schemasPair ? pairEnd(schemasPair) : null),
      children: buildNamedMapChildren(schemasPair, 'schema', 'schema'),
    },
    {
      key: 'components:securitySchemes',
      label: 'securitySchemes',
      kind: 'group',
      offset: schemesPair ? pairOffset(schemesPair) : null,
      ...endOf(schemesPair ? pairEnd(schemesPair) : null),
      children: buildNamedMapChildren(schemesPair, 'securityScheme', 'securityScheme'),
    },
  ];
  return group('components', pair, subgroups);
}

function buildSecurity(pair: Pair | null): SpecOutlineNode {
  const read = seqItems(pair);
  const children: SpecOutlineNode[] = [];
  read?.items.forEach((item, i) => {
    const names = isMap(item)
      ? item.items.map((entry) => keyString(entry)).filter((name): name is string => name !== null)
      : [];
    children.push({
      key: `security:${i}`,
      label: names.length > 0 ? names.join(' + ') : `security[${i}]`,
      kind: 'securityRequirement',
      offset: nodeOffset(item),
      ...endOf(nodeEnd(item)),
      children: [],
    });
  });
  return group('security', pair, children);
}

/** The OpenAPI outline's groups in vendor order — the structure pane
 *  renders a flat group list so Protobuf outlines feed the same tree. */
export function specOutlineGroups(outline: SpecOutline): SpecOutlineNode[] {
  return [outline.servers, outline.tags, outline.paths, outline.components, outline.security];
}

/**
 * Derive the outline from the source text. Returns null when the text
 * does not parse to a mapping document — the caller keeps the last
 * good outline on screen (same posture as the validation strip).
 */
export function buildSpecOutline(content: string): SpecOutline | null {
  const doc = parseDocument(content);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return null;
  const root = doc.contents;
  return {
    servers: buildServers(findPair(root, 'servers')),
    tags: buildTags(findPair(root, 'tags')),
    paths: buildPaths(findPair(root, 'paths')),
    components: buildComponents(findPair(root, 'components')),
    security: buildSecurity(findPair(root, 'security')),
  };
}
