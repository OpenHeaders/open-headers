/**
 * useGuideHover — the hovered row's parent guide in the primary, down
 * the parent's whole visible subtree: the drop guide's picture
 * (`tree-dnd-feedback.ts`) for a pointer at rest, so the eye finds
 * "which container am I in" without a drag.
 *
 * Direct DOM class toggling, not React state: a hover moves across
 * hundreds of rows and must not re-render the tree. The row list is the
 * sidebar's flat keyboard-nav order, so the subtree is the run after
 * the parent while rows sit deeper than it; each row's guide spans
 * carry `data-guide-level`, the ancestor depth they stand for.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import type { TreeNode } from './types';

export const GUIDE_PARENT_CLASS = 'rules-sidebar-item-guide--parent';

function guideSpans(container: HTMLElement, nodes: readonly TreeNode[], parentIndex: number): HTMLElement[] {
  const parent = nodes[parentIndex];
  const spans: HTMLElement[] = [];
  for (let i = parentIndex + 1; i < nodes.length && nodes[i].depth > parent.depth; i++) {
    const row = container.querySelector<HTMLElement>(`[data-item-id="${nodes[i].id}"]`);
    const span = row?.querySelector<HTMLElement>(`[data-guide-level="${parent.depth}"]`);
    if (span) spans.push(span);
  }
  return spans;
}

export function useGuideHover(containerRef: React.RefObject<HTMLElement | null>, nodes: readonly TreeNode[]): void {
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lit: HTMLElement[] = [];
    let litParent: string | null = null;

    const clear = () => {
      for (const span of lit) span.classList.remove(GUIDE_PARENT_CLASS);
      lit = [];
      litParent = null;
    };
    const light = (parentId: string) => {
      const list = nodesRef.current;
      const parentIndex = list.findIndex((n) => n.id === parentId);
      clear();
      if (parentIndex < 0) return;
      lit = guideSpans(container, list, parentIndex);
      litParent = parentId;
      for (const span of lit) span.classList.add(GUIDE_PARENT_CLASS);
    };

    const onOver = (e: MouseEvent) => {
      // A live drag paints its own guide — the drop target's, which
      // need not be the hovered row's parent.
      if (container.querySelector('.tree-dnd-guide')) {
        clear();
        return;
      }
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-item-id]') : null;
      const id = target?.dataset.itemId;
      const node = id === undefined ? undefined : nodesRef.current.find((n) => n.id === id);
      const parentId = node?.parentId ?? null;
      if (parentId === litParent) return;
      if (parentId === null) clear();
      else light(parentId);
    };

    container.addEventListener('mouseover', onOver);
    container.addEventListener('mouseleave', clear);
    return () => {
      container.removeEventListener('mouseover', onOver);
      container.removeEventListener('mouseleave', clear);
      clear();
    };
  }, [containerRef]);
}
