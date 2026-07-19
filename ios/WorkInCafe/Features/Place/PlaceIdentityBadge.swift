import SwiftUI

struct PlaceIdentityBadge: View {
    let place: PlaceSummary
    let size: CGFloat

    var body: some View {
        let presentation = place.presentation

        ZStack {
            Circle()
                .fill(Color(hex: presentation.hexColor))
            if let monogram = presentation.monogram {
                Text(monogram)
                    .font(.system(size: size * 0.34, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.65)
                    .lineLimit(1)
                    .padding(size * 0.12)
            } else {
                Image(systemName: presentation.symbolName)
                    .font(.system(size: size * 0.42, weight: .semibold))
            }
        }
        .foregroundStyle(presentation.foreground == .light ? Color.white : Color.black)
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(place.name), \(presentation.label)")
    }
}
