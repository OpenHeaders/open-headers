/**
 * feed-copy-text — what a selection in a feed puts on the clipboard:
 * the text as it WAS, not as it is drawn. A token the feed shows
 * shortened or folded carries what it stands for in `data-copy` (a
 * path with its middle, an options run with every option), and a
 * selection that runs through it takes that; a selection wholly inside
 * the token takes the characters it covers. Each line of the feed is
 * an element marked `data-line`, and a selection over several of them
 * reads one per line. Pure over the selection's cloned contents.
 */

export const FEED_COPY_ATTRIBUTE = 'data-copy';
export const FEED_LINE_ATTRIBUTE = 'data-line';

function read(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.nodeValue ?? '');
    return;
  }
  if (!(node instanceof Element)) {
    for (const child of node.childNodes) read(child, out);
    return;
  }
  const whole = node.getAttribute(FEED_COPY_ATTRIBUTE);
  if (whole !== null) {
    out.push(whole);
    return;
  }
  for (const child of node.childNodes) read(child, out);
  if (node.hasAttribute(FEED_LINE_ATTRIBUTE)) out.push('\n');
}

/** The copy text of a selection's contents (`Range.cloneContents()`); the last line ends without a break. */
export function feedCopyText(contents: Node): string {
  const out: string[] = [];
  read(contents, out);
  return out.join('').replace(/\n$/, '');
}
