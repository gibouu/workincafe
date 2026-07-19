import Foundation

struct PlaceSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let address: String
    let neighborhood: String
    let category: String
    let latitude: Double
    let longitude: Double
    let brand: String?
    let rating: Double?
    let hasUserReviews: Bool
    let isValidated: Bool
    let membershipRequired: String?

    init(
        id: String,
        name: String,
        address: String,
        neighborhood: String,
        category: String,
        latitude: Double,
        longitude: Double,
        brand: String?,
        rating: Double?,
        hasUserReviews: Bool,
        isValidated: Bool,
        membershipRequired: String?
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.neighborhood = neighborhood
        self.category = category
        self.latitude = latitude
        self.longitude = longitude
        self.brand = brand
        self.rating = rating
        self.hasUserReviews = hasUserReviews
        self.isValidated = isValidated
        self.membershipRequired = membershipRequired
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, address, neighborhood, category, lat, lng, brand, rating
        case hasUserReviews = "has_user_reviews"
        case isValidated = "is_validated"
        case membershipRequired = "membership_required"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        name = try values.decode(String.self, forKey: .name)
        address = try values.decodeIfPresent(String.self, forKey: .address) ?? ""
        neighborhood = try values.decodeIfPresent(String.self, forKey: .neighborhood) ?? ""
        category = try values.decode(String.self, forKey: .category)
        latitude = try values.decode(Double.self, forKey: .lat)
        longitude = try values.decode(Double.self, forKey: .lng)
        brand = try values.decodeIfPresent(String.self, forKey: .brand)
        rating = try values.decodeIfPresent(Double.self, forKey: .rating)
        hasUserReviews = try values.decodeIfPresent(Bool.self, forKey: .hasUserReviews) ?? false
        isValidated = try values.decodeIfPresent(Bool.self, forKey: .isValidated) ?? false
        membershipRequired = try values.decodeIfPresent(String.self, forKey: .membershipRequired)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encode(name, forKey: .name)
        try values.encode(address, forKey: .address)
        try values.encode(neighborhood, forKey: .neighborhood)
        try values.encode(category, forKey: .category)
        try values.encode(latitude, forKey: .lat)
        try values.encode(longitude, forKey: .lng)
        try values.encodeIfPresent(brand, forKey: .brand)
        try values.encodeIfPresent(rating, forKey: .rating)
        try values.encode(hasUserReviews, forKey: .hasUserReviews)
        try values.encode(isValidated, forKey: .isValidated)
        try values.encodeIfPresent(membershipRequired, forKey: .membershipRequired)
    }

    var categoryLabel: String {
        presentation.label
    }

    var symbolName: String {
        presentation.symbolName
    }

    var presentation: PlacePresentation {
        .resolve(category: category, brand: brand, name: name)
    }

    var presentationKey: String {
        presentation.key
    }
}

struct PlacesResponse: Codable, Sendable {
    let places: [PlaceSummary]
    let total: Int?
    let slim: Bool?
}

struct PlaceResponseDecoder: Sendable {
    func decode(_ data: Data) throws -> PlacesResponse {
        try JSONDecoder().decode(PlacesResponse.self, from: data)
    }
}

struct PlaceBounds: Codable, Hashable, Sendable {
    let west: Double
    let south: Double
    let east: Double
    let north: Double

    var queryValue: String {
        [west, south, east, north].map { String($0) }.joined(separator: ",")
    }

    var requestKey: String {
        [west, south, east, north]
            .map { String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), $0) }
            .joined(separator: ",")
    }
}
