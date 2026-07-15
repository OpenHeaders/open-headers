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
import { useT } from '@openheaders/ui/context/LocaleContext';
import { resolveDocGroupLabel, resolveDocSummary, resolveDocTitle } from '@openheaders/ui/shared/docs/registry';
import { findGroup, findSection } from '../docs/registry';
import { resolveDocLink } from '../docs/doc-ids';
import { DOC_ANCHOR_INFO } from './doc-anchor-info';
import SectionInfo from './SectionInfo';

export interface DocInfoProps {
  /** Docs id — a sub-anchor (`override`, `qp-add`, `url-regex`) or a
   *  top-level section id (`execution`). */
  docId: string;
}

const DocInfo: React.FC<DocInfoProps> = ({ docId }) => {
  const t = useT();
  const { section } = resolveDocLink(docId);
  const sectionDef = findSection(section);
  const groupDef = sectionDef ? findGroup(sectionDef.group) : null;
  const anchor = DOC_ANCHOR_INFO[docId];
  const content = anchor
    ? { kicker: sectionDef ? resolveDocTitle(sectionDef, t) : undefined, title: anchor.title, summary: anchor.summary }
    : {
        kicker: groupDef ? resolveDocGroupLabel(groupDef, t) : sectionDef?.group,
        title: sectionDef ? resolveDocTitle(sectionDef, t) : docId,
        summary: sectionDef ? resolveDocSummary(sectionDef, t) : '',
      };
  return <SectionInfo content={content} docId={docId} />;
};

export default DocInfo;
