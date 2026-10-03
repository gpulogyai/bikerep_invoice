import UIKit
import Capacitor

/// Registers the app's own plugins, which live in this target rather than in a CocoaPod.
class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleIntelligencePlugin())
        #if DEBUG
        let question = ProcessInfo.processInfo.environment["ASK_SELF_TEST"]
        selfTestLog("ASK-SELFTEST launched, question given: \(question != nil)")
        if let question {
            askSelfTest(question)
        }
        #endif
    }

    #if DEBUG
    /// Prints, and appends to Documents/ask-selftest.log so it can be copied off the phone with devicectl.
    private func selfTestLog(_ line: String) {
        print(line)
        fflush(stdout)
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        let url = dir.appendingPathComponent("ask-selftest.log")
        let data = Data("\(Date()) \(line)\n".utf8)
        if let handle = try? FileHandle(forWritingTo: url) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: url)
        }
    }

    /// Debug builds only: `devicectl device process launch --console -e '{"ASK_SELF_TEST":"Who hasn't paid?"}' …`
    /// asks through the same code as the Ask button and prints the answer to the console.
    private func askSelfTest(_ question: String) {
        Task { @MainActor in
            for _ in 0..<30 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let webView = self.webView,
                      (try? await webView.evaluateJavaScript("typeof window.bikeInvoicesAsk")) as? String == "function"
                else { continue }
                selfTestLog("ASK-SELFTEST question: \(question)")
                do {
                    let result = try await webView.callAsyncJavaScript(
                        "return JSON.stringify(await window.bikeInvoicesAsk(q))",
                        arguments: ["q": question], contentWorld: .page)
                    selfTestLog("ASK-SELFTEST result: \(result ?? "nil")")
                } catch {
                    selfTestLog("ASK-SELFTEST script error: \(error)")
                }
                return
            }
            selfTestLog("ASK-SELFTEST web app never loaded")
        }
    }
    #endif
}
