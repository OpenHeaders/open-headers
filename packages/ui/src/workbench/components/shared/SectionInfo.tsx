/**
 * SectionInfo — the standard `(i)` for rule-editor section titles
 * (Templates, Actions, Conditions). Same InfoTrigger glyph + popover
 * model the DevTools column headers use, so info affordances read
 * identically across surfaces; the workbench wiring adds a "More
 * information" link pinned to the popover header's top-right that
 * jumps to the docs panel section for the topic.
 */

import type React from 'react';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useInspectorNav } from '../../hooks/useInspectorNav';

export interface SectionInfoProps {
  content: InfoPopoverContent;
  /** Docs panel section id for the "More information" header link.
   *  A function defers resolution to click time — for sections whose
   *  docs target depends on live form state (e.g. inject css vs
   *  script). Omit for topics that have no docs section yet — no link
   *  shows. */
  docId?: string | (() => string);
}

const SectionInfo: React.FC<SectionInfoProps> = ({ content, docId }) => {
  const { openDocs } = useInspectorNav();
  return (
    <InfoTrigger
      content={
        docId
          ? {
              ...content,
              headerLink: {
                label: 'More information',
                onClick: () => openDocs(typeof docId === 'function' ? docId() : docId),
              },
            }
          : content
      }
    />
  );
};

export default SectionInfo;
