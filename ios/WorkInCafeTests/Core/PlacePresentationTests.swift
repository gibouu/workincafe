import Testing
@testable import WorkInCafe

@Suite("Place presentation")
struct PlacePresentationTests {
    @Test("all canonical API categories resolve to stable identities")
    func categories() {
        #expect(PlacePresentation.resolve(category: "cafe", brand: nil, name: "Indie").key == "category.cafe")
        #expect(PlacePresentation.resolve(category: "bakery", brand: nil, name: "Bread").symbolName == "birthday.cake.fill")
        #expect(PlacePresentation.resolve(category: "library", brand: nil, name: "Library").hexColor == 0x2C3E50)
        #expect(PlacePresentation.resolve(category: "coworking", brand: nil, name: "Desk").hexColor == 0x16A085)
        #expect(PlacePresentation.resolve(category: "hotel", brand: nil, name: "Hotel").hexColor == 0x8E44AD)
        #expect(PlacePresentation.resolve(category: "restaurant", brand: nil, name: "Food").hexColor == 0xC0392B)
        #expect(PlacePresentation.resolve(category: "fast_food", brand: nil, name: "Fast").hexColor == 0xE67E22)
        #expect(PlacePresentation.resolve(category: "unknown", brand: nil, name: "Other").hexColor == 0x5A5A60)
    }

    @Test("known brand takes precedence over category")
    func knownBrand() {
        let result = PlacePresentation.resolve(category: "cafe", brand: "Starbucks", name: "Starbucks République")
        #expect(result.key == "brand.starbucks")
        #expect(result.monogram == "S")
        #expect(result.hexColor == 0x006241)
    }

    @Test("name fallback recognizes a known brand when the API brand is absent")
    func nameFallback() {
        let result = PlacePresentation.resolve(category: "cafe", brand: nil, name: "Tim Hortons Montmartre")
        #expect(result.key == "brand.tim-hortons")
        #expect(result.monogram == "TH")
    }

    @Test("bakery uses a dark foreground for contrast")
    func bakeryContrast() {
        #expect(PlacePresentation.resolve(category: "bakery", brand: nil, name: "Bread").foreground == .dark)
    }
}
