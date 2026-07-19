import SwiftUI

struct PlaceResultRow: View {
    let place: PlaceSummary
    let isSelected: Bool

    var body: some View {
        HStack(spacing: WICSpacing.compact) {
            PlaceIdentityBadge(place: place, size: 42)

            VStack(alignment: .leading, spacing: 4) {
                Text(place.name)
                    .font(.headline)
                    .foregroundStyle(.wicPrimaryText)
                    .lineLimit(2)

                Text(supportingText)
                    .font(.subheadline)
                    .foregroundStyle(.wicSecondaryText)
                    .lineLimit(2)
            }

            Spacer(minLength: WICSpacing.small)

            VStack(alignment: .trailing, spacing: 5) {
                WorkRatingView(rating: place.rating, labelStyle: .compact)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.wicTertiaryText)
            }
        }
        .padding(.vertical, 7)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var supportingText: String {
        let location = place.neighborhood.isEmpty ? place.address : place.neighborhood
        return [place.categoryLabel, location]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}
