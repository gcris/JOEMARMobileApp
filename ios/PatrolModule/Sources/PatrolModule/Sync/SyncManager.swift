import Foundation

final class SyncManager {
    private let patrolRepository = PatrolRepository()
    private let supabaseApi: SupabaseApi
    private let logger = Logger(subsystem: "com.pnp.geotracker", category: "SyncManager")

    init(baseURL: String, anonKey: String) {
        self.supabaseApi = SupabaseApi(baseURL: baseURL, anonKey: anonKey)
    }

    func sync() async throws -> Int {
        logger.info("================================")
        logger.info("SYNC STARTED")

        let locations = try patrolRepository.getUnsyncedLocations()
        logger.debug("Pending locations = \(locations.count)")

        if locations.isEmpty {
            logger.info("No pending locations to upload")
            logger.info("SYNC FINISHED")
            return 0
        }

        locations.forEachIndexed { index, location in
            logger.debug("""
                Location #\(index + 1)
                ID: \(location.id)
                Personnel ID: \(location.personnelId)
                Duty Type: \(location.dutyType)
                Latitude: \(location.latitude)
                Longitude: \(location.longitude)
                Accuracy: \(location.accuracy)
                Speed: \(location.speed)
                Network Signal: \(location.networkSignal)
                Timestamp: \(location.timestamp)
                """)
        }

        logger.info("Uploading \(locations.count) locations to Supabase...")

        let success = try await supabaseApi.upload(locations: locations)
        logger.debug("Upload result = \(success)")

        if success {
            logger.info("Marking locations as synced...")
            try patrolRepository.markAsSynced(ids: locations.map { $0.id })
            logger.info("Successfully uploaded and marked \(locations.count) locations as synced")
        } else {
            logger.error("Upload failed; locations remain pending")
        }

        logger.info("SYNC FINISHED")
        return locations.count
    }
}