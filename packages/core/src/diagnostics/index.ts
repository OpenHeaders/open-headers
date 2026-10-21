/**
 * `@openheaders/core/diagnostics` — the user-initiated diagnostic
 * bundle (the error reports plan §4.5): the system-facts vocabulary the
 * hosts answer, the pure composer that turns gathered parts into zip
 * entries, the dependency-free zip writer, and the Report Issue link
 * builder that prefills the repository's new-issue page from the same
 * facts, the redaction every gathered file passes through, and the two
 * support links the app ships. Ships nothing; every byte stays where the
 * person saves it, and the link only opens a page the person reviews
 * before posting.
 */

export {
  composeDiagnosticsBundle,
  DIAGNOSTICS_BUNDLE_FACTS,
  DIAGNOSTICS_BUNDLE_LOGS_DIR,
  DIAGNOSTICS_BUNDLE_OBSERVABILITY_LOG,
  DIAGNOSTICS_BUNDLE_README,
  DIAGNOSTICS_BUNDLE_SETTINGS,
  DIAGNOSTICS_BUNDLE_STATUS,
  DIAGNOSTICS_BUNDLE_TELEMETRY_SESSION,
  type DiagnosticsBundleHost,
  type DiagnosticsBundleParts,
  type DiagnosticsLogFile,
  type DiagnosticsTelemetrySession,
  diagnosticsBundleFilename,
} from './bundle';
export type {
  DesktopDiagnosticsFacts,
  DesktopDisplayFacts,
  DiagnosticsFacts,
  DiagnosticsFactsBase,
  ExtensionDiagnosticsFacts,
} from './facts';
export {
  ISSUE_COMPONENT,
  ISSUE_TEMPLATE,
  ISSUE_URL_BUDGET,
  type IssueDraft,
  type IssueHost,
  type IssueKind,
  type IssueLink,
  type IssueTrim,
  issueBody,
  issueLink,
  issuePlatformLine,
  issueVersionLine,
  type SystemInformationRow,
  systemInformationMarkdown,
  systemInformationRows,
} from './issue-form';
export {
  DIAGNOSTICS_COLLAPSED,
  DIAGNOSTICS_CREDENTIAL_QUERY_KEYS,
  DIAGNOSTICS_CREDENTIALS_PLACEHOLDER,
  DIAGNOSTICS_EMAIL_PLACEHOLDER,
  DIAGNOSTICS_HOME_PLACEHOLDER,
  DIAGNOSTICS_REDACTED_PLACEHOLDER,
  DIAGNOSTICS_TMP_PLACEHOLDER,
  type DiagnosticsRoot,
  redactDiagnosticsText,
  workspaceDiagnosticsRoots,
} from './redact';
export { COMMUNITY_CHAT_URL, ISSUE_NEW_URL } from './support-links';
export { crc32, dosDateTime, writeZip, type ZipEntry } from './zip';
