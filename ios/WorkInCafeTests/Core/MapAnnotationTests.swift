import MapKit
import Testing
@testable import WorkInCafe

@Suite("Map annotation presentation")
@MainActor
struct MapAnnotationTests {
    @Test("refresh updates a visible marker and its VoiceOver label")
    func refreshesExistingView() throws {
        let initial = PlaceFixture.summary(id: "place-a", name: "Old café", category: "cafe")
        let updated = PlaceFixture.summary(id: "place-a", name: "New library", category: "library")
        let annotation = PlaceAnnotation(place: initial)
        let view = PlaceAnnotationView(annotation: annotation, reuseIdentifier: PlaceAnnotationView.reuseIdentifier)

        annotation.update(with: updated)
        view.refresh()

        #expect(view.markerTintColor == .systemBlue)
        #expect(view.accessibilityLabel == "New library, Library")
    }
}
