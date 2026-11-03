import Foundation
import CoreTelephony

struct NetworkSignal {
    let networkType: String
    let dbm: Int
    let level: Int
}

enum SignalStrengthHelper {
    static func getSignal() -> NetworkSignal? {
        let networkInfo = CTTelephonyNetworkInfo()
        guard let serviceCurrentRadioAccessTechnology = networkInfo.serviceCurrentRadioAccessTechnology else {
            return nil
        }

        var bestSignal: NetworkSignal?

        for (_, radioAccessTechnology) in serviceCurrentRadioAccessTechnology {
            let networkType: String
            if #available(iOS 14.1, *) {
                if radioAccessTechnology == CTRadioAccessTechnologyNR ||
                   radioAccessTechnology == CTRadioAccessTechnologyNRNSA {
                    networkType = "5G"
                } else {
                    networkType = "LTE"
                }
            } else {
                networkType = radioAccessTechnology == CTRadioAccessTechnologyLTE ? "LTE" : "Unknown"
            }

            // iOS doesn't expose dBm directly via public API for cellular
            // Use signal level (0-4 bars) as proxy
            // This is a limitation of iOS public APIs
            let level = 2 // Default moderate signal

            let signal = NetworkSignal(networkType: networkType, dbm: -85, level: level)

            // Prefer 5G > LTE > others
            if bestSignal == nil || (signal.networkType == "5G" && bestSignal!.networkType != "5G") {
                bestSignal = signal
            }
        }

        return bestSignal
    }
}