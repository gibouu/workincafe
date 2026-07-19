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

    @Test("visible presentation changes refresh a stable annotation")
    func visiblePresentationUpdate() async {
        let existingPlace = PlaceFixture.summary(id: "place-a", name: "Cafe", rating: nil)
        let incoming = PlaceFixture.summary(id: "place-a", name: "Cafe", rating: 8.5)

        let diff = await AnnotationReconciler().diff(
            existing: [AnnotationSnapshot(place: existingPlace)],
            incoming: [incoming]
        )

        #expect(diff.updated == [AnnotationUpdate(id: "place-a", place: incoming)])
    }

    @Test("duplicate incoming identities keep their first stable annotation")
    func duplicateIncomingIDs() async {
        let first = PlaceFixture.summary(id: "place-a", name: "First")
        let duplicate = PlaceFixture.summary(id: "place-a", name: "Duplicate")

        let diff = await AnnotationReconciler().diff(existing: [], incoming: [first, duplicate])

        #expect(diff.added == [first])
        #expect(diff.updated.isEmpty)
        #expect(diff.removedIDs.isEmpty)
    }
}
