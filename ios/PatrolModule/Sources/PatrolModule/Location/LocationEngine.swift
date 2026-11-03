import Foundation
import CoreLocation
import os.log

final class LocationEngine: NSObject {
    private let locationManager = CLLocationManager()
    private let patrolRepository: PatrolRepository
    private let personnelId: String
    private let dutyType: String

    private var lastSavedLocation: CLLocation?
    private var lastSavedTime: TimeInterval = 0

    private let logger = Logger(subsystem: "com.pnp.geotracker", category: "LocationEngine")

    init(personnelId: String, dutyType: String, patrolRepository: PatrolRepository) {
        self.personnelId = personnelId
        self.dutyType = dutyType
        self.patrolRepository = patrolRepository
        super.init()

        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 5 // meters
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.activityType = .fitness
    }

    func startTracking() {
        logger.info("Starting GPS tracking...")
        locationManager.startUpdatingLocation()
    }

    func stopTracking() {
        logger.info("Stopping GPS tracking...")
        locationManager.stopUpdatingLocation()
    }
}

extension LocationEngine: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // Process in chronological order
        let sorted = locations.sorted { $0.timestamp < $1.timestamp }

        for location in sorted {
            // 1. Reject invalid/inaccurate GPS fixes
            guard location.coordinate.latitude.isFinite,
                  location.coordinate.longitude.isFinite,
                  location.coordinate.latitude >= -90 && location.coordinate.latitude <= 90,
                  location.coordinate.longitude >= -180 && location.coordinate.longitude <= 180,
                  location.coordinate.latitude != 0.0,
                  location.coordinate.longitude != 0.0,
                  location.horizontalAccuracy.isFinite,
                  location.horizontalAccuracy <= 30.0 else {
                logger.debug("GPS fix rejected: accuracy=\(location.horizontalAccuracy)m")
                continue
            }

            let locationTime = location.timestamp.timeIntervalSince1970 * 1000 // ms

            // Ignore old or duplicate timestamps
            guard locationTime > 0 && locationTime > lastSavedTime else { continue }

            let elapsed = lastSavedTime > 0 ? locationTime - lastSavedTime : .greatestFiniteMagnitude
            let previousLocation = lastSavedLocation

            let distance = previousLocation?.distance(from: location) ?? .greatestFiniteMagnitude

            let moving = (location.speed >= 1.0) || (distance >= 5.0)

            let saveInterval: TimeInterval = moving ? 5_000 : 9 * 60_000

            let shouldSave: Bool = {
                if previousLocation == nil || lastSavedTime <= 0 { return true }
                if moving { return elapsed >= 5_000 && distance >= 5.0 }
                return elapsed >= saveInterval
            }()

            guard shouldSave else { continue }

            do {
                let signal = SignalStrengthHelper.getSignal()

                let patrolLocation = PatrolLocation(
                    personnelId: personnelId,
                    dutyType: dutyType,
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    accuracy: Float(location.horizontalAccuracy),
                    speed: location.speed >= 0 ? Float(location.speed) : 0,
                    networkSignal: signal?.level ?? 0,
                    altitude: location.altitude,
                    bearing: location.course >= 0 ? Float(location.course) : 0,
                    timestamp: Int64(locationTime)
                )

                let id = try patrolRepository.saveLocation(patrolLocation)

                lastSavedLocation = location
                lastSavedTime = locationTime

                logger.info("""
                    Saved location #\(id) | \
                    moving=\(moving) | \
                    speed=\(location.speed) m/s | \
                    accuracy=\(location.horizontalAccuracy)m | \
                    distance=\(distance)m | \
                    elapsed=\(Int(elapsed/1000))s
                    """)

            } catch {
                logger.error("Failed to save patrol location: \(error.localizedDescription)")
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        logger.error("Location manager error: \(error.localizedDescription)")
    }
}