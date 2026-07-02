/**
 * DocInfo — data-driven `(i)` for a docs id. The row/field-level
 * counterpart to `SectionInfo`: instead of authoring popover content
 * at each call site, content resolves from the doc id itself —
 * sub-anchors (header operations, condition types, …) from
 * `DOC_ANCHOR_INFO`, top-level sections from the docs registry's own
 * title + summary. The kicker names the owning docs section and the
 * "More information" header link jumps straight to the id.
 */

import type React from 'react';
import { findSection } from '../docs/registry';
import { resolveDocLink } from '../docs/doc-ids';
import { DOC_ANCHOR_INFO } from './doc-anchor-info';
import SectionInfo from './SectionInfo';

export interface DocInfoProps {
  /** Docs id — a sub-anchor (`override`, `qp-add`, `url-regex`) or a
   *  top-level section id (`execution`). */
  docId: string;
}

const DocInfo: React.FC<DocInfoProps> = ({ docId }) => {
  const { section } = resolveDocLink(docId);
  const sectionDef = findSection(section);
  const anchor = DOC_ANCHOR_INFO[docId];
  const content = anchor
    ? { kicker: sectionDef?.title, title: anchor.title, summary: anchor.summary }
    : { kicker: sectionDef?.group, title: sectionDef?.title ?? docId, summary: sectionDef?.summary ?? '' };
  return <SectionInfo content={content} docId={docId} />;
};

export default DocInfo;
