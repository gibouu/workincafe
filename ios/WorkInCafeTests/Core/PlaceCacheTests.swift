import Foundation
import Testing
@testable import WorkInCafe

@Suite("Place cache")
struct PlaceCacheTests {
    @Test("round trips the last successful summaries")
    func roundTrip() async throws {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent()) }
        let cache = PlaceCache(fileURL: fileURL)
        let places = [PlaceFixture.summary(id: "a", name: "Cafe")]

        try await cache.store(places)

        #expect(try await cache.load() == places)
    }

    @Test("evicts corrupt bytes and returns an empty cache")
    func corruptRecovery() async throws {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent()) }
        try Data("not-json".utf8).write(to: fileURL, options: .atomic)
        let cache = PlaceCache(fileURL: fileURL)

        #expect(try await cache.load() == nil)
        #expect(!FileManager.default.fileExists(atPath: fileURL.path))
    }

    private func temporaryFileURL() -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("places.json")
    }
}
