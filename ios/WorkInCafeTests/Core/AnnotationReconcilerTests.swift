import Testing
@testable import WorkInCafe

@Suite("Annotation reconciliation")
struct AnnotationReconcilerTests {
    @Test("moving a stable place updates instead of replacing its annotation")
    func stableIdentity() async {
        let existing = [
            AnnotationSnapshot(
                id: "place-a",
                latitude: 48.8,
                longitude: 2.3,
                presentationKey: "Cafe|cafe|"
            )
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
        let existing = [AnnotationSnapshot(id: "old", latitude: 0, longitude: 0, presentationKey: "old")]
        let incoming = [PlaceFixture.summary(id: "new", name: "New")]

        let diff = await AnnotationReconciler().diff(existing: existing, incoming: incoming)

        #expect(diff.removedIDs == ["old"])
        #expect(diff.added.map(\.id) == ["new"])
    }
}
