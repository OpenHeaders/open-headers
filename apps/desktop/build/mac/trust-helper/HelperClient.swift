import Foundation
import ServiceManagement
import XPC

/// The unprivileged side — client verbs the app (or a terminal) runs
/// against the same binary, always from the user's GUI session. The
/// daemon pass-throughs (`import`/`delete`) move System-keychain cert
/// bytes via the root daemon; `trust-set`/`trust-remove` write the
/// admin-domain trust settings HERE, in-session, where authd can put
/// macOS's own admin authentication in front of the user (a
/// session-less root cannot — live-proven). Every verb prints exactly
/// one JSON object to stdout; exit code 0 means "the JSON is the
/// answer", never "the operation succeeded" — callers read the JSON.
func runClient(verb: String, arguments: [String]) {
  switch verb {
  case "status":
    clientStatus()
  case "import":
    clientImport()
  case "delete":
    clientDelete(arguments: arguments)
  case "trust-set":
    clientTrustSettings(remove: false)
  case "trust-remove":
    clientTrustSettings(remove: true)
  case "register":
    clientRegister()
  case "unregister":
    clientUnregister()
  case "login-items":
    SMAppService.openSystemSettingsLoginItems()
    printJson(["ok": true])
  default:
    printJson(["ok": false, "error": "unknown verb \(verb)"])
  }
}

private func connect() -> xpc_connection_t {
  let connection = xpc_connection_create_mach_service(
    HelperConstants.machServiceName,
    nil,
    UInt64(XPC_CONNECTION_MACH_SERVICE_PRIVILEGED)
  )
  if let team = selfTeamIdentifier() {
    _ = xpc_connection_set_peer_code_signing_requirement(connection, peerRequirement(team: team))
  }
  xpc_connection_set_event_handler(connection) { _ in }
  xpc_connection_activate(connection)
  return connection
}

private func roundTrip(_ request: xpc_object_t) -> xpc_object_t {
  let connection = connect()
  defer { xpc_connection_cancel(connection) }
  return xpc_connection_send_message_with_reply_sync(connection, request)
}

private func replyError(_ reply: xpc_object_t) -> String? {
  if xpc_get_type(reply) == XPC_TYPE_ERROR {
    if let raw = xpc_dictionary_get_string(reply, XPC_ERROR_KEY_DESCRIPTION) {
      return String(cString: raw)
    }
    return "helper unreachable"
  }
  guard xpc_get_type(reply) == XPC_TYPE_DICTIONARY else { return "unexpected reply type" }
  if !xpc_dictionary_get_bool(reply, "ok") {
    if let raw = xpc_dictionary_get_string(reply, "error") { return String(cString: raw) }
    return "helper refused"
  }
  return nil
}

private func clientStatus() {
  let request = xpc_dictionary_create(nil, nil, 0)
  xpc_dictionary_set_string(request, "verb", "status")
  let reply = roundTrip(request)
  if let error = replyError(reply) {
    printJson(["available": false, "reason": error])
    return
  }
  printJson(["available": true, "version": Int(xpc_dictionary_get_int64(reply, "version"))])
}

private func readStdinPem() -> String? {
  guard let data = try? FileHandle.standardInput.readToEnd() else { return nil }
  return String(data: data, encoding: .utf8)
}

private func clientImport() {
  guard let pem = readStdinPem(), !pem.isEmpty else {
    printJson(["ok": false, "error": "expected the CA PEM on stdin"])
    return
  }
  let request = xpc_dictionary_create(nil, nil, 0)
  xpc_dictionary_set_string(request, "verb", "import")
  xpc_dictionary_set_string(request, "pem", pem)
  printDaemonCommandReply(roundTrip(request))
}

private func clientDelete(arguments: [String]) {
  guard let sha1 = arguments.first else {
    printJson(["ok": false, "error": "expected the SHA-1 fingerprint as the argument"])
    return
  }
  guard let pem = readStdinPem(), !pem.isEmpty else {
    printJson(["ok": false, "error": "expected the CA PEM on stdin"])
    return
  }
  let request = xpc_dictionary_create(nil, nil, 0)
  xpc_dictionary_set_string(request, "verb", "delete")
  xpc_dictionary_set_string(request, "pem", pem)
  xpc_dictionary_set_string(request, "sha1", sha1)
  printDaemonCommandReply(roundTrip(request))
}

private func printDaemonCommandReply(_ reply: xpc_object_t) {
  if let error = replyError(reply) {
    printJson(["ok": false, "error": error])
    return
  }
  printJson([
    "ok": true,
    "code": Int(xpc_dictionary_get_int64(reply, "code")),
    "stderr": xpc_dictionary_get_string(reply, "stderr").map { String(cString: $0) } ?? "",
  ])
}

/// Writes/removes the admin-domain trust settings for the proxy CA
/// IN-PROCESS, from the user's session — authd fronts its own admin
/// authentication and a denial comes back as a plain OSStatus, never
/// an app-drawn prompt.
private func clientTrustSettings(remove: Bool) {
  guard let pem = readStdinPem(), !pem.isEmpty else {
    printJson(["ok": false, "error": "expected the CA PEM on stdin"])
    return
  }
  guard let cert = parseProxyCaCertificate(pem: pem) else {
    printJson(["ok": false, "error": "certificate is not the OpenHeaders proxy CA"])
    return
  }
  let status = remove
    ? SecTrustSettingsRemoveTrustSettings(cert, .admin)
    : SecTrustSettingsSetTrustSettings(cert, .admin, nil)
  let message = SecCopyErrorMessageString(status, nil).map { String($0) } ?? "OSStatus \(status)"
  printJson(["ok": true, "status": Int(status), "message": message])
}

private func serviceStatusLabel(_ status: SMAppService.Status) -> String {
  switch status {
  case .notRegistered: return "notRegistered"
  case .enabled: return "enabled"
  case .requiresApproval: return "requiresApproval"
  case .notFound: return "notFound"
  @unknown default: return "unknown"
  }
}

private func clientRegister() {
  let service = SMAppService.daemon(plistName: HelperConstants.plistName)
  var result: [String: Any] = ["bundle": Bundle.main.bundlePath]
  do {
    try service.register()
    result["ok"] = true
  } catch {
    result["ok"] = false
    result["error"] = error.localizedDescription
  }
  result["status"] = serviceStatusLabel(service.status)
  printJson(result)
}

private func clientUnregister() {
  let service = SMAppService.daemon(plistName: HelperConstants.plistName)
  var result: [String: Any] = [:]
  do {
    try service.unregister()
    result["ok"] = true
  } catch {
    result["ok"] = false
    result["error"] = error.localizedDescription
  }
  result["status"] = serviceStatusLabel(service.status)
  printJson(result)
}
