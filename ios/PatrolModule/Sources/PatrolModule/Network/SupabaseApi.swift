import Foundation

struct SupabaseLocation: Codable {
    let personnel_id: String
    let duty_type: String
    let latitude: Double
    let longitude: Double
    let speed: Float
    let captured_at: String
    let network_signal: Int
}

final class SupabaseApi {
    private let logger = Logger(subsystem: "com.pnp.geotracker", category: "SupabaseApi")

    private let baseURL: String
    private let anonKey: String

    init(baseURL: String, anonKey: String) {
        self.baseURL = baseURL
        self.anonKey = anonKey
    }

    func upload(locations: [PatrolLocation]) async throws -> Bool {
        let validLocations = locations.filter { !$0.personnelId.isEmpty }
        let invalidCount = locations.count - validLocations.count

        logger.debug("Total locations: \(locations.count)")
        logger.debug("Valid locations: \(validLocations.count)")
        if invalidCount > 0 {
            logger.warning("Empty personnelId records: \(invalidCount)")
        }

        guard !validLocations.isEmpty else {
            logger.warning("No valid locations to upload")
            return false
        }

        let payload = validLocations.map { $0.toSupabasePayload() }
        let jsonData = try JSONSerialization.data(withJSONObject: payload)

        var request = URLRequest(url: URL(string: "\(baseURL)/rest/v1/patrol_logs")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = jsonData

        logger.debug("\(String(data: jsonData, encoding: .utf8) ?? "")")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("Invalid response type")
            return false
        }

        logger.debug("HTTP \(httpResponse.statusCode)")
        return (200...299).contains(httpResponse.statusCode)
    }
}