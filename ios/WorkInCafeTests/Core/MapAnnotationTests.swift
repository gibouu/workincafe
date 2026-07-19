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
}
