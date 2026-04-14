import Foundation
import CapacitorThermalPrinter

/// Referencia al plugin para que el enlazador incluya el binario SPM. Sin esto, Capacitor responde
/// "CapacitorThermalPrinter is not implemented on ios" y addListener no completa.
private enum _ThermalPrinterSPMForceLink {
    static let once: Bool = {
        _ = CapacitorThermalPrinterPlugin.self
        return true
    }()
}

public let isCapacitorApp: Bool = {
    _ = _ThermalPrinterSPMForceLink.once
    return true
}()
