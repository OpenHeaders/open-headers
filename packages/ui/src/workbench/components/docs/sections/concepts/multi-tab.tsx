/**
 * Concepts: Multi-tab Behavior.
 */

import type React from 'react';
import {
  MultiTabLocalDiagram,
  MultiTabNavigationDiagram,
  MultiTabNumberingDiagram,
  MultiTabSyncDiagram,
  MultiTabSyncedDiagram,
} from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocParagraph, SurfaceContext } from '../../shared';

export const MultiTabSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['workbench', 'devtools']} />
    <DocParagraph>
      Multiple workspace tabs open at once is a first-class state. Persisted data syncs through{' '}
      <code>chrome.storage</code>, layout state stays per-tab, and navigation intents reuse existing tabs in the same
      window before opening new ones.
    </DocParagraph>
    <DiagramFrame caption="Tab A saves, the SW broadcasts, Tab B re-hydrates. Layout state stays in each tab.">
      <MultiTabSyncDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Navigation reuses existing tabs</DocHeading>
    <DocParagraph>
      Same-window first: if a workspace tab is already open in the window you're clicking from, it activates and
      receives the intent (docs section to scroll to, rule to edit). Different window: a fresh tab opens in your current
      window rather than pulling focus across Chrome windows — mirroring how Chrome's own DevTools works, with one panel
      per window.
    </DocParagraph>
    <DiagramFrame caption="Warm path activates the same-window tab; cold path opens a new tab in the caller's window.">
      <MultiTabNavigationDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Tab numbering</DocHeading>
    <DocParagraph>
      With two or more workspace tabs, each tab's title is prefixed with its ordinal — <code>#1 Open Headers</code>,{' '}
      <code>#2 Open Headers</code>, <code>#3 Open Headers</code>. When the count drops back to one, the survivor sheds
      its prefix.
    </DocParagraph>
    <DocParagraph>
      Ordinals are stable within a tab's lifetime: closing <code>#1</code> while <code>#2</code> and <code>#3</code>{' '}
      remain does not renumber survivors. The next tab opened gets <code>#4</code>; numbering resets to <code>#1</code>{' '}
      only after every workspace tab has closed.
    </DocParagraph>
    <DiagramFrame caption="Survivors keep their numbers across closes; the next tab is always max + 1.">
      <MultiTabNumberingDiagram />
    </DiagramFrame>

    <DocHeading level={3}>What syncs, what doesn't</DocHeading>
    <DocParagraph>
      Every persisted entity — rules, collections, folders, environments, workspace variables, vault, requests,
      templates — lives in <code>chrome.storage.local</code> as the single source of truth. Saves in tab A broadcast
      through the background and tab B re-hydrates. Workspace and environment switches propagate the same way.
    </DocParagraph>
    <DiagramFrame caption="One shared chrome.storage; both tabs read and write the same persisted data.">
      <MultiTabSyncedDiagram />
    </DiagramFrame>
    <DiagramFrame caption="Layout drags and unsaved typing live in each tab — the other tab never sees them.">
      <MultiTabLocalDiagram />
    </DiagramFrame>
    <Callout kind="note" title="Layout does not live-sync">
      Pane ratios and tool-window dock state are per-workspace, but changes don't propagate to already-open tabs.
      Dragging a splitter in tab A leaves tab B untouched until reload — live layout sync would feel jarring while
      typing. A tab opened <em>after</em> the drag inherits the new layout.
    </Callout>
    <Callout kind="warn" title="Unsaved drafts are tab-local">
      Editor drafts live in their own tab's memory. If tab A saves the same rule tab B is editing, tab A wins the
      storage write — there's no cross-tab "modified, reload?" prompt today. Only matters when two tabs edit the same
      entity simultaneously.
    </Callout>
  </>
);
