/**
 * Workbench editors — the gRPC client editor and gRPC response
 * examples. gRPC status-code names, rpc/service identifiers, and
 * Protobuf vocabulary ride raw inside keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'gRPC request not found.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (e.g. grpc.openheaders.io:443)',
  'workbench.editors.grpc.tls.on': 'TLS on — click to switch to plaintext',
  'workbench.editors.grpc.tls.off': 'TLS off (plaintext) — click to switch to TLS',
  'workbench.editors.grpc.method.placeholder': 'Select a method',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'Link a Protobuf spec to pick a method',
  'workbench.editors.grpc.method.unresolvedGroup': 'Not in linked spec',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (unresolved)',
  'workbench.editors.grpc.method.linkGroup': 'Link a Protobuf spec',
  'workbench.editors.grpc.method.importProto': 'Import a .proto file…',
  'workbench.editors.grpc.invoke.label': 'Invoke',
  'workbench.editors.grpc.invoke.stop': 'Stop',
  'workbench.editors.grpc.invoke.browserHost': 'Invoking runs on the desktop app — composing and saving works here.',
  'workbench.editors.grpc.invoke.needsMethod': 'Pick a method that resolves against the linked spec to invoke',
  'workbench.editors.grpc.invoke.needsUrl': 'Enter a target host to invoke',
  'workbench.editors.grpc.invoke.failed': 'Invoke failed — the host did not answer the call',
  'workbench.editors.grpc.response.title': 'Response',
  'workbench.editors.grpc.response.empty.prompt': 'Invoke a method to get a response.',
  'workbench.editors.grpc.response.empty.invoking': 'Invoking…',
  'workbench.editors.grpc.status.kicker': 'gRPC status',
  'workbench.editors.grpc.status.desc.unknownCode': 'A non-standard status code outside the gRPC vocabulary.',
  'workbench.editors.grpc.status.desc.OK': 'The call completed successfully.',
  'workbench.editors.grpc.status.desc.CANCELLED': 'The operation was cancelled, typically by the caller.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    'An unknown error occurred — often a server-side exception the runtime could not classify.',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'The client specified an invalid argument — problematic regardless of system state, such as a malformed name.',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'The deadline expired before the operation completed. The work may still have finished on the server.',
  'workbench.editors.grpc.status.desc.NOT_FOUND': 'A requested entity was not found.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS': 'The entity the client tried to create already exists.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'The caller does not have permission for this operation — authenticated, but not allowed.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'A resource has been exhausted — a per-user quota, or a system limit such as disk space.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    'The system is not in the state the operation requires — for example deleting a non-empty directory.',
  'workbench.editors.grpc.status.desc.ABORTED':
    'The operation was aborted, typically over a concurrency conflict. Retrying the whole sequence may help.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'The operation ran past the valid range — unlike INVALID_ARGUMENT, this depends on the system state.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED': 'The operation is not implemented or supported by this service.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    'An internal error — an invariant the underlying system expects was broken.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'The service is currently unavailable — usually transient. Check the target and TLS mode, or retry.',
  'workbench.editors.grpc.status.desc.DATA_LOSS': 'Unrecoverable data loss or corruption.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'The request lacks valid authentication credentials for the operation.',
  'workbench.editors.grpc.response.error.title': 'Call failed',
  'workbench.editors.grpc.response.error.localGuidance':
    'The call never reached a reply. Check the target, TLS mode, and that the server is reachable.',
  'workbench.editors.grpc.response.error.statusGuidance': 'Check the message and invoke the method again.',
  'workbench.editors.grpc.response.tab.response': 'Response',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': 'Filter metadata',
  'workbench.editors.grpc.response.filterTrailers': 'Filter trailers',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'No gRPC status',
  'workbench.editors.grpc.response.noMessage': 'The reply carried no response message.',
  'workbench.editors.grpc.response.noMetadata': 'No metadata',
  'workbench.editors.grpc.response.noTrailers': 'No trailers',
  'workbench.editors.grpc.response.trailersOnly':
    'Trailers-only reply — the status arrived with the initial metadata and no message followed.',
  'workbench.editors.grpc.response.compressed':
    'The response frame is compressed — compression is not negotiated, so it cannot be decoded.',
  'workbench.editors.grpc.response.structuralNotice':
    'Structural decode (field numbers) — the response type did not resolve against the linked spec.',
  'workbench.editors.grpc.response.rawNotice': 'The message did not decode; raw bytes shown as base64.',
  'workbench.editors.grpc.response.extraFrames':
    '{count} message frames arrived — a unary reply carries one; showing the first.',
  'workbench.editors.grpc.response.incompleteTail': 'The response ended mid-frame; complete frames shown.',
  'workbench.editors.grpc.response.truncated': 'Response capped at {bytes} bytes.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'Message',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.serviceDefinition': 'Service definition',
  'workbench.editors.grpc.tab.settings': 'Settings',
  'workbench.editors.grpc.messagePlaceholder': 'Request message as JSON',
  'workbench.editors.grpc.example.label': 'Use example message',
  'workbench.editors.grpc.example.needsMethod': 'Pick a method that resolves against the linked spec first',
  'workbench.editors.grpc.metadata.keyPlaceholder': 'Key',
  'workbench.editors.grpc.metadata.valuePlaceholder': 'Value',
  'workbench.editors.grpc.spec.selectLabel': 'Protobuf spec',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Link a Protobuf spec…',
  'workbench.editors.grpc.spec.summary': '{services} services · {methods} methods',
  'workbench.editors.grpc.spec.parseFailure': '{path}: {message}',
  'workbench.editors.grpc.spec.issue': '{kind}: {reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'Failed to read the file: {message}',
  'workbench.editors.grpc.spec.importFailed': 'Failed to import the .proto file',
  'workbench.editors.grpc.specFooter.using': 'Using {name}',
  'workbench.editors.grpc.specFooter.none': 'No spec linked',
  'workbench.editors.grpc.specFooter.issues': '{count} unresolved',
  'workbench.editors.grpc.specFooter.refresh': 'Rebuild from the spec’s current files',
  'workbench.editors.grpc.settings.timeoutLabel': 'Call timeout (ms)',
  'workbench.editors.grpc.settings.timeoutPlaceholder': 'No limit',
  'workbench.editors.grpc.settings.timeoutHelp':
    'Wall-clock ceiling on the whole call — sent as the gRPC deadline and enforced locally.',
  'workbench.editors.grpc.settings.sslVerifyLabel': 'SSL certificate verification',
  'workbench.editors.grpc.settings.sslVerifyHelp':
    'Verify the server certificate against the system roots. Turn off for self-signed development servers.',
  'workbench.editors.grpc.tab.auth': 'Authorization',
  'workbench.editors.grpc.auth.typeLabel': 'Type',
  'workbench.editors.grpc.auth.typeNone': 'No auth',
  'workbench.editors.grpc.auth.typeBearer': 'Bearer token',
  'workbench.editors.grpc.auth.tokenLabel': 'Token',
  'workbench.editors.grpc.auth.tokenPlaceholder': 'Token or {{variable}}',
  'workbench.editors.grpc.auth.help':
    'Sent as authorization: Bearer <token> metadata on the call. An explicit authorization metadata row takes precedence.',
  'workbench.editors.grpc.invoke.connectCompanion':
    'Connect the desktop app to invoke — composing and saving works here.',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': 'Stopped',
  'workbench.editors.grpc.stream.tab.timeline': 'Timeline',
  'workbench.editors.grpc.stream.trailersPending': 'Trailers arrive when the call completes.',
  'workbench.editors.grpc.stream.sendMessage': 'Send message',
  'workbench.editors.grpc.stream.endStreaming': 'End streaming',
  'workbench.editors.grpc.stream.controlsIdle': 'Invoke the call to open the stream first',
  'workbench.editors.grpc.stream.sendFailed': 'The message did not send',
  'workbench.editors.grpc.timeline.requestSent': 'Request sent',
  'workbench.editors.grpc.timeline.responseReceived': 'Response received',
  'workbench.editors.grpc.timeline.completed': 'Call completed',
  'workbench.editors.grpc.timeline.stopped': 'Call stopped',
  'workbench.editors.grpc.timeline.failed': 'Call failed',
  'workbench.editors.grpc.timeline.waiting': 'Waiting for messages…',
  'workbench.editors.grpc.timeline.noMatches': 'No messages match.',
  'workbench.editors.grpc.timeline.searchMessages': 'Search messages',
  'workbench.editors.grpc.timeline.filterAll': 'All',
  'workbench.editors.grpc.timeline.filterSent': 'Sent',
  'workbench.editors.grpc.timeline.filterReceived': 'Received',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} message', other: '{count} messages' }),
  'workbench.editors.grpc.timeline.sortOrder': 'Sort and group',
  'workbench.editors.grpc.timeline.newestFirst': 'Newest first',
  'workbench.editors.grpc.timeline.oldestFirst': 'Oldest first',
  'workbench.editors.grpc.timeline.showTypes': 'Show message types',
  'workbench.editors.grpc.timeline.groupByType': 'Group by message type',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'Rows per group',
  'workbench.editors.grpc.timeline.noLimit': 'No limit',
  'workbench.editors.grpc.timeline.clearMessages': 'Clear messages (display only)',
  'workbench.editors.grpc.timeline.newMessages': 'New messages',
  'workbench.editors.grpc.timeline.sentAria': 'Sent message',
  'workbench.editors.grpc.timeline.receivedAria': 'Received message',
  'workbench.editors.grpc.toast.deletedOtherTab': 'gRPC request was deleted from another tab',
  'workbench.editors.grpc.toast.updateFailed': 'Failed to update gRPC request',
  'workbench.editors.grpc.toast.updateFailedDetail': 'Failed to update gRPC request: {message}',
  'workbench.editors.grpc.response.saveResponse': 'Save Response',
  'workbench.editors.grpc.toast.savedExample': 'Saved example "{name}"',
  'workbench.editors.grpc.toast.saveExampleFailed': 'Failed to save example',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': 'Failed to save example: {message}',
  'workbench.editors.grpcExample.loading': 'Loading example…',
  'workbench.editors.grpcExample.notFound': 'Example not found.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': 'Example was deleted from another tab',
  'workbench.editors.grpcExample.toast.saveFailed': 'Failed to save example',
  'workbench.editors.grpcExample.toast.saveFailedDetail': 'Failed to save example: {message}',
  'workbench.editors.grpcExample.openInRequest': 'Open in Request',
  'workbench.editors.grpcExample.openInRequestTooltip':
    'Copy this example’s captured call into the parent gRPC request’s editor as unsaved edits',
  'workbench.editors.grpcExample.noMethod': 'No method recorded',
  'workbench.editors.grpcExample.capturedTooltip': 'Captured {date}',
  'workbench.editors.grpcExample.result.title': 'Captured response',
} as const satisfies Catalog;
