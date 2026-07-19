import Foundation

private struct CacheEnvelope: Codable, Sendable {
    let schemaVersion: Int
    let storedAt: Date
    let places: [PlaceSummary]
}

protocol PlaceCaching: Sendable {
    func load() async throws -> [PlaceSummary]?
    func store(_ places: [PlaceSummary]) async throws
}

actor PlaceCache: PlaceCaching {
    private static let schemaVersion = 1
    private let explicitFileURL: URL?

    init(fileURL: URL? = nil) {
        explicitFileURL = fileURL
    }

    func load() throws -> [PlaceSummary]? {
        let fileURL = try resolvedFileURL(createDirectory: false)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        do {
            let data = try Data(contentsOf: fileURL)
            let envelope = try JSONDecoder().decode(CacheEnvelope.self, from: data)
            guard envelope.schemaVersion == Self.schemaVersion else {
                try? FileManager.default.removeItem(at: fileURL)
                return nil
            }
            return envelope.places
        } catch {
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }
    }

    func store(_ places: [PlaceSummary]) throws {
        let fileURL = try resolvedFileURL(createDirectory: true)
        let envelope = CacheEnvelope(
            schemaVersion: Self.schemaVersion,
            storedAt: Date(),
            places: places
        )
        let data = try JSONEncoder().encode(envelope)
        try data.write(to: fileURL, options: .atomic)
    }

    private func resolvedFileURL(createDirectory: Bool) throws -> URL {
        if let explicitFileURL { return explicitFileURL }
        let directory = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: createDirectory
        ).appendingPathComponent("WorkInCafe", isDirectory: true)
        if createDirectory {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory.appendingPathComponent("place-summaries-v1.json")
    }
}
