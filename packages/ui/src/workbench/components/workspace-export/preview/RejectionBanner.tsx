/**
 * Rejection banner — fail-closed envelope-level rejection or caller-side
 * pre-parse error. Tailored copy per `parseWorkspaceExport` reason arm
 * (forward-compat vs. schema mismatch vs. discriminator gate, etc.).
 */

import type { ParseResult } from '@openheaders/core/workspace-export';
import { Alert, Typography } from 'antd';
import type React from 'react';

const { Text, Paragraph } = Typography;

export type ParseRejection =
  | { kind: 'parse'; reason: Extract<ParseResult, { ok: false }>['reason']; details: string }
  | { kind: 'caller'; details: string };

const RejectionBanner: React.FC<{ rejection: ParseRejection }> = ({ rejection }) => {
  const { title, body } = describeRejection(rejection);
  return (
    <Alert
      type="error"
      showIcon
      title={title}
      description={
        <div>
          <Paragraph style={{ marginBottom: 4 }}>{body}</Paragraph>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
            {rejection.details}
          </Text>
        </div>
      }
      style={{ marginBottom: 12 }}
    />
  );
};

export default RejectionBanner;

function describeRejection(rejection: ParseRejection): { title: string; body: string } {
  if (rejection.kind === 'caller') {
    return {
      title: "Couldn't load the import",
      body: 'The source returned an error before the file could be parsed.',
    };
  }
  switch (rejection.reason) {
    case 'export-format-version':
      return {
        title: 'This export was created with a newer version of OpenHeaders',
        body: "Your installation can't read it yet. Update OpenHeaders, then try again — older versions are read forward, but newer ones aren't read backward.",
      };
    case 'schema-version':
      return {
        title: 'Incompatible workspace model version',
        body: 'This export targets a different major version of the OpenHeaders data model. Update OpenHeaders if the export is newer, or ask the sender to re-export from a current version.',
      };
    case 'discriminator':
      return {
        title: 'This file is not a workspace export',
        body: 'A workspace export starts with `kind: workspace-export`. This file has a different shape — double-check that you picked the right file.',
      };
    case 'format':
      return {
        title: "Couldn't parse the file as YAML or JSON",
        body: 'A workspace export is YAML (preferred) or JSON. The parser rejected this input — the file may be truncated or corrupted.',
      };
    case 'size-cap':
      return {
        title: 'This export is too large to import',
        body: 'Workspace exports are capped at 50 MB. Split the source workspace into smaller pieces and re-export.',
      };
    case 'envelope-schema':
      return {
        title: "The export envelope doesn't match what the importer expects",
        body: 'One or more top-level fields are missing or invalid. If this came from a trusted source, ask them to re-export.',
      };
    case 'crypto-envelope':
      return {
        title: "The encrypted block in this export isn't well-formed",
        body: "We can't decrypt the secrets without a valid envelope. Ask the sender to re-export.",
      };
  }
}
