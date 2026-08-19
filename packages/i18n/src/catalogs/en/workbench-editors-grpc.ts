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
  'workbench.editors.grpc.urlPlaceholder': 'host:port (e.g. grpc.openheaders.com:443)',
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
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions, verbatim, so the pill popover reads exactly like the
  // protocol documentation.
  'workbench.editors.grpc.status.desc.unknownCode': 'A non-standard status code outside the gRPC vocabulary.',
  'workbench.editors.grpc.status.desc.OK':
    'Status code 0 OK is a standard response for successfully invoking a gRPC method.',
  'workbench.editors.grpc.status.desc.CANCELLED':
    'Status code 1 CANCELLED is returned if the operation is cancelled by the caller.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    "Status code 2 UNKNOWN is returned if the operation couldn't be completed because of an unknown error. For example, this error may be returned when a Status value received from another address space belongs to an error space that is not known in this address space. Also errors raised by APIs that do not return enough error information may be converted to this error.",
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'Status code 3 INVALID_ARGUMENT is returned if the client has specified an invalid argument. This stands for arguments that are problematic regardless of the state of the system (e.g. a malformed file name).',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'Status code 4 DEADLINE_EXCEEDED is returned if the deadline expires before the operation could be completed. For operations that change the state of the system, this error may be returned even if the operation has completed successfully. For example, a successful response from a server could have been delayed long.',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'Status code 5 NOT_FOUND is returned if a requested entity (e.g., file or directory) was not found.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    'Status code 6 ALREADY_EXISTS is returned if the entity you attempted to create (e.g., file or directory) already exists.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'Status code 7 PERMISSION_DENIED is returned if the caller does not have permission to execute the specified operation. This error code does not imply the request is valid or the requested entity exists or satisfies other pre-conditions.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'Status code 8 RESOURCE_EXHAUSTED is returned if a per-user quota, or perhaps the entire file system is out of space.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    "Status code 9 FAILED_PRECONDITION is returned if the operation was rejected because of the system not being in the required state for the operation's execution. For example, the directory to be deleted is non-empty, an rmdir operation is applied to a non-directory, etc.",
  'workbench.editors.grpc.status.desc.ABORTED':
    'Status code 10 ABORTED is returned if the operation was aborted, typically due to a concurrency issue such as a sequencer check failure or transaction abort.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'Status code 11 OUT_OF_RANGE is returned if the operation was attempted past the valid range. For example, seeking or reading past end-of-file.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    'Status code 12 UNIMPLEMENTED is returned if the operation is not implemented or is not supported/enabled in this service.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    "Status code 13 INTERNAL is returned if there's an internal error. This means that some invariants expected by the underlying system have been broken.",
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'Status code 14 UNAVAILABLE is returned if the service is currently unavailable.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'Status code 15 DATA_LOSS is returned if there is an irrecoverable data loss or corruption.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'Status code 16 UNAUTHENTICATED is returned if the request does not have valid authentication credentials for the operation.',
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
  'workbench.editors.grpc.settings.unixSocketLabel': 'Unix socket',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'Dial this local socket — an absolute Unix socket path, or a Windows named pipe like \\\\.\\pipe\\name — instead of opening a TCP connection. The target keeps deciding the :authority header, TLS server name, and certificate verification; only where the connection goes changes. Leave empty for a normal TCP connection.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'No socket — TCP connection',
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
  'workbench.editors.grpc.timeline.groupByDirection': 'Group by direction',
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
