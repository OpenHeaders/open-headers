import SafariServices
import os.log

/// The extension's native endpoint, which the appex must declare. The product
/// never calls `sendNativeMessage` on Safari: the loopback socket to the desktop
/// app opens from the extension's own background page (the Safari distribution
/// plan §4 F4), so this handler has no relay role and answers nothing.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        os_log(.default, "Open Headers: a native message arrived, but the extension has no native plane")
        context.completeRequest(returningItems: nil, completionHandler: nil)
    }

}
