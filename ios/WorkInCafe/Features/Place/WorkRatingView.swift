import SwiftUI

struct WorkRatingView: View {
    enum LabelStyle {
        case compact
        case full
    }

    let rating: Double?
    let labelStyle: LabelStyle

    @ViewBuilder
    var body: some View {
        if let rating, rating.isFinite, rating > 0, rating <= 10 {
            Label {
                Text(label(for: rating))
                    .monospacedDigit()
            } icon: {
                Image(systemName: "star.fill")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.wicCaution)
            .accessibilityLabel("Work rating \(String(format: "%.1f", rating)) out of 10")
        }
    }

    private func label(for rating: Double) -> String {
        let value = String(format: "%.1f/10", rating)
        return labelStyle == .compact ? value : "\(value) work rating"
    }
}
