import Testing
@testable import WorkInCafe

@Suite("Annotation reconciliation")
struct AnnotationReconcilerTests {
    @Test("moving a stable place updates instead of replacing its annotation")
    func stableIdentity() async {
        let existing = [
            AnnotationSnapshot(place: PlaceFixture.summary(
                id: "place-a",
                name: "Cafe",
                latitude: 48.8,
                longitude: 2.3
            ))
        ]
        let incoming = [
            PlaceFixture.summary(id: "place-a", name: "Cafe", latitude: 48.81, longitude: 2.3)
        ]

        let diff = await AnnotationReconciler().diff(existing: existing, incoming: incoming)

        #expect(diff.removedIDs.isEmpty)
        #expect(diff.added.isEmpty)
        #expect(diff.updated.map(\.id) == ["place-a"])
    }

    @Test("adds and removes only changed identities")
    func additionsAndRemovals() async {
        let existing = [AnnotationSnapshot(place: PlaceFixture.summary(id: "old", name: "Old"))]
        let incoming = [PlaceFixture.summary(id: "new", name: "New")]

        let diff = await AnnotationReconciler().diff(existing: existing, incoming: incoming)

        #expect(diff.removedIDs == ["old"])
        #expect(diff.added.map(\.id) == ["new"])
    }

    @Test("metadata-only changes refresh a stable annotation")
    func metadataOnlyUpdate() async {
        let existingPlace = PlaceFixture.summary(id: "place-a", name: "Cafe", address: "Old address")
        let incoming = PlaceFixture.summary(id: "place-a", name: "Cafe", address: "New address")

        let diff = await AnnotationReconciler().diff(
            existing: [AnnotationSnapshot(place: existingPlace)],
            incoming: [incoming]
        )

        #expect(diff.updated == [AnnotationUpdate(id: "place-a", place: incoming)])
    }
}
