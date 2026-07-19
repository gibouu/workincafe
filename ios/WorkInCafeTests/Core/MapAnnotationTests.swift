import MapKit
import Testing
@testable import WorkInCafe

@Suite("Map annotation presentation")
@MainActor
struct MapAnnotationTests {
    @Test("payload keeps only stable map presentation values")
    func minimalPayload() {
        let payload = PlaceAnnotationPayload(
            place: PlaceFixture.summary(id: "1", name: "Ten Belles")
        )

        #expect(payload.id == "1")
        #expect(payload.name == "Ten Belles")
        #expect(payload.presentationKey == "category.cafe")
    }

    @Test("selection publishes marker size and VoiceOver state")
    func selectedMarkerPresentation() {
        let annotation = PlaceAnnotation(
            place: PlaceFixture.summary(id: "selected", name: "Ten Belles")
        )
        let view = PlaceAnnotationView(
            annotation: annotation,
            reuseIdentifier: PlaceAnnotationView.reuseIdentifier
        )

        #expect(view.bounds.width == 32)
        #expect(view.accessibilityValue == "Not selected")
        #expect(!view.accessibilityTraits.contains(.selected))

        view.setSelected(true, animated: false)

        #expect(view.bounds.width == 42)
        #expect(view.accessibilityValue == "Selected")
        #expect(view.accessibilityTraits.contains(.selected))

        view.setSelected(false, animated: false)

        #expect(view.bounds.width == 32)
        #expect(view.accessibilityValue == "Not selected")
        #expect(!view.accessibilityTraits.contains(.selected))
    }

    @Test("reuse clears selected marker accessibility state")
    func reuseCleanup() {
        let annotation = PlaceAnnotation(
            place: PlaceFixture.summary(id: "selected", name: "Ten Belles")
        )
        let view = PlaceAnnotationView(
            annotation: annotation,
            reuseIdentifier: PlaceAnnotationView.reuseIdentifier
        )
        view.setSelected(true, animated: false)

        view.prepareForReuse()

        #expect(view.bounds.width == 32)
        #expect(view.accessibilityLabel == nil)
        #expect(view.accessibilityValue == nil)
        #expect(!view.accessibilityTraits.contains(.selected))
    }

    @Test("cluster diameter scales at deterministic count thresholds")
    func clusterSizeThresholds() {
        #expect(ClusterAnnotationView.diameter(for: 1) == 34)
        #expect(ClusterAnnotationView.diameter(for: 9) == 34)
        #expect(ClusterAnnotationView.diameter(for: 10) == 40)
        #expect(ClusterAnnotationView.diameter(for: 99) == 40)
        #expect(ClusterAnnotationView.diameter(for: 100) == 46)
    }
}
