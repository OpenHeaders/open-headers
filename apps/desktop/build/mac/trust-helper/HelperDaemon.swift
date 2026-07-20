import Foundation
import XPC

/// The privileged side — a launchd daemon (root, registered via
/// SMAppService) exposing exactly three verbs over a Mach XPC service:
/// `status`, `install`, `remove`. Scope is enforced twice: the peer
/// must carry our own team's code signature, and the certificate must
/// be the proxy CA by subject CN. Anything else is refused.
///
/// The daemon is a dumb executor: it runs the same `security` commands
/// the unprivileged trust path uses (with `-d`, against the System
/// keychain) and returns raw exit codes + stderr — all interpretation
/// (idempotency, residue, verification) stays in the app's daemon,
/// where the trust laws are tested.
func runDaemon() -> Never {
  guard let team = selfTeamIdentifier() else {
    // Unsigned helper serves nobody — the capability probe stays
    // honestly unavailable on unsigned builds.
    FileHandle.standardError.write(Data("oh-trust-helper: refusing to serve unsigned\n".utf8))
    exit(1)
  }
  let requirement = peerRequirement(team: team)
  let listener = xpc_connection_create_mach_service(
    HelperConstants.machServiceName,
    nil,
    UInt64(XPC_CONNECTION_MACH_SERVICE_LISTENER)
  )
  xpc_connection_set_event_handler(listener) { peer in
    guard xpc_get_type(peer) == XPC_TYPE_CONNECTION else { return }
    if xpc_connection_set_peer_code_signing_requirement(peer, requirement) != 0 {
      xpc_connection_cancel(peer)
      return
    }
    xpc_connection_set_event_handler(peer) { message in
      guard xpc_get_type(message) == XPC_TYPE_DICTIONARY else { return }
      let reply = xpc_dictionary_create_reply(message)
      guard let reply else { return }
      handleRequest(message, into: reply)
      xpc_connection_send_message(peer, reply)
    }
    xpc_connection_activate(peer)
  }
  xpc_connection_activate(listener)
  dispatchMain()
}

private func handleRequest(_ message: xpc_object_t, into reply: xpc_object_t) {
  guard let verbRaw = xpc_dictionary_get_string(message, "verb") else {
    setError(reply, "missing verb")
    return
  }
  switch String(cString: verbRaw) {
  case "status":
    xpc_dictionary_set_bool(reply, "ok", true)
    xpc_dictionary_set_int64(reply, "version", Int64(HelperConstants.protocolVersion))
  case "install":
    handleInstall(message, into: reply)
  case "remove":
    handleRemove(message, into: reply)
  default:
    setError(reply, "unknown verb")
  }
}

private func handleInstall(_ message: xpc_object_t, into reply: xpc_object_t) {
  guard let pem = requireProxyCaPem(message, reply) else { return }
  withTemporaryPem(pem) { pemPath in
    let result = runCommand("/usr/bin/security", [
      "add-trusted-cert", "-d", "-r", "trustRoot", "-k", HelperConstants.systemKeychainPath, pemPath,
    ])
    xpc_dictionary_set_bool(reply, "ok", true)
    xpc_dictionary_set_int64(reply, "code", Int64(result.code))
    xpc_dictionary_set_string(reply, "stderr", result.stderr)
  }
}

private func handleRemove(_ message: xpc_object_t, into reply: xpc_object_t) {
  guard let pem = requireProxyCaPem(message, reply) else { return }
  guard let sha1Raw = xpc_dictionary_get_string(message, "sha1") else {
    setError(reply, "missing sha1")
    return
  }
  let sha1 = String(cString: sha1Raw).uppercased()
  guard sha1.count == 40, sha1.allSatisfy({ $0.isHexDigit }) else {
    setError(reply, "sha1 is not a 40-char hex fingerprint")
    return
  }
  withTemporaryPem(pem) { pemPath in
    let untrust = runCommand("/usr/bin/security", ["remove-trusted-cert", "-d", pemPath])
    let del = runCommand("/usr/bin/security", [
      "delete-certificate", "-Z", sha1, HelperConstants.systemKeychainPath,
    ])
    xpc_dictionary_set_bool(reply, "ok", true)
    xpc_dictionary_set_int64(reply, "untrustCode", Int64(untrust.code))
    xpc_dictionary_set_string(reply, "untrustStderr", untrust.stderr)
    xpc_dictionary_set_int64(reply, "deleteCode", Int64(del.code))
    xpc_dictionary_set_string(reply, "deleteStderr", del.stderr)
  }
}

/// The scope guard: the PEM must parse and its subject CN must be the
/// proxy CA's. The helper never touches any other certificate.
private func requireProxyCaPem(_ message: xpc_object_t, _ reply: xpc_object_t) -> String? {
  guard let pemRaw = xpc_dictionary_get_string(message, "pem") else {
    setError(reply, "missing pem")
    return nil
  }
  let pem = String(cString: pemRaw)
  guard let cn = certificateCommonName(pem: pem) else {
    setError(reply, "pem does not parse as a certificate")
    return nil
  }
  guard cn == HelperConstants.requiredCommonName else {
    setError(reply, "certificate is not the OpenHeaders proxy CA")
    return nil
  }
  return pem
}

private func withTemporaryPem(_ pem: String, _ body: (String) -> Void) {
  let dir = FileManager.default.temporaryDirectory
  let file = dir.appendingPathComponent("oh-proxy-ca-\(UUID().uuidString).pem")
  do {
    try pem.write(to: file, atomically: true, encoding: .utf8)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
  } catch {
    return
  }
  defer { try? FileManager.default.removeItem(at: file) }
  body(file.path)
}

private func setError(_ reply: xpc_object_t, _ error: String) {
  xpc_dictionary_set_bool(reply, "ok", false)
  xpc_dictionary_set_string(reply, "error", error)
}
