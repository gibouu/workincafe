import SwiftUI
import UIKit

enum WICSpacing {
    static let small: CGFloat = 8
    static let compact: CGFloat = 12
    static let medium: CGFloat = 16
    static let comfortable: CGFloat = 20
    static let large: CGFloat = 24
    static let minimumControlTarget: CGFloat = 44
}

enum WICRadius {
    static let compact: CGFloat = 8
    static let field: CGFloat = 12
    static let card: CGFloat = 16
    static let surface: CGFloat = 24
    static let dock: CGFloat = 32
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

extension ShapeStyle where Self == Color {
    static var wicAccent: Color { Color(uiColor: .systemBlue) }
    static var wicAccentTint: Color { Color(uiColor: .systemBlue).opacity(0.12) }
    static var wicPositive: Color { Color(uiColor: .systemGreen) }
    static var wicPositiveTint: Color { Color(uiColor: .systemGreen).opacity(0.12) }
    static var wicDestructive: Color { Color(uiColor: .systemRed) }
    static var wicCaution: Color { Color(uiColor: .systemOrange) }
    static var wicPrimaryText: Color { Color(uiColor: .label) }
    static var wicSecondaryText: Color { Color(uiColor: .secondaryLabel) }
    static var wicTertiaryText: Color { Color(uiColor: .tertiaryLabel) }
    static var wicSurface: Color { Color(uiColor: .secondarySystemBackground) }
    static var wicSurfaceBorder: Color { Color(uiColor: .separator).opacity(0.5) }
    static var wicDivider: Color { Color(uiColor: .separator) }
    static var wicMapBackground: Color { Color(hex: 0xF2EDE3) }
    static var wicCafe: Color { Color(hex: 0x6B4F3B) }
}
