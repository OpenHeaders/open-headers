/**
 * Concepts: Request Tracking.
 */

import type React from 'react';
import {
  DirectVsIndirectDiagram,
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
} from '../../diagrams';
import { DiagramFrame, DocHeading, DocLink, DocParagraph, SurfaceContext } from '../../shared';

export const RequestTrackingSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel']} />
    <DocParagraph>
      The <strong>This Page</strong> tab in the popup shows which rules are active for the current page and which
      requests they matched. Tracking spans both request and response phases of every connection the page makes.
    </DocParagraph>
    <DiagramFrame caption="A single connection has two phases — both contribute to the badge count.">
      <RequestTrackingPhasesDiagram />
    </DiagramFrame>

    <DocHeading level={3}>How it works</DocHeading>
    <DocParagraph>
      The extension observes HTTP requests via the <code>webRequest</code> API. When a request URL matches a rule's
      conditions (domains, URL pattern, or URL regex), it's recorded with its resource type. Recording happens live
      inside the service worker; the popup just reads that record back when you open the <strong>This Page</strong> tab.
    </DocParagraph>
    <DiagramFrame caption="Browser fires webRequest events; the extension matches and records; the popup reads later.">
      <RequestTrackingDiagram />
    </DiagramFrame>
    <DocParagraph>
      Each matched rule shows a numbered badge equal to how many requests it matched. Click the badge to expand into a
      list of timestamps, URLs, resource types, and the pattern that matched.
    </DocParagraph>
    <DiagramFrame caption="The badge collapses the count; clicking it reveals the full match list.">
      <RequestTrackingUiDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Direct vs indirect matches</DocHeading>
    <DocParagraph>
      A <strong>direct</strong> match means the page URL itself matched. An <strong>indirect</strong> match means only a
      sub-resource — script, stylesheet, XHR, image, font — matched while the page URL didn't. The same rule can produce
      either kind depending on which page you're on.
    </DocParagraph>
    <DiagramFrame caption="One rule, two page contexts. Green = matched. Dashed = excluded.">
      <DirectVsIndirectDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Resource types</DocHeading>
    <DocParagraph>
      Each matched request carries its Chrome <code>ResourceType</code> — Page, Frame, Fetch/XHR, Script, CSS, Image,
      Font, Media, WebSocket, Ping, or Other. See the <DocLink to="resource-types">Resource types</DocLink> reference
      page for the full mapping with examples.
    </DocParagraph>
  </>
);
