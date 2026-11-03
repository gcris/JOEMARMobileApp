import Foundation
import GRDB

final class PatrolDatabase {
    static let shared = PatrolDatabase()
    private let dbQueue: DatabaseQueue

    private init() {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dbURL = documentsPath.appendingPathComponent("patrol.db")
        do {
            dbQueue = try DatabaseQueue(path: dbURL.path)
            try migrate()
        } catch {
            fatalError("Failed to initialize PatrolDatabase: \(error)")
        }
    }

    private func migrate() throws {
        try dbQueue.write { db in
            try db.execute(sql: """
                CREATE TABLE IF NOT EXISTS patrol_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    dutyType TEXT,
                    personnelId TEXT,
                    accuracy REAL,
                    speed REAL,
                    networkSignal REAL,
                    altitude REAL,
                    bearing REAL,
                    timestamp INTEGER NOT NULL,
                    synced INTEGER DEFAULT 0
                );
                """)
        }
    }

    func insertLocation(_ location: PatrolLocation) throws -> Int64 {
        try dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO patrol_logs (latitude, longitude, dutyType, personnelId, accuracy, speed, networkSignal, altitude, bearing, timestamp, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    location.latitude,
                    location.longitude,
                    location.dutyType,
                    location.personnelId,
                    location.accuracy,
                    location.speed,
                    location.networkSignal,
                    location.altitude,
                    location.bearing,
                    location.timestamp,
                    location.synced ? 1 : 0
                ])
            return db.lastInsertedRowID
        }
    }

    func getLocationCount() throws -> Int {
        try dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM patrol_logs") ?? 0
        }
    }

    func getUnsyncedLocations() throws -> [PatrolLocation] {
        try dbQueue.read { db in
            try PatrolLocation.fetchAll(db, sql: """
                SELECT id, latitude, longitude, dutyType, personnelId, accuracy, speed, networkSignal, altitude, bearing, timestamp, synced
                FROM patrol_logs
                WHERE synced = 0
                ORDER BY timestamp ASC
                """)
        }
    }

    func markAsSynced(ids: [Int64]) throws {
        guard !ids.isEmpty else { return }
        let placeholders = ids.map { _ in "?" }.joined(separator: ",")
        try dbQueue.write { db in
            try db.execute(sql: """
                UPDATE patrol_logs SET synced = 1 WHERE id IN (\(placeholders))
                """, arguments: StatementArguments(ids.map { DatabaseValue($0) }))
        }
    }

    func getTotalLocationCount() throws -> Int {
        try getLocationCount()
    }

    func getUnsyncedLocationCount() throws -> Int {
        try dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM patrol_logs WHERE synced = 0") ?? 0
        }
    }
}

// MARK: - GRDB Record Conformance
extension PatrolLocation: FetchableRecord, MutablePersistableRecord {
    static let databaseTableName = "patrol_logs"

    enum Columns: String, ColumnExpression {
        case id, latitude, longitude, dutyType, personnelId, accuracy, speed, networkSignal, altitude, bearing, timestamp, synced
    }

    init(row: Row) {
        id = row[Columns.id]
        latitude = row[Columns.latitude]
        longitude = row[Columns.longitude]
        dutyType = row[Columns.dutyType] ?? ""
        personnelId = row[Columns.personnelId] ?? ""
        accuracy = row[Columns.accuracy] ?? 0
        speed = row[Columns.speed] ?? 0
        networkSignal = row[Columns.networkSignal] ?? 0
        altitude = row[Columns.altitude] ?? 0
        bearing = row[Columns.bearing] ?? 0
        timestamp = row[Columns.timestamp]
        synced = (row[Columns.synced] ?? 0) == 1
    }

    func encode(to container: inout PersistenceContainer) {
        container[Columns.id] = id
        container[Columns.latitude] = latitude
        container[Columns.longitude] = longitude
        container[Columns.dutyType] = dutyType
        container[Columns.personnelId] = personnelId
        container[Columns.accuracy] = accuracy
        container[Columns.speed] = speed
        container[Columns.networkSignal] = networkSignal
        container[Columns.altitude] = altitude
        container[Columns.bearing] = bearing
        container[Columns.timestamp] = timestamp
        container[Columns.synced] = synced ? 1 : 0
    }

    mutating func didInsert(with rowID: Int64, for column: String?) {
        // id is auto-assigned; we don't update the struct since it's a value type
    }
}