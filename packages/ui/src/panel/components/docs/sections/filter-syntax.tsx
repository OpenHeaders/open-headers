/**
 * Filter Syntax — docs section that replaces the standalone
 * `FilterDocs` component the panel used to render in its docs window.
 * Lives as a regular docs section so it composes with the rest of the
 * panel's docs registry and shares keyboard nav, TOC, and breadcrumbs.
 */

import { DocHeading, DocParagraph } from '@openheaders/ui/shared/docs/shared';

function Row({ code, desc }: { code: string; desc: string }) {
  return (
    <DocParagraph>
      <code>{code}</code> &mdash; {desc}
    </DocParagraph>
  );
}

export function FilterSyntaxSection() {
  return (
    <div>
      <DocHeading>Filter Syntax</DocHeading>
      <DocParagraph>The traffic filter input combines text tokens, property filters, and toggle buttons.</DocParagraph>

      <DocParagraph>
        <strong>Text filters</strong>
      </DocParagraph>
      <Row code="example.com" desc="Show requests whose URL contains “example.com”" />
      <Row code="-analytics" desc="Hide requests matching “analytics”" />
      <Row code={'"exact phrase"'} desc="Match an exact phrase (use quotes for spaces)" />
      <Row code="api -fonts" desc="Multiple terms are AND-ed together" />

      <DocParagraph>
        <strong>Property filters</strong>
      </DocParagraph>
      <Row code="domain:example.com" desc="Match hostname" />
      <Row code="status-code:404" desc="Exact status code" />
      <Row code="method:POST" desc="HTTP method (case-insensitive)" />
      <Row code="mime-type:json" desc="Match MIME type substring" />
      <Row code="has-response-header:x-cache" desc="Response header exists" />
      <Row code="larger-than:10k" desc="Response size > N bytes (k, M suffixes)" />
      <Row code="is:from-cache" desc="Cached responses (304 or from-cache flag)" />
      <Row code="-domain:ads.com" desc="Negate any property with `-` prefix" />

      <DocParagraph>
        <strong>Toggle buttons</strong>
      </DocParagraph>
      <Row code="Aa" desc="Match Case — case-sensitive matching (Alt+C)" />
      <Row code="ab" desc="Whole Word — match word boundaries only (Alt+W)" />
      <Row code=".*" desc="Regex — treat input as a regular expression (Alt+R)" />

      <DocParagraph>
        <strong>Examples</strong>
      </DocParagraph>
      <Row code="domain:api.example.com method:POST" desc="POST requests to api.example.com" />
      <Row code="-domain:analytics.com -.js" desc="Hide analytics and JS files" />
      <Row code="larger-than:1M mime-type:image" desc="Images larger than 1 MB" />
      <Row code="status-code:500" desc="Server errors only" />
    </div>
  );
}
