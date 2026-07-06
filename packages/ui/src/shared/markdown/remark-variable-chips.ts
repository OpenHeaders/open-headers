/**
 * remark plugin: lift bare `{{variable}}` references in prose into
 * `inlineCode` nodes so the renderer can style them as the same code
 * chips the rest of the app uses for template references. Fenced code
 * blocks and existing inline code are left untouched — they aren't
 * text nodes, so the walker never descends into them.
 */

const VAR_PATTERN = /\{\{[A-Za-z0-9_][\w.-]*\}\}/;

/** Minimal mdast shape — enough for a text-node walker without
 *  depending on the mdast type packages. */
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

export function remarkVariableChips() {
  return (tree: MdNode): void => {
    walk(tree);
  };
}

function walk(node: MdNode): void {
  const children = node.children;
  if (!children) return;
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (!child) continue;
    if (child.type === 'text' && child.value && VAR_PATTERN.test(child.value)) {
      children.splice(i, 1, ...splitVariableRefs(child.value));
    } else if (child.type !== 'code' && child.type !== 'inlineCode') {
      walk(child);
    }
  }
}

function splitVariableRefs(value: string): MdNode[] {
  const out: MdNode[] = [];
  const re = new RegExp(VAR_PATTERN.source, 'g');
  let last = 0;
  for (const match of value.matchAll(re)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ type: 'text', value: value.slice(last, at) });
    out.push({ type: 'inlineCode', value: match[0] });
    last = at + match[0].length;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}
