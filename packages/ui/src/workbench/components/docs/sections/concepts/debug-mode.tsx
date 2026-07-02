/**
 * Concepts: Debug mode.
 */

import type React from 'react';
import {
  DebugModeReachDiagram,
  DebugModeScopeDiagram,
  DebugModeStatesDiagram,
  DebugModeSurfaceDiagram,
} from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocLink, DocParagraph, StateRow, SurfaceContext } from '../../shared';

export const DebugModeSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      <strong>Debug mode</strong> attaches Open Headers to the browser's debugging protocol so it can inspect and change
      traffic that ordinary extension APIs can't reach. It's the same machinery the browser's own developer tools use —
      which is why, while it's on, the browser shows an <em>"OH started debugging this browser"</em> banner.
    </DocParagraph>
    <DocParagraph>
      Standard mode (debug mode off) already covers most rules — header, block, redirect, query-param, and the
      page-context body / response / inject rules. Debug mode is the opt-in upgrade for what those can't reach:
      navigations, workers, cross-origin frames, and tab-wide environment changes.
    </DocParagraph>

    <DocHeading level={3}>Where you control it</DocHeading>
    <DocParagraph>
      The <code>● Debug mode</code> pill sits in the footer of every surface, just left of{' '}
      <DocLink to="system-status">System status</DocLink>. The inline switch turns it on and off, the colored dot tracks
      its health, and the dot + label open a popover with everything else — scope, per-tab pins, and the list of
      currently attached tabs.
    </DocParagraph>
    <DiagramFrame caption="The inline switch turns it on; the dot + label open the popover for everything else.">
      <DebugModeSurfaceDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Choosing what to inspect</DocHeading>
    <DocParagraph>
      The <strong>Attach to</strong> dropdown decides which tabs debug mode attaches to —{' '}
      <strong>Where DevTools is open</strong> (only tabs with the Open Headers panel open; the narrowest default),{' '}
      <strong>The focused tab</strong> (follows the active tab as you switch), or <strong>Both</strong> (the union of
      the two).
    </DocParagraph>
    <DocParagraph>
      Picking a scope <em>is</em> the consent for the browser banner — there's no separate prompt. When the current tab
      isn't already covered by the scope, an <strong>Include this browser tab</strong> pin appears, so you can attach
      that one tab without widening the scope for everything else.
    </DocParagraph>
    <DocParagraph>
      The <strong>Attached tabs</strong> list shows every tab debug mode is currently driving, each with a jump-to-tab
      action. The attached set is always recomputed from your scope, your pins, and which panels are open — so it
      reflects the present, never a stale snapshot.
    </DocParagraph>
    <DiagramFrame caption="The attached set is derived every time — re-attach replays it, nothing is stored.">
      <DebugModeScopeDiagram />
    </DiagramFrame>

    <Callout kind="warn" title="The banner is browser-wide">
      While debug mode is on, the browser's "OH started debugging this browser" banner shows on <em>every</em> tab — not
      just the ones it's attached to. That's the browser's own behavior; turning debug mode off removes it immediately.
    </Callout>

    <DocHeading level={3}>What it unlocks</DocHeading>
    <DocParagraph>On an attached tab, rules and controls reach past the page context:</DocParagraph>
    <DocParagraph>
      <strong>Any request, any context.</strong> Mock or rewrite top-level navigations, worker requests, and
      cross-origin iframes — not just page <code>fetch</code> / <code>XHR</code>. Request and response bodies can be
      read and transformed on those same contexts, and HTTP authentication challenges answered automatically for dev
      proxies and staging.
    </DocParagraph>
    <DocParagraph>
      <strong>Stronger injection.</strong> Script injection becomes race-free and CSP-proof, and reaches inside workers
      and cross-origin frames the standard page-context path can't touch.
    </DocParagraph>
    <DocParagraph>
      <strong>Tab environment.</strong> Exact cache disable, network throttle / offline, and user-agent / locale /
      timezone / media overrides — set per tab from the panel toolbar and the <strong>Overrides</strong> surface.
    </DocParagraph>
    <DiagramFrame caption="Standard mode covers page fetch / XHR; an attached tab extends the same rules to everything else.">
      <DebugModeReachDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Rules never fail silently</DocHeading>
    <DocParagraph>
      A rule that needs debug mode to take full effect shows a <strong>Debug mode off</strong> badge in the rules list
      while it's off, and a <strong>Tab out of scope</strong> note in the panel when it's on but the tab isn't in scope.
      The rule still runs everything it <em>can</em> through the standard page-context path — arming debug mode only
      extends the same rule to the contexts page injection can't reach.
    </DocParagraph>

    <DocHeading level={3}>Status colors</DocHeading>
    <DocParagraph>
      The dot mirrors the <DocLink to="system-status">System status</DocLink> <code>Debug mode</code> row:
    </DocParagraph>
    <DiagramFrame caption="Grey when off; green / yellow / red once it's on.">
      <DebugModeStatesDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      <strong>On</strong> and attached cleanly. (When it's off the dot is simply grey.)
    </StateRow>
    <StateRow color="warning" label="yellow">
      A tab <strong>fell back to heuristic</strong> — usually because the browser's debug banner was dismissed, so that
      tab reverts to standard observation.
    </StateRow>
    <StateRow color="error" label="red">
      A tab <strong>failed to attach</strong> — the debugging protocol couldn't be engaged for it.
    </StateRow>

    <Callout kind="note" title="Chromium only">
      Debug mode relies on a debugging protocol only Chromium-based browsers expose to extensions. On Firefox and Safari
      the pill stays hidden; the standard-mode rules above work everywhere.
    </Callout>
  </>
);
