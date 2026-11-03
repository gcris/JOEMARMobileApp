import Foundation

final class PatrolRepository {
    private let database = PatrolDatabase.shared

    func saveLocation(_ location: PatrolLocation) throws -> Int64 {
        try database.insertLocation(location)
    }

    func getLocationCount() throws -> Int {
        try database.getLocationCount()
    }

    func getUnsyncedLocations() throws -> [PatrolLocation] {
        try database.getUnsyncedLocations()
    }

    func markAsSynced(ids: [Int64]) throws {
        try database.markAsSynced(ids: ids)
    }

    func getTotalLocationCount() throws -> Int {
        try database.getTotalLocationCount()
    }

    func getUnsyncedLocationCount() throws -> Int {
        try database.getUnsyncedLocationCount()
    }
}