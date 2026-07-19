import Foundation

struct AnnotationSnapshot: Hashable, Sendable {
    let payload: PlaceAnnotationPayload

    var id: String { payload.id }

    init(payload: PlaceAnnotationPayload) {
        self.payload = payload
    }

    init(place: PlaceSummary) {
        payload = PlaceAnnotationPayload(place: place)
    }
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
        var existingByID: [String: AnnotationSnapshot] = [:]
        for snapshot in existing where existingByID[snapshot.id] == nil {
            existingByID[snapshot.id] = snapshot
        }

        var incomingByID: [String: PlaceSummary] = [:]
        for place in incoming
            where !place.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                && incomingByID[place.id] == nil {
            incomingByID[place.id] = place
        }

        let removed = existingByID.keys.filter { incomingByID[$0] == nil }.sorted()
        let added = incomingByID.values.filter { existingByID[$0.id] == nil }.sorted { $0.id < $1.id }
        let updated = incomingByID.values.compactMap { place -> AnnotationUpdate? in
            guard let current = existingByID[place.id] else { return nil }
            guard current.payload != PlaceAnnotationPayload(place: place) else { return nil }
            return AnnotationUpdate(id: place.id, place: place)
        }.sorted { $0.id < $1.id }

        return AnnotationDiff(added: added, updated: updated, removedIDs: removed)
    }
}
