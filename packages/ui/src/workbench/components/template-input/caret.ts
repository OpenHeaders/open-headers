/**
 * Caret offset helpers for the contentEditable TemplateInput — translate
 * between the DOM Selection and a flat character offset (counting only
 * text nodes) so the component can save/restore the caret across the
 * innerHTML re-renders that re-highlight `{{ref}}` spans.
 */

/** Caret char-offset within `root` (counts only text nodes). `-1` if
 *  the current selection is outside `root`. */
export function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return -1;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

/** Place the caret at `offset` characters into `root`. Silently no-ops
 *  if the root is shorter than `offset` (we clamp to end). */
export function setCaretOffset(root: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const total = (root.textContent ?? '').length;
  const target = Math.max(0, Math.min(offset, total));
  const range = document.createRange();
  let remaining = target;
  let placed = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.nodeValue?.length ?? 0;
    if (remaining <= len) {
      range.setStart(node, remaining);
      range.collapse(true);
      placed = true;
      break;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  if (!placed) {
    // Empty editable — anchor at the root itself.
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
