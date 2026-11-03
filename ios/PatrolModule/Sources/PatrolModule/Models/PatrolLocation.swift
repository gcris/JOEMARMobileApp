import Foundation

struct PatrolLocation: Codable {
    let id: Int64
    let personnelId: String
    let dutyType: String
    let latitude: Double
    let longitude: Double
    let accuracy: Float
    let speed: Float
    let networkSignal: Int
    let altitude: Double
    let bearing: Float
    let timestamp: Int64
    let synced: Bool

    init(
        id: Int64 = 0,
        personnelId: String,
        dutyType: String,
        latitude: Double,
        longitude: Double,
        accuracy: Float,
        speed: Float,
        networkSignal: Int,
        altitude: Double,
        bearing: Float,
        timestamp: Int64,
        synced: Bool = false
    ) {
        self.id = id
        self.personnelId = personnelId
        self.dutyType = dutyType
        self.latitude = latitude
        self.longitude = longitude
        self.accuracy = accuracy
        self.speed = speed
        self.networkSignal = networkSignal
        self.altitude = altitude
        self.bearing = bearing
        self.timestamp = timestamp
        self.synced = synced
    }

    // Convert to Supabase upload format
    func toSupabasePayload() -> [String: Any] {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000.0)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return [
            "personnel_id": personnelId,
            "duty_type": dutyType.isEmpty ? "Foot Patrolling" : dutyType,
            "latitude": latitude,
            "longitude": longitude,
            "speed": speed,
            "captured_at": formatter.string(from: date),
            "network_signal": networkSignal
        ]
    }
}

struct NetworkSignal: Codable {
    let networkType: String
    let dbm: Int
    let level: Int
}