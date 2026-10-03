import Foundation
import Capacitor
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Answers questions about the shop's orders with Apple Intelligence's on-device model.
/// Nothing leaves the phone and no API key is needed.
@objc(AppleIntelligencePlugin)
public class AppleIntelligencePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleIntelligencePlugin"
    public let jsName = "AppleIntelligence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ask", returnType: CAPPluginReturnPromise),
    ]

    @objc func availability(_ call: CAPPluginCall) {
        let (available, reason) = currentAvailability()
        call.resolve(["available": available, "reason": reason])
    }

    @objc func ask(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt"), !prompt.isEmpty else {
            call.reject("Type a question first.", "empty")
            return
        }
        let instructions = call.getString("instructions") ?? ""
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else {
            call.reject(unavailableMessage("osTooOld"), "unavailable")
            return
        }
        let (available, reason) = currentAvailability()
        guard available else {
            call.reject(unavailableMessage(reason), "unavailable")
            return
        }
        Task {
            do {
                let session = LanguageModelSession(instructions: instructions)
                let response = try await session.respond(
                    to: prompt, generating: OrdersAnswer.self, options: GenerationOptions(sampling: .greedy))
                call.resolve([
                    "answer": response.content.answer,
                    "invoiceNumbers": response.content.invoiceNumbers,
                ])
            } catch let error as LanguageModelSession.GenerationError {
                switch error {
                case .exceededContextWindowSize:
                    call.reject("Too many orders to read at once.", "context")
                case .guardrailViolation, .refusal:
                    call.reject("Apple Intelligence declined to answer that question.", "refused")
                case .unsupportedLanguageOrLocale:
                    call.reject("Apple Intelligence doesn't support the phone's language for this yet.", "language")
                case .rateLimited, .concurrentRequests:
                    call.reject("Apple Intelligence is busy. Wait a moment and ask again.", "busy")
                case .assetsUnavailable:
                    call.reject(unavailableMessage("modelNotReady"), "unavailable")
                default:
                    call.reject("Apple Intelligence couldn't answer: \(error.localizedDescription)", "failed")
                }
            } catch {
                call.reject("Apple Intelligence couldn't answer: \(error.localizedDescription)", "failed")
            }
        }
        #else
        call.reject(unavailableMessage("osTooOld"), "unavailable")
        #endif
    }

    private func currentAvailability() -> (Bool, String) {
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else { return (false, "osTooOld") }
        switch SystemLanguageModel.default.availability {
        case .available:
            return (true, "")
        case .unavailable(.deviceNotEligible):
            return (false, "deviceNotEligible")
        case .unavailable(.appleIntelligenceNotEnabled):
            return (false, "appleIntelligenceNotEnabled")
        case .unavailable(.modelNotReady):
            return (false, "modelNotReady")
        case .unavailable:
            return (false, "unknown")
        }
        #else
        return (false, "osTooOld")
        #endif
    }

    private func unavailableMessage(_ reason: String) -> String {
        switch reason {
        case "appleIntelligenceNotEnabled":
            return "Turn on Apple Intelligence in Settings › Apple Intelligence & Siri to ask questions."
        case "modelNotReady":
            return "Apple Intelligence is still downloading. Try again in a few minutes."
        case "deviceNotEligible":
            return "This iPhone doesn't support Apple Intelligence."
        case "osTooOld":
            return "Asking questions needs iOS 26 or later with Apple Intelligence."
        default:
            return "Apple Intelligence isn't available right now."
        }
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct OrdersAnswer {
    @Guide(description: "A short, plain answer for the shop owner, readable on a phone. Money as $12.34.")
    var answer: String
    @Guide(description: "Invoice numbers, digits only, of every order the answer refers to. Empty if none.")
    var invoiceNumbers: [String]
}
#endif
