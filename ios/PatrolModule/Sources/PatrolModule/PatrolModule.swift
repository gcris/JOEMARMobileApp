import ExpoModulesCore
import Foundation
import CoreLocation

public class PatrolModule: Module {
    private var locationEngine: LocationEngine?
    private let patrolRepository = PatrolRepository()
    private var syncManager: SyncManager?
    private let logger = Logger(subsystem: "com.pnp.geotracker", category: "PatrolModule")

    public func definition() -> ModuleDefinition {
        Name("PatrolModule")

        Events("onLocationUpdate", "onSyncComplete", "onError")

        AsyncFunction("configure") { (config: [String: Any]) in
            guard let baseURL = config["baseURL"] as? String,
                  let anonKey = config["anonKey"] as? String else {
                throw NSError(domain: "PatrolModule", code: -1, userInfo: [NSLocalizedDescriptionKey: "Missing baseURL or anonKey"])
            }
            self.syncManager = SyncManager(baseURL: baseURL, anonKey: anonKey)
            self.logger.info("PatrolModule configured with Supabase URL")
        }

        AsyncFunction("startTracking") { (personnelId: String, dutyType: String, promise: Promise) in
            do {
                let repo = PatrolRepository()
                self.locationEngine = LocationEngine(
                    personnelId: personnelId,
                    dutyType: dutyType,
                    patrolRepository: repo
                )
                self.locationEngine?.startTracking()
                self.logger.info("Started tracking for personnel: \(personnelId), duty: \(dutyType)")
                promise.resolve(true)
            } catch {
                self.logger.error("Failed to start tracking: \(error.localizedDescription)")
                promise.reject("START_TRACKING_FAILED", error.localizedDescription)
            }
        }

        AsyncFunction("stopTracking") { (promise: Promise) in
            self.locationEngine?.stopTracking()
            self.locationEngine = nil
            self.logger.info("Stopped tracking")
            promise.resolve(true)
        }

        AsyncFunction("sync") { (promise: Promise) in
            guard let syncManager = self.syncManager else {
                promise.reject("NOT_CONFIGURED", "Call configure() first")
                return
            }

            Task {
                do {
                    let count = try await syncManager.sync()
                    self.sendEvent("onSyncComplete", ["count": count])
                    promise.resolve(count)
                } catch {
                    self.logger.error("Sync failed: \(error.localizedDescription)")
                    self.sendEvent("onError", ["message": error.localizedDescription])
                    promise.reject("SYNC_FAILED", error.localizedDescription)
                }
            }
        }

        AsyncFunction("getUnsyncedCount") { (promise: Promise) in
            do {
                let count = try self.patrolRepository.getUnsyncedLocationCount()
                promise.resolve(count)
            } catch {
                promise.reject("COUNT_FAILED", error.localizedDescription)
            }
        }

        AsyncFunction("getTotalCount") { (promise: Promise) in
            do {
                let count = try self.patrolRepository.getTotalLocationCount()
                promise.resolve(count)
            } catch {
                promise.reject("COUNT_FAILED", error.localizedDescription)
            }
        }

        AsyncFunction("requestLocationPermission") { (promise: Promise) in
            let status = CLLocationManager.authorizationStatus()
            switch status {
            case .notDetermined:
                self.locationManager.requestAlwaysAuthorization()
                promise.resolve("requested")
            case .authorizedAlways, .authorizedWhenInUse:
                promise.resolve("granted")
            case .denied, .restricted:
                promise.resolve("denied")
            @unknown default:
                promise.resolve("unknown")
            }
        }

        private let locationManager = CLLocationManager()
    }
}