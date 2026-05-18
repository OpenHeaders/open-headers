/**
 * Shared docs-registry types + lookup helpers.
 *
 * Each surface (workbench, panel) builds its own `DocGroup[]` and
 * passes it to `<DocsPanel groups={…} />`. Sections are looked up
 * by stable id, and `openDocs(id)` deep-links resolve through the
 * surface's local registry.
 */

import type React from 'react';

export interface DocSection {
  id: string;
  title: string;
  /**
   * One-line orientation, written for a reader who has never opened
   * this section. Surfaces as a subtitle under each TOC row and as
   * additional text the filter matches against.
   */
  summary: string;
  group: string;
  icon: React.ReactNode;
  Component: React.FC;
}

export interface DocGroup {
  id: string;
  label: string;
  sections: DocSection[];
}

/** Flatten a list of groups into a single section array, preserving order. */
export function flattenGroups(groups: readonly DocGroup[]): readonly DocSection[] {
  return groups.flatMap((g) => g.sections);
}

/**
 * Build a `id → section` lookup over a list of groups. Cache the
 * result at the call site if the groups array is stable, so we don't
 * rebuild on every render.
 */
export function buildSectionIndex(groups: readonly DocGroup[]): Map<string, DocSection> {
  return new Map(flattenGroups(groups).map((s) => [s.id, s]));
}
