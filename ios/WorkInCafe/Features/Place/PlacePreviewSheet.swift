import SwiftUI

struct PlacePreviewSheet: View {
    let place: PlaceSummary
    let onViewDetails: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WICSpacing.medium) {
                previewHeader
                location
                status
                actions
            }
            .padding(.horizontal, WICSpacing.comfortable)
            .padding(.top, WICSpacing.small)
            .padding(.bottom, WICSpacing.large)
        }
        .scrollIndicators(.hidden)
        .presentationDetents([.height(310), .medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.preview")
    }

    private var previewHeader: some View {
        HStack(alignment: .top, spacing: WICSpacing.compact) {
            PlaceIdentityBadge(place: place, size: 56)

            VStack(alignment: .leading, spacing: 3) {
                Text(place.categoryLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.wicSecondaryText)
                    .textCase(.uppercase)

                Text(place.name)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(.wicPrimaryText)
                    .lineLimit(2)

                WorkRatingView(rating: place.rating, labelStyle: .compact)
                    .accessibilityIdentifier("place.preview.rating")
            }

            Spacer(minLength: 0)

            Button("Close", systemImage: "xmark") {
                dismiss()
            }
            .labelStyle(.iconOnly)
            .font(.body.weight(.semibold))
            .frame(
                width: WICSpacing.minimumControlTarget,
                height: WICSpacing.minimumControlTarget
            )
            .background(.wicSurface, in: Circle())
            .accessibilityIdentifier("place.close")
        }
    }

    @ViewBuilder
    private var location: some View {
        if !place.neighborhood.isEmpty || !place.address.isEmpty {
            HStack(alignment: .top, spacing: WICSpacing.small) {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(.wicAccent)

                VStack(alignment: .leading, spacing: 2) {
                    if !place.neighborhood.isEmpty {
                        Text(place.neighborhood)
                            .font(.subheadline.weight(.semibold))
                    }
                    if !place.address.isEmpty {
                        Text(place.address)
                            .font(.footnote)
                            .foregroundStyle(.wicSecondaryText)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var status: some View {
        if place.isValidated || hasMembership {
            HStack(spacing: WICSpacing.small) {
                if place.isValidated {
                    Label("Validated", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.wicPositive)
                }

                if let membership = nonemptyMembership {
                    Label(membership, systemImage: "person.badge.key.fill")
                        .foregroundStyle(.wicSecondaryText)
                }
            }
            .font(.caption.weight(.semibold))
            .lineLimit(1)
        }
    }

    private var actions: some View {
        VStack(spacing: WICSpacing.small) {
            Button(action: onViewDetails) {
                Label("View work spot", systemImage: "arrow.up.right")
                    .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("place.preview.details")

            HStack(spacing: WICSpacing.small) {
                Button {
                    // Authentication and persistence arrive in a later product slice.
                } label: {
                    Label("Save", systemImage: "bookmark")
                        .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
                }
                .buttonStyle(.bordered)
                .disabled(true)
                .accessibilityHint("Sign in support is coming in the authenticated product slice")
                .accessibilityIdentifier("place.preview.save")

                Button {
                    AppleMapsDirections.open(place: place)
                } label: {
                    Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                        .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
                }
                .buttonStyle(.bordered)
                .accessibilityHint("Opens this destination in Apple Maps")
                .accessibilityIdentifier("place.preview.directions")
            }
        }
        .controlSize(.large)
    }

    private var nonemptyMembership: String? {
        guard let membership = place.membershipRequired?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !membership.isEmpty else { return nil }
        return membership
    }

    private var hasMembership: Bool {
        nonemptyMembership != nil
    }
}
