import Foundation
@testable import WorkInCafe

enum PlaceFixture {
    static let response = Data(
        #"""
        {
          "places": [
            {
              "id": "11111111-1111-1111-1111-111111111111",
              "name": "Ten Belles",
              "address": "10 Rue de la Grange aux Belles",
              "neighborhood": "10e",
              "category": "cafe",
              "lat": 48.8721,
              "lng": 2.3671,
              "brand": null,
              "rating": 4.5,
              "has_user_reviews": true,
              "is_validated": true,
              "membership_required": null
            },
            {
              "id": "22222222-2222-2222-2222-222222222222",
              "name": "Quiet Corner",
              "category": "library",
              "lat": 48.8338,
              "lng": 2.3764
            }
          ],
          "total": 2,
          "slim": true
        }
        """#.utf8
    )

    static func summary(
        id: String,
        name: String,
        address: String = "",
        category: String = "cafe",
        latitude: Double = 48.8566,
        longitude: Double = 2.3522
    ) -> PlaceSummary {
        PlaceSummary(
            id: id,
            name: name,
            address: address,
            neighborhood: "",
            category: category,
            latitude: latitude,
            longitude: longitude,
            brand: nil,
            rating: nil,
            hasUserReviews: false,
            isValidated: false,
            membershipRequired: nil
        )
    }
}
