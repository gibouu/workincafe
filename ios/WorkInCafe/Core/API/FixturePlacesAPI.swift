struct FixturePlacesAPI: PlacesServing {
    func places(in bounds: PlaceBounds) async throws -> [PlaceSummary] {
        Self.parisPlaces
    }

    private static let parisPlaces = [
        PlaceSummary(
            id: "fixture-ten-belles",
            name: "Ten Belles",
            address: "10 Rue Bréguet, 75011 Paris",
            neighborhood: "Bastille",
            category: "cafe",
            latitude: 48.8569,
            longitude: 2.3712,
            brand: nil,
            rating: 4.7,
            hasUserReviews: true,
            isValidated: true,
            membershipRequired: nil
        ),
        PlaceSummary(
            id: "fixture-bibliotheque-forney",
            name: "Bibliothèque Forney",
            address: "1 Rue du Figuier, 75004 Paris",
            neighborhood: "Le Marais",
            category: "library",
            latitude: 48.8537,
            longitude: 2.3590,
            brand: nil,
            rating: 4.5,
            hasUserReviews: true,
            isValidated: true,
            membershipRequired: nil
        ),
        PlaceSummary(
            id: "fixture-du-pain",
            name: "Du Pain et des Idées",
            address: "34 Rue Yves Toudic, 75010 Paris",
            neighborhood: "Canal Saint-Martin",
            category: "bakery",
            latitude: 48.8719,
            longitude: 2.3634,
            brand: nil,
            rating: 4.4,
            hasUserReviews: true,
            isValidated: true,
            membershipRequired: nil
        ),
        PlaceSummary(
            id: "fixture-wework-lafayette",
            name: "WeWork La Fayette",
            address: "33 Rue La Fayette, 75009 Paris",
            neighborhood: "Faubourg-Montmartre",
            category: "coworking",
            latitude: 48.8751,
            longitude: 2.3404,
            brand: "WeWork",
            rating: 4.2,
            hasUserReviews: true,
            isValidated: true,
            membershipRequired: "Day pass required"
        ),
        PlaceSummary(
            id: "fixture-starbucks-opera",
            name: "Starbucks Opéra",
            address: "26 Avenue de l'Opéra, 75001 Paris",
            neighborhood: "Palais-Royal",
            category: "cafe",
            latitude: 48.8660,
            longitude: 2.3332,
            brand: "Starbucks",
            rating: 3.9,
            hasUserReviews: false,
            isValidated: true,
            membershipRequired: nil
        ),
    ]
}
