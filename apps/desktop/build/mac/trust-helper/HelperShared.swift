import Foundation
import Security

/// Shared constants and signing-identity helpers for the OpenHeaders
/// trust helper — the SMAppService privileged daemon scoped to
/// installing/removing System-keychain trust for the proxy CA
/// (the proxy-security design §2.6 amendment).
enum HelperConstants {
  static let machServiceName = "io.openheaders.trust-helper"
  static let plistName = "io.openheaders.trust-helper.plist"
  static let requiredCommonName = "Open Headers Proxy CA"
  static let systemKeychainPath = "/Library/Keychains/System.keychain"
  static let protocolVersion = 1
}

/// Team identifier of this binary's own code signature, or nil when
/// unsigned/ad-hoc. Both sides derive their peer requirement from it so
/// nothing is hardcoded at build time.
func selfTeamIdentifier() -> String? {
  var code: SecCode?
  guard SecCodeCopySelf([], &code) == errSecSuccess, let code else { return nil }
  var staticCode: SecStaticCode?
  guard SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode else { return nil }
  var info: CFDictionary?
  let flags = SecCSFlags(rawValue: kSecCSSigningInformation)
  guard SecCodeCopySigningInformation(staticCode, flags, &info) == errSecSuccess,
        let dict = info as? [String: Any] else { return nil }
  return dict[kSecCodeInfoTeamIdentifier as String] as? String
}

/// Same-team code-signing requirement string for peer validation.
func peerRequirement(team: String) -> String {
  "anchor apple generic and certificate leaf[subject.OU] = \"\(team)\""
}

/// Parses a PEM certificate, or nil when unparseable.
func parseCertificate(pem: String) -> SecCertificate? {
  let body = pem
    .components(separatedBy: .newlines)
    .filter { !$0.hasPrefix("-----") && !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    .joined()
  guard let der = Data(base64Encoded: body) else { return nil }
  return SecCertificateCreateWithData(nil, der as CFData)
}

/// The scope guard both modes share: the PEM must parse and its
/// subject CN must be the proxy CA's — no other certificate is ever
/// touched, privileged or not.
func parseProxyCaCertificate(pem: String) -> SecCertificate? {
  guard let cert = parseCertificate(pem: pem) else { return nil }
  guard let cn = SecCertificateCopySubjectSummary(cert) as String? else { return nil }
  return cn == HelperConstants.requiredCommonName ? cert : nil
}

struct CommandOutput {
  let code: Int32
  let stdout: String
  let stderr: String
}

/// Runs one fixed binary with fixed args — the helper never interprets
/// a shell line.
func runCommand(_ executable: String, _ arguments: [String]) -> CommandOutput {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments
  let out = Pipe()
  let err = Pipe()
  process.standardOutput = out
  process.standardError = err
  do {
    try process.run()
  } catch {
    return CommandOutput(code: 127, stdout: "", stderr: "\(executable): \(error.localizedDescription)")
  }
  let outData = out.fileHandleForReading.readDataToEndOfFile()
  let errData = err.fileHandleForReading.readDataToEndOfFile()
  process.waitUntilExit()
  return CommandOutput(
    code: process.terminationStatus,
    stdout: String(data: outData, encoding: .utf8) ?? "",
    stderr: String(data: errData, encoding: .utf8) ?? ""
  )
}

/// Prints one JSON object to stdout — the client verbs' whole contract.
func printJson(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
        let text = String(data: data, encoding: .utf8) else {
    print("{\"ok\":false,\"error\":\"json encoding failed\"}")
    return
  }
  print(text)
}