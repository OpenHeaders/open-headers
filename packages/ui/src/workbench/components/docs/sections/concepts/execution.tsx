/**
 * Concepts: Execution (DNR vs Script).
 */

import type React from 'react';
import { ExecutionDnrReachDiagram, ExecutionScriptReachDiagram, ExecutionStackDiagram } from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocParagraph, EngineTag, SurfaceContext } from '../../shared';

export const ExecutionSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Rules execute through one of two engines depending on what they do. Knowing which path a rule travels explains
      where it applies — and where it cannot.
    </DocParagraph>
    <DiagramFrame caption="JS-initiated requests pass through Script then DNR. Static and navigation traffic bypass Script entirely.">
      <ExecutionStackDiagram />
    </DiagramFrame>

    <DocHeading level={3}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <EngineTag kind="dnr" /> Native, fast, broad reach
      </span>
    </DocHeading>
    <DocParagraph>
      Header Override / Append / Remove, Block, Redirect, and Query Param rules compile to{' '}
      <code>declarativeNetRequest</code> entries. Chrome applies them at the network layer, before any request leaves
      the browser.
    </DocParagraph>
    <DocParagraph>
      Reach is broad: pages, sub-frames, scripts, images, fonts, fetch, XHR — every request the browser makes on behalf
      of the page.
    </DocParagraph>
    <DiagramFrame caption="A single bordered list — DNR's reach is essentially universal.">
      <ExecutionDnrReachDiagram />
    </DiagramFrame>

    <DocHeading level={3}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <EngineTag kind="script" /> JS-context, narrow reach
      </span>
    </DocHeading>
    <DocParagraph>
      Inject, Delay, Request Body, API Response, and Header Merge rules work by monkey-patching <code>fetch()</code> and{' '}
      <code>XMLHttpRequest</code> from inside the page. They can transform JavaScript-initiated traffic in ways DNR
      can't express — including reading and rewriting response bodies, which DNR has no access to.
    </DocParagraph>
    <DiagramFrame caption="Two columns — what the script engine actually intercepts, and what slips through unchanged.">
      <ExecutionScriptReachDiagram />
    </DiagramFrame>
    <Callout kind="limitation">
      Static resources (<code>&lt;img&gt;</code>, <code>&lt;script&gt;</code>, <code>&lt;link&gt;</code>), page
      navigations, and browser-internal requests bypass this engine entirely. Use a DNR-based rule for those.
    </Callout>
  </>
);
