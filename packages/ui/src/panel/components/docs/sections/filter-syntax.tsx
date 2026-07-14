/**
 * Filter Syntax — the panel docs' reference for the traffic filter
 * input, in the workbench docs card idiom: one Card per concept, each
 * with a diagram that filters the SAME five-request example capture
 * (see `filter-example.tsx`), so every card is a different slice of one
 * picture.
 */

import { Card, Tag } from 'antd';
import { Anchor, DiagramFrame, DocHeading, DocParagraph, OnThisPage } from '@openheaders/ui/shared/docs/shared';
import { FilterExample } from '../filter-example';

const FILTER_ANCHORS = [
  { id: 'filter-text', title: 'Text' },
  { id: 'filter-negation', title: 'Negation' },
  { id: 'filter-phrase', title: 'Exact Phrase' },
  { id: 'filter-domain', title: 'Domain' },
  { id: 'filter-status-code', title: 'Status Code' },
  { id: 'filter-method', title: 'Method' },
  { id: 'filter-mime-type', title: 'MIME Type' },
  { id: 'filter-has-response-header', title: 'Response Header' },
  { id: 'filter-larger-than', title: 'Larger Than' },
  { id: 'filter-from-cache', title: 'From Cache' },
  { id: 'filter-match-case', title: 'Match Case' },
  { id: 'filter-whole-word', title: 'Whole Word' },
  { id: 'filter-regex', title: 'Regex' },
  { id: 'filter-other-inputs', title: 'Other Filter Inputs' },
];

const CARD_STYLE = { marginBottom: 8 } as const;

