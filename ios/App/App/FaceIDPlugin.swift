import Foundation
import LocalAuthentication
import UIKit
import Capacitor

/// Uses Apple's enrolled Face ID; no face images, app PIN, or passcode fallback.
@objc(FaceIDPlugin)
public class FaceIDPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FaceIDPlugin"
    public let jsName = "FaceID"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeLock", returnType: CAPPluginReturnPromise),
    ]
    private var context: LAContext?
    private var generation = 0
    private var observers: [NSObjectProtocol] = []
    private var privacyView: UIView?
    private var unlocked = false
    private var lockEpoch = 0
    private var acknowledgedEpoch: Int?

    public override func load() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            // Face ID itself resigns active. Never cancel its prompt here.
            if self?.unlocked == true { self?.cover() }
        })
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.unlocked || self.context != nil else { return }
            self.cover()
            self.invalidate()
            self.lockEpoch += 1
            self.acknowledgedEpoch = nil
            self.emitLock()
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.privacyView != nil else { return }
            if self.unlocked || self.acknowledgedEpoch == self.lockEpoch {
                // An interruption, such as Control Center, without backgrounding.
                self.uncover()
            } else {
                // Keep the cover until React has painted the locked screen.
                self.emitLock()
            }
        })
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        context?.invalidate()
    }

    private func emitLock() {
        notifyListeners("locked", data: ["epoch": lockEpoch], retainUntilConsumed: true)
    }

    private func cover() {
        guard privacyView == nil, let view = bridge?.viewController?.view else { return }
        let cover = UIView(frame: view.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = UIColor(red: 27/255, green: 19/255, blue: 64/255, alpha: 1)
        let label = UILabel()
        label.text = "Bike Invoices — Locked"
        label.textColor = .white
        label.textAlignment = .center
        label.frame = cover.bounds
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.addSubview(label)
        view.addSubview(cover)
        privacyView = cover
    }

    private func uncover() {
        privacyView?.removeFromSuperview()
        privacyView = nil
    }

    @objc func acknowledgeLock(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if call.getInt("epoch") == self.lockEpoch, !self.unlocked {
                self.acknowledgedEpoch = self.lockEpoch
                if UIApplication.shared.applicationState == .active { self.uncover() }
            }
            call.resolve()
        }
    }

    private func invalidate() {
        unlocked = false
        generation += 1
        context?.invalidate()
        context = nil
    }

    @objc func availability(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let context = LAContext()
            var error: NSError?
            let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            let isFaceID = context.biometryType == .faceID
            call.resolve([
                "available": available && isFaceID,
                "reason": available && isFaceID ? "" : self.message(error, isFaceID: isFaceID),
            ])
            context.invalidate()
        }
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.invalidate()
            guard UIApplication.shared.applicationState != .background else {
                call.reject("Return to the app to use Face ID.", "background")
                return
            }
            let context = LAContext()
            context.localizedFallbackTitle = ""
            context.localizedCancelTitle = "Cancel"
            // A fresh context ensures every entry requires a new authentication.
            context.touchIDAuthenticationAllowableReuseDuration = 0
            var error: NSError?
            let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            guard available, context.biometryType == .faceID else {
                call.reject(self.message(error, isFaceID: context.biometryType == .faceID), "unavailable")
                context.invalidate()
                return
            }
            self.context = context
            let request = self.generation
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                                   localizedReason: "View your bike shop income and owner settings") { success, error in
                DispatchQueue.main.async {
                    guard request == self.generation,
                          UIApplication.shared.applicationState != .background else {
                        call.reject("Face ID was cancelled. Try again.", "cancelled")
                        return
                    }
                    self.context = nil
                    context.invalidate()
                    if success {
                        self.unlocked = true
                        call.resolve(["authenticated": true])
                    } else {
                        call.reject(self.message(error as NSError?, isFaceID: true), "authenticationFailed")
                    }
                }
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.invalidate()
            call.resolve()
        }
    }

    private func message(_ error: NSError?, isFaceID: Bool) -> String {
        if let error, error.domain == LAError.errorDomain, let code = LAError.Code(rawValue: error.code) {
            switch code {
            case .biometryLockout:
                return "Face ID is locked. Unlock your iPhone using its passcode, then return and try Face ID again."
            case .biometryNotEnrolled:
                return "Set up Face ID in iPhone Settings › Face ID & Passcode first."
            case .biometryNotAvailable:
                return "Face ID is unavailable. Check iPhone Settings › Face ID & Passcode › Other Apps."
            case .userCancel, .appCancel, .systemCancel, .userFallback:
                return "Face ID was cancelled. Income stays locked."
            case .authenticationFailed:
                return "Face ID did not recognize you. Try again."
            default: break
            }
        }
        return isFaceID ? "Face ID could not authenticate. Try again." : "This device does not support Face ID. Income stays locked."
    }
}
