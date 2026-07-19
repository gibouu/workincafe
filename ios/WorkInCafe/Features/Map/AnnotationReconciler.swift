import Foundation

struct AnnotationSnapshot: Hashable, Sendable {
    let id: String
    let latitude: Double
    let longitude: Double
    let presentationKey: String
}

struct AnnotationUpdate: Hashable, Sendable {
    let id: String
    let place: PlaceSummary
}

struct AnnotationDiff: Sendable {
    let added: [PlaceSummary]
    let updated: [AnnotationUpdate]
    let removedIDs: [String]
}

actor AnnotationReconciler {
    func diff(existing: [AnnotationSnapshot], incoming: [PlaceSummary]) -> AnnotationDiff {
        let existingByID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        let incomingByID = Dictionary(uniqueKeysWithValues: incoming.map { ($0.id, $0) })

        let removed = existingByID.keys.filter { incomingByID[$0] == nil }.sorted()
        let added = incomingByID.values.filter { existingByID[$0.id] == nil }.sorted { $0.id < $1.id }
        let updated = incomingByID.values.compactMap { place -> AnnotationUpdate? in
            guard let current = existingByID[place.id] else { return nil }
            guard current.latitude != place.latitude
                    || current.longitude != place.longitude
                    || current.presentationKey != place.presentationKey else { return nil }
            return AnnotationUpdate(id: place.id, place: place)
        }.sorted { $0.id < $1.id }

        return AnnotationDiff(added: added, updated: updated, removedIDs: removed)
    }
}