export function FilterSyntaxSection() {
  return (
    <div>
      <DocParagraph>
        The traffic filter combines free text, <code>key:value</code> property filters, and three match toggles.
        Terms separated by spaces must ALL match (AND), and every card below runs its filter over the same
        five-request example capture — each diagram is one slice of that picture.
      </DocParagraph>
      <DocParagraph>
        Every filter input in the panel — Network, Console, Storage, Headers, Cookies, Initiator, Messages — carries
        the same three toggles (<code>Aa</code> match case, <code>ab</code> whole word, <code>.*</code> regex) and a{' '}
        <code>×</code> button that clears the text. Keyboard: <code>Alt+C</code> / <code>Alt+W</code> /{' '}
        <code>Alt+R</code> flip the toggles while the input has focus.
      </DocParagraph>
      <OnThisPage entries={FILTER_ANCHORS} />

      <DocHeading>Text filters</DocHeading>

      <Anchor id="filter-text">
        <Card title="Text" extra={<Tag color="blue">api users</Tag>} style={CARD_STYLE}>
          A bare term keeps every request whose URL contains it. Several terms AND together — a request must contain
          all of them, in any position.
          <DiagramFrame caption="Two terms — only the request whose URL contains both “api” and “users” survives.">
            <FilterExample
              filter="api users"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: false, reason: 'contains “api” but not “users”' },
                { id: 'app', pass: false, reason: 'contains neither term' },
                { id: 'font', pass: false, reason: 'contains neither term' },
                { id: 'pixel', pass: false, reason: 'contains neither term' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-negation">
        <Card title="Negation" extra={<Tag color="blue">-term</Tag>} style={CARD_STYLE}>
          A leading <code>-</code> flips any token: <code>-analytics</code> hides matching requests instead of keeping
          them. Works on property filters too — <code>-domain:ads.example</code>, <code>-is:from-cache</code>.
          <DiagramFrame caption="Everything stays EXCEPT requests matching the negated term.">
            <FilterExample
              filter="-analytics"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: true },
                { id: 'app', pass: true },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'URL contains “analytics”' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-phrase">
        <Card title="Exact Phrase" extra={<Tag color="blue">"…"</Tag>} style={CARD_STYLE}>
          Quotes make one token out of text that contains spaces, and keep characters like <code>?</code> or{' '}
          <code>=</code> literal — useful for query strings.
          <DiagramFrame caption="The quoted phrase matches as one contiguous piece of the URL.">
            <FilterExample
              filter='"users?page=2"'
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: false, reason: 'no such phrase in the URL' },
                { id: 'app', pass: false, reason: 'no such phrase in the URL' },
                { id: 'font', pass: false, reason: 'no such phrase in the URL' },
                { id: 'pixel', pass: false, reason: 'no such phrase in the URL' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <DocHeading>Property filters</DocHeading>
      <DocParagraph>
        A <code>key:value</code> token checks one attribute of the request instead of the whole URL. Property filters
        compose with text tokens and with each other — all of them must match.
      </DocParagraph>

      <Anchor id="filter-domain">
        <Card title="Domain" extra={<Tag color="green">domain:</Tag>} style={CARD_STYLE}>
          Matches the hostname by substring, so an apex domain catches every subdomain — <code>api.</code>,{' '}
          <code>cdn.</code>, <code>static.</code> — without wildcards.
          <DiagramFrame caption="One value covers every openheaders.io subdomain; the third-party host misses.">
            <FilterExample
              filter="domain:openheaders.io"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: true },
                { id: 'app', pass: true },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'hostname is tracker-example.net' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-status-code">
        <Card title="Status Code" extra={<Tag color="green">status-code:</Tag>} style={CARD_STYLE}>
          Keeps requests whose response carried exactly this code. Pending and failed requests have no code, so they
          never match.
          <DiagramFrame caption="Only the 404 survives — the exact code, not a range.">
            <FilterExample
              filter="status-code:404"
              verdicts={[
                { id: 'users', pass: false, reason: 'status is 200' },
                { id: 'login', pass: false, reason: 'status is 201' },
                { id: 'app', pass: false, reason: 'status is 200' },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'status is 200' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-method">
        <Card title="Method" extra={<Tag color="green">method:</Tag>} style={CARD_STYLE}>
          Keeps requests using this HTTP verb, compared case-insensitively — <code>method:post</code> and{' '}
          <code>method:POST</code> are the same filter.
          <DiagramFrame caption="Only the POST survives.">
            <FilterExample
              filter="method:POST"
              verdicts={[
                { id: 'users', pass: false, reason: 'method is GET' },
                { id: 'login', pass: true },
                { id: 'app', pass: false, reason: 'method is GET' },
                { id: 'font', pass: false, reason: 'method is GET' },
                { id: 'pixel', pass: false, reason: 'method is GET' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-mime-type">
        <Card title="MIME Type" extra={<Tag color="green">mime-type:</Tag>} style={CARD_STYLE}>
          Matches the response's content type by substring — <code>mime-type:json</code> catches{' '}
          <code>application/json</code>, <code>mime-type:image</code> catches every image format.
          <DiagramFrame caption="Both JSON responses survive; scripts, fonts and images miss.">
            <FilterExample
              filter="mime-type:json"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: true },
                { id: 'app', pass: false, reason: 'text/javascript' },
                { id: 'font', pass: false, reason: 'not a JSON response' },
                { id: 'pixel', pass: false, reason: 'image/gif' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-has-response-header">
        <Card title="Response Header" extra={<Tag color="green">has-response-header:</Tag>} style={CARD_STYLE}>
          Keeps requests whose response carries a header with this exact name — the value doesn't matter. Handy for
          spotting CDN cache behavior (<code>x-cache</code>) or missing security headers (negate it).
          <DiagramFrame caption="Only the CDN response carries an x-cache header.">
            <FilterExample
              filter="has-response-header:x-cache"
              verdicts={[
                { id: 'users', pass: false, reason: 'no x-cache header' },
                { id: 'login', pass: false, reason: 'no x-cache header' },
                { id: 'app', pass: true },
                { id: 'font', pass: false, reason: 'no x-cache header' },
                { id: 'pixel', pass: false, reason: 'no x-cache header' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-larger-than">
        <Card title="Larger Than" extra={<Tag color="green">larger-than:</Tag>} style={CARD_STYLE}>
          Keeps requests that transferred more than N bytes. Suffixes scale the number: <code>larger-than:100k</code>,{' '}
          <code>larger-than:1M</code>.
          <DiagramFrame caption="Only the 128 kB bundle clears the 100k threshold.">
            <FilterExample
              filter="larger-than:100k"
              verdicts={[
                { id: 'users', pass: false, reason: '1.2 kB' },
                { id: 'login', pass: false, reason: '0.4 kB' },
                { id: 'app', pass: true },
                { id: 'font', pass: false, reason: '2.1 kB' },
                { id: 'pixel', pass: false, reason: '0.1 kB' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-from-cache">
        <Card title="From Cache" extra={<Tag color="green">is:from-cache</Tag>} style={CARD_STYLE}>
          Keeps responses the browser served from cache — a <code>304</code>, or a disk/memory cache hit that never
          touched the network. Negate it (<code>-is:from-cache</code>) to see only what actually crossed the wire.
          <DiagramFrame caption="Only the cached tracking pixel survives.">
            <FilterExample
              filter="is:from-cache"
              verdicts={[
                { id: 'users', pass: false, reason: 'served from the network' },
                { id: 'login', pass: false, reason: 'served from the network' },
                { id: 'app', pass: false, reason: 'served from the network' },
                { id: 'font', pass: false, reason: 'served from the network' },
                { id: 'pixel', pass: true },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <DocHeading>Match toggles</DocHeading>
      <DocParagraph>
        The three buttons inside the input change how text tokens compare. They apply to free text (and{' '}
        <code>name:</code>/<code>value:</code> style tokens on the detail tabs); <code>is:</code> and the other
        property filters keep their own semantics.
      </DocParagraph>

      <Anchor id="filter-match-case">
        <Card title="Match Case" extra={<Tag>Aa · Alt+C</Tag>} style={CARD_STYLE}>
          Off (the default), <code>V1</code> and <code>v1</code> are the same filter. On, the term must match the URL's
          exact casing.
          <DiagramFrame caption="With Aa on, “Users” matches nothing — every URL in the capture is lowercase.">
            <FilterExample
              filter="Users"
              toggles={{ matchCase: true }}
              verdicts={[
                { id: 'users', pass: false, reason: 'URL says “users” — case differs' },
                { id: 'login', pass: false, reason: 'no match' },
                { id: 'app', pass: false, reason: 'no match' },
                { id: 'font', pass: false, reason: 'no match' },
                { id: 'pixel', pass: false, reason: 'no match' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-whole-word">
        <Card title="Whole Word" extra={<Tag>ab · Alt+W</Tag>} style={CARD_STYLE}>
          The term only matches at word boundaries — <code>/</code>, <code>.</code>, <code>?</code>, <code>=</code> and
          friends count as boundaries. Use it when a short term is buried inside longer words.
          <DiagramFrame caption="“user” no longer matches inside “users” — with ab off, request #7 would match.">
            <FilterExample
              filter="user"
              toggles={{ wholeWord: true }}
              verdicts={[
                { id: 'users', pass: false, reason: '“user” only appears inside “users”' },
                { id: 'login', pass: false, reason: 'no match' },
                { id: 'app', pass: false, reason: 'no match' },
                { id: 'font', pass: false, reason: 'no match' },
                { id: 'pixel', pass: false, reason: 'no match' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-regex">
        <Card title="Regex" extra={<Tag color="purple">.* · Alt+R</Tag>} style={CARD_STYLE}>
          The whole input becomes one regular expression tested against the URL — property tokens are not parsed in
          this mode. A pattern that doesn't compile turns the input red and hides nothing.
          <DiagramFrame caption="One pattern, two file types: URLs ending in .js or .woff2.">
            <FilterExample
              filter="\.(js|woff2)$"
              toggles={{ regexMode: true }}
              verdicts={[
                { id: 'users', pass: false, reason: 'ends in a query string' },
                { id: 'login', pass: false, reason: 'ends in “login”' },
                { id: 'app', pass: true },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'ends in “.gif”' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <DocHeading>Everywhere else</DocHeading>

      <Anchor id="filter-other-inputs">
        <Card title="Other Filter Inputs" style={CARD_STYLE}>
          <DocParagraph>
            The detail tabs carry the same input with their own property keys; the toggles and <code>-</code> negation
            work identically in each:
          </DocParagraph>
          <DocParagraph>
            <strong>Headers</strong> — <code>name:cookie</code>, <code>value:no-cache</code>, <code>is:rule</code>,{' '}
            <code>is:security</code>, <code>is:overridable</code>, <code>is:request</code> / <code>is:response</code>.
          </DocParagraph>
          <DocParagraph>
            <strong>Cookies</strong> — <code>name:sess</code>, <code>value:</code>, <code>domain:</code>,{' '}
            <code>path:</code>, <code>is:secure</code>, <code>is:samesite-none</code>, <code>is:third-party</code>,{' '}
            <code>is:problem</code>.
          </DocParagraph>
          <DocParagraph>
            <strong>Initiator</strong> — <code>is:failed</code>, <code>is:third-party</code>, <code>type:js</code>,{' '}
            <code>status:404</code>, <code>size:&gt;50kb</code>.
          </DocParagraph>
          <DocParagraph>
            <strong>Console, Storage, Messages, Call Stack</strong> — plain text with the three toggles; Storage also
            counts matches per section on its navigation rail while you type.
          </DocParagraph>
          <DocParagraph>
            <strong>Search</strong> — plain text (or a regex under <code>.*</code>) with the three toggles, submitted
            with Enter. The <em>Network / Storage / Console</em> chips pick which data it scans — at least one stays
            selected — and each result opens its source: the request tab, the storage section, or the Console.
          </DocParagraph>
        </Card>
      </Anchor>
    </div>
  );
}
