import Foundation

/// Dual-mode entry: launchd runs the binary with no arguments (daemon
/// mode, per the LaunchDaemons plist); every other invocation is a
/// client verb printing one JSON object to stdout.
let arguments = CommandLine.arguments
if arguments.count < 2 {
  runDaemon()
} else {
  runClient(verb: arguments[1], arguments: Array(arguments.dropFirst(2)))
}
