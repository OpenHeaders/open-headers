import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "io.openheaders.safari.extension"

/// The desktop app's token-free health route on its loopback bind. The window
/// reads reachability from it and nothing else: whether this Safari is paired
/// is the extension popup's answer, never this app's (the Safari distribution
/// plan §4 F3).
let desktopHealthURL = URL(string: "http://127.0.0.1:8137/healthz")!

let desktopWebsiteURL = URL(string: "https://openheaders.com/")!

/// The one window: is the extension enabled in Safari, is the desktop app
/// running on this computer, and the two ways out of here.
class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        self.refresh()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.body as? String {
        case "open-preferences":
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
                DispatchQueue.main.async {
                    NSApplication.shared.terminate(nil)
                }
            }
        case "open-website":
            NSWorkspace.shared.open(desktopWebsiteURL)
        case "refresh":
            self.refresh()
        default:
            return
        }
    }

    private func refresh() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            let enabled = error == nil ? state?.isEnabled : nil
            let literal = enabled.map { String($0) } ?? "null"
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("showExtensionState(\(literal))")
            }
        }

        var request = URLRequest(url: desktopHealthURL)
        request.timeoutInterval = 2
        request.cachePolicy = .reloadIgnoringLocalCacheData
        URLSession.shared.dataTask(with: request) { (_, response, _) in
            let reachable = (response as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("showDesktopState(\(reachable))")
            }
        }.resume()
    }

}
