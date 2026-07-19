import SwiftUI

enum WICSpacing {
    static let small: CGFloat = 8
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let minimumControlTarget: CGFloat = 44
}

extension ShapeStyle where Self == Color {
    static var wicAccent: Color { .blue }
    static var wicCafe: Color { Color(red: 0.42, green: 0.31, blue: 0.23) }
}
