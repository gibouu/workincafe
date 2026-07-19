import Foundation

struct PlacePresentation: Hashable, Sendable {
    enum Foreground: Hashable, Sendable {
        case light
        case dark
    }

    let key: String
    let label: String
    let symbolName: String
    let monogram: String?
    let hexColor: UInt32
    let foreground: Foreground

    static func resolve(category: String, brand: String?, name: String) -> Self {
        if let brand, let presentation = brandPresentation(for: brand) {
            return presentation
        }
        if brand?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false,
           let presentation = brandPresentation(for: name) {
            return presentation
        }
        return categoryPresentation(for: category)
    }

    private static let brands: [(aliases: [String], presentation: Self)] = [
        (
            ["starbucks"],
            Self(
                key: "brand.starbucks",
                label: "Starbucks",
                symbolName: "cup.and.saucer.fill",
                monogram: "S",
                hexColor: 0x006241,
                foreground: .light
            )
        ),
        (
            ["tim hortons"],
            Self(
                key: "brand.tim-hortons",
                label: "Tim Hortons",
                symbolName: "cup.and.saucer.fill",
                monogram: "TH",
                hexColor: 0xC8102E,
                foreground: .light
            )
        ),
        (
            ["mcdonalds"],
            Self(
                key: "brand.mcdonalds",
                label: "McDonald's",
                symbolName: "fork.knife",
                monogram: "M",
                hexColor: 0xFFC72C,
                foreground: .dark
            )
        ),
        (
            ["wework"],
            Self(
                key: "brand.wework",
                label: "WeWork",
                symbolName: "briefcase.fill",
                monogram: "WW",
                hexColor: 0x000000,
                foreground: .light
            )
        ),
        (
            ["anticafe"],
            Self(
                key: "brand.anticafe",
                label: "Anticafé",
                symbolName: "cup.and.saucer.fill",
                monogram: "A",
                hexColor: 0xF2994A,
                foreground: .dark
            )
        ),
        (
            ["de mello"],
            Self(
                key: "brand.de-mello",
                label: "De Mello",
                symbolName: "cup.and.saucer.fill",
                monogram: "DM",
                hexColor: 0x6B4F3B,
                foreground: .light
            )
        ),
    ]

    private static func brandPresentation(for value: String) -> Self? {
        let normalizedValue = normalize(value)
        guard !normalizedValue.isEmpty else { return nil }
        let paddedValue = " \(normalizedValue) "

        return brands.first { brand in
            brand.aliases.contains { alias in
                let normalizedAlias = normalize(alias)
                return normalizedValue == normalizedAlias
                    || paddedValue.contains(" \(normalizedAlias) ")
            }
        }?.presentation
    }

    private static func categoryPresentation(for category: String) -> Self {
        switch category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "cafe":
            Self(
                key: "category.cafe",
                label: "Café",
                symbolName: "cup.and.saucer.fill",
                monogram: nil,
                hexColor: 0x6B4F3B,
                foreground: .light
            )
        case "bakery":
            Self(
                key: "category.bakery",
                label: "Bakery",
                symbolName: "birthday.cake.fill",
                monogram: nil,
                hexColor: 0xD4A574,
                foreground: .dark
            )
        case "library":
            Self(
                key: "category.library",
                label: "Library",
                symbolName: "books.vertical.fill",
                monogram: nil,
                hexColor: 0x2C3E50,
                foreground: .light
            )
        case "coworking":
            Self(
                key: "category.coworking",
                label: "Coworking",
                symbolName: "briefcase.fill",
                monogram: nil,
                hexColor: 0x16A085,
                foreground: .dark
            )
        case "hotel":
            Self(
                key: "category.hotel",
                label: "Hotel",
                symbolName: "bed.double.fill",
                monogram: nil,
                hexColor: 0x8E44AD,
                foreground: .light
            )
        case "restaurant":
            Self(
                key: "category.restaurant",
                label: "Restaurant",
                symbolName: "fork.knife",
                monogram: nil,
                hexColor: 0xC0392B,
                foreground: .light
            )
        case "fast_food":
            Self(
                key: "category.fast-food",
                label: "Fast food",
                symbolName: "takeoutbag.and.cup.and.straw.fill",
                monogram: nil,
                hexColor: 0xE67E22,
                foreground: .dark
            )
        case "fast_food_burger":
            Self(
                key: "category.fast-food-burger",
                label: "Fast food (burger)",
                symbolName: "takeoutbag.and.cup.and.straw.fill",
                monogram: nil,
                hexColor: 0xE67E22,
                foreground: .dark
            )
        default:
            Self(
                key: "category.other",
                label: "Other",
                symbolName: "mappin",
                monogram: nil,
                hexColor: 0x5A5A60,
                foreground: .light
            )
        }
    }

    private static func normalize(_ value: String) -> String {
        let folded = value.folding(
            options: [.caseInsensitive, .diacriticInsensitive],
            locale: Locale(identifier: "en_US_POSIX")
        )
        let withoutPunctuation = folded.unicodeScalars.reduce(into: "") { result, scalar in
            if scalar.value == 0x27 || scalar.value == 0x2019 {
                return
            }
            if CharacterSet.punctuationCharacters.contains(scalar) {
                result.append(" ")
            } else {
                result.append(contentsOf: String(scalar))
            }
        }
        return withoutPunctuation
            .split(whereSeparator: \Character.isWhitespace)
            .joined(separator: " ")
    }
}
