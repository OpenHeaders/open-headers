/**
 * Concepts: Limitations.
 */

import type React from 'react';
import { LimitationsOverviewDiagram } from '../../diagrams';
import { Callout, DiagramFrame, DocParagraph, SurfaceContext } from '../../shared';

export const LimitationsSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Quick reference for behaviors that surprise people. Each item is also called out inline in the section it affects.
    </DocParagraph>
    <DiagramFrame caption="Four common gotchas at a glance — each callout below has the details.">
      <LimitationsOverviewDiagram />
    </DiagramFrame>
    <Callout kind="limitation" title="Modified headers don't show in DevTools">
      Header actions are applied correctly but Chrome's Network tab still displays the original server headers.
    </Callout>
    <Callout kind="limitation" title="Script-based rules — narrow reach">
      Inject, Delay, Body, Mock, and Header Merge only intercept <code>fetch()</code> and <code>XMLHttpRequest</code>.
      Static resources and page navigations bypass them. See <em>How rules execute</em>.
    </Callout>
    <Callout kind="limitation" title="Merge can't read browser-default headers">
      The Merge operation only sees headers explicitly set by page code — Accept, User-Agent, and other browser-defaults
      are invisible to it.
    </Callout>
    <Callout kind="limitation" title="Header matching needs Chrome 128+">
      Conditions that match on request / response header values require Chrome 128 or newer. Older browsers ignore the
      condition silently.
    </Callout>
  </>
);
