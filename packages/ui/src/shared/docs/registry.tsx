/**
 * Shared docs-registry types + lookup helpers.
 *
 * Each surface (workbench, panel) builds its own `DocGroup[]` and
 * passes it to `<DocsPanel groups={…} />`. Sections are looked up
 * by stable id, and `openDocs(id)` deep-links resolve through the
 * surface's local registry.
 *
 * Copy is raw-or-key (dock-layout `ToolWindowDef` idiom): converted
 * surfaces (workbench) mint `titleKey`/`summaryKey`/`labelKey`,
 * unconverted registries keep raw `title`/`summary`/`label`. Render
 * sites resolve either shape through the `resolveDoc*` helpers below
 * instead of reading the fields directly.
 */

import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export type DocSection = {
  id: string;
  group: string;
  icon: React.ReactNode;
  Component: React.FC;
} & (
  | {
      title: string;
      titleKey?: never;
      /**
       * One-line orientation, written for a reader who has never opened
       * this section. Surfaces as a subtitle under each TOC row and as
       * additional text the filter matches against.
       */
      summary: string;
      summaryKey?: never;
    }
  | { title?: never; titleKey: MessageKey; summary?: never; summaryKey: MessageKey }
);

export type DocGroup = {
  id: string;
  sections: DocSection[];
} & ({ label: string; labelKey?: never } | { label?: never; labelKey: MessageKey });

/** Display title for a section — keyed defs translate, raw defs pass through. */
export function resolveDocTitle(section: DocSection, t: Translate): string {
  return section.titleKey ? t(section.titleKey) : (section.title ?? '');
}

/** TOC subtitle / filter text for a section — keyed defs translate, raw defs pass through. */
export function resolveDocSummary(section: DocSection, t: Translate): string {
  return section.summaryKey ? t(section.summaryKey) : (section.summary ?? '');
}

/** Display label for a group — keyed defs translate, raw defs pass through. */
export function resolveDocGroupLabel(group: DocGroup, t: Translate): string {
  return group.labelKey ? t(group.labelKey) : (group.label ?? '');
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
